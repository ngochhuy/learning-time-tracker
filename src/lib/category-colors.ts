export const categoryColorKeys = ["matcha", "sage", "olive", "leaf", "tea"] as const;

export type CategoryColorKey = (typeof categoryColorKeys)[number] | `custom:#${string}`;

export type CategoryPalette = {
  key: CategoryColorKey;
  dot: string;
  bg: string;
  text: string;
  bar: string;
};

export const categoryPalettes: Record<(typeof categoryColorKeys)[number], CategoryPalette> = {
  matcha: { key: "matcha", dot: "#2c4a32", bg: "#d8e8d6", text: "#223a27", bar: "#2c4a32" },
  sage: { key: "sage", dot: "#54735c", bg: "#dcedda", text: "#26442e", bar: "#54735c" },
  olive: { key: "olive", dot: "#735639", bg: "#ebd9c8", text: "#5b4028", bar: "#735639" },
  leaf: { key: "leaf", dot: "#86af80", bg: "#eaf2e8", text: "#223a27", bar: "#86af80" },
  tea: { key: "tea", dot: "#a9c3a6", bg: "#e3ece1", text: "#304536", bar: "#a9c3a6" },
};

export function getCategoryPalette(key?: CategoryColorKey | null): CategoryPalette {
  if (key?.startsWith("custom:#")) {
    const color = key.slice("custom:".length);
    return { key, dot: color, bg: `${color}26`, text: "#1b2e21", bar: color };
  }
  return categoryPalettes[(key as keyof typeof categoryPalettes) ?? "matcha"] ?? categoryPalettes.matcha;
}
