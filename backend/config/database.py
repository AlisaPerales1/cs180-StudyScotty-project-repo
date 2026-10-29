"""Database configuration shared by local SQLite and hosted PostgreSQL."""

import dj_database_url


def database_config(database_url, *, base_dir, debug):
    return dj_database_url.parse(
        database_url or f"sqlite:///{base_dir / 'db.sqlite3'}",
        conn_max_age=0 if debug else 600,
        conn_health_checks=True,
    )
