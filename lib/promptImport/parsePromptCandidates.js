import { createHash } from "crypto";
function normalizeWhitespace(text) {
    return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}
function stripFrontmatter(text) {
    return text.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
}
function isBoilerplate(line) {
    const trimmed = line.trim();
    return (!trimmed ||
        /^\[!\[.*\]\(.+\)\]\(.+\)$/.test(trimmed) ||
        /^!\[.*\]\(.+\)$/.test(trimmed) ||
        /^\[.*\]\(.+\)$/.test(trimmed));
}
function titleFromFilename(filename) {
    return (filename || "Imported prompt")
        .replace(/\.(txt|md|markdown)$/i, "")
        .replace(/[-_]+/g, " ")
        .trim() || "Imported prompt";
}
function candidateId(text, ordinal) {
    return `candidate_${ordinal}_${createHash("sha256").update(text).digest("hex").slice(0, 10)}`;
}
function promptHash(text) {
    return createHash("sha256").update(normalizeWhitespace(text).toLowerCase()).digest("hex");
}
function headingName(heading, fallback) {
    return heading?.replace(/^#+\s*/, "").trim() || fallback;
}
function allowedCandidate(text, limits) {
    const length = text.trim().length;
    return length >= limits.minCandidateChars && length <= limits.maxCandidateChars;
}
function cleanMarkdownBody(text) {
    return normalizeWhitespace(text
        .split("\n")
        .filter((line) => !isBoilerplate(line))
        .filter((line) => !/^\|.*\|$/.test(line.trim()))
        .join("\n"));
}
function pushCandidate(candidates, rawText, options) {
    const text = normalizeWhitespace(rawText);
    if (!allowedCandidate(text, options.limits))
        return;
    const ordinal = candidates.length + 1;
    const hash = promptHash(text);
    candidates.push({
        id: candidateId(text, ordinal),
        name: options.name,
        text,
        textPreview: text.slice(0, 220),
        tags: [...new Set(options.tags)],
        warnings: options.warnings ?? [],
        source: options.source,
        headingPath: options.headingPath ?? null,
        ordinal,
        promptHash: hash,
        scoreHints: options.scoreHints ?? {},
    });
}
function parseMarkdown(text, options) {
    const source = stripFrontmatter(text).slice(0, options.limits.maxSourceCharsScanned);
    const fencePattern = /```([A-Za-z0-9_-]*)\n([\s\S]*?)```/g;
    const acceptedFenceLanguages = new Set(["", "prompt", "text", "markdown", "md"]);
    const ranges = [];
    for (const match of source.matchAll(fencePattern)) {
        const language = (match[1] || "").toLowerCase();
        if (!acceptedFenceLanguages.has(language))
            continue;
        ranges.push([match.index ?? 0, (match.index ?? 0) + match[0].length]);
        pushCandidate(options.candidates, match[2], {
            ...options,
            name: `${options.baseName} ${options.candidates.length + 1}`,
            headingPath: options.headingPath ?? null,
        });
        if (options.candidates.length >= options.limits.maxPromptCandidatesPerFile)
            return;
    }
    const withoutFences = source
        .split("\n")
        .filter((line, index, lines) => {
        const offset = lines.slice(0, index).join("\n").length + (index > 0 ? 1 : 0);
        return !ranges.some(([start, end]) => offset >= start && offset < end);
    })
        .join("\n");
    const sections = withoutFences.split(/(?=^#{1,4}\s+)/gm);
    for (const section of sections) {
        const heading = /^#{1,4}\s+(.+)$/m.exec(section)?.[1];
        const body = cleanMarkdownBody(section.replace(/^#{1,4}\s+.+$/m, ""));
        pushCandidate(options.candidates, body, {
            ...options,
            name: headingName(heading, `${options.baseName} ${options.candidates.length + 1}`),
            headingPath: headingName(heading, options.baseName),
        });
        if (options.candidates.length >= options.limits.maxPromptCandidatesPerFile)
            return;
    }
}
function splitTextPrompts(text) {
    const normalized = normalizeWhitespace(text);
    const separatorBlocks = normalized.split(/\n\s*---+\s*\n/g).filter(Boolean);
    const blocks = separatorBlocks.length > 1
        ? separatorBlocks
        : normalized.split(/\n\s*\n+/g).filter(Boolean);
    const numbered = normalized.split(/(?=^\s*\d+[.)]\s+)/gm).filter(Boolean);
    const longLines = normalized.split("\n").map((line) => line.trim()).filter((line) => line.length >= 80);
    return blocks.length > 1 ? blocks : numbered.length > 1 ? numbered : longLines.length > 1 ? longLines : [normalized];
}
function parsePlainText(text, options) {
    const chunks = splitTextPrompts(text.slice(0, options.limits.maxSourceCharsScanned));
    for (const chunk of chunks) {
        const clean = chunk.replace(/^\s*\d+[.)]\s+/, "");
        pushCandidate(options.candidates, clean, {
            ...options,
            name: `${options.baseName} ${options.candidates.length + 1}`,
            headingPath: `${options.baseName} ${options.candidates.length + 1}`,
        });
        if (options.candidates.length >= options.limits.maxPromptCandidatesPerFile)
            return;
    }
}
export function parsePromptCandidates({ text, filename, source, tags = [], limits }) {
    const candidates = [];
    const extension = (filename.split(".").pop() || "").toLowerCase();
    const baseName = titleFromFilename(filename);
    const common = {
        candidates,
        limits,
        baseName,
        tags,
        source,
    };
    if (extension === "txt")
        parsePlainText(text, common);
    else
        parseMarkdown(text, common);
    return candidates.slice(0, limits.maxPromptCandidatesPerFile);
}
