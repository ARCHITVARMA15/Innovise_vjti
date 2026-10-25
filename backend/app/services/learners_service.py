import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_CONTENT_FILE = _DATA_DIR / "learners_content.json"
_PROGRESS_FILE = _DATA_DIR / "learners_progress.json"


def _load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)


def _normalize_text(value: str) -> str:
    return value.strip().lower()


def _resource_matches_query(resource: dict[str, Any], investor_name: str, query: str) -> bool:
    needle = _normalize_text(query)
    hay = " ".join(
        [
            str(resource.get("title", "")),
            str(resource.get("summary", "")),
            " ".join(resource.get("topics", [])),
            investor_name,
        ]
    ).lower()
    return needle in hay


def _topic_video_suggestions(query: str, investors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not query.strip():
        return []

    featured = [inv.get("name", "") for inv in investors[:3] if inv.get("name")]
    if not featured:
        featured = ["Warren Buffett", "Ray Dalio", "Rakesh Jhunjhunwala"]

    suggestions: list[dict[str, Any]] = []
    for index, name in enumerate(featured, start=1):
        search_query = f"{query} {name} investing"
        suggestions.append(
            {
                "id": f"generated_video_{index}_{_normalize_text(query).replace(' ', '_')}",
                "title": f"Search YouTube: {query} with {name}",
                "type": "video",
                "investor_id": "",
                "investor_name": name,
                "topics": [query],
                "level": "all",
                "duration_minutes": 10,
                "source": "YouTube Search",
                "url": f"https://www.youtube.com/results?search_query={search_query.replace(' ', '+')}",
                "summary": "Auto-suggested video search from your topic query.",
                "is_generated": True,
                "thumbnail_url": "/learners/placeholders/video-card.svg",
                "image_source": "Generated search placeholder",
                "image_license": "Internal placeholder",
                "image_credit": "CodeCrafters",
            }
        )
    return suggestions


def _investor_name_map(investors: list[dict[str, Any]]) -> dict[str, str]:
    return {str(i.get("id", "")): str(i.get("name", "")) for i in investors}


def _default_thumbnail_by_type(resource_type: str) -> str:
    if resource_type == "video":
        return "/learners/placeholders/video-card.svg"
    if resource_type == "book":
        return "/learners/placeholders/book-card.svg"
    if resource_type == "podcast":
        return "/learners/placeholders/podcast-card.svg"
    return "/learners/placeholders/story-card.svg"


def _extract_youtube_video_id(url: str) -> str | None:
    if not url:
        return None

    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    path = (parsed.path or "").strip("/")

    if "youtu.be" in host:
        candidate = path.split("/")[0] if path else ""
        return candidate[:11] if candidate else None

    if "youtube.com" in host:
        if path == "watch":
            video_id = parse_qs(parsed.query).get("v", [""])[0]
            return video_id[:11] if video_id else None

        match = re.match(r"^(shorts|embed)/([^/?#]+)", path)
        if match:
            return match.group(2)[:11]

    return None


def _thumbnail_from_url(url: str) -> str | None:
    video_id = _extract_youtube_video_id(url)
    if not video_id:
        return None
    return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"


def _build_attributions(investors: list[dict[str, Any]], resources: list[dict[str, Any]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    items: list[dict[str, str]] = []

    def add_item(entity_type: str, title: str, source: str, license_name: str, credit: str) -> None:
        key = "|".join([entity_type, title, source, license_name, credit])
        if key in seen:
            return
        seen.add(key)
        items.append(
            {
                "entity_type": entity_type,
                "title": title,
                "source": source,
                "license": license_name,
                "credit": credit,
            }
        )

    for investor in investors:
        source = str(investor.get("image_source", "")).strip()
        license_name = str(investor.get("image_license", "")).strip()
        credit = str(investor.get("image_credit", "")).strip()
        if source or license_name or credit:
            add_item("investor", str(investor.get("name", "")), source, license_name, credit)

    for resource in resources:
        source = str(resource.get("image_source", "")).strip()
        license_name = str(resource.get("image_license", "")).strip()
        credit = str(resource.get("image_credit", "")).strip()
        if source or license_name or credit:
            add_item("resource", str(resource.get("title", "")), source, license_name, credit)

    return items


def _set_level_from_xp(progress: dict[str, Any]) -> None:
    xp = int(progress.get("xp", 0))
    if xp >= 400:
        progress["level"] = "Master"
    elif xp >= 250:
        progress["level"] = "Advanced"
    elif xp >= 120:
        progress["level"] = "Explorer"
    else:
        progress["level"] = "Starter"


def _resource_status(progress: dict[str, Any], resource_id: str, fallback_index: int) -> tuple[str, int]:
    completed = set(progress.get("completed_resource_ids", []))
    in_progress = set(progress.get("in_progress_resource_ids", []))

    if resource_id in completed:
        return "completed", 100
    if resource_id in in_progress:
        return "in_progress", 45 + (fallback_index % 35)
    return "not_started", 0


def get_progress() -> dict[str, Any]:
    progress = _load_json(_PROGRESS_FILE, {})
    if not progress:
        progress = {
            "user_id": "default",
            "xp": 0,
            "streak_days": 0,
            "level": "Explorer",
            "lessons_completed": 0,
            "quizzes_taken": 0,
            "correct_answers": 0,
            "completed_resource_ids": [],
            "in_progress_resource_ids": [],
            "last_active": datetime.now(timezone.utc).isoformat(),
        }
        _save_json(_PROGRESS_FILE, progress)
    else:
        progress.setdefault("completed_resource_ids", [])
        progress.setdefault("in_progress_resource_ids", [])
    return progress


def update_progress(action: str, resource_id: str | None = None) -> dict[str, Any]:
    progress = get_progress()
    completed = progress.setdefault("completed_resource_ids", [])
    in_progress = progress.setdefault("in_progress_resource_ids", [])

    if action == "lesson_started":
        if resource_id and resource_id not in completed and resource_id not in in_progress:
            in_progress.append(resource_id)
            progress["xp"] = int(progress.get("xp", 0)) + 3

    elif action == "lesson_completed":
        if resource_id and resource_id not in completed:
            completed.append(resource_id)
            if resource_id in in_progress:
                in_progress.remove(resource_id)
            progress["lessons_completed"] = int(progress.get("lessons_completed", 0)) + 1
            progress["xp"] = int(progress.get("xp", 0)) + 20
    elif action == "daily_visit":
        progress["streak_days"] = int(progress.get("streak_days", 0)) + 1
        progress["xp"] = int(progress.get("xp", 0)) + 5

    _set_level_from_xp(progress)

    progress["last_active"] = datetime.now(timezone.utc).isoformat()
    _save_json(_PROGRESS_FILE, progress)
    return progress


def get_overview(
    query: str | None = None,
    resource_type: str | None = None,
    investor_id: str | None = None,
    limit: int = 24,
) -> dict[str, Any]:
    payload = _load_json(_CONTENT_FILE, {"investors": [], "resources": [], "quiz_cards": []})
    investors = payload.get("investors", [])
    resources = payload.get("resources", [])
    investor_map = _investor_name_map(investors)

    progress = get_progress()

    filtered: list[dict[str, Any]] = []
    for idx, resource in enumerate(resources):
        if resource_type and resource_type != "all" and resource.get("type") != resource_type:
            continue
        if investor_id and investor_id != "all" and resource.get("investor_id") != investor_id:
            continue

        item = dict(resource)
        item["investor_name"] = investor_map.get(str(resource.get("investor_id", "")), "")

        if query and query.strip() and not _resource_matches_query(item, item.get("investor_name", ""), query):
            continue

        status, progress_percent = _resource_status(progress, str(item.get("id", "")), idx)
        item["is_generated"] = False
        item["status"] = status
        item["progress_percent"] = progress_percent
        existing_thumbnail = str(item.get("thumbnail_url", "")).strip()
        item["thumbnail_url"] = existing_thumbnail or (_thumbnail_from_url(str(item.get("url", ""))) or "")
        item.setdefault("image_source", "Internal placeholder")
        item.setdefault("image_license", "Internal placeholder")
        item.setdefault("image_credit", "CodeCrafters")
        filtered.append(item)

    filtered = filtered[:max(1, limit)]

    generated: list[dict[str, Any]] = []
    if query and query.strip() and (not resource_type or resource_type in {"all", "video"}):
        generated = _topic_video_suggestions(query, investors)

    for item in generated:
        item["status"] = "not_started"
        item["progress_percent"] = 0

    normalized_investors: list[dict[str, Any]] = []
    for investor in investors:
        item = dict(investor)
        item.setdefault("image_url", "/learners/placeholders/investor-generic.svg")
        item.setdefault("image_source", "Internal placeholder")
        item.setdefault("image_license", "Internal placeholder")
        item.setdefault("image_credit", "CodeCrafters")
        normalized_investors.append(item)

    merged_resources = filtered + generated

    return {
        "progress": progress,
        "investors": normalized_investors,
        "resources": merged_resources,
        "quiz_count": len(payload.get("quiz_cards", [])),
        "attributions": _build_attributions(normalized_investors, merged_resources),
    }


def get_quiz_cards(limit: int = 5) -> list[dict[str, Any]]:
    payload = _load_json(_CONTENT_FILE, {"quiz_cards": []})
    cards = payload.get("quiz_cards", [])
    results: list[dict[str, Any]] = []

    for card in cards[:max(1, limit)]:
        results.append(
            {
                "id": card.get("id", ""),
                "question": card.get("question", ""),
                "options": card.get("options", []),
                "topic": card.get("topic", ""),
                "level": card.get("level", "beginner"),
            }
        )
    return results


def submit_quiz_answer(card_id: str, selected_index: int) -> dict[str, Any]:
    payload = _load_json(_CONTENT_FILE, {"quiz_cards": []})
    card = next((c for c in payload.get("quiz_cards", []) if c.get("id") == card_id), None)
    if not card:
        raise ValueError("Invalid card_id")

    correct_index = int(card.get("correct_index", -1))
    is_correct = selected_index == correct_index

    progress = get_progress()
    progress["quizzes_taken"] = int(progress.get("quizzes_taken", 0)) + 1
    progress["xp"] = int(progress.get("xp", 0)) + (10 if is_correct else 3)
    if is_correct:
        progress["correct_answers"] = int(progress.get("correct_answers", 0)) + 1

    _set_level_from_xp(progress)

    progress["last_active"] = datetime.now(timezone.utc).isoformat()
    _save_json(_PROGRESS_FILE, progress)

    return {
        "card_id": card_id,
        "selected_index": selected_index,
        "correct_index": correct_index,
        "correct": is_correct,
        "explanation": card.get("explanation", ""),
        "progress": progress,
    }
