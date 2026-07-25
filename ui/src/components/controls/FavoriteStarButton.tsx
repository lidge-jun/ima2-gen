import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { FavoriteStarIcon } from "./FavoriteStarIcon";

type FavoriteStarButtonProps = {
  active: boolean;
  label: string;
  variant: "gallery" | "result" | "asset";
  busy?: boolean;
  onToggle: () => void | Promise<void>;
};

export function FavoriteStarButton({
  active,
  label,
  variant,
  busy = false,
  onToggle,
}: FavoriteStarButtonProps) {
  const stopPointer = (event: PointerEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
  };
  const stopMouse = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
  };
  const stopKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === "Enter" || event.key === " ") event.stopPropagation();
  };

  return (
    <button
      type="button"
      className={`favorite-star favorite-star--${variant}${active ? " is-active" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      aria-busy={busy || undefined}
      disabled={busy}
      onPointerDown={stopPointer}
      onDoubleClick={stopMouse}
      onKeyDown={stopKey}
      onClick={(event) => {
        event.stopPropagation();
        void onToggle();
      }}
    >
      <FavoriteStarIcon />
    </button>
  );
}
