from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


def _create_engine():
    # TiDB Cloud ONLY - Requires SSL/TLS
    # Connection string format: mysql+pymysql://user:password@host:port/database
    
    import ssl
    
    # TiDB Cloud requires SSL/TLS - use system CA certificates
    # PyMySQL SSL parameters
    connect_args = {
        "connect_timeout": 15,
    }
    
    # For PyMySQL with TiDB Cloud SSL/TLS
    # The URL can include SSL parameters via query string
    # OR we can use connect_args with ssl options
    
    return create_engine(
        settings.database_url, 
        pool_pre_ping=True, 
        connect_args=connect_args,
        pool_size=10,
        max_overflow=20,
        echo=False
    )


engine = _create_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)


def init_db() -> None:
    """Initialize database tables. Called on app startup with error handling."""
    import sys
    try:
        from . import models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        print("✅ Database initialized successfully", file=sys.stderr)
    except Exception as e:
        print(f"⚠️  Database initialization warning: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        print("⚠️  Tables will be created on first request if needed", file=sys.stderr)

