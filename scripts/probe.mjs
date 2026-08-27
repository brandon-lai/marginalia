// Minimal CDP driver: open a page, run a JS expression against it, print the
// JSON result, and optionally screenshot. Dependency-free — no puppeteer.
//
//   node probe.mjs <url> '<expr>' [width] [height]
//   SHOT=/tmp/out.png node probe.mjs <url> '"ok"' 360 760
//
// Viewport is emulated rather than sized, because Chrome refuses window widths
// below roughly 500px and would otherwise hand you a 500px "mobile" check that
// silently proves nothing.
//
// Prefer this over `chrome --headless --screenshot --virtual-time-budget`:
// virtual time reorders layout effects and produces screenshots that do not
// match what a real browser renders.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , url, expr = '"ok"', width = "1200", height = "900"] = process.argv;
if (!url) {
  console.error("usage: node probe.mjs <url> '<expr>' [width] [height]");
  process.exit(2);
}

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// A fixed port collides with a probe that did not shut down cleanly.
const PORT = 9200 + Math.floor(Math.random() * 700);
const profile = join(tmpdir(), `cdp-probe-${PORT}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

function done(code) {
  try { chrome.kill(); } catch {}
  process.exit(code);
}

let target;
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find((t) => t.type === "page");
    if (target) break;
  } catch {
    // Chrome is not listening yet.
  }
  await sleep(250);
}
if (!target) {
  console.error(`chrome never opened a debugging port (tried ${CHROME})`);
  done(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
await new Promise((resolve) => (ws.onopen = resolve));

const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send("Page.enable");

// Chrome will not size a window below roughly 500px, so the metrics override is
// the only way to get a real narrow viewport. It has to be re-applied after
// navigation: setting it once before Page.navigate leaves innerWidth at the
// window width (a 360 request came back as 447), and a "mobile" check that
// silently ran at 447px proves nothing.
const metrics = {
  width: Number(width),
  height: Number(height),
  screenWidth: Number(width),
  screenHeight: Number(height),
  deviceScaleFactor: 1,
  // mobile:true makes Chrome scale the layout viewport to fit the emulated
  // device, so a 360 request came back with innerWidth 447 — a narrow-viewport
  // check that silently ran 87px wider than asked. innerWidth is what CSS media
  // queries read, so keep it exact and leave touch emulation off.
  mobile: false,
  fitWindow: false,
};
await send("Emulation.setDeviceMetricsOverride", metrics);
// THEME=dark exercises the real prefers-color-scheme branch — the one most
// viewers actually hit, since it needs no explicit choice stamped on the root.
if (process.env.THEME) {
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: process.env.THEME }],
  });
}
await send("Page.navigate", { url });
await sleep(Number(process.env.SETTLE_MS ?? 4000));
await send("Emulation.setDeviceMetricsOverride", metrics);
await sleep(250);

if (process.env.SHOT) {
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(process.env.SHOT, Buffer.from(shot.result.data, "base64"));
}

const out = await send("Runtime.evaluate", {
  expression: `JSON.stringify(${expr})`,
  returnByValue: true,
  awaitPromise: true,
});
const value = out.result?.result?.value;
console.log(value ?? JSON.stringify(out.result));

ws.close();
done(0);
