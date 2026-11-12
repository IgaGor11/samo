import https from "node:https";
import { resolve4 } from "node:dns/promises";
import { publicIPv4 } from "./pure.mjs";
export async function publicFetch(raw) {
  let url = new URL(raw);
  for (let hop = 0; hop < 4; hop++) {
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !url.hostname.includes(".") ||
      url.hostname.includes(":")
    )
      throw Error("Разрешены только публичные HTTPS-источники");
    const ips = await resolve4(url.hostname);
    if (!ips.length || !ips.every(publicIPv4))
      throw Error("Недоступный адрес источника");
    // Connect to the checked IP directly. TLS still verifies the original hostname.
    const response = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: ips[0],
          servername: url.hostname,
          port: 443,
          path: url.pathname + url.search,
          method: "GET",
          agent: false,
          headers: {
            Host: url.hostname,
            "User-Agent": "SAMO/1.0 RSS reader",
            "Accept-Encoding": "identity",
          },
        },
        (res) => {
          const parts = [];
          let size = 0;
          res.on("data", (chunk) => {
            size += chunk.length;
            if (size > 1500000) {
              res.destroy();
              req.destroy(Error("Источник слишком большой"));
            } else parts.push(chunk);
          });
          res.on("error", reject);
          res.on("end", () =>
            resolve({
              status: res.statusCode,
              location: res.headers.location,
              text: Buffer.concat(parts).toString("utf8"),
            }),
          );
        },
      );
      const timer = setTimeout(
        () => req.destroy(Error("Источник не ответил вовремя")),
        12000,
      );
      req.on("error", reject);
      req.on("close", () => clearTimeout(timer));
      req.end();
    });
    if (response.status >= 300 && response.status < 400) {
      if (!response.location) throw Error("Пустой редирект");
      url = new URL(response.location, url);
      continue;
    }
    if (response.status !== 200)
      throw Error("Источник недоступен: " + response.status);
    return { text: response.text, url: url.href };
  }
  throw Error("Слишком много перенаправлений");
}
