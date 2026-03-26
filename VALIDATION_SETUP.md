# Voicestand Content Validation Setup

## Overview
The app now includes an **AI-powered content validation system** that uses Claude Vision to verify that user-submitted images match their descriptions. This helps prevent misinformation and ensures post reliability.

## How It Works

### Validation Flow
1. **User creates a post** with text description and image
2. **Backend validates** using Claude Vision API:
   - Analyzes the image
   - Compares against the text description
   - Returns match status, confidence score, and flags
3. **Frontend displays** validation results:
   - ✓ Green: Description matches image (high confidence)
   - ⚠ Yellow: Content mismatch detected with warnings
   - Post is created regardless (but flagged for moderation)

### Example Validations
| Scenario | Result | Flags |
|----------|--------|-------|
| Post: "Pothole on Main St" + Image: Pothole | ✓ Matches | None |
| Post: "Child hit by two people" + Image: Pothole | ✗ Mismatch | `content_mismatch` |
| Post: Generic complaint + Image: Specific | ⚠ Partial | `partial_match`, `description_too_vague` |

## Setup Instructions

### 1. Get Anthropic API Key
- Visit: https://console.anthropic.com/account/keys
- Create a new API key
- Copy it safely

### 2. Configure Backend Environment
Create/update `.env` in `backend/`:
```bash
ANTHROPIC_API_KEY=your-key-here
```

Or update the existing:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env and add your ANTHROPIC_API_KEY
```

### 3. Install Dependencies
```bash
cd backend
source .venv/bin/activate
pip install anthropic
```

### 4. Restart Backend
```bash
cd /Users/nivas/VoiceStand
source backend/.venv/bin/activate
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8080
```

## API Changes

### POST /posts Response
**Old:**
```json
{ "post_id": 123 }
```

**New:**
```json
{
  "post_id": 123,
  "validation": {
    "matches": true,
    "confidence": 0.95,
    "reasoning": "Image shows a pothole, description accurately describes location and damage",
    "flags": []
  }
}
```

## Validation Flags

| Flag | Meaning | Example |
|------|---------|---------|
| `content_mismatch` | Image and description describe different things | Pic: Pothole, Text: "Person injured" |
| `description_too_vague` | Description too generic to validate | Pic: Road, Text: "Issue on my street" |
| `partial_match` | Some accuracy but missing key details | Pic: Specific pothole, Text: "Road damage" |
| `irrelevant_details` | Description includes unrelated info | Pic: Pothole, Text: "Weather is rainy" |
| `perspective_difference` | Same subject, different context | Pic: Wide shot, Text: Details of specific area |
| `validation_error` | API error (post still created) | N/A |

## Testing

### Test Case 1: Matching Content
1. Go to Compose
2. Upload: Photo of a pothole
3. Text: "Large pothole on Main Street near intersection"
4. Expected: ✓ Green badge, high confidence

### Test Case 2: Mismatched Content  
1. Go to Compose
2. Upload: Photo of a pothole
3. Text: "Child hit by two cars at the intersection"
4. Expected: ⚠ Yellow warning about content mismatch

### Test Case 3: Vague Description
1. Go to Compose
2. Upload: Photo of flooding
3. Text: "Something is broken"
4. Expected: ⚠ Yellow warning about vague description

## Architecture

### Backend Files
- `backend/app/validation.py` - Claude Vision validation service
- `backend/app/schemas.py` - Updated with `ValidationResult` schema
- `backend/app/main.py` - Updated `/posts` endpoint

### Frontend Files
- `frontend/web/src/lib/types.ts` - `ValidationResult` type
- `frontend/web/src/app/client/ComposeClient.tsx` - Displays validation results
- `frontend/web/src/lib/api.ts` - `getImageUrl()` helper for image loading

## Troubleshooting

### "No module named 'anthropic'"
```bash
cd backend && source .venv/bin/activate && pip install anthropic
```

### "ANTHROPIC_API_KEY not set"
```bash
# Check your .env file exists and has the key
cat backend/.env | grep ANTHROPIC_API_KEY

# Or set it temporarily
export ANTHROPIC_API_KEY=sk-ant-...
```

### Images not loading (404 errors)
Images should now load from `http://localhost:8080/uploads/...` instead of localhost:3000. The frontend helper `getImageUrl()` handles this automatically.

### Validation always returns "error"
Check that:
1. API key is valid
2. Image file exists in `backend/uploads/`
3. Backend can read the file (check permissions)

## Location-Based Access

The app already filters posts by locality (approximately 1km buckets) based on user location:
- Location is captured at login, on feed load, and when composing
- Locality code is computed from lat/lon with `LOCALITY_DECIMALS=2`
- Feed only shows posts from same locality
- All working ✓

## Auth System

- Email + password authentication with JWT tokens
- Tokens expire after 7 days (configurable)
- Bearer token in Authorization header
- All working ✓

## Next Steps

1. **Test the validation** with real images and descriptions
2. **Monitor Claude API costs** (vision requests are higher cost)
3. **Consider future improvements**:
   - Cache validation results for identical image+text
   - Integrate validation feedback into user reputation
   - Add automatic moderation flags for low-confidence mismatches
   - Multi-language support for descriptions
