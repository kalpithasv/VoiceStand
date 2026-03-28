import { getAccessToken } from "./token";

const DEFAULT_API_BASE_URL = "http://localhost:8080";

export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!envUrl || envUrl.trim().length === 0) return DEFAULT_API_BASE_URL;

  const trimmed = envUrl.trim();
  // If someone accidentally points the API base at the frontend dev server,
  // uploaded images will 404 (backend serves `/uploads`).
  try {
    const u = new URL(trimmed);
    if (u.port === "3000") return DEFAULT_API_BASE_URL;
    // If someone points to another frontend port by mistake, keep backend default.
    if (u.port === "3000") return DEFAULT_API_BASE_URL;
  } catch {
    // If parsing fails, fall back to whatever envUrl provided.
  }

  return trimmed;
}

export function getImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  return `${getApiBaseUrl()}${imagePath}`;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;
  const accessToken = token ?? getAccessToken();

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  // Only set JSON headers for JSON bodies.
  const hasBody = init.body !== undefined && init.body !== null;
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (hasBody && !isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    const text = contentType.includes("application/json") ? await res.json() : await res.text();
    throw new Error(typeof text === "string" ? text : JSON.stringify(text));
  }
  if (!contentType.includes("application/json")) {
    return (await res.text()) as unknown as T;
  }
  return (await res.json()) as T;
}

