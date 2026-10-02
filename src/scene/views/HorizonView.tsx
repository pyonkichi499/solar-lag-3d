// 地平線の視点。観測者は地面の円盤の中心、東 = +x、北 = +y、天頂 = +z。
// 南中が常に正面（−y）に来るよう、南半球では全体を 180° 回す（horizonMath.viewYaw）。
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type CSSProperties, useMemo, useRef } from "react";
import * as THREE from "three";
import { create } from "zustand";
import { dayEvents, EARTH, type RiseSetEvent } from "../../engine";
import { yearResultFor } from "../../store/derived";
import { useStore } from "../../store/store";
import { selectActive } from "../active";
import type { Vec3 } from "../geometry";
import {
  type AltAz,
  analemmaPoints,
  dayPath,
  domePoint,
  formatHm,
  sunAltAz,
  viewYaw,
} from "../horizonMath";
import type { Tr } from "./types";

/** Overlay（Canvas の外）と共有する表示の設定。React の文脈は Canvas を越えないので、小さなストアにする */
export const useHorizonUi = create<{
  analemma: boolean;
  setAnalemma: (v: boolean) => void;
}>((set) => ({ analemma: true, setAnalemma: (analemma) => set({ analemma }) }));

// ドームの半径（観測者の目の高さ 0.6 に対して十分大きい）と、太陽の見かけの大きさ
const R = 50;
const SUN_R = 1.1;
const ANALEMMA_N = 73;
const RING_ALTS = [30, 60];

const labelStyle: CSSProperties = {
  color: "#fff",
  fontSize: 11,
  whiteSpace: "nowrap",
  textShadow: "0 0 3px #000, 0 0 3px #000",
  pointerEvents: "none",
};

const ring = (altDeg: number, yaw: number): Vec3[] =>
  Array.from({ length: 73 }, (_, i) =>
    domePoint({ altitudeDeg: altDeg, azimuthDeg: i * 5 }, R, yaw),
  );

const meridian = (azDeg: number, yaw: number): Vec3[] =>
  Array.from({ length: 19 }, (_, i) =>
    domePoint({ altitudeDeg: i * 5, azimuthDeg: azDeg }, R, yaw),
  );

/** 高度 0 を境に、連続する区間に分ける（境界の点は両側に入れて線をつなぐ） */
function splitByHorizon(path: AltAz[], yaw: number) {
  const above: Vec3[][] = [];
  const below: Vec3[][] = [];
  let cur: Vec3[] = [];
  let curUp = (path[0]?.altitudeDeg ?? 0) >= 0;
  for (const a of path) {
    const up = a.altitudeDeg >= 0;
    const p = domePoint(a, R, yaw);
    if (up !== curUp) {
      cur.push(p);
      (curUp ? above : below).push(cur);
      cur = [p];
      curUp = up;
    } else cur.push(p);
  }
  (curUp ? above : below).push(cur);
  return {
    above: above.filter((s) => s.length > 1),
    below: below.filter((s) => s.length > 1),
  };
}

function eventAltAz(
  ev: RiseSetEvent,
  params: Parameters<typeof sunAltAz>[0],
): AltAz | null {
  return ev.kind === "event" ? sunAltAz(params, ev.t) : null;
}

