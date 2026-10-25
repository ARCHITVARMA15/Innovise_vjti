"""
Agent configuration constants and safe LLM call helper.
"""

import asyncio
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

log = logging.getLogger("veritas.config")

# ── Model Configuration ──────────────────────────────────────────────────────

PRIMARY_MODEL = "llama-3.3-70b-versatile"
ROUTER_MODEL = "llama-3.1-8b-instant"

PRIMARY_MAX_TOKENS = 2200
ROUTER_MAX_TOKENS = 100

PRIMARY_TEMPERATURE = 0.1
ROUTER_TEMPERATURE = 0.0

# ── Agent Limits ─────────────────────────────────────────────────────────────

MAX_ENTITIES_PER_QUERY = 3
MAX_RETRIES = 2
RETRY_DELAY_BASE = 2  # seconds, exponential backoff


def _get_groq_api_key() -> str:
    load_dotenv(dotenv_path=_ENV_PATH, override=True)
    return os.getenv("GROQ_API_KEY", "")


async def safe_llm_call(
    messages: list[dict[str, str]],
    model: str = PRIMARY_MODEL,
    temperature: float = PRIMARY_TEMPERATURE,
    max_tokens: int = PRIMARY_MAX_TOKENS,
    fallback_model: str | None = None,
) -> str:
    """
    LLM call with retry on rate-limit and optional model fallback.

    Returns the response content string.
    Raises RuntimeError only after all retries are exhausted.
    """
    from langchain_groq import ChatGroq

    api_key = _get_groq_api_key()
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set in .env")

    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES + 1):
        current_model = model
        if attempt == MAX_RETRIES and fallback_model:
            current_model = fallback_model
            log.warning("Falling back to %s after %d failed attempts", fallback_model, attempt)

        try:
            llm = ChatGroq(
                model=current_model,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=api_key,
            )
            response = await llm.ainvoke(messages)
            return response.content
        except Exception as exc:
            last_error = exc
            error_str = str(exc).lower()

            is_rate_limit = "429" in error_str or "rate" in error_str
            is_overloaded = "503" in error_str or "overloaded" in error_str

            if is_rate_limit and attempt < MAX_RETRIES:
                delay = RETRY_DELAY_BASE * (attempt + 1)
                log.warning("Rate limited (attempt %d/%d). Retrying in %ds...", attempt + 1, MAX_RETRIES, delay)
                await asyncio.sleep(delay)
                continue

            if is_overloaded and fallback_model and attempt < MAX_RETRIES:
                log.warning("Model overloaded. Will try fallback on next attempt.")
                continue

            break

    raise RuntimeError(f"LLM call failed after {MAX_RETRIES + 1} attempts: {last_error}")
