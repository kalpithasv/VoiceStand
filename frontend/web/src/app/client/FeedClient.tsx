"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getImageUrl } from "@/lib/api";
import { getAccessToken, clearAccessToken } from "@/lib/token";
import type { PostOut, UserOut } from "@/lib/types";
import { getCurrentCoords, updateLocationOnServer } from "@/lib/location";

export default function FeedClient() {
  const router = useRouter();

  const token = useMemo(() => getAccessToken(), []);
  const [me, setMe] = useState<UserOut | null>(null);
  const [feed, setFeed] = useState<PostOut[]>([]);
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
      return "Voting is open for ~5 hours. At expiry, upvotes vs downvotes decides visibility.";
    }
    if (p.moderation_status === "legit") {
      return "Verified by community: upvotes >= downvotes at expiry.";
    }
    return "Marked as false news: downvotes > upvotes at expiry. Reporter coins deducted.";
  }

  async function updateLocationOnServerOnly() {
    const { lat, lon } = await getCurrentCoords();
    await updateLocationOnServer(lat, lon);
  }

  async function fetchMeAndFeed() {
    const meRes = await apiFetch<UserOut>("/me", { method: "GET" }, token);
    setMe(meRes);
    const posts = await apiFetch<PostOut[]>("/feed", { method: "GET" }, token);
    setFeed(posts);
  }

  async function refreshAllWithLocation() {
    setLoading(true);
    setError(null);
    try {
      try {
        await updateLocationOnServerOnly();
      } catch (e) {
        // Geolocation permission issues should not block feed rendering.
        setError(e instanceof Error ? e.message : String(e));
      }
      await fetchMeAndFeed();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function refreshFeedOnly() {
    try {
      await fetchMeAndFeed();
    } catch (e) {
      // avoid spamming UI while polling
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    const alive = { current: true };
    refreshAllWithLocation();

    const feedTimer = window.setInterval(() => {
      if (!alive.current) return;
      void refreshFeedOnly();
    }, 8000);

    // Update location periodically so locality feed stays correct.
    const locationTimer = window.setInterval(() => {
      if (!alive.current) return;
      void refreshAllWithLocation();
    }, 60_000);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      alive.current = false;
      window.clearInterval(feedTimer);
      window.clearInterval(locationTimer);
    };
  }, [router, token]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  async function vote(postId: number, vote: "up" | "down") {
    try {
      const updated = await apiFetch<PostOut>(
        `/posts/${postId}/vote`,
        { method: "POST", body: JSON.stringify({ vote }) },
        token,
      );
      setFeed((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function logout() {
    clearAccessToken();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-bold">Voicestand</div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-600">{me?.locality_code ?? "Locating..."}</span>
            <button
              className="px-3 py-1 rounded-full text-sm bg-zinc-900 text-white"
              onClick={() => router.push("/compose")}
            >
              Post
            </button>
            <button
              className="px-3 py-1 rounded-full text-sm bg-zinc-200"
              onClick={() => router.push("/profile")}
            >
              Profile
            </button>
            <button className="px-3 py-1 rounded-full text-sm bg-zinc-200" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {error ? <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-800">{error}</div> : null}
        {loading ? <div className="text-zinc-600">Loading feed...</div> : null}

        {feed.length === 0 && !loading ? (
          <div className="text-zinc-600 mt-10 text-center">
            No reports in your locality yet.
            <div className="mt-3">
              <button
                className="px-4 py-2 rounded-full bg-zinc-900 text-white"
                onClick={() => router.push("/compose")}
              >
                Create the first post
              </button>
            </div>
          </div>
        ) : null}

        <div>
          {feed.map((p) => (
            <article key={p.id} className="bg-white rounded-2xl border p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center text-sm">
                  {p.reporter_email?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{p.reporter_email}</div>
                    <div className="text-xs text-zinc-500 text-right">
                      {p.moderation_status === "pending"
                        ? `Live • ${getTimeRemaining(p.expires_at).hours}h ${getTimeRemaining(p.expires_at).minutes}m left`
                        : p.moderation_status === "legit"
                          ? "Verified"
                          : "Wrong"}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-zinc-900 whitespace-pre-wrap">{p.text}</p>
                  <p className="mt-1 text-xs text-zinc-500">{moderationExplanation(p)}</p>
                </div>
              </div>

              {p.image_path ? (
                <img
                  src={getImageUrl(p.image_path) || ""}
                  alt="Post"
                  className="w-full rounded-xl mt-3 object-cover max-h-80"
                />
              ) : null}

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-sm"
                    onClick={() => vote(p.id, "up")}
                  >
                    Upvote ({p.upvotes_count})
                  </button>
                  <button
                    className="px-3 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-sm"
                    onClick={() => vote(p.id, "down")}
                  >
                    Downvote ({p.downvotes_count})
                  </button>
                </div>
                <Link className="text-sm text-zinc-700 underline" href={`/post/${p.id}`}>
                  Discuss
                </Link>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

