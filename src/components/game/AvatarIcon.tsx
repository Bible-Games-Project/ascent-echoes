import type { AvatarId } from "@/lib/avatars";

// Unified icon system: amber/ivory line art with soft warm glow.
// All glyphs share viewBox 0 0 32 32, identical stroke style, no per-icon
// shading or rendering tricks. The Black Dove reuses the White Dove path
// with a darker tonal palette.

type Props = {
  id: AvatarId;
  size?: number;
  locked?: boolean;
  className?: string;
  title?: string;
};

function pathFor(id: AvatarId): JSX.Element {
  switch (id) {
    case "white_dove":
    case "black_dove":
    case "seraph_dove": {
      // Wings-first dove silhouette, mirrors the in-game player.
      return (
        <g>
          {id === "seraph_dove" && (
            <circle cx="16" cy="9" r="4" fill="none" strokeOpacity="0.7" />
          )}
          <path d="M16 13 C 11 11, 6 12, 4 16 C 8 16, 10 17, 13 18 Z" />
          <path d="M16 13 C 21 11, 26 12, 28 16 C 24 16, 22 17, 19 18 Z" />
          <ellipse cx="16" cy="17" rx="2" ry="4" />
          <circle cx="16" cy="12" r="1.7" />
          <path d="M14 21 L18 21 L17 26 L15 26 Z" />
        </g>
      );
    }
    case "oil_lamp":
      return (
        <g>
          <path d="M8 20 C 8 16, 14 14, 18 16 L24 14 L22 19 C 22 22, 16 24, 11 22 Z" />
          <path d="M22 14 L26 11" />
          <path d="M26 11 C 26 8, 24 7, 25 5" />
        </g>
      );
    case "scroll":
      return (
        <g>
          <path d="M8 9 C 8 7, 12 7, 12 9 V23 C 12 25, 8 25, 8 23 Z" />
          <path d="M12 7 H22 C 24 7, 24 11, 22 11 H14" />
          <path d="M12 25 H22 C 24 25, 24 21, 22 21 H14" />
          <path d="M14 14 H22 M14 18 H20" />
        </g>
      );
    case "star":
      return <path d="M16 5 L19 13 L27 13 L21 18 L23 26 L16 21 L9 26 L11 18 L5 13 L13 13 Z" />;
    case "olive_branch":
      return (
        <g>
          <path d="M6 24 C 12 18, 20 12, 26 8" />
          <path d="M10 19 C 8 17, 9 14, 13 15 C 13 18, 12 20, 10 19 Z" />
          <path d="M16 14 C 14 12, 15 9, 19 10 C 19 13, 18 15, 16 14 Z" />
          <path d="M22 10 C 20 8, 21 5, 25 6 C 25 9, 24 11, 22 10 Z" />
        </g>
      );
    case "anchor":
      return (
        <g>
          <circle cx="16" cy="8" r="2" />
          <path d="M16 10 V25" />
          <path d="M12 13 H20" />
          <path d="M7 21 C 9 26, 14 27, 16 25 C 18 27, 23 26, 25 21" />
        </g>
      );
    case "ichthys":
      return (
        <g>
          <path d="M5 16 C 10 8, 22 8, 27 16 C 22 24, 10 24, 5 16 Z" />
          <path d="M5 16 L1 12 M5 16 L1 20" />
          <circle cx="22" cy="14" r="1" fill="currentColor" stroke="none" />
        </g>
      );
    case "feather":
      return (
        <g>
          <path d="M22 6 C 12 8, 7 16, 8 24 C 16 23, 24 18, 26 8 Z" />
          <path d="M22 6 L8 24" />
        </g>
      );
    case "water_drop":
      return <path d="M16 4 C 22 12, 24 17, 24 21 C 24 26, 20 28, 16 28 C 12 28, 8 26, 8 21 C 8 17, 10 12, 16 4 Z" />;
    case "sun":
      return (
        <g>
          <circle cx="16" cy="16" r="5" />
          <path d="M16 3 V7 M16 25 V29 M3 16 H7 M25 16 H29 M7 7 L10 10 M22 22 L25 25 M7 25 L10 22 M22 10 L25 7" />
        </g>
      );
    case "moon":
      return <path d="M22 6 C 14 6, 9 11, 9 18 C 9 24, 14 28, 21 27 C 15 24, 13 18, 16 12 C 17 9, 19 7, 22 6 Z" />;
    case "rainbow":
      return (
        <g>
          <path d="M4 24 C 4 13, 12 6, 16 6 C 20 6, 28 13, 28 24" />
          <path d="M7 24 C 7 15, 13 9, 16 9 C 19 9, 25 15, 25 24" />
          <path d="M10 24 C 10 17, 14 12, 16 12 C 18 12, 22 17, 22 24" />
        </g>
      );
    case "golden_key":
      return (
        <g>
          <circle cx="11" cy="16" r="5" />
          <path d="M16 16 H27" />
          <path d="M23 16 V20 M27 16 V19" />
        </g>
      );
    case "crystal":
      return (
        <g>
          <path d="M16 4 L26 13 L16 28 L6 13 Z" />
          <path d="M6 13 H26 M16 4 L11 13 L16 28 L21 13 Z" />
        </g>
      );
    case "laurel":
      return (
        <g>
          <path d="M16 6 V26" />
          <path d="M16 26 C 9 25, 5 20, 5 14 C 9 14, 13 17, 16 22" />
          <path d="M16 26 C 23 25, 27 20, 27 14 C 23 14, 19 17, 16 22" />
        </g>
      );
    case "celestial":
      return (
        <g>
          <path d="M16 3 L18 14 L29 16 L18 18 L16 29 L14 18 L3 16 L14 14 Z" />
          <circle cx="16" cy="16" r="2" fill="currentColor" stroke="none" />
        </g>
      );
    case "crown":
      return (
        <g>
          <path d="M5 22 L8 10 L13 16 L16 8 L19 16 L24 10 L27 22 Z" />
          <path d="M5 26 H27" />
        </g>
      );
    case "shield":
      return (
        <g>
          <path d="M16 4 L27 8 V16 C 27 22, 22 26, 16 28 C 10 26, 5 22, 5 16 V8 Z" />
          <path d="M16 11 V21 M11 16 H21" />
        </g>
      );
  }
}

export function AvatarIcon({ id, size = 28, locked, className, title }: Props) {
  const isBlack = id === "black_dove";
  const isSeraph = id === "seraph_dove";
  // Unified palette: ivory line, warm amber glow.
  const stroke = locked
    ? "rgba(245, 230, 200, 0.22)"
    : isBlack
      ? "rgba(255, 245, 220, 0.95)"
      : isSeraph
        ? "rgba(255, 224, 140, 1)"
        : "rgba(255, 248, 225, 0.95)";
  const glow = locked
    ? "none"
    : isSeraph
      ? "drop-shadow(0 0 6px rgba(255,210,120,0.85))"
      : "drop-shadow(0 0 4px rgba(255,220,160,0.55))";
  const fillBg = isBlack
    ? (locked ? "rgba(0,0,0,0.0)" : "rgba(20,16,12,0.85)")
    : "transparent";
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={title ?? id}
      className={className}
      style={{ filter: glow }}
    >
      {isBlack && (
        <circle cx="16" cy="16" r="14" fill={fillBg} stroke="none" />
      )}
      <g
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {pathFor(id)}
      </g>
    </svg>
  );
}