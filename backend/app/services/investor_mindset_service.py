import json
from pathlib import Path
from typing import Any

from app.agent.config import PRIMARY_MODEL, safe_llm_call


_DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "investor_personas.json"


def _load_personas_raw() -> list[dict[str, Any]]:
    if not _DATA_FILE.exists():
        return []
    with _DATA_FILE.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        return []
    return [p for p in data if isinstance(p, dict)]


def list_personas() -> list[dict[str, Any]]:
    personas = _load_personas_raw()
    results: list[dict[str, Any]] = []
    for p in personas:
        results.append(
            {
                "id": p.get("id", ""),
                "name": p.get("name", ""),
                "title": p.get("title", ""),
                "era": p.get("era", ""),
                "image_url": p.get("image_url", ""),
                "core_style": p.get("core_style", ""),
                "persona_summary": p.get("persona_summary", ""),
                "stocks_focus": p.get("stocks_focus", []),
                "sectors_focus": p.get("sectors_focus", []),
                "risk_profile": p.get("risk_profile", ""),
                "time_horizon": p.get("time_horizon", ""),
                "net_worth_estimate": p.get("net_worth_estimate", ""),
                "famous_advice": p.get("famous_advice", ""),
                "signature_bets": p.get("signature_bets", []),
                "notable_facts": p.get("notable_facts", []),
                "principles": p.get("principles", []),
                "sample_prompts": p.get("sample_prompts", []),
            }
        )
    return results


def get_persona_by_id(persona_id: str) -> dict[str, Any] | None:
    for persona in _load_personas_raw():
        if persona.get("id") == persona_id:
            return persona
    return None


def _render_persona_context(persona: dict[str, Any], extra_context: str | None = None) -> str:
    principles = "\n".join(f"- {item}" for item in persona.get("principles", []))
    avoid_patterns = "\n".join(f"- {item}" for item in persona.get("avoid_patterns", []))
    stocks = ", ".join(persona.get("stocks_focus", []))
    sectors = ", ".join(persona.get("sectors_focus", []))

    extra = ""
    if extra_context and extra_context.strip():
        extra = f"\nAdditional user context:\n{extra_context.strip()}\n"

    return (
        f"Investor Persona: {persona.get('name', 'Unknown')}\n"
        f"Role: {persona.get('title', 'N/A')}\n"
        f"Era/Style: {persona.get('era', 'N/A')}\n"
        f"Core style: {persona.get('core_style', 'N/A')}\n"
        f"Summary: {persona.get('persona_summary', 'N/A')}\n"
        f"Preferred sectors: {sectors or 'N/A'}\n"
        f"Preferred symbols: {stocks or 'N/A'}\n"
        f"Risk profile: {persona.get('risk_profile', 'N/A')}\n"
        f"Time horizon: {persona.get('time_horizon', 'N/A')}\n"
        f"Principles:\n{principles or '- N/A'}\n"
        f"Avoid patterns:\n{avoid_patterns or '- N/A'}"
        f"{extra}"
    )


async def generate_persona_answer(query: str, persona_id: str, extra_context: str | None = None) -> str:
    persona = get_persona_by_id(persona_id)
    if not persona:
        raise ValueError("Invalid persona_id")

    persona_context = _render_persona_context(persona, extra_context)

    system_prompt = (
        "You are Veritas Mindset, speaking in the selected investor persona's voice. "
        "Be specific and decisive, not generic. "
        "Use first-person persona language (for example: 'I would prioritize...', 'I avoid...'). "
        "When user context/history is provided, explicitly anchor recommendations to it with wording like "
        "'Based on your history and positioning...'. "
        "Remain educational and risk-aware. Do not claim real-time holdings certainty. "
        "If uncertain, state assumptions explicitly and still give a concrete base-case stance. "
        "Write naturally like a real person speaking to the user, not like a template or checklist. "
        "Use markdown lightly only when it helps readability. "
        "Always end with a bolded **Key Takeaway:** line that gives one clear, actionable recommendation. "
        "The Key Takeaway must be specific to the user's query and include a concrete next step."
    )

    user_message = (
        f"Selected persona context:\n{persona_context}\n\n"
        f"User question:\n{query}\n\n"
        "Respond as the selected persona in a natural conversational flow. "
        "Give a clear recommendation and practical next actions without using a rigid numbered format. "
        "Make sure the final line is exactly in this form: **Key Takeaway:** <solid actionable advice>."
    )

    return await safe_llm_call(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        model=PRIMARY_MODEL,
        max_tokens=700,
        fallback_model="llama-3.1-8b-instant",
    )
