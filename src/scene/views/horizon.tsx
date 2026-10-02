// 「地平線の視点」を ViewModule として登録する。描画本体は HorizonView.tsx、計算は horizonMath.ts。
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { dayEvents, EARTH, type RiseSetEvent } from "../../engine";
import { yearResultFor } from "../../store/derived";
import { useStore } from "../../store/store";
import { selectActive } from "../active";
import { formatDuration, formatHm, sunAltAz } from "../horizonMath";
import { HorizonView, useHorizonUi } from "./HorizonView";
import type { ViewModule, ViewProps } from "./types";

function Content({ t }: ViewProps) {
  return <HorizonView t={t} />;
}

function Overlay({ t }: ViewProps) {
  const params = useStore(selectActive);
  const solstice = useMemo(
    () => yearResultFor(params).summerSolstice,
    [params],
  );
  // 日が変わったときだけ再描画する（時刻・高度・方位の読み出しは下で DOM を直接更新する）
  const dayN = useStore((s) => Math.floor(solstice + s.day));
  const row = useMemo(() => dayEvents(params, EARTH, dayN), [params, dayN]);
  const analemma = useHorizonUi((s) => s.analemma);
  const setAnalemma = useHorizonUi((s) => s.setAnalemma);

  const lmtRef = useRef<HTMLSpanElement>(null);
  const altRef = useRef<HTMLSpanElement>(null);
  const azRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const update = (day: number) => {
      const tNow = solstice + day;
      const a = sunAltAz(params, tNow);
      const lmt = 24 * (tNow - Math.floor(tNow));
      if (lmtRef.current) lmtRef.current.textContent = formatHm(lmt);
      if (altRef.current)
        altRef.current.textContent = `${a.altitudeDeg.toFixed(1)}°`;
      if (azRef.current)
        azRef.current.textContent = `${a.azimuthDeg.toFixed(1)}°`;
    };
    update(useStore.getState().day);
    return useStore.subscribe((s, prev) => {
      if (s.day !== prev.day) update(s.day);
    });
  }, [params, solstice]);

  const hm = (ev: RiseSetEvent) =>
    ev.kind === "event" ? formatHm(ev.hours) : "";
  const hasBoth = row.sunrise.kind === "event" && row.sunset.kind === "event";

  return (
    <>
      <div style={overlay}>
        <strong>{t("scene.horizonTitle")}</strong>
        <table style={{ borderCollapse: "collapse" }}>
          <tbody>
            <Row label={t("scene.horizonLmt")} value={<span ref={lmtRef} />} />
            <Row
              label={t("scene.horizonAltitude")}
              value={<span ref={altRef} />}
            />
            <Row
              label={t("scene.horizonAzimuth")}
              value={<span ref={azRef} />}
            />
            {hasBoth ? (
              <>
                <Row
                  label={t("scene.horizonSunrise")}
                  value={hm(row.sunrise)}
                />
                <Row label={t("scene.horizonSunset")} value={hm(row.sunset)} />
                <Row
                  label={t("scene.horizonDayLength")}
                  value={formatDuration(row.dayLength)}
                />
              </>
            ) : (
              <tr>
                <td colSpan={2}>
                  {row.sunrise.kind === "polarDay" ||
                  row.sunset.kind === "polarDay"
                    ? t("scene.horizonPolarDay")
                    : t("scene.horizonPolarNight")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <label style={toggle}>
        <input
          type="checkbox"
          checked={analemma}
          onChange={(e) => setAnalemma(e.target.checked)}
        />{" "}
        {t("scene.horizonAnalemma")}
      </label>
      <div style={note}>{t("scene.horizonHint")}</div>
    </>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <tr>
      <td style={{ paddingRight: 12 }}>{label}</td>
      <td style={{ textAlign: "right" }}>{value}</td>
    </tr>
  );
}

// 観測者は地面の中心。カメラは目の高さ 0.6 のすぐ後ろから、注視点（正面やや上）を向く。
// OrbitControls は注視点の周りを回るので、注視点を目のすぐ前（距離約 1）に置けば、
// ドーム（半径 50）に対して「その場で見回す」動きになる。ズームは距離 0.5〜3 に制限する。
// 南中の方向が正面（−y）になるよう、南半球では HorizonView 側で全体を回している。
export const horizonView: ViewModule = {
  id: "horizon",
  tabKey: "tabHorizon",
  camera: { up: [0, 0, 1], position: [0, 1, 0.6], fov: 70 },
  controls: { minDistance: 0.5, maxDistance: 3, target: [0, 0, 0.8] },
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

const toggle: CSSProperties = {
  position: "absolute",
  bottom: 24,
  left: 8,
  padding: "3px 8px",
  fontSize: 12,
  background: "rgba(0,0,0,0.55)",
  color: "#fff",
  borderRadius: 6,
  cursor: "pointer",
};

const note: CSSProperties = {
  position: "absolute",
  bottom: 6,
  left: 8,
  right: 8,
  fontSize: 11,
  color: "#fff",
  opacity: 0.8,
  pointerEvents: "none",
  textShadow: "0 0 3px #000",
};
