import pytest
from types import SimpleNamespace
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

def test_gemini_provider_replays_native_signed_model_content():
    """Gemini tool turns must retain opaque thought-signature-bearing parts."""
    captured = {}
    signed_model_content = object()

    class FakeModels:
        def generate_content(self, **kwargs):
            captured["contents"] = kwargs["contents"]
            return SimpleNamespace(text="Complete.", function_calls=[], candidates=[])

    provider = GeminiProvider(api_key="mock_test_key", model="gemini-2.5-flash")
    provider._client = SimpleNamespace(models=FakeModels())

    response = provider.generate_response(
        messages=[{"role": "model", "gemini_content": signed_model_content}],
        tools=[]
    )

    assert response.content == "Complete."
    assert captured["contents"] == [signed_model_content]

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
    # For a general question, the answer is generated directly with a rich narrative
    # Check case-insensitively since our response uses "Gross Profit Margin" heading
    assert "gross" in result["response"].lower()
    tool_starts = [e for e in result["events"] if e["type"] == "tool_start"]
    assert len(tool_starts) == 0

def test_named_company_trend_uses_verified_company_tool(owner_a_user, test_environment):
    """A named company must not be replaced with a portfolio-level result."""
    orchestrator = AIOrchestrator(
        repository=repo,
        user=owner_a_user,
        provider=MockAIProvider()
    )

    result = orchestrator.run_conversation_turn(
        "Plot the historical revenue trend for Test Company A over the last 8 months."
    )

    tool_starts = [event for event in result["events"] if event["type"] == "tool_start"]
    assert len(tool_starts) == 1
    assert tool_starts[0]["tool"] == "get_sales_trend"
    assert tool_starts[0]["arguments"]["company_id"] == "comp_test_a"
    assert tool_starts[0]["arguments"]["months"] == 8
    # The narrative now includes company_name from the tool result
    # Test Company A is the company name from seed data; check case-insensitively
    assert "test company a" in result["response"].lower() or "comp_test_a" in result["response"].lower()
    assert "AI service is temporarily unavailable" not in result["response"]

    artifact_events = [event for event in result["events"] if event["type"] == "artifact"]
    assert len(artifact_events) >= 3
    types = {event["artifact"]["type"] for event in artifact_events}
    assert "kpi" in types
    assert "chart" in types
    chart = next(event["artifact"] for event in artifact_events if event["artifact"]["type"] == "chart")
    assert chart["data"]["chartType"] in ("line", "area", "bar")
    assert chart["data"]["dataPoints"]
    assert chart["data"]["xKey"] == "month"

def test_parenthetical_company_trade_name_is_a_verified_alias(admin_user):
    company = SimpleNamespace(
        id="comp_jupiter",
        name="Textile J (Jupiter Garment Exports)",
        code="TEX-J"
    )
    repository = SimpleNamespace(get_companies=lambda _scope=None: [company])
    orchestrator = AIOrchestrator(
        repository=repository,
        user=admin_user,
        provider=MockAIProvider()
    )

    tool_call = orchestrator._build_verified_tool_call(
        "Give me the full executive summary and KPIs for Jupiter Garment Exports."
    )

    assert tool_call is not None
    assert tool_call.name == "get_company_summary"
    assert tool_call.arguments["company_id"] == "comp_jupiter"

def test_unknown_company_returns_database_grounded_not_found_message(admin_user):
    company = SimpleNamespace(
        id="comp_known",
        name="Known Textile Mills",
        code="KTM"
    )
    repository = SimpleNamespace(get_companies=lambda _scope=None: [company])
    orchestrator = AIOrchestrator(
        repository=repository,
        user=admin_user,
        provider=MockAIProvider()
    )

    message = orchestrator._unrecognized_company_message(
        "Give me the full executive summary for Jupiter Garment Exports."
    )

    assert message is not None
    assert "Jupiter Garment Exports" in message
    assert "Known Textile Mills" in message

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


