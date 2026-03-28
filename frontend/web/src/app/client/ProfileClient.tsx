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
  const irrelevantPosts = posts.filter(
    (p) => p.moderation_status === "irrelevant" || (p.moderation_status === "wrong" && p.validation_matches === false),
  );
  
  const regularPosts = posts.filter(
    (p) => !(p.moderation_status === "irrelevant" || (p.moderation_status === "wrong" && p.validation_matches === false)),
  );

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

        <div className="space-y-4 mb-10">
          <h2 className="text-xl font-bold mb-4">Your Complaints</h2>
          {regularPosts.length === 0 ? <div className="text-zinc-600">No regular posts yet.</div> : null}

          {regularPosts.map((p) => (
            <article key={p.id} className="bg-white border rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-zinc-600">{p.locality_code}</div>
                <div className={`text-xs font-semibold px-2 py-1 rounded ${p.moderation_status === "pending" ? "bg-zinc-100 text-zinc-500" : p.moderation_status === "legit" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
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

        {irrelevantPosts.length > 0 && (
          <div className="space-y-4 mt-8 pt-8 border-t border-zinc-200">
            <h2 className="text-xl font-bold text-red-800">Irrelevant Complaints</h2>
            <p className="text-sm text-zinc-600 mb-4">These posts were flagged by the AI for a mismatch between the provided image and description.</p>

            {irrelevantPosts.map((p) => (
              <article key={p.id} className="bg-red-50 border border-red-200 rounded-2xl p-4 opacity-80">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-red-800 font-bold">Penalty Applied</div>
                  <div className="text-xs text-white font-semibold px-2 py-1 bg-red-600 rounded">
                    -10 Coins
                  </div>
                </div>
                <p className="mt-2 text-sm text-zinc-800 whitespace-pre-wrap">{p.text}</p>
                {p.image_path ? <img src={getImageUrl(p.image_path) || ""} alt="" className="mt-3 w-full rounded-xl" /> : null}
                <div className="mt-4 bg-white/60 p-3 rounded-xl border border-red-100">
                    <div className="text-xs font-bold text-red-800 mb-1">AI Reasoning</div>
                    <div className="text-xs text-red-700">{p.validation_reasoning || "Mismatch detected by the validation agent."}</div>
                    {p.validation_flags && p.validation_flags.length > 0 ? (
                      <div className="mt-1 text-[10px] text-zinc-600">
                        Flags: {p.validation_flags.join(", ")}
                      </div>
                    ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

