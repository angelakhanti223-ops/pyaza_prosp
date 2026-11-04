"""Narrow read-only API for the Telegram agent.

This endpoint intentionally returns only the local CRM request number, client
name, and today's actionable task titles. Contact details and task descriptions
are not serialized.
"""
import secrets

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from kanban.models import Task

from .models import Lead


class AgentBearerTokenPermission(BasePermission):
    """Authenticate the dedicated agent with a server-side Bearer token."""

    def has_permission(self, request, view):
        expected = getattr(settings, 'AGENT_API_TOKEN', '')
        if not expected:
            return False

        scheme, separator, supplied = request.headers.get('Authorization', '').partition(' ')
        if not separator or scheme.lower() != 'bearer' or not supplied:
            return False

        return secrets.compare_digest(
            supplied.encode('utf-8'),
            expected.encode('utf-8'),
        )


class AgentTodayQueueView(APIView):
    """Return leads with an active task due today or a next contact due today."""

    authentication_classes = []
    permission_classes = [AgentBearerTokenPermission]
    http_method_names = ['get', 'head', 'options']

    def get(self, request):
        today = timezone.localdate()
        closed_task_states = [Task.Status.DONE, Task.Status.CANCELLED]
        today_task_filter = (
            Q(tasks__deadline__date=today, tasks__archived_at__isnull=True)
            & ~Q(tasks__status__in=closed_task_states)
        )
        leads = list(
            Lead.objects.filter(
                Q(next_contact_at__date=today) | today_task_filter,
            )
            .distinct()
            .only('id', 'name', 'next_contact_at')
            .order_by('id')
        )

        if not leads:
            return Response({'date': today.isoformat(), 'items': []})

        lead_ids = [lead.pk for lead in leads]
        task_rows = (
            Task.objects.filter(
                lead_id__in=lead_ids,
                deadline__date=today,
                archived_at__isnull=True,
            )
            .exclude(status__in=closed_task_states)
            .order_by('deadline', 'id')
            .values('id', 'lead_id', 'title', 'deadline')
        )
        tasks_by_lead = {}
        for task in task_rows:
            tasks_by_lead.setdefault(task['lead_id'], []).append({
                'task_id': task['id'],
                'title': task['title'],
                'due_at': task['deadline'].isoformat(),
            })

        items = []
        for lead in leads:
            tasks = tasks_by_lead.get(lead.pk, [])
            if lead.next_contact_at and timezone.localtime(lead.next_contact_at).date() == today:
                tasks.append({
                    'task_id': None,
                    'title': 'Следующий контакт',
                    'due_at': lead.next_contact_at.isoformat(),
                })
            items.append({
                'request_number': lead.pk,
                'client_name': lead.name,
                'tasks': tasks,
            })

        return Response({'date': today.isoformat(), 'items': items})
