from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.urls import reverse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from files.models import Category, Media
from users.models import User

from .models import MigrationRecord, MigrationService
from .providers import get_provider, get_provider_class
from .serializers import MigrationRecordSerializer, MigrationServiceSerializer
from .tasks import abort_migration, pause_migration, restart_migration, start_migration

LOG_TAIL_LINES = 50
LOG_LINE_MAX = 500


class IsSuperUser(permissions.BasePermission):
    """Migrations create users, categories and media in bulk. Admins only."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class MigrationServiceViewSet(viewsets.ModelViewSet):
    queryset = MigrationService.objects.all()
    serializer_class = MigrationServiceSerializer
    permission_classes = (IsSuperUser,)

    @action(detail=False, methods=["post"], url_path="check_connection")
    def check_unsaved_connection(self, request):
        """Validate credentials typed into the form before anything is saved"""
        provider_name = request.data.get("provider") or "kaltura"
        connection = request.data.get("connection") or {}
        # the options are part of what is being tested: they decide what the source is
        # asked for, so a check that ignored them would report on the whole portal
        options = request.data.get("options") or {}
        try:
            klass = get_provider_class(provider_name)
        except ValueError as exc:
            return Response({"ok": False, "error": str(exc), "stats": {}})
        return Response(self._check(klass(connection, options)))

    @action(detail=True, methods=["post"], url_path="check_connection")
    def check_connection(self, request, pk=None):
        """Test the stored credentials, against the options currently on screen.

        Used when the secret on the form is still masked. The options are taken from
        the request when sent, so edits that have not been saved are still what gets
        tested, and only the credentials come from the record.
        """
        service = self.get_object()
        options = dict(service.get_options())
        options.update(request.data.get("options") or {})
        klass = get_provider_class(service.provider)
        return Response(self._check(klass(service.get_connection(), options)))

    @staticmethod
    def _check(provider):
        try:
            return provider.check_connection()
        except NotImplementedError as exc:
            return {"ok": False, "error": str(exc), "stats": {}}
        except Exception as exc:  # noqa: BLE001 - the button must always answer
            return {"ok": False, "error": f"{type(exc).__name__}: {exc}", "stats": {}}

    def _transition(self, function):
        service = self.get_object()
        try:
            function(service)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        service.refresh_from_db()
        return Response(MigrationServiceSerializer(service).data)

    @action(detail=False, methods=["post"], url_path="source_categories")
    def unsaved_source_categories(self, request):
        """Categories to choose from, for the picker on an unsaved migration"""
        provider_name = request.data.get("provider") or "kaltura"
        connection = request.data.get("connection") or {}
        try:
            klass = get_provider_class(provider_name)
        except ValueError as exc:
            return Response({"ok": False, "error": str(exc), "categories": []})
        return Response(self._categories(klass(connection, {})))

    @action(detail=True, methods=["post"], url_path="source_categories")
    def source_categories(self, request, pk=None):
        """Same, for a saved migration, using its stored credentials"""
        return Response(self._categories(get_provider(self.get_object())))

    @staticmethod
    def _categories(provider):
        try:
            return {"ok": True, "error": "", "categories": provider.list_categories()}
        except NotImplementedError as exc:
            return {"ok": False, "error": str(exc), "categories": []}
        except Exception as exc:  # noqa: BLE001 - the button must always answer
            return {"ok": False, "error": f"{type(exc).__name__}: {exc}", "categories": []}

    @action(detail=False, methods=["post"], url_path="source_roles")
    def unsaved_source_roles(self, request):
        """Roles defined on the source, for the role mapping tab of an unsaved migration"""
        provider_name = request.data.get("provider") or "kaltura"
        connection = request.data.get("connection") or {}
        try:
            klass = get_provider_class(provider_name)
        except ValueError as exc:
            return Response({"ok": False, "error": str(exc), "roles": []})
        return Response(self._roles(klass(connection, {})))

    @action(detail=True, methods=["post"], url_path="source_roles")
    def source_roles(self, request, pk=None):
        """Same, for a saved migration, using its stored credentials"""
        return Response(self._roles(get_provider(self.get_object())))

    @staticmethod
    def _roles(provider):
        try:
            return {"ok": True, "error": "", "roles": provider.list_roles()}
        except NotImplementedError as exc:
            return {"ok": False, "error": str(exc), "roles": []}
        except Exception as exc:  # noqa: BLE001 - the button must always answer
            return {"ok": False, "error": f"{type(exc).__name__}: {exc}", "roles": []}

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        return self._transition(start_migration)

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        return self._transition(start_migration)

    @action(detail=True, methods=["post"])
    def rerun(self, request, pk=None):
        return self._transition(restart_migration)

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        return self._transition(pause_migration)

    @action(detail=True, methods=["post"])
    def abort(self, request, pk=None):
        return self._transition(abort_migration)

    @action(detail=True, methods=["get"])
    def records(self, request, pk=None):
        service = self.get_object()
        records = MigrationRecord.objects.filter(service=service)
        object_type = request.query_params.get("object_type")
        if object_type:
            records = records.filter(object_type=object_type)
        record_status = request.query_params.get("status")
        if record_status:
            records = records.filter(status=record_status)

        search = (request.query_params.get("search") or "").strip()
        if search:
            records = records.filter(self.record_search_filter(search))

        page = self.paginate_queryset(records)
        serializer = MigrationRecordSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @staticmethod
    def record_search_filter(search):
        """Match a mapping row by anything an admin can see in the table.

        The label the table shows for the MediaCMS side lives on the imported
        object rather than on the row, so each type is matched through its own
        subquery instead of a join this generic pointer cannot express.
        """
        matches = Q(source_id__icontains=search) | Q(log__icontains=search)
        matches |= Q(
            object_type="media",
            target_id__in=Media.objects.filter(Q(title__icontains=search) | Q(friendly_token__icontains=search)).values("id"),
        )
        matches |= Q(
            object_type="user",
            target_id__in=User.objects.filter(Q(username__icontains=search) | Q(email__icontains=search)).values("id"),
        )
        matches |= Q(
            object_type="category",
            target_id__in=Category.objects.filter(title__icontains=search).values("id"),
        )
        return matches

    @action(detail=True, methods=["get"])
    def progress(self, request, pk=None):
        """Small payload for the dashboard's poll. Never includes credentials."""
        service = self.get_object()
        log_lines = [line[:LOG_LINE_MAX] for line in (service.log or "").strip().split("\n")]
        return Response(
            {
                "id": service.pk,
                "status": service.status,
                "totals": service.counted_totals(),
                "cursor_phase": (service.cursor or {}).get("phase") or "",
                "started_at": service.started_at,
                "ended_at": service.ended_at,
                "last_activity": service.last_activity,
                "log": log_lines[-LOG_TAIL_LINES:],
            }
        )


@login_required
def migrations_list(request):
    """Migrations listing page"""
    if not request.user.is_superuser:
        return HttpResponseRedirect("/")
    return render(request, "cms/migrations.html", {})


@login_required
def migration_new(request):
    """Source selection page, the first step of creating a migration"""
    if not request.user.is_superuser:
        return HttpResponseRedirect("/")
    return render(request, "cms/migration_new.html", {})


@login_required
def migration_edit(request, pk=None, source=None):
    """Migration create and settings page, one URL per source"""
    if not request.user.is_superuser:
        return HttpResponseRedirect("/")
    if source is not None:
        try:
            get_provider_class(source)
        except ValueError:
            # an address for a source that does not exist: send them back to pick one
            return HttpResponseRedirect(reverse("migration_new"))
    return render(request, "cms/migration_edit.html", {})


@login_required
def migration_detail(request, pk):
    """Running migration dashboard"""
    if not request.user.is_superuser:
        return HttpResponseRedirect("/")
    return render(request, "cms/migration_detail.html", {"migration_id": pk})
