import { approveSpriteAnchor, createSpriteRecipe, generateSpriteAnchor, generateSpriteRows, getSpriteRecipe, listSpriteRecipes, updateSpriteRecipe } from "../lib/api-sprite-recipes";
import { subscribe, whenConnected } from "../lib/eventChannel";
import { parseSseErrorPayload } from "../lib/sseStreamError";
import { resolveErrorSpec } from "../lib/errorCodes";
import { handleError } from "../lib/errorHandler";
import type { SpriteJobEvent, SpriteRecipeDraft, SpriteRecipeRecord } from "../types/spriteRecipe";
import type { StoreGet, StoreSet } from "./storeTypes";

const subscriptions = new Map<string, () => void>();
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const summary = (recipe: SpriteRecipeRecord) => ({ id: recipe.id, name: recipe.name, anchorStatus: recipe.anchorStatus, updatedAt: recipe.updatedAt });

export async function loadSpriteRecipesImpl(set: StoreSet, get: StoreGet): Promise<void> {
  set({ spriteRecipeLoading: true, spriteRecipeError: null });
  try { const { recipes } = await listSpriteRecipes(); set({ spriteRecipes: recipes.map(summary) }); if (get().activeSpriteRecipeId) await selectSpriteRecipeImpl(get().activeSpriteRecipeId, set, get); }
  catch (error) { set({ spriteRecipeError: message(error) }); }
  finally { set({ spriteRecipeLoading: false }); }
}
export async function selectSpriteRecipeImpl(id: string | null, set: StoreSet, _get: StoreGet): Promise<void> {
  set({ activeSpriteRecipeId: id, spriteRecipeError: null });
  if (!id) { set({ activeSpriteRecipe: null }); return; }
  set({ spriteRecipeLoading: true });
  try { const { recipe } = await getSpriteRecipe(id); set({ activeSpriteRecipe: recipe, spriteRecipeDraft: recipe, spriteRecipeDirty: false }); }
  catch (error) { set({ spriteRecipeError: message(error) }); }
  finally { set({ spriteRecipeLoading: false }); }
}
export async function saveSpriteRecipeImpl(set: StoreSet, get: StoreGet): Promise<string | null> {
  set({ spriteRecipeSaving: true, spriteRecipeError: null });
  try { const current = get(); const result = current.activeSpriteRecipeId ? await updateSpriteRecipe(current.activeSpriteRecipeId, current.spriteRecipeDraft) : await createSpriteRecipe(current.spriteRecipeDraft); set((s) => ({ activeSpriteRecipeId: result.recipe.id, activeSpriteRecipe: result.recipe, spriteRecipeDraft: result.recipe, spriteRecipeDirty: false, spriteRecipes: [summary(result.recipe), ...s.spriteRecipes.filter((r) => r.id !== result.recipe.id)] })); return result.recipe.id; }
  catch (error) { set({ spriteRecipeError: message(error) }); return null; }
  finally { set({ spriteRecipeSaving: false }); }
}
function watch(requestId: string, set: StoreSet, get: StoreGet) {
  subscriptions.get(requestId)?.();
  subscriptions.set(requestId, subscribe(requestId, null, (event, data) => applySpriteJobEventImpl({ event: event as SpriteJobEvent["event"], data: { ...data, requestId } }, set, get)));
}
function stopWatching(requestId: string): void {
  subscriptions.get(requestId)?.();
  subscriptions.delete(requestId);
}
function generationMessage(error: unknown, get: StoreGet): string {
  return resolveErrorSpec(error).code === "JOB_TRACKING_TIMEOUT"
    ? handleError(error, get()).message : message(error);
}
export async function generateSpriteAnchorImpl(set: StoreSet, get: StoreGet): Promise<void> {
  const id = get().activeSpriteRecipeId; if (!id) return;
  set({ spriteRecipeGenerating: true, spriteRecipeError: null });
  const requestId = crypto.randomUUID();
  try {
    watch(requestId, set, get);
    await whenConnected();
    await generateSpriteAnchor(id, { requestId, async: true });
  } catch (error) {
    stopWatching(requestId);
    set({ spriteRecipeError: generationMessage(error, get), spriteRecipeGenerating: false });
  }
}
export async function approveSpriteAnchorImpl(assetId: string, set: StoreSet, get: StoreGet): Promise<void> {
  const id = get().activeSpriteRecipeId; if (!id) return;
  set({ spriteRecipeGenerating: true, spriteRecipeError: null });
  try { const { recipe } = await approveSpriteAnchor(id, assetId); set({ activeSpriteRecipe: recipe, spriteRecipeDraft: recipe, spriteRecipeDirty: false }); }
  catch (error) { set({ spriteRecipeError: message(error) }); }
  finally { set({ spriteRecipeGenerating: false }); }
}
export async function generateSpriteRowsImpl(stateKeys: string[] | undefined, set: StoreSet, get: StoreGet): Promise<void> {
  const id = get().activeSpriteRecipeId; if (!id) return;
  set({ spriteRecipeGenerating: true, spriteRecipeError: null });
  const requestId = crypto.randomUUID();
  try {
    watch(requestId, set, get);
    await whenConnected();
    await generateSpriteRows(id, { requestId, stateKeys, async: true });
  } catch (error) {
    stopWatching(requestId);
    set({ spriteRecipeError: generationMessage(error, get), spriteRecipeGenerating: false });
  }
}
export async function cancelSpriteJobImpl(requestId: string, set: StoreSet, _get: StoreGet): Promise<void> { subscriptions.get(requestId)?.(); subscriptions.delete(requestId); set({ spriteRecipeGenerating: false }); }
export function applySpriteJobEventImpl(event: SpriteJobEvent, set: StoreSet, get: StoreGet): void {
  const key = event.data.stateKey; const url = (event.data.url ?? event.data.image ?? event.data.previewUrl) as string | undefined;
  if (key && url) set((s) => ({ spritePartialPreviews: { ...s.spritePartialPreviews, [key]: url } }));
  if (event.event === "error" || event.event === "done") stopWatching(String(event.data.requestId ?? ""));
  if (event.event === "error") {
    const fallback = String(event.data.message ?? "Generation failed");
    const error = parseSseErrorPayload(event.data, fallback);
    const safeMessage = resolveErrorSpec(error).code === "JOB_TRACKING_TIMEOUT"
      ? handleError(error, get()).message : fallback;
    set({ spriteRecipeError: safeMessage, spriteRecipeGenerating: false });
  }
  if (event.event === "done") { set({ spriteRecipeGenerating: false }); const recipeId = get().activeSpriteRecipeId; if (recipeId) void selectSpriteRecipeImpl(recipeId, set, get); }
}
export function updateSpriteRecipeDraftImpl(patch: Partial<SpriteRecipeDraft>, set: StoreSet): void { set((s) => ({ spriteRecipeDraft: { ...s.spriteRecipeDraft, ...patch }, spriteRecipeDirty: true })); }
