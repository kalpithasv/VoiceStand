"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getImageUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/token";
import type { PostOut, UserOut } from "@/lib/types";

export default function ProfileClient() {
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  const [me, setMe] = useState<UserOut | null>(null);
  const [posts, setPosts] = useState<PostOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [wrongModalIndex, setWrongModalIndex] = useState<number | null>(null);

  const wrongHiddenPosts = posts.filter(
    (p) => p.moderation_status === "wrong" && p.hidden && p.validation_matches === false,
  );
  const activeWrongPost = wrongModalIndex !== null ? wrongHiddenPosts[wrongModalIndex] : null;

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    (async () => {
      try {
        const meRes = await apiFetch<UserOut>("/me", { method: "GET" }, token);
        setMe(meRes);
        const my = await apiFetch<PostOut[]>("/me/posts", { method: "GET" }, token);
        setPosts(my);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Compulsory: if you have any wrong/hidden posts, show the explanation modal.
    if (wrongModalIndex === null && wrongHiddenPosts.length > 0) {
      setWrongModalIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongHiddenPosts.length]);

  return (
    <div className="min-h-screen bg-zinc-50 px-4">
      <div className="max-w-2xl mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Your profile</h1>
          <button className="px-3 py-1 rounded-full text-sm bg-zinc-200" onClick={() => router.push("/")}>
            Back
          </button>
        </div>

        {error ? <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-800">{error}</div> : null}

        {me ? (
          <div className="bg-white border rounded-2xl p-6 mb-6">
            <div className="text-sm text-zinc-600">{me.locality_code ?? "No location yet"}</div>
            <div className="font-semibold mt-1">{me.email}</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-zinc-50 border rounded-xl p-3">
                <div className="text-xs text-zinc-600">Coins</div>
                <div className="text-lg font-bold">{me.coins}</div>
              </div>
              <div className="bg-zinc-50 border rounded-xl p-3">
                <div className="text-xs text-zinc-600">Wrong streak</div>
                <div className="text-lg font-bold">{me.wrong_streak}</div>
              </div>
              <div className="bg-zinc-50 border rounded-xl p-3 col-span-2">
                <div className="text-xs text-zinc-600">Total wrong posts</div>
                <div className="text-lg font-bold">{me.wrong_total}</div>
              </div>
            </div>
            <div className="mt-4 text-sm">
              {me.dismissed ? (
                <span className="text-red-700 font-semibold">Account dismissed</span>
              ) : me.suspended_until ? (
                <span className="text-orange-700 font-semibold">Suspended until {me.suspended_until}</span>
              ) : (
                <span className="text-emerald-700 font-semibold">Active</span>
              )}
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {posts.length === 0 ? <div className="text-zinc-600">No posts yet.</div> : null}

          {posts.map((p) => (
            <article key={p.id} className="bg-white border rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-zinc-600">{p.locality_code}</div>
                <div className="text-xs text-zinc-500">
                  {p.moderation_status === "pending" ? "Live" : p.moderation_status === "legit" ? "Verified" : "Wrong"}
                </div>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">{p.text}</p>
              {p.image_path ? <img src={getImageUrl(p.image_path) || ""} alt="" className="mt-3 w-full rounded-xl" /> : null}
              <div className="mt-3 text-sm text-zinc-600 flex gap-3">
                <span>Up: {p.upvotes_count}</span>
                <span>Down: {p.downvotes_count}</span>
              </div>
              <div className="mt-3">
                <button className="text-sm text-zinc-700 underline" onClick={() => router.push(`/post/${p.id}`)}>
                  View
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {activeWrongPost ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[92%] max-w-xl bg-white rounded-2xl border p-5">
            <div className="text-lg font-semibold text-red-800">Post flagged: photo & description mismatch</div>
            <div className="mt-2 text-sm text-red-700">
              This post is removed from the community feed.
            </div>

            {activeWrongPost.image_path ? (
              <img
                src={getImageUrl(activeWrongPost.image_path) || ""}
                alt=""
                className="mt-3 w-full rounded-xl object-cover max-h-60"
              />
            ) : null}

            <div className="mt-3 text-sm text-zinc-900">
              <div className="font-semibold text-zinc-800">Your description</div>
              <div className="whitespace-pre-wrap">{activeWrongPost.text}</div>
            </div>

            <div className="mt-3 text-sm text-zinc-800">
              <div className="font-semibold text-red-800">Reason</div>
              <div className="mt-1">{activeWrongPost.validation_reasoning || "Mismatch detected by the validation agent."}</div>
            </div>

            {activeWrongPost.validation_flags && activeWrongPost.validation_flags.length > 0 ? (
              <div className="mt-2 text-xs text-zinc-600">
                Issues: {activeWrongPost.validation_flags.join(", ")}
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (wrongModalIndex === null) return;
                  const next = wrongModalIndex + 1;
                  if (next >= wrongHiddenPosts.length) setWrongModalIndex(null);
                  else setWrongModalIndex(next);
                }}
                type="button"
              >
                {wrongModalIndex !== null && wrongModalIndex + 1 < wrongHiddenPosts.length
                  ? "Next"
                  : "Ok"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

