from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.serializers import UserSerializer

from .models import KanbanColumn, Task

User = get_user_model()


class KanbanColumnSerializer(serializers.ModelSerializer):
    class Meta:
        model = KanbanColumn
        fields = ['id', 'name', 'order']


class TaskSerializer(serializers.ModelSerializer):
    assignee = UserSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(
        source='assignee', queryset=User.objects.all(), write_only=True, required=False, allow_null=True,
    )
    lead_name = serializers.CharField(source='lead.name', read_only=True, default=None)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'column', 'assignee', 'assignee_id',
            'lead', 'lead_name', 'deadline', 'order', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'order', 'created_at', 'updated_at']


class TaskUpdateSerializer(serializers.ModelSerializer):
    """PATCH: edit task fields, but never column/order directly — use the move action instead."""

    assignee_id = serializers.PrimaryKeyRelatedField(
        source='assignee', queryset=User.objects.all(), write_only=True, required=False, allow_null=True,
    )

    class Meta:
        model = Task
        fields = ['title', 'description', 'assignee_id', 'lead', 'deadline']


class TaskMoveSerializer(serializers.Serializer):
    column = serializers.PrimaryKeyRelatedField(queryset=KanbanColumn.objects.all())
    order = serializers.IntegerField(min_value=0)
