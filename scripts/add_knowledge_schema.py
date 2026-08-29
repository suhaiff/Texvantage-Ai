import sys
import os

# Add the root of the project to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from backend.app.core.config import settings
from backend.app.models.base import Base
# Import all models to ensure they are registered with Base.metadata
from backend.app.models import *

def main():
    print("Creating CompanyKnowledge table if it doesn't exist...")
    engine = create_engine(settings.DATABASE_URL)
    
    # We only create tables that don't exist
    Base.metadata.create_all(bind=engine)
    print("Done!")

if __name__ == "__main__":
    main()
