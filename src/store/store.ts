import { create } from "zustand";
import { DEFAULT_PARAMS, PRESETS, RANGES } from "../presets";
import type { AppStore } from "./types";

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export const useStore = create<AppStore>((set) => ({
  sets: [{ ...DEFAULT_PARAMS }],
  presetIds: ["earth"],
  activeIndex: 0,
  day: 0,
  playing: false,
  show: {
    latestSunset: true,
    earliestSunrise: true,
    earliestSunset: true,
    latestSunrise: true,
  },
  lang: "ja",
  lockYAxis: false,

  setParam: (index, key, value) =>
    set((s) => {
      const r = RANGES[key];
      const v =
        key === "varpi"
          ? ((value % 360) + 360) % 360
          : clamp(value, r.min, r.max);
      return {
        sets: s.sets.map((p, i) => (i === index ? { ...p, [key]: v } : p)),
        presetIds: s.presetIds.map((id, i) => (i === index ? null : id)),
      };
    }),
  applyPreset: (index, id) =>
    set((s) => {
      const preset = PRESETS.find((p) => p.id === id);
      if (!preset) return s;
      return {
        sets: s.sets.map((p, i) =>
          i === index
            ? {
                ...p,
                epsilon: preset.epsilon,
                e: preset.e,
                varpi: preset.varpi ?? p.varpi,
              }
            : p,
        ),
        presetIds: s.presetIds.map((x, i) => (i === index ? id : x)),
      };
    }),
  addSet: () =>
    set((s) =>
      s.sets.length >= 2 || !s.sets[0]
        ? s
        : {
            sets: [...s.sets, { ...s.sets[0] }],
            presetIds: [...s.presetIds, s.presetIds[0] ?? null],
            activeIndex: 1,
          },
    ),
  removeSet: () =>
    set((s) => ({
      sets: s.sets.slice(0, 1),
      presetIds: s.presetIds.slice(0, 1),
      activeIndex: 0,
    })),
  setActiveIndex: (activeIndex) =>
    set((s) => ({ activeIndex: clamp(activeIndex, 0, s.sets.length - 1) })),
  alignLatitude: () =>
    set((s) =>
      s.sets.length < 2 || !s.sets[0]
        ? s
        : {
            sets: s.sets.map((p, i) =>
              i === 1 ? { ...p, phi: s.sets[0]?.phi ?? p.phi } : p,
            ),
          },
    ),
  setDay: (day) => set({ day }),
  setPlaying: (playing) => set({ playing }),
  toggleShow: (kind) =>
    set((s) => ({ show: { ...s.show, [kind]: !s.show[kind] } })),
  setLang: (lang) => set({ lang }),
  setLockYAxis: (lockYAxis) => set({ lockYAxis }),
}));
