from rest_framework import serializers

from accounts.serializers import UserSerializer

from .models import KnowledgeArticle


class KnowledgeArticleListSerializer(serializers.ModelSerializer):
    direction_name = serializers.CharField(source='direction.name', read_only=True, default=None)
    author = UserSerializer(read_only=True)

    class Meta:
        model = KnowledgeArticle
        fields = ['id', 'title', 'direction', 'direction_name', 'author', 'updated_at']


class KnowledgeArticleDetailSerializer(serializers.ModelSerializer):
    direction_name = serializers.CharField(source='direction.name', read_only=True, default=None)
    author = UserSerializer(read_only=True)

    class Meta:
        model = KnowledgeArticle
        fields = ['id', 'title', 'direction', 'direction_name', 'content', 'author', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)
