from celery import shared_task


@shared_task
def send_due_task_pushes():
    from .push import dispatch_due_pushes
    return dispatch_due_pushes()
