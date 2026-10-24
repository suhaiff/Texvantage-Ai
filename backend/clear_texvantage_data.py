"""
Script to clear all TexVantage AI data from the database.
Supports both SQL Server (MSSQL) and SQLite fallback environments.
"""
import os
import sys
from sqlalchemy import text

# Ensure backend directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.repositories.dev_repo import DevRepository

def clear_data(keep_admin: bool = True):
    repo = DevRepository()
    engine = repo.engine
    dialect = engine.dialect.name
    print(f"Connected to database using dialect: {dialect}")

    with repo.SessionLocal() as session:
        # Child to parent order respecting foreign keys
        tables_to_delete = [
            "ai_message_artifacts",
            "ai_messages",
            "ai_conversations",
            "ai_artifacts",
            "ai_company_knowledge",
            "ai_dataset_columns",
            "ai_datasets",
            "ai_monthly_financials",
            "ai_product_metrics",
            "ai_audit_logs",
        ]

        for table in tables_to_delete:
            try:
                cnt = session.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                session.execute(text(f"DELETE FROM {table}"))
                print(f"Cleared {table} ({cnt} rows removed)")
            except Exception as e:
                print(f"Skipping {table}: {e}")

        # Users table
        if keep_admin:
            try:
                cnt = session.execute(text("SELECT COUNT(*) FROM ai_users WHERE role != 'ADMIN' AND email != 'apexspinners@gmail.com'")).scalar()
                session.execute(text("DELETE FROM ai_users WHERE role != 'ADMIN' AND email != 'apexspinners@gmail.com'"))
                print(f"Cleared non-admin demo users from ai_users ({cnt} rows removed, Admin and Apex Spinners accounts preserved)")
            except Exception as e:
                print(f"Error clearing ai_users: {e}")
        else:
            try:
                cnt = session.execute(text("SELECT COUNT(*) FROM ai_users")).scalar()
                session.execute(text("DELETE FROM ai_users"))
                print(f"Cleared all ai_users ({cnt} rows removed)")
            except Exception as e:
                print(f"Error clearing ai_users: {e}")

        # Companies table
        try:
            if keep_admin:
                # Keep Apex Spinners company so apexspinners@gmail.com remains valid, clear other 9 demo companies
                cnt = session.execute(text("SELECT COUNT(*) FROM ai_companies WHERE id != 'comp_textile_a'")).scalar()
                session.execute(text("DELETE FROM ai_companies WHERE id != 'comp_textile_a'"))
                print(f"Cleared other demo companies from ai_companies ({cnt} rows removed, Textile A / Apex Spinners preserved)")
            else:
                session.execute(text("UPDATE ai_users SET company_id = NULL"))
                cnt = session.execute(text("SELECT COUNT(*) FROM ai_companies")).scalar()
                session.execute(text("DELETE FROM ai_companies"))
                print(f"Cleared all ai_companies ({cnt} rows removed)")
        except Exception as e:
            print(f"Error clearing ai_companies: {e}")

        session.commit()
        print("Database purge completed successfully.")

if __name__ == "__main__":
    keep = "--all" not in sys.argv
    clear_data(keep_admin=keep)
