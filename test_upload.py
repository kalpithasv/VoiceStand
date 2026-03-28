import base64
import requests

b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
img_bytes = base64.b64decode(b64)
with open("test.png", "wb") as f:
    f.write(img_bytes)

# First get a valid token
try:
    res = requests.post("http://localhost:8000/auth/login", data={"username": "user9@testing.com", "password": "password"})
    token = res.json()["access_token"]
except Exception as e:
    # sign up if login fails
    requests.post("http://localhost:8000/auth/signup", json={"email": "user9000@testing.com", "password": "password"})
    res = requests.post("http://localhost:8000/auth/login", data={"username": "user9000@testing.com", "password": "password"})
    token = res.json()["access_token"]

# Now upload the file
with open("test.png", "rb") as f:
    files = {"image": ("test.png", f, "image/png")}
    data = {
        "text": "Huge fire engulfing a building",
        "lat": "1.3",
        "lon": "103.85"
    }
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post("http://localhost:8000/posts", files=files, data=data, headers=headers)
    import json
    print(json.dumps(resp.json(), indent=2))
