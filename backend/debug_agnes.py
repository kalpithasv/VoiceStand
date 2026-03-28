import sys
import os
sys.path.append("/Users/nivas/VoiceStand/backend")

from app.validation import _validate_with_agnes, _image_to_base64
import json

try:
    print(f"Testing with image: 5b8ba4078ade4a148bd04ef88cae4e69.webp")
    image_b64, media_type = _image_to_base64("/uploads/5b8ba4078ade4a148bd04ef88cae4e69.webp")
    res = _validate_with_agnes(image_b64, media_type, "fire at a place")
    print("Agnes response:")
    print(json.dumps(res, indent=2))
except Exception as e:
    import traceback
    traceback.print_exc()
