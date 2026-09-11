import type { ThemeKey } from "./types";

export interface ThemeDef {
  key: ThemeKey;
  name: string;
  desc: string;
  colors: [string, string, string, string, string, string]; // shell, primary, secondary, accent, highlight, soft
}

export const THEMES: ThemeDef[] = [
  { key: "kpjk", name: "KPJK Signature", desc: "브랜드 기본 — 차콜 + 오렌지", colors: ["#171b20", "#343b44", "#6b7680", "#d47a4a", "#e8b89a", "#faefe9"] },
  { key: "navy", name: "Deep Navy Blue", desc: "01", colors: ["#0b1830", "#2457d6", "#1687a7", "#17a889", "#e7c873", "#e3f5f1"] },
  { key: "navygold", name: "Navy Gold", desc: "02", colors: ["#111a2d", "#2847a7", "#a37a28", "#d0a84b", "#f0d995", "#f9f5e9"] },
  { key: "emerald", name: "Emerald Gold", desc: "03", colors: ["#11332b", "#0e7663", "#2c9277", "#b4862a", "#e8ce88", "#f6f0e5"] },
  { key: "forest", name: "Forest Sage", desc: "04", colors: ["#17352c", "#356e58", "#73977e", "#a58e4d", "#d9d2aa", "#f4f1ea"] },
  { key: "teal", name: "Deep Teal", desc: "05", colors: ["#08323a", "#087a83", "#1597a3", "#d2704c", "#e9b59b", "#faeeea"] },
  { key: "onyx", name: "Onyx Gold", desc: "06", colors: ["#15171c", "#343942", "#6a717c", "#b89032", "#e0c76f", "#f6f2e6"] },
  { key: "burgundy", name: "Burgundy Slate", desc: "07", colors: ["#3a1724", "#7a2c49", "#7c6873", "#b8405f", "#f0b9a6", "#fbecef"] },
  { key: "plum", name: "Plum Indigo", desc: "08", colors: ["#291a3d", "#573f91", "#4e63a8", "#8a4fb5", "#cbb3ec", "#f3ecf8"] },
  { key: "steel", name: "Steel Platinum", desc: "09", colors: ["#24303b", "#44647a", "#6d8899", "#4c9aaa", "#c9d6de", "#eaf3f5"] },
];
