import { readFile, readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const ref = "fpgdsosfwsrfxebvkgdz";
const access = process.env.SUPABASE_ACCESS_TOKEN;
const bot = process.env.TELEGRAM_BOT_TOKEN;
if (!access || !bot)
  throw Error(
    "Required GitHub Secrets: SUPABASE_ACCESS_TOKEN, TELEGRAM_BOT_TOKEN",
  );
async function management(path, body) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw Error(`Supabase ${path}: HTTP ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
await management("secrets", [{ name: "TELEGRAM_BOT_TOKEN", value: bot }]);
const secretResponse = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/secrets`,
  { headers: { Authorization: `Bearer ${access}` } },
);
if (!secretResponse.ok) throw Error("Cannot inspect secret names");
const secretNames = await secretResponse.json();
if (!secretNames.some((item) => item.name === "AI_ENCRYPTION_KEY"))
  await management("secrets", [
    { name: "AI_ENCRYPTION_KEY", value: randomBytes(32).toString("base64") },
  ]);
await management("database/query", {
  query:
    "create table if not exists public.samo_migrations(name text primary key); alter table public.samo_migrations enable row level security; revoke all on public.samo_migrations from anon,authenticated;",
});
const applied = await management("database/query", {
  query: "select name from public.samo_migrations",
});
for (const name of (await readdir("supabase/migrations"))
  .filter((n) => /^\d+_[a-z_]+\.sql$/.test(n))
  .sort()) {
  if (applied.some((row) => row.name === name)) continue;
  const existing =
    name === "202611080001_initial.sql"
      ? await management("database/query", {
          query: "select to_regclass('public.accounts') as existing",
        })
      : [];
  const query = existing[0]?.existing
    ? ""
    : await readFile("supabase/migrations/" + name, "utf8");
  await management("database/query", {
    query: `begin; ${query} insert into public.samo_migrations(name) values ('${name}'); commit;`,
  });
}
console.log("Database and server secrets configured");
