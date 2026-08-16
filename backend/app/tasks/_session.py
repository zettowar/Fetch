"""Database sessions that survive being used inside a Celery task.

The trap, which cost this codebase its core feature for an unknown length of
time: a Celery task body runs under ``asyncio.run()``, which creates a **new
event loop every invocation**. The app's shared ``async_session`` is backed by a
*pooled* engine, and a pooled asyncpg connection is bound to the loop that
opened it. So the first task to run in a worker process succeeds, checks its
connection back into the pool, and every task after it in that same process
picks up a connection belonging to a loop that no longer exists and dies with::

    sqlalchemy.exc.InterfaceError: (asyncpg.InterfaceError)
    cannot perform operation: another operation is in progress

It fails per worker *process*, not per task, which is why it hid so well: with N
prefork workers you see N successes and then permanent failure, and a task that
runs rarely can look fine for days. On a production stack
``pick_current_winner_task`` — the Top Dog / Top Cat computation, the entire
premise of the app — failed 4 out of 4 while ``purge_refresh_tokens_task``
succeeded once on a fresh process and failed immediately afterwards on a used
one.

The fix is to give every task its own engine with ``NullPool``, so nothing is
ever reused across loops, and to dispose it when the task ends so connections
are not leaked. That is what this context manager does, and it is the only way
a task should reach the database.
"""
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings


@asynccontextmanager
async def task_session(session_factory=None):
    """Yield an ``AsyncSession`` that is safe inside ``asyncio.run()``.

    ``session_factory`` is injectable so tests can point the task at their own
    database without monkeypatching the engine; when it is supplied this does
    not create or dispose anything.
    """
    if session_factory is not None:
        async with session_factory() as session:
            yield session
        return

    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    try:
        factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        async with factory() as session:
            yield session
    finally:
        # Without this the task leaks a connection per run; NullPool means the
        # engine holds none itself, but disposing is still what closes the
        # checked-out one deterministically rather than at GC time.
        await engine.dispose()
