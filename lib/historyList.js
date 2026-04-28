import { mkdir, readFile, readdir, stat } from "fs/promises";
import { dirname, join } from "path";
import { config } from "../config.js";
import { readEmbeddedImageMetadataFromFile } from "./imageMetadataStore.js";
async function listImageFiles(baseDir) {
    const out = [];
    async function walk(dir, depth) {
        const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            if (entry.name === config.storage.trashDirName)
                continue;
            const full = join(dir, entry.name);
            if (entry.isDirectory() && depth > 0) {
                await walk(full, depth - 1);
            }
            else if (entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name)) {
                out.push({ full, rel: full.slice(baseDir.length + 1), name: entry.name });
            }
        }
    }
    await walk(baseDir, 2);
    return out;
}
export async function listHistoryRows(baseDir = config.storage.generatedDir) {
    await mkdir(baseDir, { recursive: true });
    const imgs = await listImageFiles(baseDir);
    const setRows = await listCardNewsSetRows(baseDir);
    const rows = await Promise.all(imgs.map(async ({ full, rel, name }) => {
        const st = await stat(full).catch(() => null);
        const meta = await readImageMetadata(full, rel);
        return {
            filename: rel,
            url: `/generated/${rel.split("/").map(encodeURIComponent).join("/")}`,
            createdAt: meta?.createdAt || st?.mtimeMs || 0,
            prompt: meta?.prompt || null,
            userPrompt: meta?.userPrompt || meta?.prompt || null,
            revisedPrompt: meta?.revisedPrompt || null,
            promptMode: meta?.promptMode || null,
            quality: meta?.quality || null,
            size: meta?.size || null,
            format: meta?.format || name.split(".").pop(),
            model: meta?.model || null,
            provider: meta?.provider || "oauth",
            usage: meta?.usage || null,
            webSearchCalls: meta?.webSearchCalls || 0,
            sessionId: meta?.sessionId || null,
            nodeId: meta?.nodeId || null,
            parentNodeId: meta?.parentNodeId || null,
            clientNodeId: meta?.clientNodeId || null,
            requestId: meta?.requestId || null,
            kind: meta?.kind || null,
            canvasVersion: Boolean(meta?.canvasVersion),
            canvasSourceFilename: meta?.canvasSourceFilename || null,
            canvasEditableFilename: meta?.canvasEditableFilename || null,
            canvasMergedAt: Number.isFinite(meta?.canvasMergedAt) ? meta.canvasMergedAt : null,
            setId: meta?.setId || null,
            cardId: meta?.cardId || null,
            cardOrder: Number.isFinite(meta?.cardOrder) ? meta.cardOrder : null,
            headline: meta?.headline || null,
            body: meta?.body || null,
            cards: meta?.cards || null,
            refsCount: Number.isFinite(meta?.refsCount) ? meta.refsCount : 0,
            sequenceId: meta?.sequenceId || null,
            sequenceIndex: Number.isFinite(meta?.sequenceIndex) ? meta.sequenceIndex : null,
            sequenceTotalRequested: Number.isFinite(meta?.sequenceTotalRequested) ? meta.sequenceTotalRequested : null,
            sequenceTotalReturned: Number.isFinite(meta?.sequenceTotalReturned) ? meta.sequenceTotalReturned : null,
            sequenceStatus: meta?.sequenceStatus || null,
        };
    }));
    rows.push(...setRows);
    rows.sort((a, b) => {
        if (b.createdAt !== a.createdAt)
            return b.createdAt - a.createdAt;
        return b.filename < a.filename ? -1 : b.filename > a.filename ? 1 : 0;
    });
    return rows;
}
async function readImageSidecar(full, rel) {
    const sibling = full.replace(/\.(png|jpe?g|webp)$/i, ".json");
    for (const candidate of [`${full}.json`, sibling]) {
        try {
            return JSON.parse(await readFile(candidate, "utf-8"));
        }
        catch (e) {
            if (e.code !== "ENOENT")
                console.warn("[history] sidecar parse fail:", rel, e.message);
        }
    }
    return null;
}
async function readImageMetadata(full, rel) {
    const sidecar = await readImageSidecar(full, rel);
    if (sidecar)
        return sidecar;
    try {
        const embedded = await readEmbeddedImageMetadataFromFile(full);
        return embedded.metadata;
    }
    catch (e) {
        if (e.code !== "ENOENT")
            console.warn("[history] embedded metadata read fail:", rel, e.message);
        return null;
    }
}
async function listCardNewsSetRows(baseDir) {
    const root = join(baseDir, "cardnews");
    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    const rows = [];
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        try {
            const manifestPath = join(root, entry.name, "manifest.json");
            const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
            const first = (manifest.cards || []).find((card) => card.imageFilename);
            const filename = `cardnews/${entry.name}/manifest.json`;
            rows.push({
                filename,
                url: first?.imageFilename
                    ? `/generated/cardnews/${encodeURIComponent(entry.name)}/${encodeURIComponent(first.imageFilename)}`
                    : "",
                createdAt: manifest.createdAt || 0,
                prompt: null,
                userPrompt: null,
                revisedPrompt: null,
                promptMode: null,
                quality: null,
                size: manifest.size || null,
                format: "card-news-set",
                model: null,
                provider: "oauth",
                usage: null,
                webSearchCalls: 0,
                sessionId: manifest.sessionId || null,
                nodeId: null,
                parentNodeId: null,
                clientNodeId: null,
                requestId: manifest.requestId || null,
                kind: "card-news-set",
                setId: manifest.setId || entry.name,
                cardId: null,
                cardOrder: null,
                title: manifest.title || "Untitled card news",
                headline: manifest.title || "Untitled card news",
                body: null,
                cards: (manifest.cards || []).map((card) => ({
                    url: card.imageFilename
                        ? `/generated/cardnews/${encodeURIComponent(entry.name)}/${encodeURIComponent(card.imageFilename)}`
                        : "",
                    headline: card.headline,
                    body: card.body,
                    cardOrder: card.cardOrder,
                    imageFilename: card.imageFilename,
                    status: card.status || "generated",
                })),
                refsCount: 0,
                dir: dirname(manifestPath),
            });
        }
        catch (e) {
            if (e.code !== "ENOENT")
                console.warn("[history] card-news manifest parse fail:", entry.name, e.message);
        }
    }
    return rows;
}
