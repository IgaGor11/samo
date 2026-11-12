import { test, expect } from "@playwright/test";
test("public mobile preview stays usable without Telegram", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Контент. В вашем ритме." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "＋ Подключить канал" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("[name=kind]").selectOption("character");
  await expect(page.getByText("Включить автоподготовку")).toBeVisible();
  await expect(page.locator("[name=sources]")).toBeHidden();
  await page.screenshot({
    path: "test-results/mobile-settings.png",
    fullPage: true,
  });
});
test("draft editor uses IDs and renders untrusted text safely", async ({
  page,
}) => {
  const calls = [];
  const channel = {
    id: "channel-1",
    title: "Test channel",
    kind: "personal",
    settings: {},
    moderation: true,
  };
  let posts = [
    {
      id: "post-1",
      channel_id: channel.id,
      status: "draft",
      content: "<img src=x onerror=alert(1)> Same text",
      media: [],
      created_at: new Date().toISOString(),
    },
    {
      id: "post-2",
      channel_id: channel.id,
      status: "draft",
      content: "<img src=x onerror=alert(1)> Same text",
      media: [],
      created_at: new Date().toISOString(),
    },
  ];
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: { initData: "test-signed-session", ready() {}, expand() {} },
    };
  });
  await page.route("https://telegram.org/**", (route) =>
    route.fulfill({ body: "" }),
  );
  await page.route("**/functions/v1/api", async (route) => {
    const b = route.request().postDataJSON();
    calls.push(b);
    let result = { ok: true };
    if (b.action === "channels") result = [channel];
    if (b.action === "posts") result = posts;
    if (["ai_status", "attachments", "media_jobs"].includes(b.action))
      result = [];
    if (b.action === "edit_post")
      posts = posts.map((p) =>
        p.id === b.post_id ? { ...p, content: b.content } : p,
      );
    await route.fulfill({ json: result });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "▤ Публикации", exact: true }).click();
  await expect(page.locator(".post")).toHaveCount(2);
  await expect(page.locator(".post img")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Редактировать", exact: true })
    .nth(1)
    .click();
  await page.locator("[name=content]").fill("Edited second post");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByText("Edited second post", { exact: true }),
  ).toBeVisible();
  expect(calls.find((x) => x.action === "edit_post").post_id).toBe("post-2");
  await page.screenshot({
    path: "test-results/desktop-posts.png",
    fullPage: true,
  });
});
