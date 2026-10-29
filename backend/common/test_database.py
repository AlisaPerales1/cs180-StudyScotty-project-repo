from pathlib import Path

from django.test import SimpleTestCase

from config.database import database_config


class DatabaseConfigTests(SimpleTestCase):
    def test_blank_database_url_uses_sqlite_in_backend_directory(self):
        for url in [None, ""]:
            with self.subTest(url=url):
                config = database_config(url, base_dir=Path("/tmp/backend"), debug=True)
                self.assertEqual(config["ENGINE"], "django.db.backends.sqlite3")
                self.assertEqual(config["NAME"], "/tmp/backend/db.sqlite3")
                self.assertEqual(config["CONN_MAX_AGE"], 0)

    def test_postgres_url_parses_credentials_and_ssl(self):
        config = database_config(
            "postgresql://scotty:test-password@db.example:5432/studyscotty?sslmode=require",
            base_dir=Path("/tmp/backend"), debug=False,
        )
        self.assertEqual(config["ENGINE"], "django.db.backends.postgresql")
        self.assertEqual(config["NAME"], "studyscotty")
        self.assertEqual(config["USER"], "scotty")
        self.assertEqual(config["HOST"], "db.example")
        self.assertEqual(config["PORT"], 5432)
        self.assertEqual(config["OPTIONS"]["sslmode"], "require")
        self.assertEqual(config["CONN_MAX_AGE"], 600)
        self.assertTrue(config["CONN_HEALTH_CHECKS"])
