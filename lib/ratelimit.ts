import { headers } from "next/headers";

// Simple in-memory limits. The site runs as one server on Render, so this is enough;
// counts reset when the server restarts or redeploys.
const g = globalThis as unknown as { __bbkRate?: Map<string, number[]> };
const store = (g.__bbkRate ??= new Map<string, number[]>());

function recent(key: string, windowMs: number) {
  const since = Date.now() - windowMs;
  const hits = (store.get(key) ?? []).filter((t) => t > since);
  if (hits.length) store.set(key, hits);
  else store.delete(key);
  return hits;
}

function sweep() {
  if (store.size < 5000) return;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const [k, v] of store) if (!v.length || v[v.length - 1] < dayAgo) store.delete(k);
}

/** True if `key` has already used up `limit` within the window (does not count this call). */
export function isLimited(key: string, limit: number, windowMs: number) {
  return recent(key, windowMs).length >= limit;
}

/** Count one attempt against `key`. */
export function record(key: string, windowMs: number) {
  const hits = recent(key, windowMs);
  hits.push(Date.now());
  store.set(key, hits);
  sweep();
}

/** Count one attempt and say whether it is allowed (false once the limit is used up). */
export function take(key: string, limit: number, windowMs: number) {
  if (isLimited(key, limit, windowMs)) return false;
  record(key, windowMs);
  return true;
}

export function clear(key: string) {
  store.delete(key);
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

/** The visitor's IP address. Render sits behind Cloudflare, which sets cf-connecting-ip. */
export async function clientIp() {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ||
    h.get("true-client-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
