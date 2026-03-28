"""
Mem9 integration for user credibility tracking and memory-based flagging.
Tracks user streaks, flags chronic offenders, and stores behavioral patterns.
"""

import json
import urllib.error
import urllib.request

from .config import settings


def _mem9_request(endpoint: str, data: dict) -> dict | None:
    """Make HTTP request to Mem9 API."""
    if not settings.mem9_api_key or not settings.mem9_endpoint:
        return None

    url = f"{settings.mem9_endpoint.rstrip('/')}/{endpoint}"
    payload = json.dumps(data).encode("utf-8")
    
    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": f"Bearer {settings.mem9_api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"Mem9 API error: {e}")
        return None


def update_user_streak_memory(user_id: int, wrong_streak: int, wrong_total: int, is_wrong: bool):
    """
    Update Mem9 with user's validation streak.
    Flags users with streak >= 5 as chronic offenders.
    """
    if not settings.mem9_api_key:
        return

    user_key = f"user:{user_id}:credibility"
    
    # Determine credibility status
    credibility_status = "clean"
    if wrong_streak >= 5:
        credibility_status = "flagged_chronic"
    elif wrong_streak >= 3:
        credibility_status = "suspicious"
    elif wrong_total >= 10:
        credibility_status = "flagged_total"
    
    # Store in Mem9
    memory_data = {
        "key": user_key,
        "value": {
            "user_id": user_id,
            "wrong_streak": wrong_streak,
            "wrong_total": wrong_total,
            "credibility_status": credibility_status,
            "last_update": "now",
        },
        "metadata": {
            "type": "user_credibility",
            "category": "validation",
            "is_flagged": wrong_streak >= 5 or wrong_total >= 10,
        },
    }
    
    _mem9_request("memory/store", memory_data)


def get_user_credibility(user_id: int) -> dict | None:
    """Retrieve user's credibility information from Mem9."""
    if not settings.mem9_api_key:
        return None

    user_key = f"user:{user_id}:credibility"
    
    retrieve_data = {
        "key": user_key,
    }
    
    result = _mem9_request("memory/retrieve", retrieve_data)
    return result.get("value") if result else None


def flag_user_chronic_offender(user_id: int, reason: str):
    """Flag user as chronic offender in Mem9 for system-wide tracking."""
    if not settings.mem9_api_key:
        return

    flag_data = {
        "key": f"user:{user_id}:flags",
        "value": {
            "user_id": user_id,
            "flag_type": "chronic_offender",
            "reason": reason,
            "threshold": "5_consecutive_wrong_posts",
        },
        "metadata": {
            "type": "user_flag",
            "severity": "high",
            "auto_flagged": True,
        },
    }
    
    _mem9_request("memory/store", flag_data)


def check_user_is_flagged(user_id: int) -> bool:
    """Check if user is flagged as chronic offender in Mem9."""
    credibility = get_user_credibility(user_id)
    if credibility:
        return credibility.get("credibility_status") in ["flagged_chronic", "flagged_total"]
    return False


def record_validation_event(user_id: int, post_id: int, matches: bool, reasoning: str):
    """Record individual validation event in Mem9 for pattern analysis."""
    if not settings.mem9_api_key:
        return

    event_data = {
        "key": f"user:{user_id}:validation_history",
        "value": {
            "user_id": user_id,
            "post_id": post_id,
            "validation_result": "passed" if matches else "failed",
            "reasoning": reasoning,
        },
        "metadata": {
            "type": "validation_event",
            "category": "event_log",
        },
    }
    
    _mem9_request("memory/store", event_data)
