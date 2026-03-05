"""Celery application — broker on Redis, JSON serialization, Beat schedule."""

from celery import Celery
from celery.schedules import crontab

from src.config import settings

app = Celery("nwsmedia")

app.conf.update(
    broker_url=settings.redis_url,
    result_backend=settings.redis_url,
    accept_content=["json"],
    task_serializer="json",
    result_serializer="json",
    timezone="America/New_York",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
    broker_connection_retry_on_startup=True,
    result_expires=86400,
)

app.conf.beat_schedule = {
    "nightly-full-pipeline": {
        "task": "src.tasks.pipeline.run_full_pipeline",
        "schedule": crontab(hour=2, minute=0),
        "kwargs": {"max_per_run": 100, "min_score": 40, "dry_run": True, "parallel_scrapes": 5},
    },
    "daily-summary-email": {
        "task": "src.tasks.summary.send_daily_summary",
        "schedule": crontab(hour=8, minute=0),
    },
}

app.conf.include = [
    "src.tasks.pipeline",
    "src.tasks.summary",
]
