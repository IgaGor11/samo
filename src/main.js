import "./style.css";
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
const state = {
  page: "channels",
  channels: [],
  posts: [],
  attachments: [],
  connections: [],
  jobs: [],
  news: [],
  photos: [],
  filter: "all",
  loading: false,
};
const kinds = {
  news: "Новости",
  product: "О продукте",
  personal: "Личный блог",
  character: "Персонаж",
};
const statuses = {
  draft: "Черновик",
  scheduled: "В расписании",
  publishing: "Отправляется",
  published: "Опубликован",
  failed: "Ошибка",
  uncertain: "Проверьте канал",
};
const purposes = {
  text: "Текст",
  image: "Генерация фото",
  video: "Генерация видео",
  search: "Поиск фото",
};
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const selected = (a, b) => (a === b ? "selected" : "");
const checked = (v) => (v ? "checked" : "");
const fmt = (v) =>
  v
    ? new Date(v).toLocaleString("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
const icon = { channels: "◉", posts: "▤", media: "▧", ai: "✧", profile: "◎" };
const labels = {
  channels: "Каналы",
  posts: "Публикации",
  media: "Медиа",
  ai: "Нейросети",
  profile: "Настройки",
};
const root = document.querySelector("#app");
root.innerHTML = `<aside><a class="brand" href="#">S.A.M.O<span>CONTENT STUDIO</span></a><nav>${Object.entries(
  labels,
)
  .map(
    ([p, l]) => `<button data-nav="${p}"><span>${icon[p]}</span>${l}</button>`,
  )
  .join(
    "",
  )}</nav><div class="sidebar-foot"><span class="dot"></span> Ваш голос. Ваш ритм.<small>Создавайте то, что имеет значение.</small></div></aside><main><header><span>ВАШЕ ПРОСТРАНСТВО</span><div><button data-action="refresh" class="subtle">↻ Обновить</button><a class="badge" href="https://t.me/sam_0_bot" target="_blank" rel="noopener">@sam_0_bot ↗</a></div></header><div id="view"></div><footer>Сделано для ваших идей · S.A.M.O</footer></main><dialog id="modal"></dialog><div id="toast" role="status" aria-live="polite"></div>`;
const view = document.querySelector("#view"),
  modal = document.querySelector("#modal");
let toastTimer;
function toast(message, error = false) {
  const t = document.querySelector("#toast");
  t.textContent = message;
  t.className = "visible" + (error ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ""), 7000);
}
async function api(action, payload = {}) {
  if (!tg?.initData)
    throw Error("Откройте S.A.M.O через кнопку приложения в @sam_0_bot");
  const endpoint =
    import.meta.env.VITE_API_URL ||
    "https://fpgdsosfwsrfxebvkgdz.supabase.co/functions/v1/api";
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, initData: tg.initData, ...payload }),
    signal: AbortSignal.timeout(120000),
  });
  let result;
  try {
    result = await r.json();
  } catch {
    throw Error("Сервер временно недоступен");
  }
  if (!r.ok) throw Error(result.error || "Запрос не выполнен");
  return result;
}
async function refresh() {
  if (!tg?.initData) {
    render();
    return;
  }
  state.loading = true;
  try {
    const result = await Promise.all(
      ["channels", "posts", "attachments", "ai_status", "media_jobs"].map((a) =>
        api(a),
      ),
    );
    [
      state.channels,
      state.posts,
      state.attachments,
      state.connections,
      state.jobs,
    ] = result;
    render();
  } finally {
    state.loading = false;
  }
}
function button(action, label, id = "", primary = false) {
  return `<button class="${primary ? "primary" : "secondary"}" data-action="${action}" data-id="${esc(id)}">${label}</button>`;
}
function empty(title, description, action = "") {
  return `<div class="empty"><span class="orb">✧</span><h3>${title}</h3><p>${description}</p>${action}</div>`;
}
function channelOptions(value) {
  return state.channels
    .map(
      (c) =>
        `<option value="${c.id}" ${selected(c.id, value)}>${esc(c.title)} · ${kinds[c.kind]}</option>`,
    )
    .join("");
}
function mediaOptions(value) {
  return (
    `<option value="">Без вложения</option>` +
    state.attachments
      .map(
        (a) =>
          `<option value="${a.id}" ${selected(a.id, value)}>${esc(a.kind + " · " + a.label)}</option>`,
      )
      .join("")
  );
}
function hero(eyebrow, title, subtitle) {
  return `<div class="intro"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${subtitle}</p></div>`;
}
function render() {
  document
    .querySelectorAll("[data-nav]")
    .forEach((b) => b.classList.toggle("active", b.dataset.nav === state.page));
  const demo = !tg?.initData
    ? '<div class="notice">Предпросмотр. Для работы с каналами <a href="https://t.me/sam_0_bot">откройте бота → приложение</a>.</div>'
    : "";
  let html = "";
  if (state.page === "channels")
    html =
      hero(
        "МЕНЬШЕ РУТИНЫ, БОЛЬШЕ ИДЕЙ",
        "Контент.<br><em>В вашем ритме.</em>",
        "Ваша маленькая редакция. От первой мысли<br>до публикации, которую хочется прочитать.",
      ) +
      `<div class="stats"><div><strong>${state.channels.length}</strong><span>каналов</span></div><div><strong>${state.posts.filter((p) => p.status === "draft").length}</strong><span>идей в работе</span></div><div><strong>${state.posts.filter((p) => p.status === "scheduled").length}</strong><span>в расписании</span></div></div><div class="section-title"><h2>Мои каналы</h2>${button("channel", "＋ Подключить канал", "", true)}</div>` +
      (state.channels.length
        ? `<div class="grid">${state.channels.map((c) => `<article class="card channel"><div class="row"><span class="channel-icon">${{ news: "◈", product: "◇", personal: "◉", character: "✧" }[c.kind]}</span><span class="pill ${c.enabled ? "green" : ""}">${c.enabled ? "Автоматизация" : "Ручной режим"}</span></div><h3>${esc(c.title)}</h3><p>${kinds[c.kind]} · ${c.moderation ? "С согласованием" : "Автопубликация"}</p>${c.last_error ? `<p class="error-text">${esc(c.last_error)}</p>` : ""}<div class="actions">${button("channel", "Настроить", c.id)}${button("compose", "Создать пост", c.id)}</div></article>`).join("")}</div>`
        : empty(
            "Здесь начинается ваша история",
            "Подключите канал, добавьте AI и задайте направление.",
          ));
  if (state.page === "posts")
    html =
      hero(
        "РЕДАКЦИЯ",
        "Хорошие идеи.<br><em>Готовые посты.</em>",
        "Создавайте, редактируйте и выбирайте подходящий момент.",
      ) +
      `<div class="section-title"><div class="tabs">${["all", "draft", "scheduled", "published", "uncertain"].map((s) => `<button data-filter="${s}" class="${state.filter === s ? "active" : ""}">${s === "all" ? "Все" : statuses[s]}</button>`).join("")}</div>${button("compose", "＋ Новый пост", "", true)}</div><div class="notice">Расписание работает с шагом около 15 минут; возможны задержки. Время ниже — в часовом поясе устройства.</div>` +
      renderPosts();
  if (state.page === "ai")
    html =
      hero(
        "ВАШИ ИНСТРУМЕНТЫ",
        "Интеллект.<br><em>На ваш выбор.</em>",
        "Обязателен только текстовый API. Остальное подключайте по необходимости.",
      ) +
      `<div class="notice">Ключи шифруются на сервере и не возвращаются в интерфейс. AI оплачивается по тарифам вашего провайдера. Общий предел — 50 AI-запросов в сутки на аккаунт.</div><div class="grid">${Object.entries(
        purposes,
      )
        .map(([p, l]) => {
          const c = state.connections.find((x) => x.purpose === p);
          return `<article class="card"><span class="pill ${c ? "green" : ""}">${c ? "Подключено" : p === "text" ? "Обязательно" : "Необязательно"}</span><h2>${l}</h2><p>${c ? esc(c.provider + " · " + c.model) : { text: "Groq, OpenAI или DeepSeek", image: "Replicate · модель по вашему выбору", video: "Replicate · асинхронная генерация", search: "Pexels · фотографии с авторством" }[p]}</p><div class="actions">${button("connection", c ? "Заменить ключ" : "Подключить", p)}${c ? button("delete-ai", "Удалить", p) : ""}</div></article>`;
        })
        .join("")}</div>`;
  if (state.page === "media")
    html =
      hero(
        "ВИЗУАЛЬНАЯ ИСТОРИЯ",
        "Больше,<br><em>чем слова.</em>",
        "Фото, видео и кружки для ваших публикаций.",
      ) +
      `<div class="notice">Отправьте файл или кружок <a href="https://t.me/sam_0_bot">боту</a>, затем нажмите «Обновить». Один файл на пост; длинный текст и кружок отправляются отдельными сообщениями.</div><div class="actions">${button("search", "Найти фото")}${button("media-generate", "Сгенерировать фото / видео")}</div><div class="grid">${state.attachments.map((a) => `<article class="card"><span class="orb">${a.kind === "photo" ? "▧" : a.kind === "video_note" ? "◉" : "▷"}</span><h3>${esc(a.label)}</h3><p>${a.kind} · ${fmt(a.created_at)}</p>${button("delete-media", "Удалить из медиатеки", a.id)}</article>`).join("")}</div>${!state.attachments.length ? empty("Ваша медиатека пока пуста", "Добавьте первый файл через чат с ботом.") : ""}<h2>Генерации</h2>${state.jobs.map((j) => `<div class="card"><div class="row"><strong>${purposes[j.purpose]}</strong><span class="pill">${esc(j.status)}</span></div><p>${esc(j.message || fmt(j.created_at))}</p>${["starting", "processing"].includes(j.status) ? button("poll", "Проверить готовность", j.id) : ""}</div>`).join("") || "<p>Пока нет генераций.</p>"}`;
  if (state.page === "profile")
    html =
      hero(
        "ВСЁ ПОД КОНТРОЛЕМ",
        "Ваше<br><em>пространство.</em>",
        "Данные, правила работы и помощь.",
      ) +
      `<article class="card"><h2>Как начать</h2><ol><li>Добавьте бота администратором своего канала.</li><li>Подключите канал и текстовую модель.</li><li>Для новостей укажите RSS или сайт с RSS. Для других типов опишите аудиторию и стиль.</li><li>Создайте черновик и проверьте факты. Публикуйте сразу или выберите время.</li></ol><p>Автоподготовка доступна для новостей и персонажа. Продукт и личный блог работают от ваших идей. Персонаж помнит последние 8 опубликованных постов и постоянные факты из настроек.</p></article><article class="card"><h2>Приватность и расходы</h2><p>Тексты и вложения передаются выбранным AI-провайдерам только при генерации. Telegram хранит загруженные файлы. Удаление аккаунта удаляет настройки и записи из S.A.M.O, но не сообщения в Telegram и не историю у AI-провайдеров.</p><p>Бесплатный хостинг имеет квоты. Стоимость генерации зависит от ваших моделей; денежный лимит задавайте в кабинете провайдера. S.A.M.O ограничивает число запросов, но не гарантирует сумму расходов.</p><div class="actions">${button("export", "Экспорт данных")}${button("delete-account", "Удалить мои данные")}</div></article>`;
  view.innerHTML = demo + html;
}
function renderPosts() {
  const posts = state.posts.filter(
    (p) => state.filter === "all" || p.status === state.filter,
  );
  return posts.length
    ? posts
        .map(
          (p) =>
            `<article class="card post"><div class="row"><span class="pill ${p.status === "published" ? "green" : ""}">${statuses[p.status]}</span><span class="muted">${esc(state.channels.find((c) => c.id === p.channel_id)?.title || "Канал")}</span></div><p class="post-text">${esc(p.content)}</p>${p.media?.length ? `<div class="attachment">▧ ${esc(p.media[0].label || p.media[0].kind)}</div>` : ""}<p class="hint">${fmt(p.scheduled_at || p.created_at)}</p><div class="actions">${p.status === "draft" ? button("edit", "Редактировать", p.id) + button("schedule", "Отложить", p.id) + button("publish", "Опубликовать", p.id, true) + button("delete-post", "Удалить", p.id) : p.status === "scheduled" ? button("cancel", "Вернуть в черновики", p.id) : ["uncertain", "failed"].includes(p.status) ? button("resolve", "Проверить статус", p.id) : ""}</div></article>`,
        )
        .join("")
    : empty(
        "Пока нет публикаций",
        "Здесь появятся черновики, расписание и история.",
      );
}
function field(label, name, value = "", type = "text", extra = "") {
  return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function area(label, name, value = "", max = 8000) {
  return `<label>${label}<textarea name="${name}" maxlength="${max}">${esc(value)}</textarea></label>`;
}
function toggle(label, name, value) {
  return `<label class="check"><input name="${name}" type="checkbox" ${checked(value)}>${label}</label>`;
}
function openModal(title, body, formType = "", id = "") {
  modal.innerHTML = `<button class="close" data-action="close" aria-label="Закрыть">×</button><p class="eyebrow">S.A.M.O STUDIO</p><h2>${title}</h2>${formType ? `<form data-form="${formType}" data-id="${esc(id)}">${body}<p class="form-error" role="alert"></p><button class="primary" type="submit">Сохранить</button></form>` : body}`;
  if (!modal.open) modal.showModal();
}
function channelModal(id) {
  const c = state.channels.find((x) => x.id === id) || {},
    s = c.settings || {};
  openModal(
    c.id ? "Настройки канала" : "Подключить канал",
    `${!c.id ? field("Username или ID канала", "chat", "", "text", 'placeholder="@my_channel или -100…" required') : "<p>" + esc(c.title) + "</p>"}<label>Тип канала<select name="kind">${Object.entries(
      kinds,
    )
      .map(
        ([k, l]) =>
          `<option value="${k}" ${selected(k, c.kind || "news")}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><div data-kind="news">${area("RSS или сайты с RSS — по одному адресу в строке", "sources", s.sources)}${field("Приоритетные темы — через запятую", "priorities", s.priorities)}</div>${area("Описание канала / личность персонажа", "description", s.description, 12000)}<p class="hint">Для персонажа: биография, характер, внешность, привычки, отношения, работа, манера речи. Чем конкретнее, тем последовательнее история.</p>${area("Постоянная память: факты, которые нельзя менять", "memory", s.memory, 6000)}${field("Запрещённые темы и слова — через запятую", "excluded", s.excluded)}${field("Тон и стиль", "tone", s.tone || "Живой, спокойный, без кликбейта")}${field("Язык", "language", s.language || "Русский")}<div class="split">${field("Длина поста, символов", "length", s.length || 1800, "number", 'min="300" max="3500"')}${field("Часовой пояс", "timezone", c.timezone || "Europe/Moscow", "text", "required")}</div>${field("Подпись канала", "signature", s.signature, "text", 'maxlength="200"')}${toggle("Добавлять ссылку на источник", "include_source", s.include_source !== false)}<div data-kind="auto"><h3>Автоматизация</h3>${toggle("Включить автоподготовку", "enabled", c.enabled)}${toggle("Сначала сохранять черновик на согласование", "moderation", c.moderation !== false)}<div class="split">${field("Интервал, часы", "interval_hours", s.interval_hours || 6, "number", 'min="1" max="168"')}${field("Максимум за 24 часа", "daily_limit", s.daily_limit || 3, "number", 'min="1" max="20"')}</div>${toggle("Не создавать посты в тихие часы", "quiet", s.quiet)}<div class="split">${field("Тихие часы: с", "quiet_start", s.quiet_start ?? 23, "number", 'min="0" max="23"')}${field("до", "quiet_end", s.quiet_end ?? 8, "number", 'min="0" max="23"')}</div></div>${c.id ? button("delete-channel", "Отключить канал и удалить историю S.A.M.O", c.id) : ""}`,
    "channel",
    c.id || "",
  );
  showKind();
}
function showKind() {
  const k = modal.querySelector("[name=kind]")?.value;
  modal
    .querySelector("[data-kind=news]")
    ?.toggleAttribute("hidden", k !== "news");
  modal
    .querySelector("[data-kind=auto]")
    ?.toggleAttribute("hidden", !["news", "character"].includes(k));
}
function compose(id, post) {
  openModal(
    post ? "Редактировать черновик" : "Создать публикацию",
    `${!post ? `<label>Канал<select name="channel_id" required>${channelOptions(id)}</select></label><label>Режим<select name="mode"><option value="generate">Написать с AI</option><option value="create_post">Сохранить мой текст</option></select></label>` : ""}${area(post ? "Текст публикации" : "Идея или исходный материал", post ? "content" : "brief", post?.content || "", post ? 4000 : 8000)}<label>Вложение<select name="attachment">${mediaOptions(post?.media?.[0]?.id)}</select></label><p class="hint">Фото, видео и кружки отправляйте боту. Для текстов длиннее подписи медиа и текст придут двумя сообщениями.</p>${!post ? button("news", "Подобрать новости из источников") : ""}`,
    post ? "edit" : "compose",
    post?.id || "",
  );
}
function connection(p) {
  const c = state.connections.find((x) => x.purpose === p) || {};
  const providers =
    p === "text"
      ? ["groq", "openai", "deepseek"]
      : p === "search"
        ? ["pexels"]
        : ["replicate"];
  openModal(
    purposes[p],
    `<label>Провайдер<select name="provider">${providers.map((v) => `<option ${selected(v, c.provider)}>${v}</option>`).join("")}</select></label>${p !== "search" ? field(p === "text" ? "Модель" : "Replicate: owner/model или версия", "model", c.model || (p === "text" ? "llama-3.3-70b-versatile" : ""), "text", "required") : ""}${field("API-ключ", "key", "", "password", 'required minlength="10" autocomplete="off"')}<p class="hint">${p === "text" ? "Укажите модель, доступную у вашего провайдера." : "Используется ваш API-ключ и баланс. Модель Replicate должна принимать поле prompt и возвращать ссылку на файл."}</p>`,
    "connection",
    p,
  );
}
async function action(name, id, element) {
  switch (name) {
    case "refresh":
      await refresh();
      toast("Обновлено");
      break;
    case "close":
      modal.close();
      break;
    case "channel":
      channelModal(id);
      break;
    case "compose":
      if (!state.channels.length) throw Error("Сначала подключите канал");
      compose(id);
      break;
    case "edit":
      compose(
        "",
        state.posts.find((p) => p.id === id),
      );
      break;
    case "connection":
      connection(id);
      break;
    case "publish":
      openModal(
        "Опубликовать сейчас?",
        "<p>Пост будет отправлен в выбранный канал. Проверьте текст и вложение.</p>" +
          button("publish-confirm", "Опубликовать", id, true),
      );
      break;
    case "publish-confirm":
      await api("publish", { post_id: id });
      modal.close();
      await refresh();
      toast("Опубликовано");
      break;
    case "schedule":
      openModal(
        "Выбрать время",
        field(
          "Дата и время на этом устройстве",
          "date",
          "",
          "datetime-local",
          "required",
        ) +
          '<p class="hint">Возможна задержка: очередь проверяется примерно раз в 15 минут.</p>',
        "schedule",
        id,
      );
      break;
    case "cancel":
      await api("cancel_schedule", { post_id: id });
      await refresh();
      break;
    case "resolve":
      openModal(
        "Проверьте канал",
        "<p>Если сообщение уже появилось, отметьте его опубликованным. Возвращайте в черновики только после проверки: повторная отправка может создать дубликат.</p>" +
          button("resolved", "Уже опубликовано", id) +
          button("retry-draft", "Не опубликовано — вернуть", id),
      );
      break;
    case "resolved":
    case "retry-draft":
      await api("resolve_post", {
        post_id: id,
        status: name === "resolved" ? "published" : "draft",
      });
      modal.close();
      await refresh();
      break;
    case "delete-post":
    case "delete-channel":
    case "delete-media":
    case "delete-ai":
    case "delete-account":
      openModal(
        "Подтвердите удаление",
        "<p>Это удалит данные из S.A.M.O. Опубликованные сообщения в Telegram останутся.</p>" +
          `<button class="danger" data-action="remove" data-id="${esc(id)}" data-kind="${name}">Удалить</button>`,
      );
      break;
    case "remove": {
      const mapping = {
        "delete-post": ["delete_post", { post_id: id }],
        "delete-channel": ["delete_channel", { id }],
        "delete-media": ["delete_attachment", { id }],
        "delete-ai": ["delete_ai", { purpose: id }],
        "delete-account": ["delete_account", {}],
      };
      const [a, p] = mapping[element.dataset.kind];
      await api(a, p);
      modal.close();
      await refresh();
      toast("Удалено");
      break;
    }
    case "news": {
      const channel_id = modal.querySelector("[name=channel_id]").value;
      const news = await api("news_preview", { channel_id });
      state.news = news;
      openModal(
        "Новости из ваших источников",
        news.length
          ? news
              .map(
                (n, i) =>
                  `<article class="card"><h3>${esc(n.title)}</h3><p>${esc(n.summary.slice(0, 300))}</p><button class="primary" data-action="news-generate" data-id="${i}" data-channel="${channel_id}">Подготовить пост</button></article>`,
              )
              .join("")
          : "<p>Новых подходящих новостей нет.</p>",
      );
      break;
    }
    case "news-generate":
      await api("news_generate", {
        channel_id: element.dataset.channel,
        source_url: state.news[Number(id)].url,
      });
      modal.close();
      state.page = "posts";
      await refresh();
      toast("Черновик готов");
      break;
    case "search":
      openModal(
        "Найти фотографию",
        field("Что ищем?", "query", "", "text", "required") +
          '<p>Фотографии предоставлены <a href="https://www.pexels.com" target="_blank" rel="noopener">Pexels</a>.</p>',
        "search",
      );
      break;
    case "photo-use":
      await api("use_photo", { photo_id: Number(id) });
      modal.close();
      await refresh();
      toast("Фото отправлено в чат и добавлено в медиатеку");
      break;
    case "media-generate":
      openModal(
        "Создать медиа с AI",
        `<label>Тип<select name="purpose"><option value="image">Изображение</option><option value="video">Видео</option></select></label>${area("Описание результата", "prompt", "", 3000)}${area("Дополнительные параметры модели (JSON, необязательно)", "parameters", "{}", 4000)}<p class="hint">Формат параметров зависит от модели Replicate. Генерация может быть платной; результат появится в чате с ботом и медиатеке после проверки готовности.</p>`,
        "media-generate",
      );
      break;
    case "poll":
      await api("media_poll", { id });
      await refresh();
      toast("Статус обновлён");
      break;
    case "export": {
      const data = await api("export_data");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "samo-export.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      break;
    }
  }
}
document.addEventListener("click", async (e) => {
  const nav = e.target.closest("[data-nav]");
  if (nav) {
    state.page = nav.dataset.nav;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const filter = e.target.closest("[data-filter]");
  if (filter) {
    state.filter = filter.dataset.filter;
    render();
    return;
  }
  const b = e.target.closest("[data-action]");
  if (!b) return;
  e.preventDefault();
  b.disabled = true;
  try {
    await action(b.dataset.action, b.dataset.id, b);
  } catch (error) {
    toast(error.message, true);
  } finally {
    b.disabled = false;
  }
});
modal.addEventListener("change", (e) => {
  if (e.target.name === "kind") showKind();
});
modal.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target,
    b = f.querySelector("[type=submit]"),
    v = Object.fromEntries(new FormData(f)),
    type = f.dataset.form,
    id = f.dataset.id;
  const error = f.querySelector(".form-error");
  error.textContent = "";
  b.disabled = true;
  b.textContent = "Подождите…";
  try {
    if (type === "channel") {
      await api(id ? "update_channel" : "add_channel", {
        ...v,
        id,
        enabled: !!f.elements.enabled?.checked,
        moderation: !!f.elements.moderation.checked,
        settings: {
          ...v,
          quiet: f.elements.quiet.checked,
          include_source: f.elements.include_source.checked,
        },
      });
    }
    if (type === "connection") await api("save_ai", { ...v, purpose: id });
    if (type === "compose" || type === "edit") {
      await api(type === "edit" ? "edit_post" : v.mode, {
        ...v,
        post_id: id,
        attachment_ids: v.attachment ? [v.attachment] : [],
      });
      state.page = "posts";
    }
    if (type === "schedule")
      await api("schedule_post", {
        post_id: id,
        scheduled_at: new Date(v.date).toISOString(),
      });
    if (type === "search") {
      const photos = await api("search_photo", v);
      openModal(
        "Фото от Pexels",
        `<div class="photo-grid">${photos.map((p) => `<article><img src="${esc(p.url)}" alt="Фото ${esc(p.photographer)}" loading="lazy"><p><a href="${esc(p.page)}" target="_blank" rel="noopener">${esc(p.photographer)} / Pexels</a></p>${button("photo-use", "Выбрать", p.id)}</article>`).join("") || "<p>Ничего не найдено.</p>"}</div>`,
      );
      return;
    }
    if (type === "media-generate")
      await api("media_generate", {
        ...v,
        parameters: JSON.parse(v.parameters || "{}"),
      });
    modal.close();
    await refresh();
    toast(type === "media-generate" ? "Генерация запущена" : "Сохранено");
  } catch (err) {
    error.textContent = err.message;
  } finally {
    b.disabled = false;
    b.textContent = "Сохранить";
  }
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    const r = modal.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      modal.close();
  }
});
render();
refresh().catch((e) => toast(e.message, true));
