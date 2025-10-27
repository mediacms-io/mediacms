from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.mail import EmailMessage
from django.db.models import Q
from django.http import HttpResponseRedirect
from django.shortcuts import render
from drf_yasg import openapi as openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import generics, permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import (
    FileUploadParser,
    FormParser,
    JSONParser,
    MultiPartParser,
)
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView

from cms.permissions import IsUserOrManager
from files.methods import is_mediacms_editor, is_mediacms_manager

from .forms import ChannelForm, UserForm
from .models import Channel, User
from .serializers import LoginSerializer, UserDetailSerializer, UserSerializer


def get_user(username):
    try:
        user = User.objects.get(username=username)
        return user
    except User.DoesNotExist:
        return None


def view_user(request, username):
    context = {}
    user = get_user(username=username)
    if not user:
        return HttpResponseRedirect("/members")
    context["user"] = user
    context["CAN_EDIT"] = True if ((user and user == request.user) or is_mediacms_manager(request.user)) else False
    context["CAN_DELETE"] = True if is_mediacms_manager(request.user) else False
    context["SHOW_CONTACT_FORM"] = True if (user.allow_contact or is_mediacms_editor(request.user)) else False
    return render(request, "cms/user.html", context)


def shared_with_me(request, username):
    context = {}
    user = get_user(username=username)
    if not user or (user != request.user):
        return HttpResponseRedirect("/")

    context["user"] = user
    context["CAN_EDIT"] = True
    context["CAN_DELETE"] = True
    return render(request, "cms/user_shared_with_me.html", context)


def shared_by_me(request, username):
    context = {}
    user = get_user(username=username)
    if not user or (user != request.user):
        return HttpResponseRedirect("/")

    context["user"] = user
    context["CAN_EDIT"] = True
    context["CAN_DELETE"] = True
    return render(request, "cms/user_shared_by_me.html", context)


def view_user_playlists(request, username):
    context = {}
    user = get_user(username=username)
    if not user:
        return HttpResponseRedirect("/members")

    context["user"] = user
    context["CAN_EDIT"] = True if ((user and user == request.user) or is_mediacms_manager(request.user)) else False
    context["CAN_DELETE"] = True if is_mediacms_manager(request.user) else False
    context["SHOW_CONTACT_FORM"] = True if (user.allow_contact or is_mediacms_editor(request.user)) else False

    return render(request, "cms/user_playlists.html", context)


def view_user_about(request, username):
    context = {}
    user = get_user(username=username)
    if not user:
        return HttpResponseRedirect("/members")

    context["user"] = user
    context["CAN_EDIT"] = True if ((user and user == request.user) or is_mediacms_manager(request.user)) else False
    context["CAN_DELETE"] = True if is_mediacms_manager(request.user) else False
    context["SHOW_CONTACT_FORM"] = True if (user.allow_contact or is_mediacms_editor(request.user)) else False

    return render(request, "cms/user_about.html", context)


@login_required
def edit_user(request, username):
    context = {}
    user = get_user(username=username)
    if not user or (user != request.user and not is_mediacms_manager(request.user)):
        return HttpResponseRedirect("/")

    if request.method == "POST":
        form = UserForm(request.user, request.POST, request.FILES, instance=user)
        if form.is_valid():
            user = form.save(commit=False)
            user.save()
            return HttpResponseRedirect(user.get_absolute_url())
    else:
        form = UserForm(request.user, instance=user)
    context["form"] = form
    context["user"] = user
    if user == request.user:
        context["is_author"] = True
    else:
        context["is_author"] = False
    return render(request, "cms/user_edit.html", context)


def view_channel(request, friendly_token):
    context = {}
    channel = Channel.objects.filter(friendly_token=friendly_token).first()
    if not channel:
        user = None
    else:
        user = channel.user
    context["user"] = user
    context["CAN_EDIT"] = True if ((user and user == request.user) or is_mediacms_manager(request.user)) else False
    return render(request, "cms/channel.html", context)


@login_required
def edit_channel(request, friendly_token):
    channel = Channel.objects.filter(friendly_token=friendly_token).first()
    if not (channel and request.user.is_authenticated and (request.user == channel.user)):
        return HttpResponseRedirect("/")

    if request.method == "POST":
        form = ChannelForm(request.POST, request.FILES, instance=channel)
        if form.is_valid():
            channel = form.save(commit=False)
            channel.save()
            return HttpResponseRedirect(request.user.get_absolute_url())
    else:
        form = ChannelForm(instance=channel)
    return render(request, "cms/channel_edit.html", {"form": form})


