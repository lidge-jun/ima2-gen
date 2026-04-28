const MODEL_HINTS = [
    ["gpt-image-2", /\bgpt[- ]?image[- ]?2\b/i],
    ["gpt-image", /\bgpt[- ]?image\b/i],
    ["nano-banana", /\bnano[- ]?banana\b/i],
    ["midjourney", /\bmidjourney\b/i],
    ["stable-diffusion", /\bstable[- ]?diffusion\b/i],
];
const TASK_HINTS = [
    ["image_generation", /\b(image generation|generate an image|text to image)\b/i],
    ["reference-image", /\b(reference image|keep the same|preserve|consistent character|same face)\b/i],
    ["mask-edit", /\b(mask|inpaint|outpaint|replace only|change only)\b/i],
    ["typography", /\b(typography|headline|readable text|lettering|poster text|title text)\b/i],
    ["layout", /\b(layout|grid|composition|poster|diagram|infographic)\b/i],
    ["product-shot", /\b(product photo|product shot|packaging|label|reflection)\b/i],
];
const SIZE_HINTS = [
    ["2k", /\b2k\b/i],
    ["4k", /\b4k\b/i],
    ["square", /\bsquare\b/i],
    ["portrait", /\bportrait|vertical\b/i],
    ["landscape", /\blandscape|horizontal\b/i],
];
const QUALITY_HINTS = [
    ["low", /\blow\b/i],
    ["medium", /\bmedium\b/i],
    ["high", /\bhigh\b/i],
    ["auto", /\bauto\b/i],
    ["draft", /\bdraft|thumbnail|iteration\b/i],
    ["final", /\bfinal|production[- ]ready\b/i],
];
function matches(text, patterns) {
    return patterns.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}
export function extractGptImageHints(text) {
    const value = String(text || "");
    const modelHints = matches(value, MODEL_HINTS);
    const taskHints = matches(value, TASK_HINTS);
    const sizeHints = matches(value, SIZE_HINTS);
    const qualityHints = matches(value, QUALITY_HINTS);
    const warnings = [];
    if (/\btransparent|alpha channel|no background|cutout\b/i.test(value)) {
        warnings.push("transparent-unsupported-gpt-image-2");
    }
    if (/\bexact text|small text|dense text|legal copy\b/i.test(value)) {
        warnings.push("text-rendering-sensitive");
    }
    if (/\bcomplex layout|multi[- ]panel|precise diagram\b/i.test(value)) {
        warnings.push("layout-sensitive");
    }
    if (/\b4k|high resolution|ultra[- ]high\b/i.test(value)) {
        warnings.push("high-res-cost-warning");
    }
    return {
        modelHints,
        generationSurfaceHints: taskHints.includes("image_generation") ? ["responses-image-tool"] : [],
        taskHints,
        sizeHints,
        qualityHints,
        warnings,
    };
}
