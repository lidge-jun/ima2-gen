import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
export async function writeCardNewsManifest(generatedDir, manifest) {
    const dir = join(generatedDir, "cardnews", manifest.setId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
    return { dir, manifestFilename: "manifest.json" };
}
export async function writeCardSidecar(dir, filename, sidecar) {
    await writeFile(join(dir, filename), JSON.stringify(sidecar, null, 2));
}
function cardUrl(setId, imageFilename) {
    if (!imageFilename)
        return undefined;
    return `/generated/cardnews/${encodeURIComponent(setId)}/${encodeURIComponent(imageFilename)}`;
}
function assertSafeSetId(setId) {
    if (typeof setId === "string" && /^[a-zA-Z0-9_-]{3,120}$/.test(setId))
        return setId;
    const err = new Error("Card News set not found");
    err.status = 404;
    err.code = "CARD_NEWS_SET_NOT_FOUND";
    throw err;
}
function manifestToPlan(manifest) {
    return {
        setId: manifest.setId,
        title: manifest.title || "Untitled card news",
        topic: manifest.topic || manifest.title || "Untitled card news",
        imageTemplateId: manifest.imageTemplateId || "academy-lesson-square",
        roleTemplateId: manifest.roleTemplateId || "mid-5",
        size: manifest.size || "2048x2048",
        generationStrategy: manifest.generationStrategy || "parallel-template-i2i",
        cards: (manifest.cards || []).map((card, index) => ({
            id: card.cardId || card.id || `card_${index + 1}`,
            order: card.cardOrder || card.order || index + 1,
            role: card.role || "card",
            headline: card.headline || "",
            body: card.body || "",
            visualPrompt: card.visualPrompt || "",
            textFields: Array.isArray(card.textFields) ? card.textFields : [],
            references: card.references || [],
            locked: !!card.locked,
            status: card.status || "generated",
            error: card.error?.message || card.error || undefined,
            imageFilename: card.imageFilename || undefined,
            url: card.url || cardUrl(manifest.setId, card.imageFilename),
        })),
    };
}
export async function readCardNewsSetPlan(ctx, setId) {
    return manifestToPlan(await readCardNewsManifest(ctx, setId));
}
export async function readCardNewsManifest(ctx, setId) {
    const safeSetId = assertSafeSetId(setId);
    try {
        const raw = await readFile(join(ctx.config.storage.generatedDir, "cardnews", safeSetId, "manifest.json"), "utf8");
        return JSON.parse(raw);
    }
    catch (err) {
        if (err.code === "CARD_NEWS_SET_NOT_FOUND")
            throw err;
        const notFound = new Error("Card News set not found");
        notFound.status = 404;
        notFound.code = "CARD_NEWS_SET_NOT_FOUND";
        throw notFound;
    }
}
export async function listCardNewsSets(ctx) {
    const root = join(ctx.config.storage.generatedDir, "cardnews");
    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    const sets = [];
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        try {
            const raw = await readFile(join(root, entry.name, "manifest.json"), "utf8");
            const manifest = JSON.parse(raw);
            const first = (manifest.cards || []).find((card) => card.imageFilename);
            sets.push({
                setId: manifest.setId || entry.name,
                title: manifest.title || "Untitled card news",
                cardCount: manifest.cardCount || manifest.cards?.length || 0,
                createdAt: manifest.createdAt || 0,
                sessionId: manifest.sessionId || null,
                manifestUrl: `/api/cardnews/sets/${encodeURIComponent(manifest.setId || entry.name)}/manifest`,
                folderLabel: `generated/cardnews/${manifest.setId || entry.name}`,
                url: cardUrl(manifest.setId || entry.name, first?.imageFilename),
                cards: (manifest.cards || []).map((card) => ({
                    id: card.cardId,
                    order: card.cardOrder,
                    headline: card.headline,
                    body: card.body,
                    textFields: Array.isArray(card.textFields) ? card.textFields : [],
                    imageFilename: card.imageFilename,
                    status: card.status || "generated",
                    url: cardUrl(manifest.setId || entry.name, card.imageFilename),
                })),
            });
        }
        catch (err) {
            console.warn("[card-news] set manifest read failed", entry.name, err.message);
        }
    }
    sets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return sets;
}
