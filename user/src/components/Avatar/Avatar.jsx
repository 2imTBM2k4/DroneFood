import "./Avatar.css";

// Deterministic pick so a given name always lands on the same colour.
const PALETTE = [
  "#ff6b35",
  "#f7931e",
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#ef4444",
  "#0ea5e9",
  "#d946ef",
];

const initialsOf = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const colorFor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

/**
 * A user's picture, or their initials on a coloured disc when there's no
 * uploaded avatar (and, later, no Google photo).
 */
const Avatar = ({ src, name = "", size = 40, className = "" }) => {
  const style = { width: size, height: size, fontSize: size * 0.4 };

  if (src) {
    return (
      <img
        src={src}
        alt={name || "Avatar"}
        className={`avatar avatar-img ${className}`}
        style={style}
      />
    );
  }

  return (
    <span
      className={`avatar avatar-initials ${className}`}
      style={{ ...style, backgroundColor: colorFor(name) }}
      aria-label={name || "Avatar"}
    >
      {initialsOf(name)}
    </span>
  );
};

export default Avatar;