def test_company_location_query_answers_with_location_not_generic_summary(admin_user):
    """
    Querying 'where is Jeevan Clothing Company located?' must specifically answer
    with the location/city/state rather than duplicating an executive performance summary.
    """
    company = SimpleNamespace(
        id="comp_fbs_1",
        name="Jeevan Clothing Company",
        code="JCC",
        city="Tirupur",
        state="Tamil Nadu",
        specialization="Export Quality T-Shirts, Polos & Knitted Garments",
        founded_year=2004,
        annual_capacity_description="250,000 Pcs/Month"
    )
    repository = SimpleNamespace(
        get_companies=lambda _scope=None: [company],
        get_company_by_id=lambda _id: company,
        get_monthly_financials=lambda _ids: [],
        add_message=lambda _m: None,
        get_conversation_by_id=lambda _cid, _uid: None,
        create_conversation=lambda c: c,
        update_conversation_title=lambda *a: None
    )
    orchestrator = AIOrchestrator(repository=repository, user=admin_user, provider=MockAIProvider())

    # 1. Ask analysis
    ans_analysis = orchestrator.run_conversation_turn("Analyze Jeevan Clothing Company")
    assert "Executive Performance Summary" in ans_analysis["response"]

    # 2. Ask location
    ans_location = orchestrator.run_conversation_turn("where is Jeevan Clothing Company located?")
    assert "Executive Performance Summary" not in ans_location["response"]
    assert "Tirupur" in ans_location["response"]
    assert "Tamil Nadu" in ans_location["response"]


def test_company_multi_turn_followup_location_query(admin_user):
    """
    Multi-turn test: User asks 'Analyze Jeevan Clothing Company' and then follows up
    with 'where is it located?'. The system must retain context and answer the location.
    """
    company = SimpleNamespace(
        id="comp_fbs_1",
        name="Jeevan Clothing Company",
        code="JCC",
        city="Tirupur",
        state="Tamil Nadu",
        specialization="Export Quality T-Shirts, Polos & Knitted Garments",
        founded_year=2004,
        annual_capacity_description="250,000 Pcs/Month"
    )
    conv_store = {}
    def mock_get_conv(cid, uid):
        return conv_store.get(cid)
    def mock_add_msg(m):
        conv = conv_store.get(m.conversation_id)
        if conv:
            conv.messages.append(m)
    def mock_create_conv(c):
        c.messages = []
        conv_store[c.id] = c
        return c

    repository = SimpleNamespace(
        get_companies=lambda _scope=None: [company],
        get_company_by_id=lambda _id: company,
        get_monthly_financials=lambda _ids: [],
        add_message=mock_add_msg,
        get_conversation_by_id=mock_get_conv,
        create_conversation=mock_create_conv,
        update_conversation_title=lambda *a: None
    )
    orchestrator = AIOrchestrator(repository=repository, user=admin_user, provider=MockAIProvider())

    # Turn 1: Analyze
    t1 = orchestrator.run_conversation_turn("Analyze Jeevan Clothing Company")
    cid = t1["conversation_id"]

    # Turn 2: Follow-up location query
    t2 = orchestrator.run_conversation_turn("where is it located?", conversation_id=cid)
    assert "Tirupur" in t2["response"]
    assert "Tamil Nadu" in t2["response"]


def test_company_specialization_profile_query(admin_user):
    """
    Querying 'what does Jeevan Clothing Company specialize in?' returns core specialization.
    """
    company = SimpleNamespace(
        id="comp_fbs_1",
        name="Jeevan Clothing Company",
        code="JCC",
        city="Tirupur",
        state="Tamil Nadu",
        specialization="Export Quality T-Shirts, Polos & Knitted Garments",
        founded_year=2004,
        annual_capacity_description="250,000 Pcs/Month"
    )
    repository = SimpleNamespace(
        get_companies=lambda _scope=None: [company],
        get_company_by_id=lambda _id: company,
        get_monthly_financials=lambda _ids: [],
        add_message=lambda _m: None,
        get_conversation_by_id=lambda _cid, _uid: None,
        create_conversation=lambda c: c,
        update_conversation_title=lambda *a: None
    )
    orchestrator = AIOrchestrator(repository=repository, user=admin_user, provider=MockAIProvider())

    res = orchestrator.run_conversation_turn("what does Jeevan Clothing Company specialize in?")
    assert "Specialization" in res["response"] or "Capabilities" in res["response"]
    assert "Export Quality T-Shirts" in res["response"]
