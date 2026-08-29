import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from backend.app.models.base import Base
from backend.app.models.company import Company
from backend.app.models.user import User
from backend.app.models.dataset import Dataset, DatasetColumn
from backend.app.models.financials import MonthlyFinancials
from backend.app.models.product import ProductMetric
from backend.app.models.chat import Conversation, Message
from backend.app.models.artifact import Artifact, MessageArtifact
from backend.app.models.audit import AuditLog

TABLE_MODELS = [
    Company,
    User,
    Dataset,
    DatasetColumn,
    MonthlyFinancials,
    ProductMetric,
    Conversation,
    Message,
    Artifact,
    MessageArtifact,
    AuditLog,
]

def migrate(sqlite_url: str, mssql_url: str):
    print("=" * 60)
    print(" TexVantage AI: SQLite -> MS SQL Server Migration Utility")
    print("=" * 60)
    print(f"\n[1/4] Connecting to SQLite: {sqlite_url}")
    sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    SqliteSession = sessionmaker(bind=sqlite_engine)

    print(f"[2/4] Connecting to MS SQL Server: {mssql_url}")
    try:
        mssql_engine = create_engine(mssql_url, fast_executemany=True)
        MssqlSession = sessionmaker(bind=mssql_engine)
        
        # Test connection
        with mssql_engine.connect() as conn:
            print("      [OK] Connected successfully to MS SQL Server!")
    except Exception as e:
        print(f"\n[ERROR] Failed to connect to MS SQL Server:\n{e}")
        print("\nPlease ensure:")
        print("  1. SQL Server is running.")
        print("  2. The target database exists in SQL Server.")
        print("  3. ODBC Driver for SQL Server is installed.")
        sys.exit(1)

    print("\n[3/4] Creating database tables in MS SQL Server...")
    Base.metadata.create_all(bind=mssql_engine)
    print("      [OK] Tables verified/created successfully.")

    print("\n[4/4] Migrating data records...")
    with SqliteSession() as src_session, MssqlSession() as dst_session:
        for model in TABLE_MODELS:
            table_name = model.__tablename__
            records = src_session.scalars(select(model)).all()
            print(f"  -> Migrating {table_name:<20} ({len(records)} records)...", end=" ")
            
            if not records:
                print("Skipped (Empty)")
                continue

            try:
                for rec in records:
                    src_session.expunge(rec)
                    dst_session.merge(rec)
                dst_session.commit()
                print("[OK] Done")
            except Exception as e:
                dst_session.rollback()
                print(f"FAILED: {e}")
                raise e

    print("\n" + "=" * 60)
    print(" Migration Completed Successfully!")
    print("=" * 60)
    print("\nNext step:")
    print("Set your DATABASE_URL in your .env file:")
    print(f'DATABASE_URL="{mssql_url}"')

if __name__ == "__main__":
    sqlite_path = root_dir / "texvantage_dev.db"
    sqlite_url = f"sqlite:///{sqlite_path}"
    
    mssql_url = os.getenv("TARGET_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not mssql_url or mssql_url.startswith("sqlite"):
        if len(sys.argv) > 1:
            mssql_url = sys.argv[1]
        else:
            print("Please provide the MS SQL connection string.")
            print("\nUsage:")
            print('  python scripts/migrate_sqlite_to_mssql.py "mssql+pyodbc://sa:YourPassword@localhost/texvantage?driver=ODBC+Driver+17+for+SQL+Server"')
            print('  or with Windows Authentication:')
            print('  python scripts/migrate_sqlite_to_mssql.py "mssql+pyodbc://@localhost/texvantage?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes"')
            sys.exit(1)

    migrate(sqlite_url, mssql_url)
