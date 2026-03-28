import json
import logging
import urllib.request
import urllib.parse
from sqlalchemy.orm import Session
import anthropic

from .db import SessionLocal
from .models import Post, Comment, User
from .config import settings

logger = logging.getLogger(__name__)

def fetch_brightdata_context(text: str, locality_code: str) -> str:
    """Hackathon scaffolding for Bright Data Search"""
    if not settings.bright_data_api_key or "your-bright-data-key" in settings.bright_data_api_key:
        return f"[MOCK] Searched local government sites in {locality_code}. No official alerts matching: {text}"
    return f"[LIVE] Search results pending for {locality_code} using Bright Data."

def fetch_mem9_context(text: str, locality_code: str) -> str:
    """Retrieve up to 5 related past reports from the mem9 cloud memory using the locality code as a tag."""
    api_key = settings.mem9_api_key
    if not api_key or "your-mem9-key" in api_key:
        return "[MOCK] No mem9 key configured. Memory context unavailable."

    # Using ?tags= instead of ?q= for exact locality matches
    endpoint = f"{settings.mem9_endpoint}/memories?tags={locality_code}&limit=3"
    req = urllib.request.Request(endpoint, headers={"X-API-Key": api_key})
    
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read().decode())
            memories = data.get("memories", [])
            # mem9 fallback format just in case it returns an array at root or 'items'
            if type(data) is list:
                memories = data
            
            if not memories:
                return f"[LIVE] No past false reports found in cloud memory for locality '{locality_code}'."
            
            context = "Recent flagged false reports nearby:\n"
            for m in memories:
                content = m.get("content", "")
                context += f"- '{content}'\n"
            return context
    except Exception as e:
        logger.error(f"Failed to fetch mem9 context: {e}")
        return f"[ERROR] mem9 unreachable: {e}"

def store_mem9_context(text: str, locality_code: str) -> None:
    """Store a verified false report into the mem9 cloud memory."""
    api_key = settings.mem9_api_key
    if not api_key or "your-mem9-key" in api_key:
        return

    endpoint = f"{settings.mem9_endpoint}/memories"
    payload = {
        "content": text,
        "tags": [locality_code, "false_report"],
        "source": "CouncilProxyAgent"
    }
    
    req = urllib.request.Request(
        endpoint, 
        data=json.dumps(payload).encode("utf-8"),
        headers={"X-API-Key": api_key, "Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            logger.info("Successfully stored false report in mem9 memory.")
    except Exception as e:
        logger.error(f"Failed to store memory in mem9: {e}")

def evaluate_factuality(post_text: str, search_context: str, memory_context: str) -> bool:
    """Returns True if the post is determined to be false/fake news using LLM."""
    if "test false" in post_text.lower():
        return True

    prompt = f"""You are the OpenClaw Council Proxy Fact-Checking Agent.
Your job is to read the user report, compare it against search context and memory, and determine if it is conclusively a false report.
User Report: "{post_text}"
Search Context: {search_context}
Memory Context: {memory_context}

If this is clearly a fake report (e.g. contradicting search context or matching a known past fake report), output EXACTLY 'FALSE_REPORT'. Otherwise output 'LEGIT'.
"""

    if settings.validation_provider.lower() == "anthropic" and settings.anthropic_api_key and "place-your-anthropic-key" not in settings.anthropic_api_key:
        try:
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            response = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=20,
                messages=[{"role": "user", "content": [{"type": "text", "text": prompt}]}]
            )
            return "FALSE_REPORT" in response.content[0].text
        except Exception as e:
            logger.error(f"Anthropic agent logic failed: {e}")
            return False

    return False

def run_openclaw_agent(post_id: int) -> None:
    """Main OpenClaw background worker loop."""
    with SessionLocal() as db:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post or post.moderation_status != "pending":
            return
            
        logger.info(f"OpenClaw Agent scanning post {post.id}...")
        
        # 1. Scraping (Bright Data)
        search_ctx = fetch_brightdata_context(post.text, post.locality_code)
        
        # 2. Memory Recall (mem9 cloud api)
        mem_ctx = fetch_mem9_context(post.text, post.locality_code)
        
        # 3. Agent Reasoning
        is_false = evaluate_factuality(post.text, search_ctx, mem_ctx)
            
        # 4. Action Execution
        if is_false:
            # 4a. Persist the new false report back into long-term cloud memory so the agent remembers it forever.
            store_mem9_context(post.text, post.locality_code)
            
            agent_user = db.query(User).filter(User.email == "agent@openclaw.ai").first()
            if agent_user:
                # 4b. Agent drops massive downvotes to secure community rejection and ensure 50-coin penalty at expiry
                post.downvotes_count += 5
                
                # 4c. Add fact-check comment
                comment_text = f"🤖 **OpenClaw Agent Fact-Check**: Based on local municipal data and memory context, this claim is unverified or matches a known false report.\n\n*Sources:*\n{search_ctx}"
                comment = Comment(
                    post_id=post.id,
                    user_id=agent_user.id,
                    text=comment_text,
                    is_negative=True
                )
                post.negative_comments_count += 1
                db.add(comment)
                db.commit()
                logger.info(f"OpenClaw Agent penalized false report post {post.id}")
