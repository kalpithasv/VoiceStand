# Voicestand

Hackathon build: mobile + web clients for a locality-based complaint feed (Twitter-like UI).

## Tech

- Backend: Python `FastAPI` + SQLAlchemy (MySQL-compatible, works with TiDB Cloud Zero)
- Auth: email + password (JWT)
- Frontend:
  - Mobile: Expo Go (React Native)
  - Web: Next.js (React)

## OpenClaw tool mapping (hackathon)

- `Zeabur`: deploy the FastAPI backend and serve the `/uploads` images.
- `TiDB Cloud Zero`: set `backend/.env` `DATABASE_URL` to the provided MySQL connection string.

## Run locally

### 1) Backend

```bash
cd backend
cp .env.example .env
# set DATABASE_URL + JWT_SECRET as needed
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 2) Web client (Next.js)

```bash
cd frontend/web
npm install
npm run dev
```

### 3) Mobile client (Expo Go)

```bash
cd frontend/mobile
npm install
npm run start
```

Open the Expo Go app and scan the QR code.

## Rules implemented (as requested)

- User location is captured on login/feed/compose and converted into a “locality bucket” using `LOCALITY_DECIMALS=2` (~1km).
- Feed shows only posts from the same locality and hides posts immediately when `downvotes > upvotes`.
- Every post expires/gets finalized after `POST_TTL_HOURS=5`.
  - If `upvotes >= downvotes` at expiry: status becomes `legit` and reporter’s wrong-streak resets.
  - If `downvotes > upvotes` at expiry: status becomes `wrong`, reporter loses `50 coins`, and wrong counters update:
    - 5 consecutive wrong posts => suspended for 7 days
    - 10 total wrong posts => account dismissed

