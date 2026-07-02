from rest_framework import serializers

from .models import User
from .permissions import is_head


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    is_head = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'role', 'is_head']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_is_head(self, obj):
        return is_head(obj)
