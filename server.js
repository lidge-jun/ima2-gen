import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: "50mb" }));
app.use(express.static(join(__dirname, "public")));

// Generate image
app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, quality = "low", size = "1024x1024", format = "png", moderation = "low" } =
      req.body;

    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const startTime = Date.now();

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

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const imageB64 = response.data[0].b64_json;

    await mkdir(join(__dirname, "generated"), { recursive: true });
    const filename = `${Date.now()}.${format}`;
    await writeFile(
      join(__dirname, "generated", filename),
      Buffer.from(imageB64, "base64"),
    );

    const mimeMap = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

    res.json({
      image: `data:${mimeMap[format] || "image/png"};base64,${imageB64}`,
      elapsed,
      filename,
      usage: response.usage,
    });
  } catch (err) {
    console.error("Generate error:", err.message);
    const status = err.status || 500;
    res.status(status).json({
      error: err.message,
      code: err.code,
    });
  }
});

// Edit image (inpainting)
app.post("/api/edit", async (req, res) => {
  try {
    const {
      prompt,
      image: imageB64,
      mask: maskB64,
      quality = "low",
      size = "1024x1024",
    } = req.body;

    if (!prompt || !imageB64)
      return res.status(400).json({ error: "Prompt and image are required" });

    const startTime = Date.now();

    const imageFile = new File(
      [Buffer.from(imageB64, "base64")],
      "image.png",
      { type: "image/png" },
    );

    const params = {
      model: "gpt-image-2",
      prompt,
      image: imageFile,
      quality,
      size,
    };

    if (maskB64) {
      params.mask = new File([Buffer.from(maskB64, "base64")], "mask.png", {
        type: "image/png",
      });
    }

    const response = await openai.images.edit(params);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const resultB64 = response.data[0].b64_json;

    res.json({
      image: `data:image/png;base64,${resultB64}`,
      elapsed,
      usage: response.usage,
    });
  } catch (err) {
    console.error("Edit error:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Billing info
app.get("/api/billing", async (req, res) => {
  try {
    const headers = {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    };

    const [subRes, usageRes] = await Promise.allSettled([
      fetch("https://api.openai.com/v1/organization/costs?start_time=" +
        Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000) +
        "&end_time=" + Math.floor(Date.now() / 1000) +
        "&bucket_width=1d&limit=31",
        { headers }),
      fetch("https://api.openai.com/dashboard/billing/credit_grants", { headers }),
    ]);

    const billing = {};

    if (subRes.status === "fulfilled" && subRes.value.ok) {
      const costs = await subRes.value.json();
      billing.costs = costs;
    }

    if (usageRes.status === "fulfilled" && usageRes.value.ok) {
      const credits = await usageRes.value.json();
      billing.credits = credits;
    }

    if (!billing.costs && !billing.credits) {
      const modelsRes = await fetch("https://api.openai.com/v1/models", { headers });
      billing.apiKeyValid = modelsRes.ok;
    }

    res.json(billing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Image Gen running at http://localhost:${PORT}`);
});
