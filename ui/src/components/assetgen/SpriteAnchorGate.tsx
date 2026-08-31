import { useState } from "react";
import { useI18n } from "../../i18n";
import { useModalFocus } from "../../hooks/useModalFocus";
import type { SpriteAnchorCandidate, SpriteRecipeRecord } from "../../types/spriteRecipe";

function ConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const { t } = useI18n();
  const ref = useModalFocus<HTMLDivElement>(true, onCancel);
  return (
    <div className="sprite-anchor-dialog" role="dialog" aria-modal="true" aria-labelledby="sprite-confirm-title" ref={ref}>
      <h3 id="sprite-confirm-title">{t("sprite.anchor.confirmTitle")}</h3>
      <p>{t("sprite.anchor.confirmBody")}</p>
      <button data-modal-initial-focus onClick={onCancel}>{t("sprite.anchor.cancel")}</button>
      <button onClick={onConfirm}>{t("sprite.anchor.confirm")}</button>
    </div>
  );
}

export function SpriteAnchorGate({ recipe, candidate, generating, onGenerate, onApprove }: {
  recipe: SpriteRecipeRecord;
  candidate: SpriteAnchorCandidate | null;
  generating: boolean;
  onGenerate(): void;
  onApprove(assetId: string): void;
}) {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="sprite-anchor-gate" aria-labelledby="sprite-anchor-title">
      <h2 id="sprite-anchor-title">{t("sprite.anchor.title")}</h2>
      {candidate ? (
        <>
          <img src={candidate.url} alt="" />
          <p>{t("sprite.anchor.candidate")}</p>
          <button onClick={onGenerate} disabled={generating}>{t("sprite.anchor.regenerate")}</button>
          <button onClick={() => setConfirm(true)}>{t("sprite.anchor.approve")}</button>
        </>
      ) : (
        <>
          <p>{t(recipe.anchorStatus === "approved" ? "sprite.anchor.approved" : "sprite.anchor.missing")}</p>
          <button onClick={onGenerate} disabled={generating}>
            {t(generating ? "sprite.anchor.generating" : "sprite.anchor.generate")}
          </button>
        </>
      )}
      {confirm ? (
        <ConfirmDialog
          onCancel={() => setConfirm(false)}
          onConfirm={() => { onApprove(candidate!.assetId); setConfirm(false); }}
        />
      ) : null}
    </section>
  );
}
