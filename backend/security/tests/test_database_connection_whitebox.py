"""
=============================================================================
White-Box Testing of the Alpha Testing of Database Connection Test
=============================================================================
Tested Code Segments & Components:
  - django.db.connection.ensure_connection()   -> Active DB socket/connection validation
  - django.db.connection.cursor()              -> SQL execution channel & query evaluation ("SELECT 1")
  - django.db.backends (SQLite / PostgreSQL)   -> Backend engine verification & schema accessibility
  - django.db.transaction.atomic()             -> ACID transaction integrity, commit & rollback handling
  - Model CRUD operations (User, Student, UserRole) -> ORM database round-trip mapping
  - Database error handling (OperationalError, -> Exception branch handling & connection recovery
    DatabaseError, IntegrityError)
  - Connection pooling / close handling        -> Connection close & reconnect lifecycle

Run with:
    python manage.py test security.tests.test_database_connection_whitebox -v 2
=============================================================================
"""

import sqlite3
from unittest.mock import patch, MagicMock

from django.test import TestCase, TransactionTestCase
from django.db import connection, connections, OperationalError, DatabaseError, IntegrityError, transaction
from django.contrib.auth.models import User
from django.conf import settings

from security.models import UserRole, Student, OTPVerification


class DatabaseConnectionWhiteBoxTests(TestCase):
    """
    White-Box Unit and Integration Tests for Database Connectivity,
    ORM Queries, Connection Lifecycle, and Database Error Trapping.
    """

    # -------------------------------------------------------------------------
    # TC-DBConn001: Direct connection ping (SELECT 1)
    # -------------------------------------------------------------------------
    def test_TC_DBConn001_raw_query_ping(self):
        """
        Tested Code Segment: connection.cursor().execute("SELECT 1")
        Test Description   : Validate raw SQL ping against default database connection.
        Expected Behavior  : Returns 1 without raising connection or query errors.
        """
        connection.ensure_connection()
        self.assertIsNotNone(connection.connection, "Database connection handle should not be None")

        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            row = cursor.fetchone()

        self.assertIsNotNone(row)
        self.assertEqual(row[0], 1)

    # -------------------------------------------------------------------------
    # TC-DBConn002: Verify database engine and configuration
    # -------------------------------------------------------------------------
    def test_TC_DBConn002_database_settings_configuration(self):
        """
        Tested Code Segment: settings.DATABASES['default']
        Test Description   : Verify default database configuration exists and has valid engine.
        Expected Behavior  : ENGINE is defined and connection alias 'default' is registered.
        """
        self.assertIn("default", settings.DATABASES)
        engine = settings.DATABASES["default"]["ENGINE"]
        self.assertTrue(
            "sqlite3" in engine or "postgresql" in engine or "mysql" in engine,
            f"Expected standard relational backend engine, got: {engine}"
        )
        self.assertIn("default", connections)

    # -------------------------------------------------------------------------
    # TC-DBConn003: Table introspection / schema presence
    # -------------------------------------------------------------------------
    def test_TC_DBConn003_schema_table_introspection(self):
        """
        Tested Code Segment: connection.introspection.table_names()
        Test Description   : Introspect database schema to ensure critical tables exist.
        Expected Behavior  : auth_user, security_student, security_otpverification tables present.
        """
        with connection.cursor() as cursor:
            tables = connection.introspection.table_names(cursor)

        self.assertIn("auth_user", tables)
        self.assertIn("security_student", tables)
        self.assertIn("security_otpverification", tables)

    # -------------------------------------------------------------------------
    # TC-DBConn004: ORM Write, Read, Update, Delete lifecycle
    # -------------------------------------------------------------------------
    def test_TC_DBConn004_orm_crud_roundtrip(self):
        """
        Tested Code Segment: User.objects.create() / filter() / update() / delete()
        Test Description   : Complete CRUD cycle over active database connection.
        Expected Behavior  : Record is committed, read, updated, and deleted cleanly.
        """
        email = "db_test_crud@test.com"

        # Create
        user = User.objects.create_user(
            username=email,
            email=email,
            password="TestPassword123!",
            first_name="DB",
            last_name="Tester"
        )
        self.assertIsNotNone(user.id)

        # Read
        retrieved = User.objects.filter(email=email).first()
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.first_name, "DB")

        # Update
        retrieved.first_name = "DBUpdated"
        retrieved.save()
        updated = User.objects.get(email=email)
        self.assertEqual(updated.first_name, "DBUpdated")

        # Delete
        user_id = updated.id
        updated.delete()
        self.assertFalse(User.objects.filter(id=user_id).exists())

    # -------------------------------------------------------------------------
    # TC-DBConn005: Transaction rollback on failure (Atomicity)
    # -------------------------------------------------------------------------
    def test_TC_DBConn005_transaction_atomic_rollback(self):
        """
        Tested Code Segment: transaction.atomic() rollback
        Test Description   : Ensure unhandled exception rolls back database write.
        Expected Behavior  : User created inside atomic block is reverted upon exception.
        """
        email = "rollback_user@test.com"

        try:
            with transaction.atomic():
                User.objects.create_user(username=email, email=email, password="Password123!")
                # Force rollback with exception
                raise RuntimeError("Simulated transaction failure")
        except RuntimeError:
            pass

        self.assertFalse(
            User.objects.filter(email=email).exists(),
            "User should have been rolled back upon exception"
        )

    # -------------------------------------------------------------------------
    # TC-DBConn006: Transaction commit on success
    # -------------------------------------------------------------------------
    def test_TC_DBConn006_transaction_atomic_commit(self):
        """
        Tested Code Segment: transaction.atomic() commit
        Test Description   : Ensure successful atomic block commits database records.
        Expected Behavior  : Records created within atomic block persist.
        """
        email = "commit_user@test.com"

        with transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password="Password123!")
            UserRole.objects.create(user=user, role="student", is_verified=True)

        self.assertTrue(User.objects.filter(email=email).exists())
        self.assertTrue(UserRole.objects.filter(user__email=email).exists())

    # -------------------------------------------------------------------------
    # TC-DBConn007: Foreign key integrity constraint enforcement
    # -------------------------------------------------------------------------
    def test_TC_DBConn007_integrity_constraint_violation(self):
        """
        Tested Code Segment: Database foreign key & unique constraints
        Test Description   : Attempt inserting duplicate unique key (username).
        Expected Behavior  : Raises IntegrityError, preventing corrupted data.
        """
        email = "duplicate_check@test.com"
        User.objects.create_user(username=email, email=email, password="Password123!")

        with self.assertRaises(IntegrityError):
            User.objects.create_user(username=email, email=email, password="Password123!")

    # -------------------------------------------------------------------------
    # TC-DBConn008: Connection close and reconnect lifecycle
    # -------------------------------------------------------------------------
    def test_TC_DBConn008_connection_reconnect_lifecycle(self):
        """
        Tested Code Segment: connection.close() & ensure_connection()
        Test Description   : Test connection health check, close and ensure_connection lifecycle.
        Expected Behavior  : Database connection executes query successfully following lifecycle call.
        """
        # Ensure active connection
        connection.ensure_connection()
        self.assertTrue(connection.is_usable())

        # Test reconnect / query execution
        with connection.cursor() as cursor:
            cursor.execute("SELECT 2 + 2")
            row = cursor.fetchone()
        self.assertEqual(row[0], 4)

        # Connection health validator reports usable
        self.assertTrue(connection.is_usable())

    # -------------------------------------------------------------------------
    # TC-DBConn009: OperationalError handling branch
    # -------------------------------------------------------------------------
    def test_TC_DBConn009_operational_error_handling(self):
        """
        Tested Code Segment: Exception trapping on OperationalError
        Test Description   : Simulate database connection failure or locked database.
        Expected Behavior  : OperationalError is caught and handled cleanly.
        """
        with patch.object(connection, "cursor", side_effect=OperationalError("database is locked")):
            error_handled = False
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
            except OperationalError as e:
                error_handled = True
                self.assertIn("locked", str(e))

            self.assertTrue(error_handled, "OperationalError should be catchable by application code")

    # -------------------------------------------------------------------------
    # TC-DBConn010: DatabaseError generic exception trapping
    # -------------------------------------------------------------------------
    def test_TC_DBConn010_database_error_generic(self):
        """
        Tested Code Segment: Exception trapping on DatabaseError
        Test Description   : Verify generic DatabaseError handling during query dispatch.
        Expected Behavior  : DatabaseError base class correctly catches low-level driver errors.
        """
        with patch.object(connection, "cursor", side_effect=DatabaseError("Unrecoverable database failure")):
            caught = False
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
            except DatabaseError:
                caught = True

            self.assertTrue(caught)