export function HorizonView({ t }: { t: Tr }) {
  const params = useStore(selectActive);
  const solstice = useMemo(
    () => yearResultFor(params).summerSolstice,
    [params],
  );
  // 日の軌跡は整数の日が変わったときだけ作り直す
  const dayN = useStore((s) => Math.floor(solstice + s.day));
  const yaw = viewYaw(params.phi);

  const segments = useMemo(
    () => splitByHorizon(dayPath(params, dayN), yaw),
    [params, dayN, yaw],
  );
  const marks = useMemo(() => {
    const row = dayEvents(params, EARTH, dayN);
    const rise = eventAltAz(row.sunrise, params);
    const set = eventAltAz(row.sunset, params);
    return [
      rise && {
        key: "sunrise",
        label: `${t("scene.horizonSunrise")} ${formatHm(
          row.sunrise.kind === "event" ? row.sunrise.hours : 0,
        )}`,
        pos: domePoint(rise, R, yaw),
      },
      set && {
        key: "sunset",
        label: `${t("scene.horizonSunset")} ${formatHm(
          row.sunset.kind === "event" ? row.sunset.hours : 0,
        )}`,
        pos: domePoint(set, R, yaw),
      },
    ].filter((m) => !!m);
  }, [params, dayN, yaw, t]);

  const rings = useMemo(
    () => RING_ALTS.map((a) => ({ alt: a, pts: ring(a, yaw) })),
    [yaw],
  );
  const horizon = useMemo(() => ring(0, yaw), [yaw]);
  const h0Ring = useMemo(
    () => (params.h0 === 0 ? null : ring(params.h0, yaw)),
    [params.h0, yaw],
  );
  const cardinals = useMemo(
    () =>
      [
        ["horizonNorth", 0],
        ["horizonEast", 90],
        ["horizonSouth", 180],
        ["horizonWest", 270],
      ].map(([k, az]) => ({
        key: k as string,
        pos: domePoint({ altitudeDeg: 1.5, azimuthDeg: az as number }, R, yaw),
        line: meridian(az as number, yaw),
      })),
    [yaw],
  );

  // アナレンマの座標は事前に確保したバッファへ書き込む（React を再描画しない）
  const analemmaBuf = useMemo(() => new Float32Array(ANALEMMA_N * 3), []);
  const analemmaAttr = useRef<THREE.BufferAttribute>(null);
  const analemmaObj = useRef<THREE.Points>(null);
  const last = useRef<{ bucket: number; params: unknown }>({
    bucket: Number.NaN,
    params: null,
  });
  const sunRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const tNow = solstice + useStore.getState().day;
    const sun = sunAltAz(params, tNow);
    sunRef.current?.position.set(...domePoint(sun, R, yaw));

    const show = useHorizonUi.getState().analemma;
    if (analemmaObj.current) analemmaObj.current.visible = show;
    // 地方平均時が 15 分進むごと（またはパラメータが変わったとき）にだけ作り直す
    const bucket = Math.floor(tNow * 96);
    if (
      show &&
      (last.current.bucket !== bucket || last.current.params !== params)
    ) {
      last.current = { bucket, params };
      analemmaPoints(params, tNow, EARTH.yearDays, ANALEMMA_N).forEach(
        (a, i) => {
          analemmaBuf.set(domePoint(a, R, yaw), i * 3);
        },
      );
      if (analemmaAttr.current) analemmaAttr.current.needsUpdate = true;
    }
  });

  return (
    <>
      <color attach="background" args={["#0b1530"]} />
      {/* 地面と天球 */}
      <mesh>
        <circleGeometry args={[R, 64]} />
        <meshBasicMaterial color="#1d3a24" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <sphereGeometry
          args={[R * 1.001, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        <meshBasicMaterial
          color="#16306a"
          side={THREE.BackSide}
          transparent
          opacity={0.35}
        />
      </mesh>

      <Line points={horizon} color="#ffffff" lineWidth={1.5} />
      {rings.map((r) => (
        <group key={r.alt}>
          <Line
            points={r.pts}
            color="#8fb2ff"
            lineWidth={1}
            transparent
            opacity={0.45}
          />
          <Html
            position={domePoint({ altitudeDeg: r.alt, azimuthDeg: 0 }, R, yaw)}
            center
            style={{ ...labelStyle, opacity: 0.7 }}
          >
            {r.alt}°
          </Html>
        </group>
      ))}
      {h0Ring && (
        <Line
          points={h0Ring}
          color="#ff9f43"
          lineWidth={1}
          dashed
          dashSize={1.5}
          gapSize={1}
        />
      )}
      {cardinals.map((c) => (
        <group key={c.key}>
          <Line
            points={c.line}
            color="#8fb2ff"
            lineWidth={1}
            transparent
            opacity={0.25}
          />
          <Html
            position={c.pos}
            center
            style={{ ...labelStyle, fontSize: 15, fontWeight: 700 }}
          >
            {t(`scene.${c.key}`)}
          </Html>
        </group>
      ))}

      {/* 今日の太陽の通り道。地平線の下は暗く */}
      {segments.above.map((s) => (
        <Line
          key={`a${s[0]?.join(",")}`}
          points={s}
          color="#ffd34d"
          lineWidth={2.5}
        />
      ))}
      {segments.below.map((s) => (
        <Line
          key={`b${s[0]?.join(",")}`}
          points={s}
          color="#a08a40"
          lineWidth={1.5}
          transparent
          opacity={0.4}
        />
      ))}
      {marks.map((m) => (
        <group key={m.key} position={m.pos}>
          <mesh>
            <sphereGeometry args={[0.5, 12, 12]} />
            <meshBasicMaterial color="#ff6b6b" />
          </mesh>
          <Html style={labelStyle}>
            <span style={{ position: "relative", left: 8, top: -8 }}>
              {m.label}
            </span>
          </Html>
        </group>
      ))}

      {/* アナレンマ：同じ地方平均時の太陽の 1 年分（先頭の点が今日で、太陽の球と重なる） */}
      <points ref={analemmaObj} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            ref={analemmaAttr}
            attach="attributes-position"
            args={[analemmaBuf, 3]}
          />
        </bufferGeometry>
        <pointsMaterial color="#ffffff" size={4} sizeAttenuation={false} />
      </points>

      <mesh ref={sunRef}>
        <sphereGeometry args={[SUN_R, 24, 16]} />
        <meshBasicMaterial color="#ffcc33" />
        <Html style={labelStyle}>
          <span style={{ position: "relative", left: 10, top: -10 }}>
            {t("scene.horizonSun")}
          </span>
        </Html>
      </mesh>
    </>
  );
}
