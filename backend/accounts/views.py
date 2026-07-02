from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .serializers import UserSerializer


@method_decorator(ensure_csrf_cookie, name='get')
class CsrfView(APIView):
    """Отдаёт CSRF-cookie для последующих мутирующих запросов из CRM (SPA + session auth)."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'detail': 'CSRF cookie set'})


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '')
        password = request.data.get('password', '')
        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({'detail': 'Неверный логин или пароль'}, status=400)
        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=204)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ManagerListView(generics.ListAPIView):
    """Список менеджеров — для переназначения ответственного (доступно руководителю)."""

    queryset = User.objects.filter(is_active=True).order_by('first_name', 'username')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
