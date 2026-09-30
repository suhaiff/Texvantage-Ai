from typing import List, Optional, Dict, Any
from datetime import date, datetime, timezone
from sqlalchemy import create_engine, select, func, desc, delete, text
from sqlalchemy.orm import sessionmaker, Session, joinedload, selectinload
from sqlalchemy.pool import NullPool, StaticPool
import os
import uuid
import logging

from ..core.config import settings
from .base import IDataRepository
from ..models.base import Base
from ..models.company import Company
from ..models.user import User
from ..models.financials import MonthlyFinancials
from ..models.product import ProductMetric
from ..models.dataset import Dataset, DatasetColumn
from ..models.chat import Conversation, Message
from ..models.artifact import Artifact, MessageArtifact
from ..models.audit import AuditLog
from .seed_data import generate_seed_entities

logger = logging.getLogger(__name__)

class DevRepository(IDataRepository):
    """
    SQLAlchemy Relational Repository.
    Executes ANSI SQL standard queries fully compatible with Microsoft SQL Server and PostgreSQL.
    Safely enforces database retention and tenant isolation.
    """

    def __init__(self, db_url: Optional[str] = None):
        database_url = db_url or settings.DATABASE_URL
        connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
        engine_options = {
            "connect_args": connect_args,
            "echo": False,
        }
        if database_url.startswith("sqlite"):
            # In-memory tests need one shared connection; file-backed SQLite tests
            # need connections released so their files remain removable on Windows.
            engine_options["poolclass"] = StaticPool if database_url == "sqlite:///:memory:" else NullPool
        else:
            engine_options.update({"pool_pre_ping": True, "pool_recycle": 1800})
        self.engine = create_engine(database_url, **engine_options)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=self.engine)
        self._init_db()

    def _init_db(self):
        """Initialize only the SQLite fallback; never alter an external SQL Server schema."""
        try:
            if self.engine.dialect.name != "sqlite":
                # texvantage is provisioned independently.  Running create_all here
                # would be surprising and risks schema drift in a production-like DB.
                self.check_connection()
                return

            Base.metadata.create_all(bind=self.engine)
            
            # Check environment rules for seed data population
            if settings.APP_ENV.lower() == "production":
                with self.SessionLocal() as session:
                    comp_count = session.scalar(select(func.count(Company.id)))
                    if comp_count == 0:
                        logger.warning("Production database is empty. No demo companies will be seeded automatically in production.")
                return

            # Development / Test explicit seed check
            if settings.SEED_DEMO_DATA:
                with self.SessionLocal() as session:
                    comp_count = session.scalar(select(func.count(Company.id)))
                    if comp_count == 0:
                        companies, users, financials, products, datasets = generate_seed_entities()
                        session.add_all(companies)
                        session.commit()
                        session.add_all(users)
                        session.commit()
                        session.add_all(financials)
                        session.commit()
                        session.add_all(products)
                        session.commit()
                        session.add_all(datasets)
                        session.commit()
                        logger.info("Successfully seeded demo companies and baseline datasets.")
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            # NEVER delete the database file. Raise exception to halt startup safely.
            raise RuntimeError(f"Database initialization failed: {e}") from e

    def check_connection(self) -> None:
        """Verify that the configured database accepts a read-only health query."""
        with self.engine.connect() as connection:
            connection.execute(text("SELECT 1"))

    def get_session(self) -> Session:
        return self.SessionLocal()

    # User & Auth
    def get_user_by_email(self, email: str) -> Optional[User]:
        with self.SessionLocal() as session:
            stmt = select(User).options(joinedload(User.company)).where(User.email == email.lower().strip())
            return session.scalars(stmt).first()

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        with self.SessionLocal() as session:
            stmt = select(User).options(joinedload(User.company)).where(User.id == user_id)
            return session.scalars(stmt).first()

    def create_user(self, user: User) -> User:
        with self.SessionLocal() as session:
            session.add(user)
            session.commit()
            session.refresh(user)
            return user

    # Companies
    def get_companies(self, authorized_company_ids: Optional[List[str]] = None) -> List[Company]:
        with self.SessionLocal() as session:
            stmt = select(Company).options(selectinload(Company.datasets))
            if authorized_company_ids is not None:
                stmt = stmt.where(Company.id.in_(authorized_company_ids))
            stmt = stmt.order_by(Company.name)
            return list(session.scalars(stmt).all())

    def get_company_by_id(self, company_id: str) -> Optional[Company]:
        with self.SessionLocal() as session:
            stmt = select(Company).options(selectinload(Company.datasets)).where(Company.id == company_id)
            return session.scalars(stmt).first()

    # Financials & Business Analytics (Strict Tenant Scoping)
    def get_monthly_financials(
        self,
        authorized_company_ids: List[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: Optional[int] = None
    ) -> List[MonthlyFinancials]:
        if not authorized_company_ids:
            return []
        
        with self.SessionLocal() as session:
            stmt = (
                select(MonthlyFinancials)
                .options(joinedload(MonthlyFinancials.company))
                .where(MonthlyFinancials.company_id.in_(authorized_company_ids))
            )
            if start_date:
                stmt = stmt.where(MonthlyFinancials.period_date >= start_date)
            if end_date:
                stmt = stmt.where(MonthlyFinancials.period_date <= end_date)
            
            stmt = stmt.order_by(MonthlyFinancials.period_date.asc())
            if limit:
                stmt = stmt.limit(limit)
            return list(session.scalars(stmt).all())

    def get_latest_financials_for_companies(
        self,
        authorized_company_ids: List[str]
    ) -> Dict[str, MonthlyFinancials]:
        if not authorized_company_ids:
            return {}
        
        with self.SessionLocal() as session:
            stmt = (
                select(MonthlyFinancials)
                .options(joinedload(MonthlyFinancials.company))
                .where(MonthlyFinancials.company_id.in_(authorized_company_ids))
                .order_by(MonthlyFinancials.period_date.desc())
            )
            records = session.scalars(stmt).all()
            latest_map: Dict[str, MonthlyFinancials] = {}
            for r in records:
                if r.company_id not in latest_map:
                    latest_map[r.company_id] = r
            return latest_map

    def upsert_financials_and_products(
        self,
        company_id: str,
        financials: List[MonthlyFinancials],
        products: List[ProductMetric],
        mode: str = "APPEND"
    ) -> None:
        with self.SessionLocal() as session:
            for fin in financials:
                # Ensure company_id and dataset_id consistency
                fin.company_id = company_id
                
                # Check if record for this company, year, month already exists
                existing = session.scalars(
                    select(MonthlyFinancials).where(
                        MonthlyFinancials.company_id == company_id,
                        MonthlyFinancials.year == fin.year,
                        MonthlyFinancials.month == fin.month
                    )
                ).first()
                if existing:
                    # Update fields and provenance
                    existing.dataset_id = fin.dataset_id
                    existing.revenue_lakh = fin.revenue_lakh
                    existing.cogs_lakh = fin.cogs_lakh
                    existing.gross_profit_lakh = fin.gross_profit_lakh
                    existing.profit_margin_pct = fin.profit_margin_pct
                    existing.operating_expenses_lakh = fin.operating_expenses_lakh
                    existing.net_profit_lakh = fin.net_profit_lakh
                    existing.units_produced = fin.units_produced
                    existing.units_sold = fin.units_sold
                    existing.orders_count = fin.orders_count
                    existing.avg_order_value_inr = fin.avg_order_value_inr
                    existing.capacity_utilization_pct = fin.capacity_utilization_pct
                    existing.raw_material_cost_lakh = fin.raw_material_cost_lakh
                    existing.energy_cost_lakh = fin.energy_cost_lakh
                else:
                    session.add(fin)

            # Ingest product metrics with verified company_id
            for prod in products:
                prod.company_id = company_id
                session.add(prod)

            session.commit()

    # Products & Categories
    def get_product_metrics(
        self,
        authorized_company_ids: List[str],
        year: Optional[int] = None,
        month: Optional[int] = None
    ) -> List[ProductMetric]:
        if not authorized_company_ids:
            return []
        with self.SessionLocal() as session:
            stmt = select(ProductMetric).where(ProductMetric.company_id.in_(authorized_company_ids))
            if year is not None:
                stmt = stmt.where(ProductMetric.year == year)
            if month is not None:
                stmt = stmt.where(ProductMetric.month == month)
            stmt = stmt.order_by(ProductMetric.revenue_lakh.desc())
            return list(session.scalars(stmt).all())

    # Datasets
    def get_datasets(self, authorized_company_ids: List[str]) -> List[Dataset]:
        if not authorized_company_ids:
            return []
        with self.SessionLocal() as session:
            stmt = (
                select(Dataset)
                .options(joinedload(Dataset.columns), joinedload(Dataset.company))
                .where(Dataset.company_id.in_(authorized_company_ids))
                .order_by(Dataset.uploaded_at.desc())
            )
            return list(session.scalars(stmt).unique().all())

    def get_datasets_by_company(self, company_id: str) -> List[Dataset]:
        with self.SessionLocal() as session:
            stmt = (
                select(Dataset)
                .options(joinedload(Dataset.columns), joinedload(Dataset.company))
                .where(Dataset.company_id == company_id)
                .order_by(Dataset.uploaded_at.desc())
            )
            return list(session.scalars(stmt).unique().all())

    def get_dataset_by_id(self, dataset_id: str) -> Optional[Dataset]:
        with self.SessionLocal() as session:
            stmt = (
                select(Dataset)
                .options(joinedload(Dataset.columns), joinedload(Dataset.company))
                .where(Dataset.id == dataset_id)
            )
            return session.scalars(stmt).first()

    def save_dataset(self, dataset: Dataset) -> Dataset:
        with self.SessionLocal() as session:
            merged = session.merge(dataset)
            session.commit()
            session.refresh(merged)
            return merged

    def delete_dataset(self, dataset_id: str, user_id: str, company_id: Optional[str] = None) -> bool:
        """
        Transactionally deletes a dataset and all associated normalized records:
        - MonthlyFinancials WHERE dataset_id = dataset_id
        - ProductMetric WHERE dataset_id = dataset_id
        - DatasetColumn (cascade)
        - Raw uploaded storage file
        - Dataset record
        - Records AuditLog
        """
        with self.SessionLocal() as session:
            try:
                ds = session.scalars(select(Dataset).where(Dataset.id == dataset_id)).first()
                if not ds:
                    return False
                # If company_id is provided, verify match (TenantGuard)
                if company_id and ds.company_id != company_id:
                    return False

                # 1. Delete associated MonthlyFinancial records
                session.execute(delete(MonthlyFinancials).where(MonthlyFinancials.dataset_id == dataset_id))

                # 2. Delete associated ProductMetric records
                session.execute(delete(ProductMetric).where(ProductMetric.dataset_id == dataset_id))

                # 3. Delete raw uploaded file if present
                if ds.stored_path and os.path.exists(ds.stored_path):
                    try:
                        os.remove(ds.stored_path)
                    except Exception as f_err:
                        logger.warning(f"Could not remove physical dataset file: {f_err}")

                # 4. Record Audit Log entry
                audit = AuditLog(
                    id=f"audit_{uuid.uuid4().hex[:12]}",
                    user_id=user_id,
                    company_id=ds.company_id,
                    action="DATASET_DELETED",
                    endpoint=f"/api/datasets/{dataset_id}",
                    details=f"Deleted dataset '{ds.dataset_name}' ({ds.filename}) and associated financial/product metrics."
                )
                session.add(audit)

                # 5. Delete dataset (cascades to columns)
                session.delete(ds)
                session.commit()
                return True
            except Exception as e:
                session.rollback()
                logger.error(f"Failed to delete dataset {dataset_id}: {e}")
                raise

    # Conversations & Chat Memory
    def get_conversations_for_user(self, user_id: str) -> List[Conversation]:
        with self.SessionLocal() as session:
            stmt = select(Conversation).where(Conversation.user_id == user_id).order_by(Conversation.updated_at.desc())
            return list(session.scalars(stmt).all())

    def get_conversation_by_id(self, conversation_id: str, user_id: str) -> Optional[Conversation]:
        with self.SessionLocal() as session:
            stmt = (
                select(Conversation)
                .options(
                    selectinload(Conversation.messages).selectinload(Message.artifacts).joinedload(MessageArtifact.artifact)
                )
                .where(Conversation.id == conversation_id, Conversation.user_id == user_id)
            )
            return session.scalars(stmt).first()

    def create_conversation(self, conversation: Conversation) -> Conversation:
        with self.SessionLocal() as session:
            session.add(conversation)
            session.commit()
            session.refresh(conversation)
            return conversation

    def add_message(self, message: Message) -> Message:
        with self.SessionLocal() as session:
            session.add(message)
            conv = session.get(Conversation, message.conversation_id)
            if conv:
                conv.updated_at = datetime.now(timezone.utc)
            session.commit()
            session.refresh(message)
            return message

    def delete_conversation(self, conversation_id: str, user_id: str) -> bool:
        with self.SessionLocal() as session:
            conv = session.scalars(select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user_id)).first()
            if conv:
                session.delete(conv)
                session.commit()
                return True
            return False

    # Artifacts
    def save_artifact(self, artifact: Artifact, message_id: Optional[str] = None) -> Artifact:
        with self.SessionLocal() as session:
            session.add(artifact)
            session.commit()
            session.refresh(artifact)
            
            if message_id:
                link = MessageArtifact(
                    id=f"link_{message_id}_{artifact.id}",
                    message_id=message_id,
                    artifact_id=artifact.id,
                    display_order=0
                )
                session.add(link)
                session.commit()
            return artifact

    def get_artifact_by_id(self, artifact_id: str) -> Optional[Artifact]:
        with self.SessionLocal() as session:
            stmt = select(Artifact).where(Artifact.id == artifact_id)
            return session.scalars(stmt).first()

    # Audit Logging
    def log_audit(self, audit: AuditLog) -> None:
        with self.SessionLocal() as session:
            session.add(audit)
            session.commit()

repo = DevRepository()
