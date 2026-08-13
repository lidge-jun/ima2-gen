import { getAsset, type AssetRecord } from "./assetsStore.js";
import { spriteRecipeStore, spriteStoreError, type SpriteRecipeRecord } from "./spriteRecipeStore.js";
import type { SpriteLayoutGuide } from "./spriteLayoutGuide.js";

export interface ApprovedSpriteAnchor { asset: AssetRecord; assetId: string }
export interface SpriteReferenceInput { role: "identity" | "layout" | "basis" | "base"; assetId?: string | undefined; path?: string | undefined; data?: string | undefined }

export async function approveSpriteAnchor(recipeId: string, candidateAssetId: string): Promise<ApprovedSpriteAnchor> {
  try { const recipe = await spriteRecipeStore.approveAnchor(recipeId, candidateAssetId); const asset = getAsset(recipe.anchorAssetId!); if (!asset) throw spriteStoreError(404, "ANCHOR_ASSET_NOT_FOUND", "anchor asset not found"); return { asset, assetId: asset.id }; } catch (error) { throw error; }
}
export async function requireApprovedSpriteAnchor(recipeId: string): Promise<ApprovedSpriteAnchor> {
  try { const recipe = await spriteRecipeStore.get(recipeId); if (!recipe) throw spriteStoreError(404, "SPRITE_RECIPE_NOT_FOUND", "sprite recipe not found"); if (recipe.anchorStatus !== "approved" || !recipe.anchorAssetId) throw spriteStoreError(400, "ANCHOR_NOT_APPROVED", "an approved idle anchor is required"); const asset = getAsset(recipe.anchorAssetId); if (!asset || asset.kind !== "image" || !asset.filePath) throw spriteStoreError(400, "ANCHOR_NOT_APPROVED", "approved anchor is no longer available"); return { asset, assetId: asset.id }; } catch (error) { throw error; }
}
export function buildSpriteRowReferences(input: { recipe: SpriteRecipeRecord; anchor: ApprovedSpriteAnchor; guide: SpriteLayoutGuide; basisRowAsset?: AssetRecord | undefined }): SpriteReferenceInput[] {
  const refs: SpriteReferenceInput[] = [{ role: "identity", assetId: input.anchor.assetId, path: input.anchor.asset.filePath ?? undefined }, { role: "layout", path: input.guide.relativePath, data: input.guide.buffer.toString("base64") }];
  if (input.basisRowAsset) refs.push({ role: "basis", assetId: input.basisRowAsset.id, path: input.basisRowAsset.filePath ?? undefined });
  assertNoBaseReferenceAfterApproval(input.recipe, refs); return refs;
}
export function assertNoBaseReferenceAfterApproval(recipe: SpriteRecipeRecord, references: SpriteReferenceInput[]): void {
  if (recipe.anchorStatus === "approved" && references.some((ref) => ref.role === "base" || ref.assetId === recipe.recipe.character.baseAssetId)) throw spriteStoreError(400, "BASE_REFERENCE_FORBIDDEN", "base asset cannot be referenced after anchor approval");
}
