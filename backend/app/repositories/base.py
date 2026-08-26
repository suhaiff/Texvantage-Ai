from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import date
from ..models.company import Company
from ..models.user import User
from ..models.financials import MonthlyFinancials
from ..models.product import ProductMetric
from ..models.dataset import Dataset
from ..models.chat import Conversation, Message
from ..models.artifact import Artifact
from ..models.audit import AuditLog

class IDataRepository(ABC):
    """
    Abstract Data Repository Interface.
    Decouples business logic and AI orchestration from the underlying database
    (Development SQLite / Production Microsoft SQL Server).
    """

    # Auth & Users
    @abstractmethod
    def get_user_by_email(self, email: str) -> Optional[User]:
        pass

    @abstractmethod
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        pass

    @abstractmethod
    def create_user(self, user: User) -> User:
        pass

    # Companies
    @abstractmethod
    def get_companies(self, authorized_company_ids: Optional[List[str]] = None) -> List[Company]:
        pass

    @abstractmethod
    def get_company_by_id(self, company_id: str) -> Optional[Company]:
        pass

    # Financials & Business Analytics (Strict Tenant Scoping)
    @abstractmethod
    def get_monthly_financials(
        self,
        authorized_company_ids: List[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: Optional[int] = None
    ) -> List[MonthlyFinancials]:
        pass

    @abstractmethod
    def get_latest_financials_for_companies(
        self,
        authorized_company_ids: List[str]
    ) -> Dict[str, MonthlyFinancials]:
        pass

    @abstractmethod
    def upsert_financials_and_products(
        self,
        company_id: str,
        financials: List[MonthlyFinancials],
        products: List[ProductMetric],
        mode: str = "APPEND"
    ) -> None:
        pass

    # Products & Categories
    @abstractmethod
    def get_product_metrics(
        self,
        authorized_company_ids: List[str],
        year: Optional[int] = None,
        month: Optional[int] = None
    ) -> List[ProductMetric]:
        pass

    # Datasets & Ingestion
    @abstractmethod
    def get_datasets(self, authorized_company_ids: List[str]) -> List[Dataset]:
        pass

    @abstractmethod
    def get_datasets_by_company(self, company_id: str) -> List[Dataset]:
        pass

    @abstractmethod
    def get_dataset_by_id(self, dataset_id: str) -> Optional[Dataset]:
        pass

    @abstractmethod
    def save_dataset(self, dataset: Dataset) -> Dataset:
        pass

    @abstractmethod
    def delete_dataset(self, dataset_id: str, user_id: str, company_id: Optional[str] = None) -> bool:
        pass

    # Conversations & Chat Memory
    @abstractmethod
    def get_conversations_for_user(self, user_id: str) -> List[Conversation]:
        pass

    @abstractmethod
    def get_conversation_by_id(self, conversation_id: str, user_id: str) -> Optional[Conversation]:
        pass

    @abstractmethod
    def create_conversation(self, conversation: Conversation) -> Conversation:
        pass

    @abstractmethod
    def add_message(self, message: Message) -> Message:
        pass

    @abstractmethod
    def delete_conversation(self, conversation_id: str, user_id: str) -> bool:
        pass

    # Artifacts & Reports
    @abstractmethod
    def save_artifact(self, artifact: Artifact, message_id: Optional[str] = None) -> Artifact:
        pass

    @abstractmethod
    def get_artifact_by_id(self, artifact_id: str) -> Optional[Artifact]:
        pass

    # Auditing
    @abstractmethod
    def log_audit(self, audit: AuditLog) -> None:
        pass
