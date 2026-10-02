// 3D ビュー（外から見る視点）。担当: R1-4
// 視点は views/ 以下に分け、共通の Canvas・操作・文言はここに置く。
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { type CSSProperties, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { EARTH } from "../engine";
import { useStore } from "../store/store";
import { SET_COLORS } from "../theme";
import { selectActive } from "./active";
import { apsisDistances, seasonLengths } from "./geometry";
import { type OutsideLabels, OutsideView } from "./views/OutsideView";

const NORTH_POINTS = [
  "vernalEquinox",
  "summerSolstice",
  "autumnalEquinox",
  "winterSolstice",
];
const SOUTH_POINTS = [
  "autumnalEquinox",
  "winterSolstice",
  "vernalEquinox",
  "summerSolstice",
];
const NORTH_SEASONS = ["spring", "summer", "autumn", "winter"];
const SOUTH_SEASONS = ["autumn", "winter", "spring", "summer"];

export function Scene() {
  const { t } = useTranslation();

  const activeIndex = useStore((s) => s.activeIndex);
  const params = useStore(selectActive);
  const color = SET_COLORS[activeIndex] ?? SET_COLORS[0];
  const north = params.phi >= 0;

  // Canvas の内側では i18n の文脈が届かないので、文言は外で作って渡す
  const labels: OutsideLabels = {
    sun: t("scene.sun"),
    perihelion: t("scene.perihelion"),
    aphelion: t("scene.aphelion"),
    orbitCenter: t("scene.orbitCenter"),
    observer: t("scene.observer"),
    axis: t("scene.axis"),
    // λ = 0, 90, 180, 270 の点の名前。南半球では季節が逆になる
    points: (north ? NORTH_POINTS : SOUTH_POINTS).map((k) => t(`scene.${k}`)),
  };

  const lengths = useMemo(() => seasonLengths(params, EARTH), [params]);
  const dist = apsisDistances(params.e);
  const names = (north ? NORTH_SEASONS : SOUTH_SEASONS).map((k) =>
    t(`scene.${k}`),
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 320,
      }}
    >
      <Canvas
        aria-label={t("scene.canvasLabel")}
        camera={{ up: [0, 0, 1], position: [0.6, -3.2, 2.2], fov: 45 }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.25} />
        <OutsideView labels={labels} color={color} />
        <OrbitControls enablePan={false} minDistance={1.5} maxDistance={8} />
      </Canvas>
      <div style={overlay}>
        <strong>{t("scene.seasonLengths")}</strong>
        <div style={{ opacity: 0.7 }}>
          {north ? t("scene.hemisphereNorth") : t("scene.hemisphereSouth")}
        </div>
        <table style={{ borderCollapse: "collapse" }}>
          <tbody>
            {names.map((n, i) => (
              <tr key={n}>
                <td style={{ paddingRight: 12 }}>{n}</td>
                <td style={{ textAlign: "right" }}>
                  {t("scene.days", { value: (lengths[i] ?? 0).toFixed(2) })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <strong>{t("scene.apsides")}</strong>
        <div>
          {t("scene.perihelionDistance")}: {dist.perihelion.toFixed(4)}
          {" / "}
          {t("scene.aphelionDistance")}: {dist.aphelion.toFixed(4)}
        </div>
      </div>
      <div style={note}>
        {t("scene.notToScale")} ・ {t("scene.hint")}
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: "absolute",
  top: 8,
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
