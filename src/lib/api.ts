import type { Envelope } from "@/types";
const base = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1";
let csrfToken = "";
let csrfPromise: Promise<string> | null = null;
let refreshPromise: Promise<boolean> | null = null;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = "",
  ) {
    super(message);
  }
}
export function clearSessionToken() {
  csrfToken = "";
}
async function getCsrf() {
  if (csrfToken) return csrfToken;
  if (!csrfPromise)
    csrfPromise = fetch(`${base}/auth/csrf`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((r) => {
        csrfToken = r.data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfPromise = null;
      });
  return csrfPromise;
}
async function request(
  path: string,
  options: RequestInit,
  retried = false,
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (options.method && !["GET", "HEAD"].includes(options.method))
    headers.set("X-CSRF-Token", await getCsrf());
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      0,
    );
  }
  if (
    response.status === 401 &&
    !retried &&
    (!path.startsWith("/auth/") ||
      path === "/auth/me" ||
      path === "/auth/password")
  ) {
    if (!refreshPromise)
      refreshPromise = getCsrf()
        .then((csrf) =>
          fetch(`${base}/auth/refresh`, {
            method: "POST",
            credentials: "include",
            headers: { "X-CSRF-Token": csrf },
          }),
        )
        .then((r) => r.ok)
        .catch(() => false)
        .finally(() => {
          refreshPromise = null;
        });
    if (await refreshPromise) return request(path, options, true);
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("session-expired"));
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (payload?.error?.code === "CSRF") csrfToken = "";
    throw new ApiError(
      payload?.error?.message || `Request failed (${response.status}).`,
      response.status,
      payload?.error?.code,
    );
  }
  return response;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<Envelope<T>> {
  const response = await request(path, options);
  if (response.status === 204) return { data: undefined as T };
  const result = await response.json();
  if (result.data?.csrfToken) csrfToken = result.data.csrfToken;
  return result;
}
export const mutate = <T = unknown>(
  path: string,
  method: string,
  body: unknown,
  key?: string,
) =>
  api<T>(path, {
    method,
    body: JSON.stringify(body),
    ...(key ? { headers: { "Idempotency-Key": key } } : {}),
  });
export async function download(path: string, filename: string) {
  const response = await request(path, {}),
    blob = await response.blob();
  const href = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
export function queryString(
  values: Record<string, string | number | undefined>,
) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, value]) => value !== "" && value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}