@swagger_auto_schema(
    methods=['post'],
    manual_parameters=[],
    tags=['Users'],
    operation_summary='Contact user',
    operation_description='Contact user through email, if user has set this option',
)
@api_view(["POST"])
def contact_user(request, username):
    if not request.user.is_authenticated:
        return Response(
            {"detail": "request need be authenticated"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    user = User.objects.filter(username=username).first()
    if user and (user.allow_contact or is_mediacms_editor(request.user)):
        from_email = request.user.email
        subject = f"[{settings.PORTAL_NAME}] - Message from {from_email}"
        body = request.data.get("body")
        body = """
You have received a message through the contact form\n
Sender name: %s
Sender email: %s\n
\n %s
""" % (
            request.user.name,
            from_email,
            body,
        )
        email = EmailMessage(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            reply_to=[from_email],
        )
        email.send(fail_silently=True)

    return Response(status=status.HTTP_204_NO_CONTENT)


class UserList(APIView):
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def get_permissions(self):
        if not settings.ALLOW_ANONYMOUS_USER_LISTING:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticatedOrReadOnly()]

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name='page', type=openapi.TYPE_INTEGER, in_=openapi.IN_QUERY, description='Page number'),
            openapi.Parameter(name='name', type=openapi.TYPE_STRING, in_=openapi.IN_QUERY, description='Search by name, username, and optionally email (depending on USER_SEARCH_FIELD setting)'),
            openapi.Parameter(name='exclude_self', type=openapi.TYPE_BOOLEAN, in_=openapi.IN_QUERY, description='Exclude current user from results'),
        ],
        tags=['Users'],
        operation_summary='List users',
        operation_description='Paginated listing of users',
    )
    def get(self, request, format=None):
        if settings.CAN_SEE_MEMBERS_PAGE == "editors" and not is_mediacms_editor(request.user):
            raise PermissionDenied("You do not have permission to view this page.")

        if settings.CAN_SEE_MEMBERS_PAGE == "admins" and not request.user.is_superuser:
            raise PermissionDenied("You do not have permission to view this page.")

        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
        paginator = pagination_class()
        users = User.objects.filter()

        name = request.GET.get("name", "").strip()
        if name:
            if settings.USER_SEARCH_FIELD == "name_username_email":
                users = users.filter(Q(name__icontains=name) | Q(username__icontains=name) | Q(email__icontains=name))
            else:  # default: name_username
                users = users.filter(Q(name__icontains=name) | Q(username__icontains=name))

        # Exclude current user if requested
        exclude_self = request.GET.get("exclude_self", "") == "True"
        if exclude_self and request.user.is_authenticated:
            users = users.exclude(id=request.user.id)

        if settings.USERS_NEEDS_TO_BE_APPROVED:
            is_approved = request.GET.get("is_approved")
            if is_approved == "true":
                users = users.filter(is_approved=True)
            elif is_approved == "false":
                users = users.filter(Q(is_approved=False) | Q(is_approved__isnull=True))

        page = paginator.paginate_queryset(users, request)

        serializer = UserSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    @swagger_auto_schema(
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=["username", "password", "email", "name"],
            properties={
                "username": openapi.Schema(type=openapi.TYPE_STRING),
                "password": openapi.Schema(type=openapi.TYPE_STRING),
                "email": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_EMAIL),
                "name": openapi.Schema(type=openapi.TYPE_STRING),
            },
        ),
        tags=["Users"],
        operation_summary="Create user",
        operation_description="Create a new user. Only for managers.",
        responses={201: UserSerializer},
    )
    def post(self, request, format=None):
        if not is_mediacms_manager(request.user):
            raise PermissionDenied("You do not have permission to create users.")

        username = request.data.get("username")
        password = request.data.get("password")
        email = request.data.get("email")
        name = request.data.get("name")

        if not all([username, password, email, name]):
            return Response({"detail": "username, password, email, and name are required."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"detail": "A user with that username already exists."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({"detail": "A user with that email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, password=password, email=email, name=name)

        serializer = UserSerializer(user, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class UserDetail(APIView):
    """"""

    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsUserOrManager)
    parser_classes = (MultiPartParser, FormParser, FileUploadParser)

    def get_user(self, username):
        try:
            user = User.objects.get(username=username)
            # this need be explicitly called, and will call
            # has_object_permission() after has_permission has succeeded
            self.check_object_permissions(self.request, user)
            return user
        except PermissionDenied:
            return Response({"detail": "not enough permissions"}, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            return Response({"detail": "user does not exist"}, status=status.HTTP_400_BAD_REQUEST)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name='username', type=openapi.TYPE_STRING, in_=openapi.IN_PATH, description='username', required=True),
        ],
        tags=['Users'],
        operation_summary='List user details',
        operation_description='Get user details',
    )
    def get(self, request, username, format=None):
        # Get user details
        user = self.get_user(username)
        if isinstance(user, Response):
            return user

        serializer = UserDetailSerializer(user, context={"request": request})
        return Response(serializer.data)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name="logo", in_=openapi.IN_FORM, type=openapi.TYPE_FILE, required=True, description="logo"),
            openapi.Parameter(name="description", in_=openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description="description"),
            openapi.Parameter(name="name", in_=openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description="name"),
            openapi.Parameter(name='username', type=openapi.TYPE_STRING, in_=openapi.IN_PATH, description='username', required=True),
        ],
        tags=['Users'],
        operation_summary='Edit user details',
        operation_description='Post user details - authenticated view',
        responses={201: openapi.Response('response description', UserDetailSerializer), 400: 'bad request'},
    )
    def post(self, request, username, format=None):
        # USER
        user = self.get_user(username)
        if isinstance(user, Response):
            return user

        serializer = UserDetailSerializer(user, data=request.data, context={"request": request})
        if serializer.is_valid():
            logo = request.data.get("logo")
            if logo:
                serializer.save(logo=logo)
            else:
                serializer.save()

            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name='action', in_=openapi.IN_FORM, type=openapi.TYPE_STRING, required=True, description="action to perform ('change_password' or 'approve_user' or 'disapprove_user')"),
            openapi.Parameter(name='password', in_=openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description="new password (if action is 'change_password')"),
        ],
        tags=['Users'],
        operation_summary='Update user details',
        operation_description='Allows a user to change their password. Allows a manager to approve a user.',
    )
    def put(self, request, username, format=None):
        user = self.get_user(username)
        if isinstance(user, Response):
            return user

        action = request.data.get("action")

        if action == "change_password":
            # Permission to edit user is already checked by self.get_user -> self.check_object_permissions
            password = request.data.get("password")
            if not password:
                return Response({"detail": "Password is required"}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(password)
            user.save()

        elif action == "approve_user":
            if not is_mediacms_manager(request.user):
                raise PermissionDenied("You do not have permission to approve users.")
            user.is_approved = True
            user.save()
        elif action == "disapprove_user":
            if not is_mediacms_manager(request.user):
                raise PermissionDenied("You do not have permission to approve users.")
            user.is_approved = False
            user.save()
        else:
            return Response({"detail": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = UserDetailSerializer(user, context={"request": request})
        return Response(serializer.data)

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Users'],
        operation_summary='to_be_written',
        operation_description='to_be_written',
    )
    def delete(self, request, username, format=None):
        # Delete a user
        user = self.get_user(username)
        if isinstance(user, Response):
            return user

        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserWhoami(generics.RetrieveAPIView):
    parser_classes = (JSONParser, FormParser, MultiPartParser)
    queryset = User.objects.all()
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserDetailSerializer

    def get_object(self):
        return User.objects.get(id=self.request.user.id)

    @swagger_auto_schema(
        tags=['Users'],
        operation_summary='Whoami user information',
        operation_description='Whoami user information',
        responses={200: openapi.Response('response description', UserDetailSerializer), 403: 'Forbidden'},
    )
    def get(self, request, *args, **kwargs):
        return super(UserWhoami, self).get(request, *args, **kwargs)


class UserToken(APIView):
    parser_classes = (JSONParser,)
    permission_classes = (permissions.IsAuthenticated,)

    @swagger_auto_schema(
        tags=['Users'],
        operation_summary='Get a user token',
        operation_description="Returns an authenticated user's token",
        responses={200: 'token', 403: 'Forbidden'},
    )
    def get(self, request, *args, **kwargs):
        token = Token.objects.filter(user=request.user).first()
        if not token:
            token = Token.objects.create(user=request.user)

        return Response({'token': str(token)}, status=200)


class LoginView(APIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = LoginSerializer
    parser_classes = (MultiPartParser, FormParser, FileUploadParser)

    @swagger_auto_schema(
        tags=['Users'],
        operation_summary='Login url',
        operation_description="Login url endpoint. According to what the portal provides, you may provide username and/or email, plus the password",
        manual_parameters=[
            openapi.Parameter(name="username", in_=openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description="username"),
            openapi.Parameter(name="email", in_=openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description="email"),
            openapi.Parameter(name="password", in_=openapi.IN_FORM, type=openapi.TYPE_STRING, required=True, description="password"),
        ],
        responses={200: openapi.Response('user details', LoginSerializer), 404: 'Bad request'},
    )
    def post(self, request):
        data = request.data

        serializer = self.serializer_class(data=data)
        serializer.is_valid(raise_exception=True)

        return Response(serializer.data, status=status.HTTP_200_OK)
