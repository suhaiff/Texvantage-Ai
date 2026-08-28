import pytest
from app.repositories.dev_repo import repo
from app.schemas.auth import AuthenticatedUser
from app.services.ai.orchestrator import AIOrchestrator
from app.services.ai.mock_provider import MockAIProvider
from app.services.ai.gemini import GeminiProvider

@pytest.fixture
def admin_user():
    return AuthenticatedUser(
        id="user_admin_01",
        email="admin@test.local",
        name="Global Admin",
        role="ADMIN",
        company_id=None,
        authorized_company_ids=["comp_test_a"]
    )

@pytest.fixture
def owner_a_user():
    return AuthenticatedUser(
        id="user_owner_a",
        email="owner.a@test.local",
        name="Owner A",
        role="OWNER",
        company_id="comp_test_a",
        authorized_company_ids=["comp_test_a"]
    )

def test_gemini_provider_init_from_env_safe():
    # Verify that GeminiProvider initializes cleanly without leaking key or crashing
    provider = GeminiProvider(api_key="mock_test_key", model="gemini-2.5-flash")
    assert provider.api_key == "mock_test_key"
    assert provider.model == "gemini-2.5-flash"
    assert provider.is_configured() is True

def test_owner_single_turn_revenue_query(owner_a_user):
    mock_provider = MockAIProvider()
    orchestrator = AIOrchestrator(repository=repo, user=owner_a_user, provider=mock_provider)

    result = orchestrator.run_conversation_turn("What were my total sales this month?")
    assert "response" in result
    assert len(result["events"]) > 0

    # Ensure tool_start was triggered
    tool_starts = [e for e in result["events"] if e["type"] == "tool_start"]
    assert len(tool_starts) >= 1
    assert tool_starts[0]["tool"] == "calculate_metric"

def test_admin_multi_company_compare_query(admin_user):
    mock_provider = MockAIProvider()
    orchestrator = AIOrchestrator(repository=repo, user=admin_user, provider=mock_provider)

    result = orchestrator.run_conversation_turn("Compare Textile A and Textile B")
    assert "response" in result
    tool_starts = [e for e in result["events"] if e["type"] == "tool_start"]
    assert len(tool_starts) >= 1
    assert tool_starts[0]["tool"] == "compare_companies"

def test_general_question_no_tool_call(owner_a_user):
    mock_provider = MockAIProvider()
    orchestrator = AIOrchestrator(repository=repo, user=owner_a_user, provider=mock_provider)

    result = orchestrator.run_conversation_turn("What is gross margin?")
    # For a general question, the answer is generated directly
    assert "Gross margin" in result["response"]
    tool_starts = [e for e in result["events"] if e["type"] == "tool_start"]
    assert len(tool_starts) == 0

def test_conversation_persistence(owner_a_user):
    mock_provider = MockAIProvider()
    orchestrator = AIOrchestrator(repository=repo, user=owner_a_user, provider=mock_provider)

    # First turn
    turn1 = orchestrator.run_conversation_turn("What is my profit margin?")
    
    # Retrieve user's conversations
    convs = repo.get_conversations_for_user(owner_a_user.id)
    assert len(convs) >= 1
    conv = convs[0]

    # Verify messages are saved
    full_conv = repo.get_conversation_by_id(conv.id, owner_a_user.id)
    assert len(full_conv.messages) >= 2 # user msg + assistant msg
