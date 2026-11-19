import logging

logger = logging.getLogger(__name__)


def publish_activity(kind: str, message: str) -> None:
    """Hand a message to Celery, which publishes it on RabbitMQ.

    The HTTP request must still succeed when the broker is down: the row is
    already committed, and the feed is only a learning signal.
    """

    try:
        from app.workers.tasks import record_activity

        record_activity.delay(kind, message)
    except Exception:
        logger.exception("Could not publish %s activity to RabbitMQ", kind)
