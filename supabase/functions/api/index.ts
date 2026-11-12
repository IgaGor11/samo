import {
  db,
  token,
  check,
  telegram,
  rights,
  limit,
  seal,
  credential,
  channelFor,
  attached,
  newsItems,
  generate,
  publish,
  autoChannel,
  digest,
  settings,
} from "../_shared/service.ts";
import { identity, equal } from "../_shared/pure.mjs";
const cors = {
  "Access-Control-Allow-Origin": "https://igagor11.github.io",
  "Access-Control-Allow-Headers": "content-type,x-worker-secret",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const text = (v: any, max = 8000) => String(v || "").slice(0, max);
const plans = {
  text: ["groq", "openai", "deepseek"],
  image: ["replicate"],
  video: ["replicate"],
  search: ["pexels"],
};
async function dispatch(owner: number, b: any) {
  switch (b.action) {
    case "channels":
      return check(
        await db
          .from("channels")
          .select("*")
          .eq("owner_id", owner)
          .order("created_at"),
      );
    case "add_channel":
    case "update_channel": {
      if (!["news", "product", "personal", "character"].includes(b.kind))
        throw Error("Выберите тип канала");
      const s = settings(b.settings || b);
      new Intl.DateTimeFormat("ru", { timeZone: b.timezone });
      const values = {
        kind: b.kind,
        timezone: b.timezone,
        moderation: b.moderation !== false,
        enabled: !!b.enabled && ["news", "character"].includes(b.kind),
        settings: s,
      };
      if (values.enabled) {
        await credential(owner);
        if (b.kind === "news" && !s.sources.trim())
          throw Error("Добавьте источники");
        if (b.kind === "character" && !s.description)
          throw Error("Опишите персонажа");
      }
      if (b.action === "update_channel") {
        const c = await channelFor(owner, b.id);
        await rights(owner, c.telegram_chat_id);
        check(
          await db
            .from("channels")
            .update({
              ...values,
              next_run_at: new Date().toISOString(),
              last_error: null,
            })
            .eq("id", b.id)
            .eq("owner_id", owner),
        );
      } else {
        const count = await db
          .from("channels")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", owner);
        if (count.error) throw count.error;
        if ((count.count || 0) >= 10) throw Error("Максимум 10 каналов");
        const chat = await telegram("getChat", {
          chat_id: text(b.chat, 100).trim(),
        });
        if (chat.type !== "channel") throw Error("Укажите канал");
        await rights(owner, chat.id);
        const me = await telegram("getMe", {});
        const member = await telegram("getChatMember", {
          chat_id: chat.id,
          user_id: me.id,
        });
        if (!member.can_post_messages) throw Error("Разрешите боту публикацию");
        const r = await db
          .from("channels")
          .insert({
            ...values,
            title: chat.title,
            owner_id: owner,
            telegram_chat_id: chat.id,
          });
        if (r.error?.code === "23505") throw Error("Канал уже подключён");
        check(r);
      }
      return { ok: true };
    }
    case "delete_channel":
      check(
        await db.from("channels").delete().eq("id", b.id).eq("owner_id", owner),
      );
      return { ok: true };
    case "ai_status":
      return check(
        await db
          .from("ai_credentials")
          .select("purpose,provider,model")
          .eq("owner_id", owner),
      );
    case "save_ai": {
      const purpose = b.purpose || "text";
      if (
        !plans[purpose]?.includes(b.provider) ||
        typeof b.key !== "string" ||
        b.key.length < 10 ||
        b.key.length > 2048
      )
        throw Error("Проверьте провайдера и ключ");
      const model = text(b.model, 150).trim();
      if (purpose !== "search" && !model) throw Error("Укажите модель");
      if (
        ["image", "video"].includes(purpose) &&
        !/^([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+|[a-f0-9]{64})$/.test(model)
      )
        throw Error("Replicate: укажите owner/model или 64-символьную версию");
      check(
        await db
          .from("ai_credentials")
          .upsert(
            {
              owner_id: owner,
              purpose,
              provider: b.provider,
              model,
              encrypted_secret: await seal(owner, b.key),
            },
            { onConflict: "owner_id,purpose" },
          ),
      );
      return { ok: true };
    }
    case "delete_ai":
      check(
        await db
          .from("ai_credentials")
          .delete()
          .eq("owner_id", owner)
          .eq("purpose", b.purpose),
      );
      return { ok: true };
    case "attachments":
      return check(
        await db
          .from("attachments")
          .select("id,kind,label,created_at")
          .eq("owner_id", owner)
          .order("created_at", { ascending: false })
          .limit(100),
      );
    case "delete_attachment":
      check(
        await db
          .from("attachments")
          .delete()
          .eq("id", b.id)
          .eq("owner_id", owner),
      );
      return { ok: true };
    case "posts":
      return check(
        await db
          .from("posts")
          .select("*")
          .eq("owner_id", owner)
          .order("created_at", { ascending: false })
          .limit(100),
      );
    case "generate":
    case "create_post": {
      const c = await channelFor(owner, b.channel_id);
      const media = await attached(owner, b.attachment_ids || []);
      const brief = text(b.brief);
      if (!brief.trim()) throw Error("Напишите идею или текст");
      if (b.action === "generate") return generate(owner, c, brief, media);
      return check(
        await db
          .from("posts")
          .insert({
            owner_id: owner,
            channel_id: c.id,
            content: brief.slice(0, 4000),
            media,
          })
          .select("*")
          .single(),
      );
    }
    case "news_preview": {
      const c = await channelFor(owner, b.channel_id);
      if (c.kind !== "news") throw Error("Выберите новостной канал");
      return (await newsItems(c)).slice(0, 10);
    }
    case "news_generate": {
      const c = await channelFor(owner, b.channel_id);
      const item = (await newsItems(c)).find((x) => x.url === b.source_url);
      if (!item) throw Error("Новость уже обработана или недоступна");
      return generate(owner, c, item.title + "\n" + item.summary, [], item.url);
    }
    case "edit_post": {
      const content = text(b.content, 4001);
      if (!content.trim() || content.length > 4000)
        throw Error("Допустимо от 1 до 4000 символов");
      const media = await attached(owner, b.attachment_ids || []);
      const r = check(
        await db
          .from("posts")
          .update({ content, media, updated_at: new Date().toISOString() })
          .eq("id", b.post_id)
          .eq("owner_id", owner)
          .eq("status", "draft")
          .select("id")
          .maybeSingle(),
      );
      if (!r) throw Error("Публикация уже обработана");
      return { ok: true };
    }
    case "delete_post":
      check(
        await db
          .from("posts")
          .delete()
          .eq("id", b.post_id)
          .eq("owner_id", owner)
          .in("status", ["draft", "failed"]),
      );
      return { ok: true };
    case "resolve_post": {
      if (!["published", "draft"].includes(b.status))
        throw Error("Неверный статус");
      const r = check(
        await db
          .from("posts")
          .update({ status: b.status, updated_at: new Date().toISOString() })
          .eq("id", b.post_id)
          .eq("owner_id", owner)
          .in("status", ["uncertain", "failed"])
          .select("id")
          .maybeSingle(),
      );
      if (!r) throw Error("Статус уже изменился");
      return { ok: true };
    }
    case "schedule_post":
    case "cancel_schedule": {
      const schedule = b.action === "schedule_post",
        date = new Date(b.scheduled_at);
      if (
        schedule &&
        (!Number.isFinite(date.getTime()) ||
          date.getTime() < Date.now() + 60000)
      )
        throw Error("Выберите время минимум через минуту");
      const r = check(
        await db
          .from("posts")
          .update({
            status: schedule ? "scheduled" : "draft",
            scheduled_at: schedule ? date.toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", b.post_id)
          .eq("owner_id", owner)
          .eq("status", schedule ? "draft" : "scheduled")
          .select("id")
          .maybeSingle(),
      );
      if (!r) throw Error("Статус публикации изменился");
      return { ok: true };
    }
    case "publish":
      return publish(owner, b.post_id);
    case "search_photo": {
      await limit(owner, "search", 10);
      const c = await credential(owner, "search");
      const r = await fetch(
        "https://api.pexels.com/v1/search?per_page=6&query=" +
          encodeURIComponent(text(b.query, 150)),
        {
          headers: { Authorization: c.key },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!r.ok) throw Error("Pexels: проверьте API-ключ");
      const data = await r.json();
      return data.photos.map((p) => ({
        id: p.id,
        url: p.src.medium,
        photographer: p.photographer,
        page: p.url,
      }));
    }
    case "use_photo": {
      const c = await credential(owner, "search");
      if (!Number.isSafeInteger(b.photo_id)) throw Error("Неверное фото");
      const r = await fetch("https://api.pexels.com/v1/photos/" + b.photo_id, {
        headers: { Authorization: c.key },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw Error("Фото недоступно");
      const photo = await r.json();
      const sent = await telegram("sendPhoto", {
        chat_id: owner,
        photo: photo.src.large,
        caption: `Фото: ${photo.photographer} / Pexels\n${photo.url}`,
      });
      return check(
        await db
          .from("attachments")
          .insert({
            owner_id: owner,
            kind: "photo",
            file_id: sent.photo.at(-1).file_id,
            label: `Pexels: ${photo.photographer} ${photo.url}`,
          })
          .select("id")
          .single(),
      );
    }
    case "media_generate": {
      if (!["image", "video"].includes(b.purpose))
        throw Error("Выберите фото или видео");
      await limit(owner, "ai", 50);
      const c = await credential(owner, b.purpose);
      const prompt = text(b.prompt, 3000);
      if (!prompt.trim()) throw Error("Опишите результат");
      const params = b.parameters || {};
      if (
        typeof params !== "object" ||
        Array.isArray(params) ||
        JSON.stringify(params).length > 4000
      )
        throw Error("Некорректные параметры");
      const version = /^[a-f0-9]{64}$/.test(c.model);
      const url = version
        ? "https://api.replicate.com/v1/predictions"
        : `https://api.replicate.com/v1/models/${c.model}/predictions`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(version ? { version: c.model } : {}),
          input: { ...params, prompt },
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw Error("Replicate: проверьте модель, параметры и баланс");
      const p = await r.json();
      return check(
        await db
          .from("media_jobs")
          .insert({ owner_id: owner, purpose: b.purpose, prediction_id: p.id })
          .select("id,status")
          .single(),
      );
    }
    case "media_jobs":
      return check(
        await db
          .from("media_jobs")
          .select("id,purpose,status,message,attachment_id,created_at")
          .eq("owner_id", owner)
          .order("created_at", { ascending: false })
          .limit(30),
      );
    case "media_poll":
      return pollMedia(owner, b.id);
    case "export_data":
      return {
        channels: await dispatch(owner, { action: "channels" }),
        posts: await dispatch(owner, { action: "posts" }),
        connections: await dispatch(owner, { action: "ai_status" }),
      };
    case "delete_account":
      check(await db.from("accounts").delete().eq("telegram_id", owner));
      return { ok: true };
    default:
      throw Error("Неизвестная команда");
  }
}
async function pollMedia(owner: number, id: string) {
  const job = check(
    await db
      .from("media_jobs")
      .select("*")
      .eq("id", id)
      .eq("owner_id", owner)
      .single(),
  );
  if (
    ["succeeded", "failed", "canceled", "delivering", "uncertain"].includes(
      job.status,
    )
  )
    return { status: job.status };
  const c = await credential(owner, job.purpose);
  const r = await fetch(
    "https://api.replicate.com/v1/predictions/" +
      encodeURIComponent(job.prediction_id),
    {
      headers: { Authorization: `Bearer ${c.key}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok) throw Error("Не удалось проверить генерацию");
  const p = await r.json();
  if (p.status !== "succeeded") {
    check(
      await db
        .from("media_jobs")
        .update({
          status: p.status,
          message:
            p.status === "failed"
              ? "Ошибка генерации. Проверьте параметры модели."
              : null,
        })
        .eq("id", id),
    );
    return { status: p.status };
  }
  const claim = check(
    await db
      .from("media_jobs")
      .update({ status: "delivering" })
      .eq("id", id)
      .eq("status", job.status)
      .select("id")
      .maybeSingle(),
  );
  if (!claim) return { status: "delivering" };
  try {
    const url = Array.isArray(p.output) ? p.output[0] : p.output;
    if (typeof url !== "string" || !url.startsWith("https://"))
      throw Error("Нет медиа в ответе");
    const kind = job.purpose === "image" ? "photo" : "video";
    const sent = await telegram(kind === "photo" ? "sendPhoto" : "sendVideo", {
      chat_id: owner,
      [kind]: url,
      caption: "S.A.M.O · Сгенерировано AI",
    });
    const file_id =
      kind === "photo" ? sent.photo.at(-1).file_id : sent.video.file_id;
    const a = check(
      await db
        .from("attachments")
        .insert({
          owner_id: owner,
          kind,
          file_id,
          label: "AI · " + new Date().toISOString(),
        })
        .select("id")
        .single(),
    );
    check(
      await db
        .from("media_jobs")
        .update({ status: "succeeded", attachment_id: a.id })
        .eq("id", id),
    );
    return { status: "succeeded" };
  } catch {
    await db
      .from("media_jobs")
      .update({
        status: "uncertain",
        message:
          "Проверьте чат с ботом и историю Replicate. Перешлите полученный файл боту, чтобы сохранить его.",
      })
      .eq("id", id);
    throw Error(
      "Не удалось сохранить результат: проверьте чат с ботом и Replicate",
    );
  }
}
async function worker(b: any) {
  if (b.action === "worker_list") {
    await db
      .from("posts")
      .update({ status: "uncertain" })
      .eq("status", "publishing")
      .lt("updated_at", new Date(Date.now() - 600000).toISOString());
    return {
      channels: check(
        await db
          .from("channels")
          .select("id")
          .eq("enabled", true)
          .lte("next_run_at", new Date().toISOString())
          .order("next_run_at")
          .limit(20),
      ),
      posts: check(
        await db
          .from("posts")
          .select("id,owner_id")
          .eq("status", "scheduled")
          .lte("scheduled_at", new Date().toISOString())
          .limit(30),
      ),
      jobs: check(
        await db
          .from("media_jobs")
          .select("id,owner_id")
          .in("status", ["starting", "processing"])
          .limit(20),
      ),
    };
  }
  if (b.action === "worker_channel") {
    await autoChannel(b.id);
    return { ok: true };
  }
  if (b.action === "worker_publish")
    return publish(b.owner_id, b.id, "scheduled");
  if (b.action === "worker_media") return pollMedia(b.owner_id, b.id);
  throw Error("Unknown worker action");
}
Deno.serve(async (request) => {
  const reply = (body: any, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  if (request.method === "OPTIONS")
    return new Response(null, { headers: cors });
  if (request.method !== "POST")
    return reply({ error: "Method not allowed" }, 405);
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Empty body" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 48000) {
        await reader.cancel();
        return reply({ error: "Request too large" }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    const b = JSON.parse(new TextDecoder().decode(bytes));
    if (String(b.action).startsWith("worker_")) {
      if (
        !equal(
          await digest("samo-worker:" + token),
          request.headers.get("x-worker-secret") || "",
        )
      )
        return reply({ error: "Unauthorized" }, 401);
      return reply(await worker(b));
    }
    let owner;
    try {
      owner = await identity(b.initData, token);
    } catch {
      return reply({ error: "Откройте приложение заново через Telegram" }, 401);
    }
    check(await db.from("accounts").upsert({ telegram_id: owner }));
    await limit(owner);
    return reply(await dispatch(owner, b));
  } catch (e) {
    return reply(
      {
        error:
          e instanceof SyntaxError
            ? "Некорректный запрос"
            : String(e.message || "Ошибка сервера").slice(0, 300),
      },
      400,
    );
  }
});
