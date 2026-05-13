from drf_yasg.utils import swagger_auto_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import EncodeProfile
from ..serializers import EncodeProfileSerializer


class EncodeProfileList(APIView):
    """List encode profiles"""

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Encoding Profiles'],
        operation_summary='List Encoding Profiles',
        operation_description='Lists all encoding profiles for videos',
        responses={200: EncodeProfileSerializer(many=True)},
    )
    def get(self, request, format=None):
        profiles = EncodeProfile.objects.all()
        serializer = EncodeProfileSerializer(profiles, many=True, context={"request": request})
        return Response(serializer.data)
