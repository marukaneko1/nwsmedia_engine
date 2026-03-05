"""Structured logging — console renderer for dev, JSON for production/Celery."""

import logging
import os
import sys

import structlog

_NAME_TO_LEVEL = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL,
}


def setup_logging(level: str = "INFO", json_output: bool | None = None) -> None:
    """Configure structlog.

    Args:
        level: Log level name (DEBUG, INFO, WARNING, ERROR, CRITICAL).
        json_output: If True, use JSON renderer (for production / Celery workers).
                     If None, auto-detect: JSON when LOG_FORMAT=json env var is set
                     or when stdout is not a TTY.
    """
    numeric = _NAME_TO_LEVEL.get(level.upper(), logging.INFO)

    if json_output is None:
        env_format = os.environ.get("LOG_FORMAT", "").lower()
        json_output = env_format == "json" or not sys.stdout.isatty()

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if json_output:
        renderer = structlog.processors.JSONRenderer()
        shared_processors.append(structlog.processors.format_exc_info)
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(numeric),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        level=numeric,
        stream=sys.stdout,
        force=True,
    )


logger = structlog.get_logger()
