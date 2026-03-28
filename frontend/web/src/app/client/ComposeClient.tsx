"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/token";
import type { PostCreateResponse, ValidationResult } from "@/lib/types";
import { getCurrentCoords, updateLocationOnServer } from "@/lib/location";
import type { FormEvent } from "react";

export default function ComposeClient() {
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [createdPostId, setCreatedPostId] = useState<number | null>(null);
  const [showMismatchPopup, setShowMismatchPopup] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    (async () => {
      try {
        const c = await getCurrentCoords();
        setCoords(c);
        await updateLocationOnServer(c.lat, c.lon);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`${msg} You can still browse, but posting requires location.`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!coords) {
      setError("Location required");
      return;
    }
    setLoading(true);
    setError(null);
    setValidation(null);
    setCreatedPostId(null);
    setShowMismatchPopup(false);
    try {
      const form = new FormData();
      form.append("text", text);
      form.append("lat", String(coords.lat));
      form.append("lon", String(coords.lon));
      if (imageFile) form.append("image", imageFile);

      const res = await apiFetch<PostCreateResponse>(
        "/posts",
        { method: "POST", body: form },
        token,
      );

      // Check if validation failed (post was flagged)
      if (res.validation && !res.validation.matches) {
        setValidation(res.validation);
        setCreatedPostId(res.post_id ?? null);
        setShowMismatchPopup(true);
        setError(null);
      } else {
        // Validation passed, post created successfully
        router.push(`/post/${res.post_id}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4">
      <div className="max-w-2xl mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">New complaint</h1>
            <div className="text-sm text-zinc-600">
              Location: {coords ? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}` : "Locating..."}
            </div>
          </div>
          <button
            className="px-3 py-1 rounded-full text-sm bg-zinc-200"
            onClick={() => router.push("/")}
          >
            Back
          </button>
        </div>

        {error ? <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-800">{error}</div> : null}

        {validation && validation.matches ? (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800">
            ✓ Content validated: Image and description match ({(validation.confidence * 100).toFixed(0)}% confidence)
          </div>
        ) : null}

        {validation && !validation.matches ? (
          <div className="mb-4 p-3 rounded-xl bg-yellow-50 text-yellow-800 border border-yellow-200">
            ⚠ Content mismatch detected:
            <div className="text-sm mt-1">{validation.reasoning}</div>
            {validation.flags.length > 0 && (
              <div className="text-xs mt-2">Issues: {validation.flags.join(", ")}</div>
            )}
          </div>
        ) : null}
        {/* Hidden posted item block removed to prevent accessing uncreated items */}
        {createdPostId && validation && !validation.matches ? (
          <div className="mb-4">
            <button
              className="w-full px-4 py-2 rounded-full bg-yellow-600 text-white hover:bg-yellow-700"
              onClick={() => router.push(`/post/${createdPostId}`)}
              type="button"
            >
              View posted item anyway
            </button>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="bg-white border rounded-2xl p-6">
          <div className="mb-4">
            <label className="text-sm text-zinc-700">Complaint text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 mt-1 min-h-[140px]"
              required
            />
          </div>

          <div className="mb-5">
            <label className="text-sm text-zinc-700">Picture (required)</label>
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="w-full mt-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-full bg-zinc-900 text-white disabled:opacity-60"
          >
            {loading ? "Posting..." : "Post complaint"}
          </button>
        </form>
      </div>

      {showMismatchPopup && validation && !validation.matches ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[92%] max-w-xl bg-white rounded-2xl border p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-xl font-semibold text-red-800">❌ Post Flagged</div>
                <div className="mt-2 text-sm text-red-700 font-semibold">
                  Your post has been marked as irrelevant to pic and desc. 
                </div>
                <div className="mt-1 text-sm text-red-700">
                  10 coins have been deducted from your profile for this irrelevant post. It will not appear in the community feed but can be viewed in your profile separately.
                </div>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <div className="text-sm text-red-800">
                <div className="font-semibold mb-1">Why was this rejected?</div>
                <div>{validation.reasoning}</div>
              </div>
              {validation.flags.length > 0 ? (
                <div className="text-xs text-red-700 mt-2">
                  Issues: {validation.flags.join(", ")}
                </div>
              ) : null}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
              <div className="text-sm text-blue-800">
                <strong>What to do:</strong>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>Make sure the photo clearly shows the issue you're describing</li>
                  <li>Write an accurate description of what's in the photo</li>
                  <li>Avoid describing things that aren't visible in the image</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 px-4 py-2 rounded-full bg-zinc-600 hover:bg-zinc-700 text-white"
                onClick={() => {
                  setShowMismatchPopup(false);
                  setValidation(null);
                  setError(null);
                }}
                type="button"
              >
                Edit & Try Again
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-900"
                onClick={() => {
                  setShowMismatchPopup(false);
                  router.push("/profile");
                }}
                type="button"
              >
                Go to Profile
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

