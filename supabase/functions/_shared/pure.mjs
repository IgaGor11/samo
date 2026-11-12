const encoder = new TextEncoder();
export async function digest(text) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(text)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function hmac(key, text) {
  const k = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", k, encoder.encode(text)),
  );
}
export function equal(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++)
    diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export async function identity(raw, token, now = Date.now()) {
  if (typeof raw !== "string" || raw.length > 12000)
    throw Error("Invalid session");
  const data = new URLSearchParams(raw);
  if (new Set(data.keys()).size !== [...data.keys()].length)
    throw Error("Duplicate fields");
  const hash = data.get("hash") || "";
  data.delete("hash");
  const check = [...data.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = await hmac(encoder.encode("WebAppData"), token);
  const expected = [...(await hmac(secret, check))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const age = now / 1000 - Number(data.get("auth_date"));
  if (
    !equal(expected, hash) ||
    !data.has("auth_date") ||
    !Number.isFinite(age) ||
    age < -30 ||
    age > 3600
  )
    throw Error("Expired session");
  const user = JSON.parse(data.get("user") || "{}");
  if (!Number.isSafeInteger(user.id) || user.id <= 0)
    throw Error("Invalid user");
  return user.id;
}
export function publicIPv4(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return false;
  return !(
    p[0] === 0 ||
    p[0] === 10 ||
    p[0] === 127 ||
    p[0] >= 224 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && (p[1] === 168 || p[1] === 0 || p[1] === 2)) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 198 && (p[1] === 18 || p[1] === 19 || p[1] === 51)) ||
    (p[0] === 203 && p[1] === 0 && p[2] === 113)
  );
}
export function settings(input = {}) {
  const text = (key, max) => String(input[key] || "").slice(0, max);
  const number = (key, min, max, fallback) => {
    const n = Number(input[key]);
    return Math.max(
      min,
      Math.min(
        max,
        input[key] !== undefined && input[key] !== "" && Number.isFinite(n)
          ? n
          : fallback,
      ),
    );
  };
  return {
    sources: text("sources", 8000),
    priorities: text("priorities", 2000),
    excluded: text("excluded", 2000),
    description: text("description", 12000),
    tone: text("tone", 200),
    signature: text("signature", 200),
    memory: text("memory", 6000),
    language: text("language", 50) || "Русский",
    length: number("length", 300, 3500, 1800),
    interval_hours: number("interval_hours", 1, 168, 6),
    daily_limit: number("daily_limit", 1, 20, 3),
    quiet_start: number("quiet_start", 0, 23, 23),
    quiet_end: number("quiet_end", 0, 23, 8),
    quiet: input.quiet === true,
    include_source: input.include_source !== false,
  };
}
export function quietNow(s, zone, now = new Date()) {
  if (!s.quiet) return false;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  return s.quiet_start < s.quiet_end
    ? hour >= s.quiet_start && hour < s.quiet_end
    : hour >= s.quiet_start || hour < s.quiet_end;
}
