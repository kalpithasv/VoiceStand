"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setAccessToken } from "@/lib/token";
import type { TokenResponse } from "@/lib/types";
import type { FormEvent } from "react";

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(res.access_token);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white border rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-2">Login</h1>
        <p className="text-zinc-600 mb-6">Vote locally. Report responsibly.</p>

        {error ? <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-800">{error}</div> : null}

        <div className="mb-3">
          <label className="text-sm text-zinc-700">Email</label>
          <input
            className="w-full border rounded-xl px-3 py-2 mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </div>

        <div className="mb-4">
          <label className="text-sm text-zinc-700">Password</label>
          <input
            className="w-full border rounded-xl px-3 py-2 mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>

        <button
          disabled={loading}
          className="w-full px-4 py-2 rounded-full bg-zinc-900 text-white disabled:opacity-60"
          type="submit"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <div className="mt-4 text-sm text-zinc-600">
          New here?{" "}
          <a className="underline" href="/signup">
            Create an account
          </a>
        </div>
      </form>
    </div>
  );
}

