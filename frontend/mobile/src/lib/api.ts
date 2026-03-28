import Constants from "expo-constants";
import { getAccessToken } from "./token";

function getApiBaseUrl(): string {
  const extraApiUrl = Constants.expoConfig?.extra?.apiUrl;
  if (typeof extraApiUrl === "string" && extraApiUrl.trim().length > 0) return extraApiUrl;
  return "http://127.0.0.1:8000";
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const accessToken = token ?? (await getAccessToken());
  const base = getApiBaseUrl();
  const url = `${base}${path}`;

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const hasBody = init.body !== undefined && init.body !== null;
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (hasBody && !isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    const text = contentType.includes("application/json") ? JSON.stringify(await res.json()) : await res.text();
    throw new Error(text);
  }
  if (!contentType.includes("application/json")) {
    return (await res.text()) as unknown as T;
  }
  return (await res.json()) as T;
}

