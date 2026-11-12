// Isolated synthetic tenants: never sends Telegram messages or calls an AI provider.
import { createHmac, randomInt, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const token = process.env.TELEGRAM_BOT_TOKEN,
  access = process.env.SUPABASE_ACCESS_TOKEN;
if (!token || !access) throw Error("Smoke-test credentials missing");
const owner = 8000000000000 + randomInt(1000000000),
  other = owner + 1,
  channel = randomUUID();
async function sql(query) {
  const r = await fetch(
    "https://api.supabase.com/v1/projects/fpgdsosfwsrfxebvkgdz/database/query",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  if (!r.ok) throw Error("Smoke setup failed: " + r.status);
  return r.json();
}
function init(id) {
  const data = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: "Automated test" }),
  });
  const key = createHmac("sha256", "WebAppData").update(token).digest();
  const body = [...data]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  data.set("hash", createHmac("sha256", key).update(body).digest("hex"));
  return data.toString();
}
async function call(id, action, payload = {}, allowed = true) {
  const r = await fetch(
    "https://fpgdsosfwsrfxebvkgdz.supabase.co/functions/v1/api",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: init(id), action, ...payload }),
    },
  );
  const result = await r.json();
  if (allowed)
    assert.equal(r.status, 200, action + ": " + JSON.stringify(result));
  else assert.notEqual(r.status, 200, action + " must reject");
  return result;
}
try {
  await sql(
    `insert into accounts(telegram_id) values(${owner}),(${other}); insert into channels(id,owner_id,telegram_chat_id,title,kind) values('${channel}',${owner},${-owner},'Automated test','personal');`,
  );
  assert.equal((await call(owner, "channels")).length, 1);
  assert.equal((await call(other, "channels")).length, 0);
  const post = await call(owner, "create_post", {
    channel_id: channel,
    brief: "Isolated test draft",
  });
  await call(
    other,
    "create_post",
    { channel_id: channel, brief: "Should not write" },
    false,
  );
  await call(
    other,
    "edit_post",
    { post_id: post.id, content: "Attack", attachment_ids: [] },
    false,
  );
  await call(owner, "edit_post", {
    post_id: post.id,
    content: "Edited draft",
    attachment_ids: [],
  });
  await call(owner, "schedule_post", {
    post_id: post.id,
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
  });
  await call(other, "cancel_schedule", { post_id: post.id }, false);
  await call(owner, "cancel_schedule", { post_id: post.id });
  await call(owner, "save_ai", {
    purpose: "text",
    provider: "groq",
    model: "test-model",
    key: "not-a-real-key-smoke-test",
  });
  const connections = await call(owner, "ai_status");
  assert.equal(connections.length, 1);
  assert.equal(connections[0].encrypted_secret, undefined);
  const records = await sql(
    `select encrypted_secret from ai_credentials where owner_id=${owner}`,
  );
  assert.ok(records[0].encrypted_secret);
  assert.notEqual(records[0].encrypted_secret, "not-a-real-key-smoke-test");
  assert.equal((await call(other, "posts")).length, 0);
  console.log(
    "PASS: live Telegram signature, tenant isolation, draft lifecycle, scheduling, encrypted credential storage",
  );
} finally {
  await sql(`delete from accounts where telegram_id in (${owner},${other});`);
}
