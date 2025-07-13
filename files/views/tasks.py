from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..methods import list_tasks


class TasksList(APIView):
    """List tasks"""

    swagger_schema = None

    permission_classes = (permissions.IsAdminUser,)

    def get(self, request, format=None):
        ret = list_tasks()
        return Response(ret)


class TaskDetail(APIView):
    """Cancel a task"""

    swagger_schema = None

    permission_classes = (permissions.IsAdminUser,)

    def delete(self, request, uid, format=None):
        # This is not imported!
        # revoke(uid, terminate=True)
        return Response(status=status.HTTP_204_NO_CONTENT)
