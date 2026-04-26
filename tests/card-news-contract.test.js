import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import express from "express";
import { listImageTemplates, getImageTemplate } from "../lib/cardNewsTemplateStore.js";
import { createCardNewsDraft } from "../lib/cardNewsPlanner.js";
import { generateCardNewsSet } from "../lib/cardNewsGenerator.js";
import { listHistoryRows } from "../lib/historyList.js";
import { readCardNewsSetPlan } from "../lib/cardNewsManifestStore.js";
import { repairPlannerOutput, validatePlannerOutput } from "../lib/cardNewsPlannerSchema.js";
import {
  createCardNewsJob,
  getCardNewsJob,
  retryCardNewsJob,
  updateCardNewsJobCard,
} from "../lib/cardNewsJobStore.js";
import { configureRoutes } from "../routes/index.js";

const rootDir = process.cwd();
const PNG_B64 = Buffer.from("generated-card").toString("base64");

function readPngSize(buf) {
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function makeCtx(generatedDir, cardNews = true) {
  return {
    rootDir,
    config: {
      features: { cardNews },
      storage: { generatedDir, staticMaxAge: "0" },
      server: { bodyLimit: "2mb" },
      oauth: { validModeration: new Set(["auto", "low"]) },
      imageModels: { default: "gpt-5.4-mini" },
      cardNewsPlanner: { enabled: false, model: "gpt-5.4-mini", timeoutMs: 60_000, deterministicFallback: false },
    },
  };
}

async function listen(app) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function listenPlanner(handler) {
  const app = express();
  app.use(express.json());
  app.post("/v1/responses", handler);
  return listen(app);
}

describe("Card News 0.20 dev MVP contract", () => {
  it("keeps the planner text-only and returns planner metadata", async () => {
    const promptSource = await readFile(join(rootDir, "lib", "cardNewsPlannerPrompt.js"), "utf8");
    const clientSource = await readFile(join(rootDir, "lib", "cardNewsPlannerClient.js"), "utf8");
    const schemaSource = await readFile(join(rootDir, "lib", "cardNewsPlannerSchema.js"), "utf8");
    const draft = await createCardNewsDraft(makeCtx("/tmp/ima2-card-news-planner"), {
      topic: "JSON output",
      roleTemplateId: "short-3",
      imageTemplateId: "academy-lesson-square",
    });

    assert.doesNotMatch(promptSource, /image_generation/);
    assert.match(promptSource, /JSON/);
    assert.match(promptSource, /Role names such as cover\/problem\/cta are structural labels/);
    assert.match(promptSource, /Use headline textFields for hook\/cover cards/);
    assert.match(promptSource, /Placement examples:/);
    assert.match(promptSource, /preferredSlots/);
    assert.match(promptSource, /textFieldPolicy/);
    assert.match(clientSource, /json_schema/);
    assert.match(clientSource, /json_object/);
    assert.match(clientSource, /\/v1\/chat\/completions/);
    assert.match(schemaSource, /validatePlannerOutput/);
    assert.match(schemaSource, /textFields/);
    assert.match(schemaSource, /slotId/);
    assert.match(schemaSource, /maxChars/);
    assert.match(schemaSource, /language/);
    assert.equal(draft.planner.mode, "deterministic-fallback");
    assert.equal(draft.plan.cards.length, 3);
    assert.deepEqual(draft.plan.cards[0].textFields, []);
  });

  it("keeps visible copy in textFields and out of visualPrompt", () => {
    const roleTemplate = {
      roles: [{ role: "cover", promptHint: "cover", preferredSlots: ["title"] }],
    };
    const visibleText = "중간고사 역전 플랜";
    const output = {
      title: "중간고사",
      topic: "중간고사",
      cards: [{
        order: 1,
        role: "cover",
        headline: "중간고사",
        body: "요약",
        visualPrompt: `top headline should render ${visibleText}`,
        textFields: [{
          id: "tf_1",
          kind: "headline",
          text: visibleText,
          renderMode: "in-image",
          placement: "top-center",
          slotId: "title",
          hierarchy: "primary",
          maxChars: 24,
          language: "ko",
          source: "planner",
        }],
        references: [],
        locked: false,
      }],
    };

    const invalid = validatePlannerOutput(output, roleTemplate);
    assert.equal(invalid.ok, false);
    assert.ok(invalid.errors.some((error) => error.includes("visualPrompt must not duplicate exact visible text")));

    const repaired = repairPlannerOutput(output, {
      topic: "중간고사",
      contentBrief: "학부모 대상 안내",
      roleTemplate,
    });
    assert.equal(repaired.ok, true);
    assert.equal(repaired.plan.cards[0].textFields[0].text, visibleText);
    assert.doesNotMatch(repaired.plan.cards[0].visualPrompt, new RegExp(visibleText));
  });

  it("honors planner upstream failure and deterministic fallback config", async () => {
    const upstream = await listenPlanner((_req, res) => {
      res.status(500).json({ error: { message: "planner down" } });
    });
    const ctx = makeCtx("/tmp/ima2-card-news-planner-fail");
    ctx.oauthUrl = upstream.baseUrl;
    ctx.config.cardNewsPlanner = {
      enabled: true,
      model: "gpt-5.4-mini",
      timeoutMs: 5_000,
      deterministicFallback: false,
    };

    try {
      await assert.rejects(
        () => createCardNewsDraft(ctx, {
          topic: "fail",
          roleTemplateId: "short-3",
          imageTemplateId: "academy-lesson-square",
        }),
        (err) => err.code === "PLANNER_UPSTREAM_FAILED",
      );

      ctx.config.cardNewsPlanner.deterministicFallback = true;
      const draft = await createCardNewsDraft(ctx, {
        topic: "fallback",
        roleTemplateId: "short-3",
        imageTemplateId: "academy-lesson-square",
      });
      assert.equal(draft.planner.mode, "deterministic-fallback");
      assert.equal(draft.plan.cards.length, 3);
    } finally {
      await upstream.close();
    }
  });

  it("rejects invalid planner JSON when fallback is disabled", async () => {
    const upstream = await listenPlanner((_req, res) => {
      res.json({ output_text: "not json" });
    });
    const ctx = makeCtx("/tmp/ima2-card-news-planner-json");
    ctx.oauthUrl = upstream.baseUrl;
    ctx.config.cardNewsPlanner = {
      enabled: true,
      model: "gpt-5.4-mini",
      timeoutMs: 5_000,
      deterministicFallback: false,
    };

    try {
      await assert.rejects(
        () => createCardNewsDraft(ctx, {
          topic: "invalid json",
          roleTemplateId: "short-3",
          imageTemplateId: "academy-lesson-square",
        }),
        (err) => err.code === "PLANNER_INVALID_JSON",
      );
    } finally {
      await upstream.close();
    }
  });

  it("lists built-in image templates and rejects unsafe template ids", async () => {
    const ctx = makeCtx("/tmp/ima2-card-news-contract");
    const templates = await listImageTemplates(ctx);

    assert.ok(templates.some((t) => t.id === "academy-lesson-square"));
    assert.ok(templates.some((t) => t.id === "clean-report-square"));
    assert.equal(templates[0].previewUrl.startsWith("/api/cardnews/image-templates/"), true);

    for (const id of ["academy-lesson-square", "clean-report-square"]) {
      const template = templates.find((item) => item.id === id);
      assert.deepEqual(template.recommendedOutputSizes, ["1024x1024", "2048x2048"]);
      assert.equal(typeof template.authoringLabel, "string");
      assert.equal(typeof template.description, "string");
      assert.ok(template.slots.every((slot) => slot.label && slot.placement));
      assert.ok(template.slots.every((slot) => slot.kind !== "title" && slot.kind !== "body" && slot.kind !== "cta"));
      assert.ok(template.slots.filter((slot) => slot.kind === "text").every((slot) => Number.isInteger(slot.maxChars)));
      const base = await readFile(join(rootDir, "assets", "card-news", "templates", id, "base.png"));
      const preview = await readFile(join(rootDir, "assets", "card-news", "templates", id, "preview.png"));
      assert.deepEqual(readPngSize(base), { width: 1024, height: 1024 });
      assert.deepEqual(readPngSize(preview), { width: 1024, height: 1024 });
    }

    await assert.rejects(
      () => getImageTemplate(ctx, "../escape"),
      (err) => err.code === "CARD_NEWS_BAD_TEMPLATE_ID",
    );
  });

  it("creates a JSON-first mid-5 draft without generating images", async () => {
    const plan = await createCardNewsDraft({
      topic: "중간고사 역전 플랜",
      audience: "학부모",
      goal: "상담 신청",
      roleTemplateId: "mid-5",
      imageTemplateId: "academy-lesson-square",
    });

    assert.equal(plan.generationStrategy, "parallel-template-i2i");
    assert.equal(plan.cards.length, 5);
    assert.deepEqual(plan.cards.map((c) => c.role), ["cover", "problem", "insight", "example", "cta"]);
    assert.equal(plan.cards.every((c) => c.status === "draft"), true);
  });

  it("generates parallel template-guided i2i cards without chaining card outputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "ima2-card-news-"));
    const generatedDir = join(root, "generated");
    const ctx = makeCtx(generatedDir);
    const calls = [];
    const plan = await createCardNewsDraft({ roleTemplateId: "short-3", imageTemplateId: "academy-lesson-square" });
    plan.cards[0] = {
      ...plan.cards[0],
      textFields: [{
        id: "tf_1",
        kind: "headline",
        text: "중간고사 역전 플랜",
        renderMode: "in-image",
        placement: "top-right",
        slotId: null,
        hierarchy: "primary",
        maxChars: 24,
        language: "ko",
        source: "planner",
      }],
    };

    const result = await generateCardNewsSet(ctx, plan, {
      generateFn: async (prompt, quality, size, moderation, refs) => {
        calls.push({ prompt, quality, size, moderation, refs });
        return { b64: PNG_B64, revisedPrompt: "revised" };
      },
    });

    try {
      assert.equal(result.cards.length, 3);
      assert.equal(result.cards[0].id, "card_1");
      assert.equal(calls.length, 3);
      assert.equal(new Set(calls.map((c) => c.refs[0])).size, 1);
      assert.equal(calls.every((c) => c.refs.length === 1), true);
      assert.doesNotMatch(calls[0].prompt, /Rendered headline:/);
      assert.match(calls[0].prompt, /Render only the following readable text items exactly as written/);
      assert.match(calls[0].prompt, /top-right/);
      assert.match(calls[0].prompt, /중간고사/);
      assert.match(calls[1].prompt, /Do not render readable text/);

      const manifest = JSON.parse(await readFile(join(generatedDir, "cardnews", result.setId, "manifest.json"), "utf8"));
      const sidecar = JSON.parse(await readFile(join(generatedDir, "cardnews", result.setId, "card-01.json"), "utf8"));
      const loadedPlan = await readCardNewsSetPlan(ctx, result.setId);
      assert.equal(manifest.generationStrategy, "parallel-template-i2i");
      assert.equal(sidecar.sidecarFilename, "card-01.json");
      assert.equal(sidecar.textFields[0].text, "중간고사 역전 플랜");
      assert.equal(loadedPlan.cards[0].textFields[0].text, "중간고사 역전 플랜");
      assert.match(result.cards[0].url, /\/generated\/cardnews\//);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("hydrates legacy Card News set manifests with empty textFields", async () => {
    const root = await mkdtemp(join(tmpdir(), "ima2-card-news-legacy-"));
    const generatedDir = join(root, "generated");
    const ctx = makeCtx(generatedDir);
    const dir = join(generatedDir, "cardnews", "cs_legacy");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "manifest.json"), JSON.stringify({
      kind: "card-news-set",
      setId: "cs_legacy",
      title: "Legacy",
      cards: [{ cardId: "card_1", cardOrder: 1, headline: "Old card" }],
    }));

    try {
      const loaded = await readCardNewsSetPlan(ctx, "cs_legacy");
      assert.deepEqual(loaded.cards[0].textFields, []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("persists per-card errors and exposes Card News set rows in history", async () => {
    const root = await mkdtemp(join(tmpdir(), "ima2-card-news-error-"));
    const generatedDir = join(root, "generated");
    const ctx = makeCtx(generatedDir);
    const plan = await createCardNewsDraft({ roleTemplateId: "short-3", imageTemplateId: "academy-lesson-square" });
    let callIndex = 0;

    const result = await generateCardNewsSet(ctx, {
      ...plan,
      sessionId: "s_card_news",
    }, {
      generateFn: async () => {
        callIndex += 1;
        if (callIndex === 2) {
          const err = new Error("upstream rejected card");
          err.code = "UPSTREAM_400";
          throw err;
        }
        return { b64: PNG_B64 };
      },
    });

    try {
      assert.equal(result.cards.length, 3);
      assert.equal(result.cards[1].status, "error");
      assert.equal(result.cards[1].url, undefined);

      const manifest = JSON.parse(await readFile(join(generatedDir, "cardnews", result.setId, "manifest.json"), "utf8"));
      const errorSidecar = JSON.parse(await readFile(join(generatedDir, "cardnews", result.setId, "card-02.json"), "utf8"));
      assert.equal(manifest.kind, "card-news-set");
      assert.equal(manifest.sessionId, "s_card_news");
      assert.equal(errorSidecar.kind, "card-news-card");
      assert.match(errorSidecar.requestId, /card-02$/);
      assert.equal(errorSidecar.status, "error");
      assert.equal(errorSidecar.error.code, "UPSTREAM_400");

      const rows = await listHistoryRows(generatedDir);
      const setRow = rows.find((row) => row.kind === "card-news-set" && row.setId === result.setId);
      const cardRow = rows.find((row) => row.kind === "card-news-card" && row.cardOrder === 1);
      assert.ok(setRow);
      assert.equal(setRow.sessionId, "s_card_news");
      assert.equal(Array.isArray(setRow.cards), true);
      assert.ok(cardRow);
      assert.equal(cardRow.sidecarFilename, undefined);
      assert.equal(cardRow.cardId, "card_1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("tracks generation jobs with queued, skipped, error, and retry states", () => {
    const routeSource = readFile(join(rootDir, "routes", "cardNews.js"), "utf8");
    const job = createCardNewsJob({
      setId: "cs_job",
      cards: [
        { id: "card_1", order: 1 },
        { id: "card_2", order: 2, locked: true },
      ],
    });

    assert.equal(job.status, "queued");
    assert.equal(job.total, 2);
    assert.equal(job.generated, 0);
    assert.deepEqual(job.cards.map((card) => card.status), ["queued", "skipped"]);

    const retry = retryCardNewsJob(job.jobId, ["card_1"]);
    assert.equal(retry.status, "queued");
    assert.equal(getCardNewsJob(job.jobId).setId, "cs_job");
    assert.equal(getCardNewsJob("missing"), null);
    return routeSource.then((source) => {
      assert.match(source, /function runCardNewsJob/);
      assert.match(source, /generateCardNewsSet\(ctx, plan/);
      assert.match(source, /updateCardNewsJobCard/);
      assert.match(source, /finishCardNewsJob/);
    });
  });

  it("exposes generated card metadata in job polling summaries", () => {
    const job = createCardNewsJob({
      setId: "cs_job_metadata",
      cards: [
        { id: "card_1", order: 1 },
      ],
    });
    const generatedAt = Date.now();

    const summary = updateCardNewsJobCard(job.jobId, "card_1", {
      status: "generated",
      url: "/generated/cardnews/cs_job_metadata/card-01.png",
      imageFilename: "card-01.png",
      headline: "Generated headline",
      body: "Generated body",
      textFields: [{ id: "tf_1", text: "Visible", renderMode: "in-image" }],
      generatedAt,
    });
    const card = summary.cards[0];

    assert.equal(summary.status, "done");
    assert.equal(summary.generated, 1);
    assert.equal(card.status, "generated");
    assert.equal(card.url, "/generated/cardnews/cs_job_metadata/card-01.png");
    assert.equal(card.imageFilename, "card-01.png");
    assert.equal(card.headline, "Generated headline");
    assert.equal(card.body, "Generated body");
    assert.deepEqual(card.textFields, [{ id: "tf_1", text: "Visible", renderMode: "in-image" }]);
    assert.equal(card.generatedAt, generatedAt);
    assert.deepEqual(getCardNewsJob(job.jobId).cards[0], card);
  });

  it("skips locked cards during batch generation", async () => {
    const root = await mkdtemp(join(tmpdir(), "ima2-card-news-locked-"));
    const generatedDir = join(root, "generated");
    const ctx = makeCtx(generatedDir);
    const calls = [];
    const plan = await createCardNewsDraft({ roleTemplateId: "short-3", imageTemplateId: "academy-lesson-square" });

    const result = await generateCardNewsSet(ctx, {
      ...plan,
      cards: plan.cards.map((card, idx) => ({ ...card, locked: idx === 1 })),
    }, {
      generateFn: async () => {
        calls.push("generated");
        return { b64: PNG_B64 };
      },
    });

    try {
      assert.equal(calls.length, 2);
      assert.deepEqual(result.cards.map((c) => c.id), ["card_1", "card_3"]);
      const manifest = JSON.parse(await readFile(join(generatedDir, "cardnews", result.setId, "manifest.json"), "utf8"));
      assert.equal(manifest.cards.length, 2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("registers Card News routes only behind the feature flag", async () => {
    const disabledApp = express();
    disabledApp.use(express.json());
    configureRoutes(disabledApp, makeCtx("/tmp/ima2-card-news-disabled", false));
    const disabled = await listen(disabledApp);

    const enabledApp = express();
    enabledApp.use(express.json());
    configureRoutes(enabledApp, makeCtx("/tmp/ima2-card-news-enabled", true));
    const enabled = await listen(enabledApp);

    try {
      assert.equal((await fetch(`${disabled.baseUrl}/api/cardnews/role-templates`)).status, 404);
      const res = await fetch(`${enabled.baseUrl}/api/cardnews/role-templates`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.templates.some((t) => t.id === "mid-5"));
    } finally {
      await disabled.close();
      await enabled.close();
    }
  });
});
