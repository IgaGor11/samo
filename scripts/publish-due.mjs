import { createHash } from "node:crypto";
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw Error("Missing TELEGRAM_BOT_TOKEN");
const secret = createHash("sha256")
  .update("samo-worker:" + token)
  .digest("hex");
async function call(action, payload = {}) {
  const r = await fetch(
    "https://fpgdsosfwsrfxebvkgdz.supabase.co/functions/v1/api",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": secret,
      },
      body: JSON.stringify({ action, ...payload }),
      signal: AbortSignal.timeout(120000),
    },
  );
  const data = await r.json();
  if (!r.ok) throw Error("Worker request failed: " + r.status);
  return data;
}
const queue = await call("worker_list");
let failed = 0;
for (const [action, items] of [
  ["worker_publish", queue.posts],
  ["worker_media", queue.jobs],
  ["worker_channel", queue.channels],
])
  for (const item of items) {
    try {
      await call(action, item);
    } catch {
      failed++;
      console.error(`${action} failed for ${item.id}`);
    }
  }
console.log(
  `Processed ${queue.posts.length} publications, ${queue.channels.length} channels, ${queue.jobs.length} media jobs; failures: ${failed}`,
);
if (failed) process.exitCode = 1;
