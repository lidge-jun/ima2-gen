import { ulid } from "ulid";
const jobs = new Map();
const TTL_MS = 30 * 60 * 1000;
function summarize(job) {
    const generated = job.cards.filter((card) => card.status === "generated").length;
    const errors = job.cards.filter((card) => card.status === "error").length;
    return {
        jobId: job.jobId,
        setId: job.setId,
        status: job.status,
        total: job.cards.length,
        generated,
        errors,
        cards: job.cards,
        updatedAt: job.updatedAt,
    };
}
function statusFromCards(cards) {
    const active = cards.some((card) => card.status === "queued" || card.status === "generating");
    if (active)
        return "running";
    const errors = cards.some((card) => card.status === "error");
    const generated = cards.some((card) => card.status === "generated");
    if (errors && generated)
        return "partial";
    if (errors)
        return "error";
    return "done";
}
export function createCardNewsJob(plan) {
    const now = Date.now();
    const job = {
        jobId: `cj_${ulid()}`,
        setId: plan.setId,
        status: "queued",
        plan,
        cards: (plan.cards || []).map((card) => ({
            id: card.id,
            order: card.order,
            status: card.locked ? "skipped" : "queued",
            textFields: Array.isArray(card.textFields) ? card.textFields : [],
        })),
        createdAt: now,
        updatedAt: now,
    };
    jobs.set(job.jobId, job);
    return summarize(job);
}
export function getCardNewsJob(jobId) {
    const job = jobs.get(jobId);
    if (!job)
        return null;
    return summarize(job);
}
export function updateCardNewsJob(jobId, patch) {
    const job = jobs.get(jobId);
    if (!job)
        return null;
    Object.assign(job, patch, { updatedAt: Date.now() });
    return summarize(job);
}
export function updateCardNewsJobCard(jobId, cardId, patch) {
    const job = jobs.get(jobId);
    if (!job)
        return null;
    job.cards = job.cards.map((card) => (card.id === cardId ? {
        ...card,
        ...patch,
        textFields: Array.isArray(patch.textFields) ? patch.textFields : card.textFields,
    } : card));
    job.status = statusFromCards(job.cards);
    job.updatedAt = Date.now();
    return summarize(job);
}
export function finishCardNewsJob(jobId) {
    const job = jobs.get(jobId);
    if (!job)
        return null;
    job.status = statusFromCards(job.cards);
    job.updatedAt = Date.now();
    return summarize(job);
}
export function getCardNewsJobPlan(jobId) {
    return jobs.get(jobId)?.plan || null;
}
export function retryCardNewsJob(jobId, cardIds) {
    const job = jobs.get(jobId);
    if (!job)
        return null;
    const wanted = new Set(cardIds || []);
    job.cards = job.cards.map((card) => (wanted.has(card.id) && card.status === "error" ? { ...card, status: "queued", error: undefined } : card));
    job.status = "queued";
    job.updatedAt = Date.now();
    return summarize(job);
}
export function reapCardNewsJobs(now = Date.now()) {
    for (const [jobId, job] of jobs.entries()) {
        if (now - job.updatedAt > TTL_MS)
            jobs.delete(jobId);
    }
}
