from typing import List, Dict, Any, Optional
import os
import uuid
import logging
from ...core.config import settings
from .provider import AIProvider, AIProviderResponse, AIToolCall

logger = logging.getLogger(__name__)

class GeminiProvider(AIProvider):
    """
    Production Google GenAI Provider implementation using the official `google-genai` SDK.
    Keeps API keys exclusively in server-side configuration.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        if api_key is not None:
            self.api_key = api_key
        else:
            self.api_key = settings.GEMINI_API_KEY or ""
        
        self.model = model or settings.GEMINI_MODEL or "gemini-2.5-flash"
        self._client = None
        if self.api_key:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize Google GenAI Client: {e}")

    def is_configured(self) -> bool:
        return bool(self.api_key and self._client is not None)

    def _convert_tools(self, tools: List[Dict[str, Any]]):
        """Converts internal tool declarations into Google GenAI types."""
        from google.genai import types
        function_declarations = []
        for t in tools:
            fn = types.FunctionDeclaration(
                name=t["name"],
                description=t.get("description", ""),
                parameters=t.get("parameters", {})
            )
            function_declarations.append(fn)
        return [types.Tool(function_declarations=function_declarations)]

    def generate_response(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        system_instruction: Optional[str] = None
    ) -> AIProviderResponse:
        """
        Executes generateContent on the Gemini model with tool support.
        """
        if not self.is_configured():
            raise RuntimeError("Gemini API key is not configured.")

        from google import genai
        from google.genai import types

        # Build contents structure
        contents = []
        for m in messages:
            role = m["role"]
            if role == "user":
                contents.append(types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=m["content"])]
                ))
            elif role == "model":
                # Gemini attaches an opaque thought_signature to model parts
                # containing function calls.  Reconstructing those parts from
                # only name/args/id loses the signature and causes Gemini to
                # reject the next tool turn with HTTP 400.
                if m.get("gemini_content") is not None:
                    contents.append(m["gemini_content"])
                    continue

                parts = []
                if m.get("content"):
                    parts.append(types.Part.from_text(text=m["content"]))
                if m.get("tool_calls"):
                    for tc in m["tool_calls"]:
                        parts.append(types.Part(
                            function_call=types.FunctionCall(
                                name=tc["name"],
                                args=tc["arguments"],
                                id=tc.get("id")
                            )
                        ))
                contents.append(types.Content(role="model", parts=parts))
            elif role == "function":
                # Keep every response from one model tool-call turn together.
                # This preserves the required model-call -> function-response
                # ordering for parallel Gemini function calls.
                function_responses = m.get("responses")
                if function_responses is not None:
                    parts = [
                        types.Part(
                            function_response=types.FunctionResponse(
                                name=response["name"],
                                response={"result": response["content"]},
                                id=response.get("id")
                            )
                        )
                        for response in function_responses
                    ]
                    contents.append(types.Content(role="user", parts=parts))
                    continue

                # Backwards-compatible handling for a single function response.
                contents.append(types.Content(
                    role="user",
                    parts=[types.Part(
                        function_response=types.FunctionResponse(
                            name=m["name"],
                            response={"result": m["content"]},
                            id=m.get("id")
                        )
                    )]
                ))

        config = types.GenerateContentConfig(
            temperature=0.1, # Low temperature for accurate analytical rigor
            system_instruction=system_instruction
        )

        if tools:
            config.tools = self._convert_tools(tools)

        try:
            response = self._client.models.generate_content(
                model=self.model,
                contents=contents,
                config=config
            )

            tool_calls = []
            if response.function_calls:
                for fc in response.function_calls:
                    tool_calls.append(AIToolCall(
                        id=fc.id or str(uuid.uuid4()),
                        name=fc.name,
                        arguments=dict(fc.args) if fc.args else {}
                    ))

            content = response.text or ""
            return AIProviderResponse(
                content=content,
                tool_calls=tool_calls,
                # Do not decompose this content.  It includes thought
                # signatures that Gemini requires on the next request.
                model_content=(response.candidates[0].content if response.candidates else None)
            )

        except Exception as e:
            logger.error(f"Gemini API invocation failure: {e}")
            raise RuntimeError(f"Gemini API invocation failure: {e}") from e
