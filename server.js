import "dotenv/config";
import express from "express";
import { writeFile, mkdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Load API key from env or .ima2/config.json
let apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  const cfgPath = join(__dirname, ".ima2", "config.json");
  if (existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(await readFile(cfgPath, "utf-8"));
      if (cfg.apiKey) apiKey = cfg.apiKey;
    } catch {}
  }
}

const OAUTH_PORT = parseInt(process.env.OAUTH_PORT || "10531");
const OAUTH_URL = `http://127.0.0.1:${OAUTH_PORT}`;
const HAS_API_KEY = !!apiKey;

let openai = null;
if (HAS_API_KEY) {
  const OpenAI = (await import("openai")).default;
  openai = new OpenAI({ apiKey });
}

app.use(express.json({ limit: "50mb" }));
app.use(express.static(join(__dirname, "public")));

// ── OAuth proxy: generate via Responses API (stream mode) ──
async function generateViaOAuth(prompt, quality, size) {
  const res = await fetch(`${OAUTH_URL}/v1/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      input: [{ role: "user", content: prompt }],
      tools: [{ type: "image_generation", quality, size }],
      stream: true,
    }),
  });

  console.log("[oauth] response status:", res.status, "content-type:", res.headers.get("content-type"));

  if (!res.ok) {
    const text = await res.text();
    console.error("[oauth] error response:", text.slice(0, 500));
    let msg;
    try { msg = JSON.parse(text).error?.message; } catch {}
    throw new Error(msg || `OAuth proxy returned ${res.status}: ${text.slice(0, 200)}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const isSSE = contentType.includes("text/event-stream");

  // If not SSE, try to parse as JSON (non-stream response)
  if (!isSSE) {
    console.log("[oauth] non-SSE response, parsing as JSON");
    const json = await res.json();
    // Check output for image data
    for (const item of json.output || []) {
      if (item.type === "image_generation_call" && item.result) {
        return { b64: item.result, usage: json.usage };
      }
    }
    console.log("[oauth] no image in JSON output, output count:", (json.output || []).length);
    console.log("[oauth] tool_usage:", JSON.stringify(json.tool_usage?.image_gen || {}));
    throw new Error("No image data in response (non-stream mode)");
  }

  // Read SSE stream line by line
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let imageB64 = null;
  let usage = null;
  let eventCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") continue;
      try {
        const data = JSON.parse(payload);
        eventCount++;
        if (data.type === "response.output_item.done" && data.item?.type === "image_generation_call" && data.item.result) {
          imageB64 = data.item.result;
          console.log("[oauth] got image data, b64 length:", imageB64.length);
        }
        if (data.type === "response.completed") {
          usage = data.response?.usage || null;
        }
        if (data.type === "error") {
          console.error("[oauth] stream error:", JSON.stringify(data));
          throw new Error(data.error?.message || JSON.stringify(data));
        }
      } catch (e) {
        if (e.message && !e.message.startsWith("Unexpected")) throw e;
      }
    }
  }

  console.log("[oauth] stream done, events:", eventCount, "hasImage:", !!imageB64);
  if (imageB64) return { b64: imageB64, usage };
  throw new Error("No image data received from OAuth proxy (parsed " + eventCount + " events)");
}

// ── Provider info ──
app.get("/api/providers", (_req, res) => {
  res.json({
    apiKey: HAS_API_KEY,
    oauth: true,
    oauthPort: OAUTH_PORT,
  });
});

// ── OAuth status ──
app.get("/api/oauth/status", async (_req, res) => {
  try {
    const r = await fetch(`${OAUTH_URL}/v1/models`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const data = await r.json();
      res.json({ status: "ready", models: data.data?.map((m) => m.id) || [] });
    } else {
      res.json({ status: "auth_required" });
    }
  } catch {
    res.json({ status: "offline" });
  }
});

