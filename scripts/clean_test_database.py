#!/usr/bin/env python3
import sys
import os

# Add backend directory to path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

from app.repositories.dev_repo import repo
from app.models.company import Company
from app.models.user import User
from app.models.dataset import Dataset, DatasetColumn
from app.models.financials import MonthlyFinancials
from app.models.product import ProductMetric
from app.models.chat import Conversation, Message
from app.models.audit import AuditLog
from sqlalchemy import delete

def clean_database():
    print("WARNING: This script will delete ALL data (Users, Companies, Datasets, Financials, etc.).")
    print("It will NOT drop the tables themselves, keeping the schema intact.")
    
    confirm = input("Are you sure you want to proceed? Type 'YES' to confirm: ")
    if confirm != "YES":
        print("Aborted.")
        return

    with repo.SessionLocal() as session:
        try:
            print("Deleting data...")
            # Delete in reverse dependency order
            session.execute(delete(AuditLog))
            session.execute(delete(Message))
            session.execute(delete(Conversation))
            session.execute(delete(ProductMetric))
            session.execute(delete(MonthlyFinancials))
            session.execute(delete(DatasetColumn))
            session.execute(delete(Dataset))
            session.execute(delete(User))
            session.execute(delete(Company))
            session.commit()
            print("Database cleaned successfully. No demo companies or users exist.")
        except Exception as e:
            session.rollback()
            print(f"Error cleaning database: {e}")

if __name__ == "__main__":
    clean_database()
