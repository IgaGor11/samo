import {
  db,
  token,
  check,
  telegram,
  limit,
  digest,
} from "../_shared/service.ts";
import { equal } from "../_shared/pure.mjs";
Deno.serve(async (request) => {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  if (
    !equal(
      await digest("samo-webhook:" + token),
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "",
    )
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    const update = await request.json(),
      m = update.message;
    if (!m || m.chat?.type !== "private" || m.from?.is_bot)
      return new Response("ok");
    const owner = m.from.id;
    check(await db.from("accounts").upsert({ telegram_id: owner }));
    let kind, file_id;
    if (m.photo) {
      kind = "photo";
      file_id = m.photo.at(-1).file_id;
    } else if (m.video) {
      kind = "video";
      file_id = m.video.file_id;
    } else if (m.video_note) {
      kind = "video_note";
      file_id = m.video_note.file_id;
    }
    let text =
      "S.A.M.O — ваша редакция в Telegram.\n\n1. Добавьте @sam_0_bot администратором своего канала с правом публикации.\n2. Откройте приложение и подключите канал.\n3. Добавьте свой текстовый AI-ключ.\n\nФото, видео и кружки отправляйте прямо сюда: они появятся в разделе «Медиа».\nНовости и персонаж поддерживают автоподготовку; для продукта и личного блога задайте идею в редакторе.";
    if (file_id) {
      const count = await db
        .from("attachments")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", owner);
      if ((count.count || 0) >= 100)
        text = "Медиатека заполнена (100 файлов). Удалите ненужные вложения.";
      else {
        const r = await db
          .from("attachments")
          .insert({
            owner_id: owner,
            kind,
            file_id,
            label: String(
              m.caption || kind + " · " + new Date(m.date * 1000).toISOString(),
            ).slice(0, 250),
            source_message_id: m.message_id,
          });
        if (r.error?.code === "23505") return new Response("ok");
        check(r);
        text =
          "Вложение сохранено. Откройте «Публикации» и выберите его для поста.";
      }
    }
    try {
      await limit(owner, "bot", 20);
    } catch {
      return new Response("ok");
    }
    await telegram("sendMessage", {
      chat_id: owner,
      text,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Открыть S.A.M.O",
              web_app: { url: "https://igagor11.github.io/samo/" },
            },
          ],
        ],
      },
    });
    return new Response("ok");
  } catch {
    return new Response("Retry", { status: 503 });
  }
});