// ── Generate image ──
app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, quality = "low", size = "1024x1024", format = "png", moderation = "low", provider = "auto" } =
      req.body;

    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const useOAuth = provider === "oauth" || (provider === "auto" && !HAS_API_KEY);
    console.log(`[generate] provider=${useOAuth ? "oauth" : "api"} quality=${quality} size=${size}`);
    const startTime = Date.now();

    let imageB64, usage;

    if (useOAuth) {
      const result = await generateViaOAuth(prompt, quality, size);
      imageB64 = result.b64;
      usage = result.usage;
    } else if (openai) {
      const response = await openai.images.generate({
        model: "gpt-image-2",
        prompt,
        quality,
        size,
        moderation,
        n: 1,
        output_format: format,
        output_compression: format === "png" ? undefined : 90,
      });
      imageB64 = response.data[0].b64_json;
      usage = response.usage;
    } else {
      return res.status(400).json({ error: "No API key configured and OAuth not selected" });
    }

    if (!imageB64) return res.status(500).json({ error: "No image data received" });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    await mkdir(join(__dirname, "generated"), { recursive: true });
    const filename = `${Date.now()}.${format}`;
    await writeFile(join(__dirname, "generated", filename), Buffer.from(imageB64, "base64"));

    const mimeMap = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

    res.json({
      image: `data:${mimeMap[format] || "image/png"};base64,${imageB64}`,
      elapsed,
      filename,
      usage,
      provider: useOAuth ? "oauth" : "api",
    });
  } catch (err) {
    console.error("Generate error:", err.message);
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

// ── Edit image (inpainting) ──
app.post("/api/edit", async (req, res) => {
  try {
    const { prompt, image: imageB64, mask: maskB64, quality = "low", size = "1024x1024", moderation = "low" } =
      req.body;

    if (!prompt || !imageB64)
      return res.status(400).json({ error: "Prompt and image are required" });
    if (!openai)
      return res.status(400).json({ error: "Image editing requires an API key" });

    const startTime = Date.now();

    const imageFile = new File([Buffer.from(imageB64, "base64")], "image.png", { type: "image/png" });
    const params = { model: "gpt-image-2", prompt, image: imageFile, quality, size, moderation };
    if (maskB64) {
      params.mask = new File([Buffer.from(maskB64, "base64")], "mask.png", { type: "image/png" });
    }

    const response = await openai.images.edit(params);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    res.json({
      image: `data:image/png;base64,${response.data[0].b64_json}`,
      elapsed,
      usage: response.usage,
    });
  } catch (err) {
    console.error("Edit error:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Billing info ──
app.get("/api/billing", async (_req, res) => {
  if (!HAS_API_KEY) return res.json({ oauth: true });

  try {
    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
    const [subRes, usageRes] = await Promise.allSettled([
      fetch(
        "https://api.openai.com/v1/organization/costs?start_time=" +
          Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000) +
          "&end_time=" + Math.floor(Date.now() / 1000) + "&bucket_width=1d&limit=31",
        { headers },
      ),
      fetch("https://api.openai.com/dashboard/billing/credit_grants", { headers }),
    ]);

    const billing = {};
    if (subRes.status === "fulfilled" && subRes.value.ok) billing.costs = await subRes.value.json();
    if (usageRes.status === "fulfilled" && usageRes.value.ok) billing.credits = await usageRes.value.json();
    if (!billing.costs && !billing.credits) {
      billing.apiKeyValid = (await fetch("https://api.openai.com/v1/models", { headers })).ok;
    }
    res.json(billing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start OAuth proxy as child process ──
function startOAuthProxy() {
  console.log(`Starting openai-oauth on port ${OAUTH_PORT}...`);
  const child = spawn("npx", ["openai-oauth", "--port", String(OAUTH_PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  child.stdout.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) console.log(`[oauth] ${msg}`);
  });

  child.stderr.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg && !msg.includes("npm warn")) console.error(`[oauth] ${msg}`);
  });

  child.on("exit", (code) => {
    console.log(`[oauth] exited with code ${code}, restarting in 5s...`);
    setTimeout(startOAuthProxy, 5000);
  });

  return child;
}

// ── Boot ──
const PORT = process.env.PORT || 3333;
const oauthChild = startOAuthProxy();

process.on("SIGINT", () => {
  oauthChild.kill();
  process.exit();
});
process.on("SIGTERM", () => {
  oauthChild.kill();
  process.exit();
});

app.listen(PORT, () => {
  console.log(`Image Gen running at http://localhost:${PORT}`);
  console.log(`Providers: ${HAS_API_KEY ? "API Key + " : ""}OAuth (port ${OAUTH_PORT})`);
  if (!HAS_API_KEY) console.log("No OPENAI_API_KEY set — OAuth mode only. Run 'codex login' first.");
});
