import base64
import json
import urllib.request
from app.config import settings

# mock 1x1 image
b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

payload = {
    "model": "openai/gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 500,
    "messages": [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Is this a valid image?"},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64}"},
                },
            ],
        }
    ],
}

req = urllib.request.Request(
    "https://zenmux.ai/api/v1/chat/completions",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": "Bearer sk-ai-v1-4ffca3648296359d6dc5dce5349b4a218a5211a22d13b7ffc6543680d5136a40",
        "Content-Type": "application/json",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=10) as response:
        print(response.read().decode())
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode())

