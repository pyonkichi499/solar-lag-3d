// 地球のそばの視点。惑星を原点に置き、太陽は黄道座標で決まった向きにある。
// 惑星は半径 1。z = 黄道の北極。惑星に固定した座標系（x = 観測者の子午線、z = 自転軸）を group に持たせる。
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type CSSProperties, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EARTH, sceneState } from "../../engine";
import { yearResultFor } from "../../store/derived";
import { useStore } from "../../store/store";
import { selectActive } from "../active";
import {
  hourAngleDeg,
  isDaylit,
  planetFrame,
  sunDirection,
  toPlanetFrame,
  type Vec3,
} from "../earthMath";

export interface EarthLabels {
  axis: string;
  observer: string;
  sun: string;
  terminator: string;
}

const R = 1;
const SUN_MARK_DIST = 2.3;
const LAT_SAMPLES = 180;

const labelStyle: CSSProperties = {
  color: "#fff",
  fontSize: 11,
  whiteSpace: "nowrap",
  textShadow: "0 0 3px #000, 0 0 3px #000",
  pointerEvents: "none",
};

const DAY_COLOR = new THREE.Color("#ffd34d");
const NIGHT_COLOR = new THREE.Color("#2f4a8a");

/** 球面上の円（惑星固定座標系）。lat は緯度 [rad] */
function latitudeCircle(lat: number, r: number, n = 96): Vec3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [
      r * Math.cos(lat) * Math.cos(a),
      r * Math.cos(lat) * Math.sin(a),
      r * Math.sin(lat),
    ];
  });
}

/** 極を通る半円（経度 lon）の点列 */
function meridian(lon: number, r: number, n = 48): Vec3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const lat = -Math.PI / 2 + (Math.PI * i) / n;
    return [
      r * Math.cos(lat) * Math.cos(lon),
      r * Math.cos(lat) * Math.sin(lon),
      r * Math.sin(lat),
    ];
  });
}

/** 観測者の緯度円を帯にしたジオメトリ（頂点色で昼夜を塗り分ける） */
function latitudeRibbon(phiDeg: number) {
  const phi = (phiDeg * Math.PI) / 180;
  const w = 0.014;
  const lo = Math.max(-Math.PI / 2, phi - w);
  const hi = Math.min(Math.PI / 2, phi + w);
  const pos = new Float32Array((LAT_SAMPLES + 1) * 2 * 3);
  const r = R * 1.006;
  for (let i = 0; i <= LAT_SAMPLES; i++) {
    const a = (2 * Math.PI * i) / LAT_SAMPLES;
    [lo, hi].forEach((lat, j) => {
      const o = (i * 2 + j) * 3;
      pos[o] = r * Math.cos(lat) * Math.cos(a);
      pos[o + 1] = r * Math.cos(lat) * Math.sin(a);
      pos[o + 2] = r * Math.sin(lat);
    });
  }
  const index: number[] = [];
  for (let i = 0; i < LAT_SAMPLES; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array((LAT_SAMPLES + 1) * 2 * 3), 3),
  );
  g.setIndex(index);
  return g;
}

