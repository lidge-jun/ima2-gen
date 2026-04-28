import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ulid } from "ulid";
import { generateViaOAuth } from "./oauthProxy.js";
import { readTemplateBaseB64 } from "./cardNewsTemplateStore.js";
import { writeCardNewsManifest, writeCardSidecar } from "./cardNewsManifestStore.js";
function formatRenderedTextInstruction(textFields = []) {
    const visible = (Array.isArray(textFields) ? textFields : [])
        .filter((field) => field?.renderMode === "in-image" && field.text);
    if (!visible.length) {
        return [
            "Do not render readable text unless explicitly listed.",
            "Do not render role labels, schema keys, placeholder labels, or untranslated summaries.",
        ].join("\n");
    }
    return [
        "Render only the following readable text items exactly as written:",
        ...visible.map((field) => {
            const slot = field.slotId ? ` in slot ${field.slotId}` : "";
            return `- ${field.kind} at ${field.placement}${slot}: "${field.text}"`;
        }),
        "Preserve the language and spelling of every listed text item.",
        "Do not render role labels, schema keys, placeholder labels, or extra text.",
    ].join("\n");
}
export function assemblePrompt(template, card) {
    return [
        template.stylePrompt,
        card.visualPrompt,
        formatRenderedTextInstruction(card.textFields),
        template.negativePrompt ? `Avoid: ${template.negativePrompt}` : "",
    ].filter(Boolean).join("\n");
}
async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    async function worker() {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i], i);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
}
export async function generateCardNewsSet(ctx, input, options = {}) {
    const setId = input.setId || `cs_${ulid()}`;
    const cards = Array.isArray(input.cards) ? input.cards : [];
    const cardsToGenerate = cards.filter((card) => !card.locked);
    if (cardsToGenerate.length === 0) {
        const err = new Error("cards are required");
        err.status = 400;
        err.code = "CARD_NEWS_CARDS_REQUIRED";
        throw err;
    }
    const imageTemplateId = input.imageTemplateId || "academy-lesson-square";
    const { template, templateBase, b64: templateB64 } = await readTemplateBaseB64(ctx, imageTemplateId);
    const dir = join(ctx.config.storage.generatedDir, "cardnews", setId);
    await mkdir(dir, { recursive: true });
    const quality = input.quality || "medium";
    const size = input.size || template.size || "2048x2048";
    const moderation = input.moderation || "low";
    const model = input.model || ctx.config.imageModels.default;
    const generateFn = options.generateFn || generateViaOAuth;
    const generatedCards = await mapLimit(cardsToGenerate, Number(input.concurrency) || 2, async (card, index) => {
        const cardOrder = Number(card.cardOrder || card.order || index + 1);
        const baseFilename = `card-${String(cardOrder).padStart(2, "0")}`;
        const imageFilename = `${baseFilename}.png`;
        const sidecarFilename = `${baseFilename}.json`;
        const requestId = input.requestId || `${setId}_${baseFilename}`;
        const prompt = assemblePrompt(template, card);
        let result = null;
        let error = null;
        if (typeof options.onCardStart === "function") {
            await options.onCardStart({ ...card, cardOrder, cardId: card.id || `card_${cardOrder}` });
        }
        try {
            result = await generateFn(prompt, quality, size, moderation, [templateB64, ...(Array.isArray(card.references) ? card.references : [])], requestId, input.promptMode || "direct", ctx, { model });
            if (!result?.b64) {
                error = { code: "CARD_NEWS_EMPTY_IMAGE", message: "No image data returned" };
            }
            else {
                await writeFile(join(dir, imageFilename), Buffer.from(result.b64, "base64"));
            }
        }
        catch (err) {
            error = { code: err.code || "CARD_NEWS_CARD_FAILED", message: err.message || "Card generation failed" };
        }
        const sidecar = {
            kind: "card-news-card",
            setId,
            sessionId: input.sessionId || null,
            requestId,
            cardId: card.id || `card_${cardOrder}`,
            cardOrder,
            title: input.title || "Untitled card news",
            role: card.role || "card",
            headline: card.headline || "",
            body: card.body || "",
            textFields: Array.isArray(card.textFields) ? card.textFields : [],
            imageTemplateId,
            generationStrategy: "parallel-template-i2i",
            templateBase,
            prompt,
            visualPrompt: card.visualPrompt || "",
            imageFilename: error ? null : imageFilename,
            sidecarFilename,
            locked: !!card.locked,
            status: error ? "error" : "generated",
            error,
            createdAt: Date.now(),
            generatedAt: error ? null : Date.now(),
            revisedPrompt: result?.revisedPrompt || null,
        };
        await writeCardSidecar(dir, sidecarFilename, sidecar);
        if (typeof options.onCardDone === "function")
            await options.onCardDone(sidecar);
        return sidecar;
    });
    const manifest = {
        kind: "card-news-set",
        setId,
        sessionId: input.sessionId || null,
        requestId: input.requestId || null,
        title: input.title || "Untitled card news",
        imageTemplateId,
        roleTemplateId: input.roleTemplateId || "mid-5",
        generationStrategy: "parallel-template-i2i",
        size,
        cardCount: generatedCards.length,
        createdAt: Date.now(),
        cards: generatedCards,
    };
    await writeCardNewsManifest(ctx.config.storage.generatedDir, manifest);
    return {
        setId,
        manifest,
        cards: generatedCards.map((card) => ({
            ...card,
            id: card.cardId,
            order: card.cardOrder,
            url: card.imageFilename
                ? `/generated/cardnews/${encodeURIComponent(setId)}/${encodeURIComponent(card.imageFilename)}`
                : undefined,
        })),
    };
}
