from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SiteImages
from .serializers import SiteImagesSerializer


class SiteImagesView(APIView):
    """Управляемые изображения публичного сайта — редактируются в Django admin."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(SiteImagesSerializer(SiteImages.load(), context={'request': request}).data)
