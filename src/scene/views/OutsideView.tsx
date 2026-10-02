// 外から見る視点。太陽は原点、軌道は黄道面（xy）、z = 黄道の北極。
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type CSSProperties, useMemo, useRef } from "react";
import * as THREE from "three";
import { EARTH, sceneState } from "../../engine";
import { yearResultFor } from "../../store/derived";
import { useStore } from "../../store/store";
import { selectActive } from "../active";
import {
  apsides,
  observerDirection,
  orbitCenter,
  orbitPoints,
  seasonMarkers,
  type Vec3,
} from "../geometry";

export interface OutsideLabels {
  sun: string;
  perihelion: string;
  aphelion: string;
  orbitCenter: string;
  observer: string;
  axis: string;
  /** λ = 0, 90, 180, 270 の点の名前 */
  points: string[];
}

// 誇張した大きさ（軌道長半径 = 1 に対する半径）
const SUN_R = 0.12;
const PLANET_R = 0.06;
const AXIS_LEN = 0.14;

const labelStyle: CSSProperties = {
  color: "#fff",
  fontSize: 11,
  whiteSpace: "nowrap",
  textShadow: "0 0 3px #000, 0 0 3px #000",
  pointerEvents: "none",
};

const circle = (r: number, n = 64): Vec3[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [r * Math.cos(a), r * Math.sin(a), 0];
  });

export function OutsideView({
  labels,
  color,
}: {
  labels: OutsideLabels;
  color: string;
}) {
  const params = useStore(selectActive);
  const { e, varpi, phi } = params;
  // 夏至の瞬間はパラメータが変わるときだけ求める
  const solstice = useMemo(
    () => yearResultFor(params).summerSolstice,
    [params],
  );

  // 軌道・マーカーは e / ϖ が変わったときだけ作り直す
  const orbit = useMemo(() => orbitPoints(e, varpi), [e, varpi]);
  const aps = useMemo(() => apsides(e, varpi), [e, varpi]);
  const seasons = useMemo(() => seasonMarkers(e, varpi), [e, varpi]);
  const center = useMemo(() => orbitCenter(e, varpi), [e, varpi]);
  const equator = useMemo(() => circle(PLANET_R * 1.5), []);

  const planetRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const pinRef = useRef<THREE.Group>(null);

  const tmp = useMemo(
    () => ({ z: new THREE.Vector3(0, 0, 1), a: new THREE.Vector3() }),
    [],
  );

  // 再生中も React を再描画せず、毎フレームストアから日付を読んで位置を更新する
  useFrame(() => {
    const day = useStore.getState().day;
    const s = sceneState(params, EARTH, solstice + day);
    planetRef.current?.position.set(...s.planetPosition);
    tmp.a.set(...s.axisDirection);
    tiltRef.current?.quaternion.setFromUnitVectors(tmp.z, tmp.a);
    const d = observerDirection(
      s.planetPosition,
      s.axisDirection,
      phi,
      s.localMeanTime,
    );
    pinRef.current?.position.set(
      s.planetPosition[0] + d[0] * PLANET_R,
      s.planetPosition[1] + d[1] * PLANET_R,
      s.planetPosition[2] + d[2] * PLANET_R,
    );
  });

  return (
    <>
      {/* 太陽が光源。距離で弱まらないようにする */}
      <pointLight position={[0, 0, 0]} intensity={6} decay={0} />
      <mesh>
        <sphereGeometry args={[SUN_R, 32, 16]} />
        <meshBasicMaterial color="#ffcc33" />
      </mesh>
      <Html position={[0, 0, SUN_R * 1.6]} center style={labelStyle}>
        {labels.sun}
      </Html>

      <Line points={orbit} color={color} lineWidth={1.5} />

      {/* 軌道の中心（太陽とのずれが見える） */}
      <mesh position={center}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial color="#aaaaaa" />
      </mesh>
      {e > 0 && (
        <>
          <Html position={center} style={{ ...labelStyle, opacity: 0.7 }}>
            <span style={{ position: "relative", top: 12 }}>
              {labels.orbitCenter}
            </span>
          </Html>
          <Marker
            position={aps.perihelion}
            label={labels.perihelion}
            color="#ff6b6b"
          />
          <Marker
            position={aps.aphelion}
            label={labels.aphelion}
            color="#6bd5ff"
          />
        </>
      )}

      {seasons.map((m, i) => (
        <Marker
          key={m.lambda}
          position={m.position}
          label={labels.points[i] ?? ""}
          color="#9be37a"
          size={0.02}
        />
      ))}

      {/* 惑星：傾いた軸に合わせた座標系に赤道リングと軸線を置く */}
      <group ref={planetRef}>
        <mesh>
          <sphereGeometry args={[PLANET_R, 32, 16]} />
          <meshStandardMaterial color="#3a7bd5" />
        </mesh>
        <group ref={tiltRef}>
          <Line
            points={equator}
            color="#ffffff"
            lineWidth={1}
            transparent
            opacity={0.6}
          />
          <Line
            points={[
              [0, 0, -PLANET_R - AXIS_LEN],
              [0, 0, PLANET_R + AXIS_LEN],
            ]}
            color="#ffffff"
            lineWidth={1.5}
          />
        </group>
        <Html position={[0, 0, PLANET_R * 3]} center style={labelStyle}>
          {labels.axis}
        </Html>
      </group>
      {/* 観測者の緯度のピン。惑星の外の座標で位置を直接更新する */}
      <group ref={pinRef}>
        <mesh>
          <sphereGeometry args={[0.014, 12, 12]} />
          <meshBasicMaterial color="#ff2d55" />
        </mesh>
        <Html style={labelStyle}>
          <span style={{ position: "relative", left: 8, top: -8 }}>
            {labels.observer}
          </span>
        </Html>
      </group>
    </>
  );
}

function Marker({
  position,
  label,
  color,
  size = 0.025,
}: {
  position: Vec3;
  label: string;
  color: string;
  size?: number;
}) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[size, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Html style={labelStyle}>
        <span style={{ position: "relative", left: 8, top: -8 }}>{label}</span>
      </Html>
    </group>
  );
}
