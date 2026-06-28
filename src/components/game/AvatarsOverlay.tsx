import { useMemo, useState } from "react";
import {
  AVATARS,
  getStats,
  isUnlocked,
  progressFor,
  setEquipped,
  type AvatarId,
} from "@/lib/avatars";
import { PlayerAvatar as AvatarIcon } from "./PlayerAvatar";
import type { UIKey } from "./i18n";

type Props = {
  isPremium: boolean;
  equipped: AvatarId;
  onEquip: (id: AvatarId) => void;
  onClose: () => void;
  title: string;
  t: (key: UIKey) => string;
};

export function AvatarsOverlay({ isPremium, equipped, onEquip, onClose, title, t }: Props) {
  const stats = useMemo(() => getStats(), []);
  const [selected, setSelected] = useState<AvatarId>(equipped);
  const selectedDef = AVATARS.find((a) => a.id === selected)!;
  const selectedUnlocked = isUnlocked(selectedDef, stats, isPremium);
  const selectedProg = progressFor(selectedDef, stats);

  const handleEquip = () => {
    if (!selectedUnlocked) return;
    const ok = setEquipped(selected);
    onEquip(ok);
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in px-4">
      <h2 className="text-xl font-light tracking-[0.25em] text-amber-50">{title}</h2>
      <p className="mt-1 text-[10px] tracking-[0.3em] text-amber-200/70">
        {AVATARS.filter((a) => isUnlocked(a, stats, isPremium)).length} / {AVATARS.length}
      </p>

      <div className="mt-4 grid w-[min(94vw,460px)] grid-cols-5 gap-2">
        {AVATARS.map((a) => {
          const unlocked = isUnlocked(a, stats, isPremium);
          const isSel = a.id === selected;
          const isEq = a.id === equipped;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a.id)}
              className={
                "relative flex aspect-square items-center justify-center rounded-xl border backdrop-blur transition " +
                (isSel
                  ? "border-amber-200/80 bg-amber-200/15 shadow-[0_0_18px_rgba(255,200,140,0.45)]"
                  : "border-amber-200/20 bg-black/45 hover:border-amber-200/50")
              }
              aria-label={a.name}
            >
              <AvatarIcon id={a.id} size={36} locked={!unlocked} />
              {a.premium && (
                <span className="absolute right-0.5 top-0.5 rounded-full bg-amber-300/90 px-1 text-[8px] font-bold tracking-wider text-stone-900">★</span>
              )}
              {!unlocked && (
                <span className="absolute bottom-0.5 right-0.5 text-[10px] text-amber-100/60">🔒</span>
              )}
              {isEq && (
                <span className="absolute left-0.5 top-0.5 rounded-full bg-amber-100/90 px-1 text-[8px] font-bold tracking-wider text-stone-900">✓</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 w-[min(94vw,460px)] rounded-2xl border border-amber-200/25 bg-black/55 p-4 text-center backdrop-blur">
        <div className="flex items-center justify-center gap-3">
          <AvatarIcon id={selected} size={42} locked={!selectedUnlocked} />
          <div className="text-left">
            <div className="text-sm tracking-[0.2em] text-amber-50">{selectedDef.name.toUpperCase()}</div>
            <div className="mt-0.5 text-[10px] tracking-wide text-amber-100/70">
              {selectedUnlocked ? t("unlocked") : selectedProg.requirement}
            </div>
            {!selectedUnlocked && selectedDef.unlock.target != null && (
              <div className="mt-0.5 text-[10px] tracking-wide text-amber-200/70 tabular-nums">
                {selectedProg.label}
              </div>
            )}
            {!selectedUnlocked && selectedDef.unlock.kind === "bestRankTop" && (
              <div className="mt-0.5 text-[10px] tracking-wide text-amber-200/70 tabular-nums">
                {t("bestRank")}: {selectedProg.label}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={!selectedUnlocked || selected === equipped}
            onClick={handleEquip}
            className={
              "rounded-full px-6 py-2 text-xs font-medium tracking-[0.25em] transition " +
              (selectedUnlocked && selected !== equipped
                ? "bg-amber-100 text-stone-900 shadow-[0_0_24px_rgba(255,200,140,0.4)] hover:scale-105 active:scale-95"
                : "cursor-not-allowed bg-amber-100/20 text-stone-900/40")
            }
          >
            {selected === equipped ? t("equipped") : selectedUnlocked ? t("equip") : t("locked")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-amber-200/40 bg-black/30 px-5 py-2 text-xs tracking-[0.25em] text-amber-100/90 hover:border-amber-200/70 hover:text-amber-50"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}