export function EarthView({
  labels,
  color,
}: {
  labels: EarthLabels;
  color: string;
}) {
  const params = useStore(selectActive);
  const { phi, h0 } = params;
  const solstice = useMemo(
    () => yearResultFor(params).summerSolstice,
    [params],
  );

  // パラメータが変わったときだけ作る静的な形
  const equator = useMemo(() => latitudeCircle(0, R * 1.004), []);
  const graticule = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => [
        meridian((i * Math.PI) / 6, R * 1.002, 48),
        meridian((i * Math.PI) / 6 + Math.PI, R * 1.002, 48),
      ]).flat(),
    [],
  );
  const terminator = useMemo(() => latitudeCircle(0, R * 1.008), []);
  const ribbon = useMemo(() => latitudeRibbon(phi), [phi]);
  // props で渡したジオメトリは R3F が破棄しないため、作り直すたびに自分で解放する
  useEffect(() => () => ribbon.dispose(), [ribbon]);
  const observerPos = useMemo<Vec3>(() => {
    const p = (phi * Math.PI) / 180;
    return [R * Math.cos(p), 0, R * Math.sin(p)];
  }, [phi]);
  const observerMeridian = useMemo(() => meridian(0, R * 1.006, 64), []);

  const planetRef = useRef<THREE.Group>(null);
  const termRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const sunMarkRef = useRef<THREE.Group>(null);
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      x: new THREE.Vector3(),
      y: new THREE.Vector3(),
      z: new THREE.Vector3(),
      sun: new THREE.Vector3(),
      up: new THREE.Vector3(0, 0, 1),
    }),
    [],
  );

  // 再生中も React を再描画せず、毎フレーム日付から向きと昼夜の色を更新する
  useFrame(() => {
    const day = useStore.getState().day;
    const s = sceneState(params, EARTH, solstice + day);
    const sun = sunDirection(s.planetPosition);
    const H = hourAngleDeg(s.localMeanTime, s.sun.equationOfTime);
    const f = planetFrame(sun, s.axisDirection, H);

    // 惑星固定座標系 → 黄道座標系の回転
    tmp.x.set(...f.x);
    tmp.y.set(...f.y);
    tmp.z.set(...f.z);
    tmp.m.makeBasis(tmp.x, tmp.y, tmp.z);
    planetRef.current?.quaternion.setFromRotationMatrix(tmp.m);

    tmp.sun.set(...sun);
    termRef.current?.quaternion.setFromUnitVectors(tmp.up, tmp.sun);
    lightRef.current?.position.set(sun[0] * 10, sun[1] * 10, sun[2] * 10);
    sunMarkRef.current?.position.set(
      sun[0] * SUN_MARK_DIST,
      sun[1] * SUN_MARK_DIST,
      sun[2] * SUN_MARK_DIST,
    );

    // 緯度円の昼夜の塗り分け
    const local = toPlanetFrame(sun, f);
    const col = ribbon.getAttribute("color") as THREE.BufferAttribute;
    for (let i = 0; i <= LAT_SAMPLES; i++) {
      const lon = (2 * Math.PI * (i + 0.5)) / LAT_SAMPLES;
      const c = isDaylit(local, phi, lon, h0) ? DAY_COLOR : NIGHT_COLOR;
      col.setXYZ(i * 2, c.r, c.g, c.b);
      col.setXYZ(i * 2 + 1, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  });

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight ref={lightRef} position={[10, 0, 0]} intensity={3} />

      {/* 惑星（半径 1）。回転に追従するのは group の中身 */}
      <mesh>
        <sphereGeometry args={[R, 64, 32]} />
        <meshStandardMaterial color="#3a7bd5" roughness={0.9} />
      </mesh>

      <group ref={planetRef}>
        <Line
          points={equator}
          color="#ffffff"
          lineWidth={1.5}
          transparent
          opacity={0.8}
        />
        {graticule.map((pts, i) => (
          <Line
            // biome-ignore lint/suspicious/noArrayIndexKey: 静的な並び
            key={i}
            points={pts}
            color="#ffffff"
            lineWidth={0.6}
            transparent
            opacity={0.25}
          />
        ))}
        {/* 観測者の子午線とピン */}
        <Line points={observerMeridian} color={color} lineWidth={1.5} />
        <mesh geometry={ribbon}>
          <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
        </mesh>
        <mesh position={observerPos}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color="#ff2d55" />
        </mesh>
        <Html
          position={observerPos.map((v) => v * 1.12) as Vec3}
          style={labelStyle}
        >
          <span style={{ position: "relative", left: 8, top: -8 }}>
            {labels.observer}
          </span>
        </Html>
        {/* 自転軸 */}
        <Line
          points={[
            [0, 0, -1.5],
            [0, 0, 1.5],
          ]}
          color="#ffffff"
          lineWidth={1.5}
        />
        <Html position={[0, 0, 1.62]} center style={labelStyle}>
          {labels.axis}
        </Html>
      </group>

      {/* 昼夜の境界（太陽方向に垂直な大円） */}
      <group ref={termRef}>
        <Line points={terminator} color="#ff9f43" lineWidth={2} />
        <Html position={[0, -R * 1.02, 0]} center style={labelStyle}>
          {labels.terminator}
        </Html>
      </group>

      {/* 太陽の向きの目印（距離は実寸ではない） */}
      <group ref={sunMarkRef}>
        <mesh>
          <sphereGeometry args={[0.12, 24, 12]} />
          <meshBasicMaterial color="#ffcc33" />
        </mesh>
        <Html position={[0, 0, 0.25]} center style={labelStyle}>
          {labels.sun}
        </Html>
      </group>
    </>
  );
}
