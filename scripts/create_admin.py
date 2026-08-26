#!/usr/bin/env python3
import sys
import os
import uuid
import argparse

# Add backend directory to path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

from app.repositories.dev_repo import repo
from app.models.user import User
from app.core.security import get_password_hash

def create_admin(email, password, name):
    print(f"Bootstrapping ADMIN account for {email}...")

    with repo.SessionLocal() as session:
        try:
            existing = repo.get_user_by_email(email)
            if existing:
                print(f"Error: User with email {email} already exists.")
                return

            password_hash = get_password_hash(password)
            
            admin_user = User(
                id=f"user_{uuid.uuid4().hex[:8]}",
                email=email.lower().strip(),
                password_hash=password_hash,
                name=name,
                role="ADMIN",
                company_id=None, # Global scope
                job_title="Administrator"
            )
            
            session.add(admin_user)
            session.commit()
            print(f"Success! Admin account created: {email}")
        except Exception as e:
            session.rollback()
            print(f"Error creating admin account: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bootstrap an ADMIN user for TexVantage AI.")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--password", required=True, help="Admin password")
    parser.add_argument("--name", default="Administrator", help="Admin full name")
    
    args = parser.parse_args()
    create_admin(args.email, args.password, args.name)
