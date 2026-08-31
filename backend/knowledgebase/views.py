from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import KnowledgeArticle
from .serializers import KnowledgeArticleDetailSerializer, KnowledgeArticleListSerializer


class KnowledgeArticleViewSet(viewsets.ModelViewSet):
    """База знаний CRM — читают и правят все залогиненные сотрудники, без
    разделения по ролям (общий, коллективно поддерживаемый справочник)."""

    queryset = KnowledgeArticle.objects.select_related('direction', 'author')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return KnowledgeArticleListSerializer
        return KnowledgeArticleDetailSerializer
