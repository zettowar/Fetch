"""Prometheus wiring that survives more than one process.

Two things broke the naive setup:

1. Production runs ``uvicorn --workers 4``. Each worker is a separate process
   with its own in-process registry, so a scrape hit whichever worker the
   kernel happened to route it to and every counter appeared to jump around at
   random. rate() over that is noise, which made the alert rules built on it
   worse than useless — they looked like coverage.

2. Every bulk email (digest, announcements, weekly recap) is sent from a Celery
   process that has no HTTP server at all, so those counters were never scraped
   by anything. The EmailDeliveryFailing alert could not fire for the flows it
   was written for.

Both are solved the standard way: with ``PROMETHEUS_MULTIPROC_DIR`` set,
prometheus_client writes every sample to mmap files in that directory instead
of process memory, and a scrape aggregates across all of them. The web
container and the Celery container each get their own directory (PIDs are
per-container, so sharing one directory between containers would collide) and
Prometheus scrapes them as two targets.
"""
import os

import structlog
from prometheus_client import CollectorRegistry, multiprocess

logger = structlog.stdlib.get_logger()

MULTIPROC_ENV = "PROMETHEUS_MULTIPROC_DIR"


def multiproc_enabled() -> bool:
    return bool(os.environ.get(MULTIPROC_ENV))


# NOTE: the stale-file reset is done by the container command in
# docker-compose.prod.yml (`rm -rf /run/prometheus/*` before exec), not here.
# It has to happen once per container, before any worker imports
# prometheus_client — a Python-side helper called at import time would run once
# per worker and race the others. Anything running this image outside that
# compose file must do the same, or counter files from the previous generation
# are added to the new process's totals.


def build_registry() -> CollectorRegistry:
    """The registry a scrape should read.

    In multiprocess mode this is a fresh registry fed by MultiProcessCollector,
    which merges every process's files at scrape time. Otherwise (dev, tests)
    the default global registry is already complete.
    """
    if not multiproc_enabled():
        from prometheus_client import REGISTRY

        return REGISTRY

    registry = CollectorRegistry()
    multiprocess.MultiProcessCollector(registry)
    return registry
