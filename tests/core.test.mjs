import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  identity,
  settings,
  quietNow,
  publicIPv4,
} from "../supabase/functions/_shared/pure.mjs";
import { publicFetch } from "../supabase/functions/_shared/network.mjs";
const token = "123:test",
  now = 1800000000000;
function signed(user = 123, date = now / 1000) {
  const params = new URLSearchParams({
    auth_date: String(date),
    user: JSON.stringify({ id: user }),
    query_id: "abc",
  });
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const check = [...params]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return params.toString();
}
test("Telegram signatures authenticate only the signed user", async () => {
  assert.equal(await identity(signed(), token, now), 123);
  await assert.rejects(identity(signed().replace("123", "124"), token, now));
  await assert.rejects(identity(signed(), token + "x", now));
});
test("expired, future, duplicate and malformed sessions rejected", async () => {
  for (const raw of [
    signed(123, now / 1000 - 3601),
    signed(123, now / 1000 + 60),
    signed() + "&auth_date=1",
    signed(-5),
    "",
  ])
    await assert.rejects(identity(raw, token, now));
});
test("private and special IPv4 destinations rejected", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.1.1",
    "192.168.1.1",
    "172.16.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.1.1.1",
    "198.18.0.1",
  ])
    assert.equal(publicIPv4(ip), false, ip);
  assert.equal(publicIPv4("8.8.8.8"), true);
});
test("unsafe URLs never reach remote fetch", async () => {
  for (const url of [
    "http://example.com",
    "https://localhost",
    "https://[::1]/",
    "https://user:pass@example.com",
    "https://example.com:8443",
  ])
    await assert.rejects(publicFetch(url));
});
test("limits clamp and midnight quiet hours preserve zero", () => {
  const s = settings({
    interval_hours: -4,
    daily_limit: 999,
    quiet_start: 0,
    quiet_end: 8,
    quiet: true,
  });
  assert.equal(s.interval_hours, 1);
  assert.equal(s.daily_limit, 20);
  assert.equal(s.quiet_start, 0);
  assert.equal(quietNow(s, "UTC", new Date("2026-11-12T04:00:00Z")), true);
  assert.equal(quietNow(s, "UTC", new Date("2026-11-12T12:00:00Z")), false);
});
