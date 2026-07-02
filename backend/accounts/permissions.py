def is_head(user):
    """Руководитель/администратор видит все заявки и может переназначать ответственного (ТЗ 5.3)."""
    return user.is_superuser or user.role == user.Role.HEAD
