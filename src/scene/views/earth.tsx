// 「地球のそばの視点」を ViewModule として登録する。描画本体は EarthView.tsx。
import { type CSSProperties, useEffect, useRef } from "react";
import { dayEvents, EARTH, sunAt } from "../../engine";
import { yearResultFor } from "../../store/derived";
import { useStore } from "../../store/store";
import { selectActive } from "../active";
import { formatHM } from "../earthMath";
import { EarthView } from "./EarthView";
import type { ViewModule, ViewProps } from "./types";

function Content({ color, t }: ViewProps) {
  return (
    <EarthView
      color={color}
      labels={{
        axis: t("scene.earthAxis"),
        observer: t("scene.earthObserver"),
        sun: t("scene.earthSun"),
        terminator: t("scene.earthTerminator"),
      }}
    />
  );
}

/** 読み出し。日付は毎フレーム動くので、React を通さず DOM を直接書き換える */
function Overlay({ t }: ViewProps) {
  const lenRef = useRef<HTMLSpanElement>(null);
  const decRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let lastKey = "";
    const update = () => {
      const st = useStore.getState();
      const params = selectActive(st);
      const solstice = yearResultFor(params).summerSolstice;
      const t0 = solstice + st.day;
      // 日の出・日没の計算は整数日ごとに 1 回だけ行う
      const n = Math.round(t0);
      const key = `${n}|${params.epsilon}|${params.e}|${params.varpi}|${params.phi}|${params.h0}`;
      if (key !== lastKey) {
        lastKey = key;
        if (lenRef.current)
          lenRef.current.textContent = formatHM(
            dayEvents(params, EARTH, n).dayLength,
          );
      }
      if (decRef.current)
        decRef.current.textContent = `${sunAt(params, EARTH, t0).declination.toFixed(2)}°`;
    };
    update();
    return useStore.subscribe(update);
  }, []);

  const phi = useStore((s) => selectActive(s).phi);
  return (
    <>
      <div style={overlay}>
        <div>
          <strong>{t("scene.earthDayLength", { phi: phi.toFixed(1) })}</strong>
          {": "}
          <span ref={lenRef} />
        </div>
        <div>
          {t("scene.earthDeclination")}: <span ref={decRef} />
        </div>
        <div style={{ opacity: 0.8, marginTop: 4 }}>
          <span style={{ color: "#ffd34d" }}>■</span> {t("scene.earthDaySide")}{" "}
          <span style={{ color: "#6f8fe0" }}>■</span>{" "}
          {t("scene.earthNightSide")}
        </div>
      </div>
      <div style={note}>
        {t("scene.earthNotToScale")} ・ {t("scene.earthHint")}
      </div>
    </>
  );
}

export const earthView: ViewModule = {
  id: "earth",
  tabKey: "tabEarth",
  camera: { up: [0, 0, 1], position: [0.4, -3.4, 1.4], fov: 45 },
  controls: { minDistance: 1.6, maxDistance: 8 },
  Content,
  Overlay,
};

const overlay: CSSProperties = {
  position: "absolute",
  top: 40,
  left: 8,
  padding: "6px 10px",
  fontSize: 12,
  lineHeight: 1.5,
  background: "rgba(0,0,0,0.55)",
  color: "#fff",
  borderRadius: 6,
  pointerEvents: "none",
};

const note: CSSProperties = {
  position: "absolute",
  bottom: 6,
  right: 8,
  fontSize: 11,
  color: "#fff",
  opacity: 0.8,
  pointerEvents: "none",
  textShadow: "0 0 3px #000",
};
