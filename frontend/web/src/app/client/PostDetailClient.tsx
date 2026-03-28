"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getImageUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/token";
import type { CommentOut, PostOut } from "@/lib/types";
import { updateLocationOnServer, getCurrentCoords } from "@/lib/location";

export default function PostDetailClient({ id }: { id: number }) {
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  const [post, setPost] = useState<PostOut | null>(null);
  const [comments, setComments] = useState<CommentOut[]>([]);
  const [commentText, setCommentText] = useState("");
  const [negative, setNegative] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  function getTimeRemaining(expiresAtIso: string) {
    const t = new Date(expiresAtIso).getTime() - now;
    const clamped = Math.max(0, t);
    const hours = Math.floor(clamped / 3_600_000);
    const minutes = Math.floor((clamped % 3_600_000) / 60_000);
    const seconds = Math.floor((clamped % 60_000) / 1000);
    return { hours, minutes, seconds, clamped };
  }

  function moderationExplanation(p: PostOut) {
    if (p.moderation_status === "pending") {
      return "Voting is open for ~5 hours. When it expires, upvotes vs downvotes decides visibility.";
    }
    if (p.moderation_status === "legit") {
      return "Verified by community: upvotes >= downvotes at expiry.";
    }
    return "Marked as false news: downvotes > upvotes at expiry. Reporter coins deducted.";
  }

  async function loadDetail(opts?: { silent?: boolean }) {
    if (!token) return;
    if (!opts?.silent) {
      setError(null);
      setLoading(true);
    }
    try {
      const detail = await apiFetch<{ post: PostOut; comments: CommentOut[] }>(
        `/posts/${id}`,
        { method: "GET" },
        token,
      );
      setPost(detail.post);
      setComments(detail.comments);
    } catch (e) {
      if (!opts?.silent) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    // Refresh feed locality (also ensures your locality_code is up-to-date).
    (async () => {
      try {
        const c = await getCurrentCoords();
        await updateLocationOnServer(c.lat, c.lon);
      } catch {
        // ignore; viewing should still work
      }
    })();

    loadDetail();

    const timer = window.setInterval(() => {
      // Keep detail + comments real-time-ish with polling.
      void loadDetail({ silent: true });
    }, 7000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router, token]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  async function vote(vote: "up" | "down") {
    if (!token || !post) return;
    try {
      const updated = await apiFetch<PostOut>(
        `/posts/${post.id}/vote`,
        { method: "POST", body: JSON.stringify({ vote }) },
        token,
      );
      setPost(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submitComment() {
    if (!token || !post) return;
    if (!commentText.trim()) {
      setError("Write a comment first");
      return;
    }
    setError(null);
    try {
      await apiFetch<PostOut>(
        `/posts/${post.id}/comments`,
        { method: "POST", body: JSON.stringify({ text: commentText, is_negative: negative }) },
        token,
      );
      setCommentText("");
      setNegative(false);
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4">
      <div className="max-w-2xl mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <button className="px-3 py-1 rounded-full text-sm bg-zinc-200" onClick={() => router.push("/")}>
            Back
          </button>
          <div className="text-sm text-zinc-600">{post ? post.locality_code : "Loading..."}</div>
        </div>

        {error ? <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-800">{error}</div> : null}
        {loading ? <div className="text-zinc-600 mb-3">Loading post...</div> : null}

        {post ? (
          <div className="bg-white border rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{post.reporter_email}</div>
                <div className={`inline-block mt-1 text-xs font-semibold px-2 py-1 rounded ${post.moderation_status === "pending" ? "bg-zinc-100 text-zinc-500" : post.moderation_status === "legit" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {post.moderation_status === "pending"
                    ? `Live • ${getTimeRemaining(post.expires_at).hours}h ${getTimeRemaining(post.expires_at).minutes}m left`
                    : post.moderation_status === "legit"
                      ? "Verified"
                      : "Wrong"}
                </div>
                <p className="mt-1 text-xs text-zinc-500">{moderationExplanation(post)}</p>
              </div>
              <div className="text-xs text-zinc-500">{new Date(post.expires_at).toLocaleString()}</div>
            </div>

            {post.hidden && post.moderation_status === "wrong" ? (
              <div className="mt-4 mb-3 p-3 rounded-xl bg-yellow-50 text-yellow-800 border border-yellow-200">
                Photo and description do not match. This post is hidden from the community feed.
              </div>
            ) : null}

            <p className="mt-3 text-sm whitespace-pre-wrap">{post.text}</p>
            {post.image_path ? (
              <img src={getImageUrl(post.image_path) || ""} alt="" className="w-full rounded-xl mt-3 object-cover max-h-80" />
            ) : null}

            <div className="mt-4 flex items-center gap-2">
              <button
                className="px-3 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-sm"
                onClick={() => vote("up")}
              >
                Upvote ({post.upvotes_count})
              </button>
              <button
                className="px-3 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-sm"
                onClick={() => vote("down")}
              >
                Downvote ({post.downvotes_count})
              </button>
            </div>

            <div className="mt-6 border-t pt-4">
              <h2 className="font-semibold mb-3">Comments</h2>

              <div className="mb-4">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add context (optionally mark it as false news)"
                  className="w-full border rounded-xl px-3 py-2 min-h-[90px]"
                />
                <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={negative}
                    onChange={(e) => setNegative(e.target.checked)}
                  />
                  Mark as negative / false news
                </label>
                <button
                  className="mt-3 px-4 py-2 rounded-full bg-zinc-900 text-white disabled:opacity-60"
                  onClick={submitComment}
                >
                  Send comment
                </button>
              </div>

              {comments.length === 0 ? (
                <div className="text-zinc-600">No comments yet.</div>
              ) : null}

              <div className="space-y-3">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-3 ${
                      c.is_negative ? "bg-red-50 border-red-200" : "bg-zinc-50 border-zinc-200"
                    }`}
                  >
                    <div className="text-xs text-zinc-600 mb-1">
                      User {c.user_id} • {c.is_negative ? "Negative" : "Neutral"} •{" "}
                      {new Date(c.created_at).toLocaleString()}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{c.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

