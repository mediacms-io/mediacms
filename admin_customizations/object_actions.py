"""Expose ModelAdmin bulk actions on the single-object change form."""

from django.contrib import messages
from django.contrib.admin import ModelAdmin
from django.contrib.admin.utils import unquote
from django.core.exceptions import PermissionDenied
from django.http import Http404, HttpResponseNotAllowed
from django.shortcuts import redirect
from django.urls import path, reverse

from admin_customizations.action_choices import object_action_select_choices
from files.frontend_translations import translate_string

CHANGE_FORM_TEMPLATE = "admin/change_form_with_object_actions.html"
EXCLUDED_ACTIONS = frozenset({"delete_selected"})


def object_action_choices_for_request(model_admin, request):
    """Return grouped (value, label, disabled) choices for the change-form Actions select."""
    return object_action_select_choices(
        model_admin.get_actions(request),
        getattr(model_admin, "action_groups", None),
        exclude=EXCLUDED_ACTIONS,
        opts=model_admin.opts,
        language_code=getattr(request, "LANGUAGE_CODE", None),
    )


def object_actions_for_request(model_admin, request):
    """Return change-form Actions dropdown entries from get_actions() (flat list)."""
    actions = []
    for name, (_func, _name, description) in model_admin.get_actions(request).items():
        if name in EXCLUDED_ACTIONS:
            continue
        actions.append({"name": name, "description": description})
    return actions


def object_action_view(model_admin, request, object_id):
    """Run a bulk action against a single object from the change form."""
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    obj = model_admin.get_object(request, unquote(object_id))
    if obj is None:
        raise Http404

    if not model_admin.has_change_permission(request, obj):
        raise PermissionDenied

    action_name = request.POST.get("action")
    actions = model_admin.get_actions(request)
    if not action_name or action_name in EXCLUDED_ACTIONS or action_name not in actions:
        messages.error(
            request,
            translate_string(getattr(request, "LANGUAGE_CODE", "en"), "Unknown or unavailable action."),
        )
        return redirect(_change_url(model_admin, obj))

    func, _name, _description = actions[action_name]
    queryset = model_admin.model.objects.filter(pk=obj.pk)
    response = func(model_admin, request, queryset)
    if response:
        return response
    return redirect(_change_url(model_admin, obj))


def _change_url(model_admin, obj):
    opts = model_admin.model._meta
    return reverse(f"admin:{opts.app_label}_{opts.model_name}_change", args=[obj.pk])


def _object_action_url(model_admin, obj):
    opts = model_admin.model._meta
    return reverse(f"admin:{opts.app_label}_{opts.model_name}_object_action", args=[obj.pk])


def patch_model_admin_object_actions():
    """Monkeypatch ModelAdmin so every change form can run bulk actions."""
    if getattr(ModelAdmin, "_mediacms_object_actions_patched", False):
        return

    original_get_urls = ModelAdmin.get_urls
    original_render_change_form = ModelAdmin.render_change_form

    def get_urls(self):
        opts = self.model._meta
        custom = [
            path(
                "<path:object_id>/object-action/",
                self.admin_site.admin_view(lambda request, object_id, model_admin=self: object_action_view(model_admin, request, object_id)),
                name=f"{opts.app_label}_{opts.model_name}_object_action",
            ),
        ]
        return custom + original_get_urls(self)

    def render_change_form(self, request, context, add=False, change=False, form_url="", obj=None):
        if change and obj is not None:
            object_action_choices = object_action_choices_for_request(self, request)
            # Drop placeholder-only lists so models with no actions stay clean.
            has_real_actions = any(value for value, _label, _disabled in object_action_choices)
            context["object_action_choices"] = object_action_choices if has_real_actions else []
            context["object_actions"] = object_actions_for_request(self, request)
            if has_real_actions:
                context["object_action_url"] = _object_action_url(self, obj)
        return original_render_change_form(self, request, context, add=add, change=change, form_url=form_url, obj=obj)

    ModelAdmin.get_urls = get_urls
    ModelAdmin.render_change_form = render_change_form
    if ModelAdmin.change_form_template is None:
        ModelAdmin.change_form_template = CHANGE_FORM_TEMPLATE
    ModelAdmin._mediacms_object_actions_patched = True
