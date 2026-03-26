"""
Content validation service using Claude AI for image-text matching.
Validates that post descriptions match their attached images.
"""

import base64
import os
from io import BytesIO

import anthropic


def validate_post_content(image_path: str, description: str) -> dict:
    """
    Validate if an image and description match using Claude Vision.
    
    Args:
        image_path: Path to the image file (e.g., "/uploads/filename.jpg")
        description: Text description of the post
    
    Returns:
        {
            "matches": bool,  # Whether image and description match
            "confidence": float,  # 0.0 to 1.0
            "reasoning": str,  # Explanation of the validation result
            "flags": list,  # Any concerns (e.g., "description_too_vague", "content_mismatch")
        }
    """
    try:
        # Read the image file
        upload_dir = os.environ.get("UPLOAD_DIR", "./uploads")
        # `image_path` is expected to be like "/uploads/<filename>".
        # Avoid using `lstrip("/uploads/")` because it treats the argument as a *set* of characters.
        rel_path = image_path
        if rel_path.startswith("/uploads/"):
            rel_path = rel_path[len("/uploads/") :]
        elif rel_path.startswith("uploads/"):
            rel_path = rel_path[len("uploads/") :]
        rel_path = rel_path.lstrip("/")
        full_path = os.path.join(upload_dir, rel_path)
        
        if not os.path.exists(full_path):
            return {
                "matches": False,
                "confidence": 0.0,
                "reasoning": "Image file not found",
                "flags": ["image_not_found"],
            }
        
        # Read and encode image
        with open(full_path, "rb") as f:
            image_data = base64.standard_b64encode(f.read()).decode("utf-8")
        
        # Determine image media type
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
        
        # Call Claude API with vision
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        
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
                                "data": image_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": f"""Analyze this image and the following description. Determine if they match.

Description: "{description}"

Respond ONLY with a JSON object (no markdown, no code blocks) with this exact structure:
{{
  "matches": true/false,
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation of why they match or don't match",
  "flags": ["flag1", "flag2"]
}}

Flags to use (if applicable):
- "content_mismatch" - Image and description describe completely different things
- "description_too_vague" - Description is too generic to validate against image
- "partial_match" - Description is partially accurate but misses key elements
- "irrelevant_details" - Description includes irrelevant information not in image
- "perspective_difference" - Same subject but different perspective/context

Example: If image is a pothole but description says "child hit by car", use "content_mismatch"."""
                        }
                    ],
                }
            ],
        )
        
        # Parse response
        response_text = message.content[0].text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.split("```")[0]
        response_text = response_text.strip()
        
        import json
        result = json.loads(response_text)
        
        return {
            "matches": result.get("matches", False),
            "confidence": float(result.get("confidence", 0.0)),
            "reasoning": result.get("reasoning", ""),
            "flags": result.get("flags", []),
        }
    
    except anthropic.APIError as e:
        return {
            "matches": True,  # Allow post to proceed if validation fails
            "confidence": 0.0,
            "reasoning": f"Validation error: {str(e)}",
            "flags": ["validation_error"],
        }
    except Exception as e:
        return {
            "matches": True,  # Allow post to proceed if validation fails
            "confidence": 0.0,
            "reasoning": f"Unexpected error: {str(e)}",
            "flags": ["validation_error"],
        }
