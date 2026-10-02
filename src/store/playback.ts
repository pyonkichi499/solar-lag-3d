// 「▶再生」で日付を自動送りする。担当: R1-2
import { useEffect } from "react";
import { EARTH } from "../engine";
import { useStore } from "./store";

/** 実時間 1 秒あたりに進むモデル時間 [日] */
export const DAYS_PER_SECOND = 30;

/** day を [-yearDays/2, +yearDays/2) に巻き戻す */
export function wrapDay(day: number, yearDays: number): number {
  const half = yearDays / 2;
  return ((((day + half) % yearDays) + yearDays) % yearDays) - half;
}

/** App から 1 回だけ呼ぶ。store.playing が true の間 store.day を進める */
export function usePlayback(): void {
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      // タブ復帰時などの大きな飛びを抑える
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const { day, setDay } = useStore.getState();
      setDay(wrapDay(day + dt * DAYS_PER_SECOND, EARTH.yearDays));
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    if (useStore.getState().playing) start();
    const unsub = useStore.subscribe((s, prev) => {
      if (s.playing === prev.playing) return;
      if (s.playing) start();
      else cancelAnimationFrame(raf);
    });
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, []);
}
