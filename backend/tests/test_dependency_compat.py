"""Runtime compatibility checks that pip's resolver can't see.

These guard combinations the package metadata allows but the libraries refuse
at runtime. They are cheap and need no services: CI installs from a clean
checkout with fresh resolution, so drift fails here before it reaches prod.
"""
from types import SimpleNamespace


def test_kombu_accepts_the_installed_redis_py():
    """kombu 5.7 requires redis-py >= 6.1 but doesn't declare it, so a fresh
    install paired it with redis-py 5 and the Celery worker died on start with
    VersionMismatch. This is the exact check kombu runs when the worker opens
    its first broker channel."""
    from kombu.transport.redis import Channel

    Channel._get_client(SimpleNamespace(global_keyprefix=None))
