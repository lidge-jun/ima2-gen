function tokenize(value) {
    return String(value || "")
        .toLowerCase()
        .split(/[^a-z0-9가-힣-]+/i)
        .map((token) => token.trim())
        .filter(Boolean);
}
function includesAny(values, terms) {
    const haystack = values.map((value) => String(value || "").toLowerCase());
    return terms.some((term) => haystack.some((value) => value.includes(term)));
}
export function rankPromptCandidates({ candidates, query, limit }) {
    const terms = tokenize(query);
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
    const ranked = candidates.map((candidate) => {
        const text = String(candidate.text || "").toLowerCase();
        const name = String(candidate.name || "").toLowerCase();
        const tags = Array.isArray(candidate.tags) ? candidate.tags : [];
        const hints = candidate.scoreHints || {};
        const hintValues = [
            ...(hints.modelHints || []),
            ...(hints.generationSurfaceHints || []),
            ...(hints.taskHints || []),
            ...(hints.sizeHints || []),
            ...(hints.qualityHints || []),
        ];
        let score = 0;
        if (terms.length === 0)
            score += 1;
        for (const term of terms) {
            if (name.includes(term))
                score += 18;
            if (includesAny(tags, [term]))
                score += 12;
            if (includesAny(hintValues, [term]))
                score += 14;
            if (text.includes(term))
                score += 5;
            if (String(candidate.sourceFileId || "").toLowerCase().includes(term))
                score += 4;
        }
        if (tags.some((tag) => tag === "trust:curated"))
            score += 5;
        if (candidate.warnings?.length)
            score -= candidate.warnings.length * 3;
        return { ...candidate, score };
    });
    return ranked
        .filter((candidate) => terms.length === 0 || candidate.score > 0)
        .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)))
        .slice(0, boundedLimit);
}
