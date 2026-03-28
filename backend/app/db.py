from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


def _create_engine():
    # For TiDB/MySQL: use SQLAlchemy's normal MySQL dialect.
    # For local dev, sqlite URL is also supported by default settings.
    connect_args = {}
    if settings.database_url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
    else:
        # TiDB/MySQL connection timeout
        connect_args = {"connect_timeout": 10}

    return create_engine(settings.database_url, pool_pre_ping=True, connect_args=connect_args)


engine = _create_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)


def init_db() -> None:
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)

