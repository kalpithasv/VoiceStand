"""
Content validation service for image-text matching.
Defaults to Agnes AI and supports Anthropic as fallback provider.
"""

import base64
import json
import os
import urllib.error
import urllib.request

from .config import settings


VALIDATION_PROMPT_TEMPLATE = """STRICT IMAGE-DESCRIPTION MATCHING VALIDATION

Your role: Verify that a social media complaint's image EXACTLY matches its description.

DESCRIPTION TO VALIDATE:
"{description}"

YOUR TASK:
1. Analyze the image content carefully
2. Compare against the description
3. Reject if there's ANY mismatch

REJECTION CRITERIA (If ANY apply, return matches=false):
✗ Description mentions PEOPLE/CHILDREN/ANIMALS → but image doesn't show them
✗ Description mentions a SPECIFIC ACTION (hit, fell, accident) → but image doesn't depict it
✗ Description mentions a SPECIFIC OBJECT (car, bike, person) → but image doesn't show it
✗ Description is about an INCIDENT/ACCIDENT → but image shows ONLY infrastructure damage
✗ Image shows one thing, description claims something completely different

EXAMPLES OF REJECTION:
- Description: "child hit on car and fell" + Image: pothole/road → REJECT (no child/accident visible)
- Description: "drunk driver" + Image: empty parked car → REJECT (no action/state visible)
- Description: "traffic signal broken" + Image: generic street → REJECT (element not visible)

EXAMPLES OF ACCEPTANCE:
- Description: "pothole on main road" + Image: clear pothole visible → ACCEPT
- Description: "road damage and debris" + Image: damaged asphalt with debris → ACCEPT

CRITICAL: Be very strict. If description mentions people/incidents but image doesn't show them clearly, REJECT.

Respond ONLY with JSON (no markdown):
{{
  "matches": true/false,
  "confidence": 0.0 to 1.0,
  "reasoning": "Specific explanation of match or mismatch",
  "flags": ["flag_name"]
}}

Flags to use:
- "complete_mismatch" - Image and description are completely unrelated
- "missing_subjects" - People/objects mentioned in description not visible in image
- "missing_action" - Action/incident mentioned but not visible
- "valid_match" - Description accurately matches image
- "subject_different" - Image shows different subject than described
"""


def _validation_error_result(reason: str) -> dict:
    return {
        "matches": True,  # Allow post to proceed if validation fails
        "confidence": 0.0,
        "reasoning": reason,
        "flags": ["validation_error"],
    }


def _image_to_base64(image_path: str) -> tuple[str, str]:
    upload_dir = settings.upload_dir
    rel_path = image_path
    if rel_path.startswith("/uploads/"):
        rel_path = rel_path[len("/uploads/") :]
    elif rel_path.startswith("uploads/"):
        rel_path = rel_path[len("uploads/") :]
    rel_path = rel_path.lstrip("/")
    full_path = os.path.join(upload_dir, rel_path)

    if not os.path.exists(full_path):
        raise FileNotFoundError("Image file not found")

    with open(full_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    ext = os.path.splitext(full_path)[1].lower()
    media_type_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".heic": "image/heic",
    }
    media_type = media_type_map.get(ext, "image/jpeg")
    return image_data, media_type


def _strip_markdown_fences(response_text: str) -> str:
    text = response_text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.split("```")[0]
    return text.strip()


def _normalize_validation_result(result: dict) -> dict:
    flags = result.get("flags", [])
    if not isinstance(flags, list):
        flags = []

    return {
        "matches": bool(result.get("matches", False)),
        "confidence": float(result.get("confidence", 0.0)),
        "reasoning": str(result.get("reasoning", "")),
        "flags": [str(f) for f in flags],
    }


def _extract_text_from_chat_content(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text_value = item.get("text")
                if isinstance(text_value, str):
                    parts.append(text_value)
        return "\n".join(parts).strip()
    return ""


def _validate_with_agnes(image_b64: str, media_type: str, description: str) -> dict:
    if not settings.agnes_api_key:
        return _validation_error_result("Validation error: AGNES_API_KEY not configured")

    endpoint = settings.agnes_chat_completions_url or f"{settings.agnes_base_url.rstrip('/')}/chat/completions"
    prompt = VALIDATION_PROMPT_TEMPLATE.format(description=description)

    payload = {
        "model": settings.agnes_model,
        "temperature": 0,
        "max_completion_tokens": 500,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{media_type};base64,{image_b64}"},
                    },
                ],
            }
        ],
    }

    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.agnes_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=45) as response:
        body = json.loads(response.read().decode("utf-8"))
    content = body["choices"][0]["message"]["content"]
    text_content = _extract_text_from_chat_content(content)
    if not text_content:
        text_content = json.dumps(content)
    parsed = json.loads(_strip_markdown_fences(text_content))
    return _normalize_validation_result(parsed)


def _validate_with_anthropic(image_b64: str, media_type: str, description: str) -> dict:
    if not settings.anthropic_api_key:
        return _validation_error_result("Validation error: ANTHROPIC_API_KEY not configured")

    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=500,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": VALIDATION_PROMPT_TEMPLATE.format(description=description)},
                ],
            }
        ],
    )
    parsed = json.loads(_strip_markdown_fences(message.content[0].text))
    return _normalize_validation_result(parsed)


def validate_post_content(image_path: str, description: str) -> dict:
    """
    Validate if an image and description match.
    Returns: matches, confidence, reasoning, flags.
    """
    try:
        image_b64, media_type = _image_to_base64(image_path)
        provider = settings.validation_provider.lower().strip()

        if provider == "anthropic":
            return _validate_with_anthropic(image_b64, media_type, description)
        return _validate_with_agnes(image_b64, media_type, description)
    except FileNotFoundError:
        return {
            "matches": False,
            "confidence": 0.0,
            "reasoning": "Image file not found",
            "flags": ["image_not_found"],
        }
    except urllib.error.HTTPError as e:
        return _validation_error_result(f"Validation HTTP error: {e.code}")
    except urllib.error.URLError as e:
        return _validation_error_result(f"Validation network error: {str(e.reason)}")
    except Exception as e:
        return _validation_error_result(f"Unexpected error: {str(e)}")
