// プリセット（docs/requirements.md §2.4）。緯度と h₀ は含めず、現在の値を維持する。
export interface Preset {
  id: PresetId;
  epsilon: number;
  e: number;
  /** undefined のときは現在の ϖ を維持する */
  varpi?: number;
}

export type PresetId =
  | "earth"
  | "circular"
  | "perihelionSummer"
  | "perihelionWinter"
  | "noTilt"
  | "mars"
  | "extremeTilt";

export const PRESETS: Preset[] = [
  { id: "earth", epsilon: 23.44, e: 0.0167, varpi: 283 },
  { id: "circular", epsilon: 23.44, e: 0 },
  { id: "perihelionSummer", epsilon: 23.44, e: 0.0167, varpi: 90 },
  { id: "perihelionWinter", epsilon: 23.44, e: 0.0167, varpi: 270 },
  { id: "noTilt", epsilon: 0, e: 0.0167, varpi: 283 },
  { id: "mars", epsilon: 25.19, e: 0.0934, varpi: 251 },
  { id: "extremeTilt", epsilon: 60, e: 0.0167, varpi: 283 },
];

export const DEFAULT_PARAMS = {
  epsilon: 23.44,
  e: 0.0167,
  varpi: 283,
  phi: 35.68,
  h0: -0.833,
} as const;

/** パラメータの入力範囲（§3.1） */
export const RANGES = {
  epsilon: { min: 0, max: 89.9 },
  e: { min: 0, max: 0.5 },
  varpi: { min: 0, max: 360 },
  phi: { min: -89.9, max: 89.9 },
  h0: { min: -2, max: 2 },
} as const;
