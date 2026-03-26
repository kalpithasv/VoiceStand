# Quick Start: AI Validation Setup

## What Was Done

✅ **Fixed Errors:**
- Next.js dynamic params error in post detail page
- Image 404 loading errors (now loading from backend)

✅ **Implemented AI Validation Agent:**
- Claude Vision analyzes if image matches description
- Flags mismatches (e.g., pothole pic vs "child injured" text)
- Shows confidence score and specific issues
- Integrates seamlessly into post creation

---

## 3 Steps to Activate AI Validation

### Step 1: Get API Key (30 seconds)
```bash
# Go to: https://console.anthropic.com/account/keys
# Create new API key → Copy it
```

### Step 2: Add to Backend Config (10 seconds)
```bash
# Edit backend/.env and add:
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```

### Step 3: Restart Backend (5 seconds)
```bash
cd /Users/nivas/VoiceStand
pkill -f "python -m uvicorn"  # Kill old process
source backend/.venv/bin/activate
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8080
```

---

## Test It

1. Open **http://localhost:3000** in browser
2. Login with your test account
3. Click **"Post"** button
4. Upload an image of a real problem (pothole, flooding, etc.)
5. Write matching description: **"Large pothole on Main Street"**
6. **✓ Green validation badge** appears (matches!)
7. Try again with mismatched text: **"Child injured here"**
8. **⚠ Yellow warning** shows (mismatch detected!)

---

## What It Does

```
User Action              AI Response
─────────────────────────────────────────────────────
Pothole pic +            ✓ Green badge
"Pothole on Main St"     95% confidence, no flags

Pothole pic +            ⚠ Yellow warning
"Child hit by cars"      content_mismatch flag

Generic pic +            ⚠ Yellow warning
"Something's wrong"      description_too_vague flag
```

---

## Current Status

| Component | Status | Port |
|-----------|--------|------|
| Backend API | ✅ Running | 8080 |
| Web Frontend | ✅ Running | 3000 |
| Image Uploads | ✅ Fixed | 8080/uploads |
| Location Filtering | ✅ Working | - |
| Auth System | ✅ Working | - |
| AI Validation | ⏳ Ready (needs API key) | - |

---

## System Architecture

```
┌─────────────────────┐
│   Next.js Frontend  │
│   (localhost:3000)  │
└──────────┬──────────┘
           │ HTTP
           ↓
┌─────────────────────────────────────────┐
│      FastAPI Backend (8080)             │
│  ┌──────────────────────────────────┐   │
│  │ Create Post Endpoint             │   │
│  │  1. Save image to /uploads       │   │
│  │  2. Call Claude Vision (NEW!)    │   │
│  │  3. Return validation results    │   │
│  └──────────────────────────────────┘   │
│                    │                      │
│                    ↓ (if image exists)   │
│  ┌──────────────────────────────────┐   │
│  │ Validation Service (NEW!)        │   │
│  │  • Base64 encode image           │   │
│  │  • Send to Claude API            │   │
│  │  • Get match score + flags       │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## Files Modified

### Backend
- ✨ `backend/app/validation.py` (NEW - Claude integration)
- 📝 `backend/app/main.py` (Updated /posts endpoint)
- 📝 `backend/app/schemas.py` (Added ValidationResult)
- 📝 `backend/requirements.txt` (Added anthropic)

### Frontend
- 📝 `frontend/web/src/lib/api.ts` (Added getImageUrl helper)
- 📝 `frontend/web/src/app/client/ComposeClient.tsx` (Shows validation)
- 📝 `frontend/web/src/app/client/FeedClient.tsx` (Fixed images)
- 📝 `frontend/web/src/app/client/PostDetailClient.tsx` (Fixed images)
- 📝 `frontend/web/src/app/post/[id]/page.tsx` (Fixed Next.js params)
- 📝 `frontend/web/src/lib/types.ts` (Added ValidationResult type)

---

## Troubleshooting

### Images still showing 404?
```bash
# Verify backend is running on 8080
curl http://127.0.0.1:8080/uploads/
# Should list files (or 403, not 404)
```

### "Module 'anthropic' not found"
```bash
cd backend && source .venv/bin/activate && pip install anthropic
```

### Validation not running?
```bash
# Check API key is set
grep ANTHROPIC_API_KEY backend/.env

# Should show: ANTHROPIC_API_KEY=sk-ant-...
# If missing, add it and restart backend
```

### Claude returns error?
```bash
# Check if:
# 1. API key is valid (test at console.anthropic.com)
# 2. Account has credits
# 3. Image file exists in backend/uploads/
```

---

## What Happens Next

After setup, when users create posts:

```json
{
  "post_id": 42,
  "validation": {
    "matches": true,
    "confidence": 0.92,
    "reasoning": "Image clearly shows a pothole, description accurately describes location and severity",
    "flags": []
  }
}
```

The frontend shows:
- **✓ Matches:** Green badge with confidence percentage
- **✗ Mismatch:** Yellow warning with specific issues (content_mismatch, description_too_vague, etc.)
- **Error:** Gray badge (allows post anyway, don't block users)

---

## Next Optimization Ideas

1. **Cache validation results** for identical image+text pairs
2. **Integrate with moderation** - flag low-confidence matches for review
3. **Auto-suspension** - automatically suspend users posting consistently mismatched content
4. **Multi-language support** - analyze descriptions in any language
5. **Metadata extraction** - automatically populate tags from image analysis

---

**Ready to go!** 🚀 Just get your API key and restart the backend.
