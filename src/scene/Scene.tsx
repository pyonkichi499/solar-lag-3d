// 3D ビュー。視点は views/ 以下に分け、共通の Canvas・操作・視点の切り替えはここに置く。
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "../store/store";
import { SET_COLORS } from "../theme";
import { earthView } from "./views/earth";
import { horizonView } from "./views/horizon";
import { outsideView } from "./views/outside";
import type { Tr, ViewId, ViewModule } from "./views/types";

const VIEWS: ViewModule[] = [outsideView, earthView, horizonView];

export function Scene() {
  const { t: rawT } = useTranslation();
  const t = rawT as unknown as Tr;
  const [viewId, setViewId] = useState<ViewId>("outside");
  const activeIndex = useStore((s) => s.activeIndex);
  const color = SET_COLORS[activeIndex] ?? SET_COLORS[0];
  const view = VIEWS.find((v) => v.id === viewId) ?? outsideView;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 320,
      }}
    >
      {/* 視点を切り替えるときは Canvas を作り直して、カメラを視点ごとの初期位置に戻す */}
      <Canvas
        key={view.id}
        aria-label={t("scene.canvasLabel")}
        camera={{ ...view.camera, up: view.camera.up }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.25} />
        <view.Content color={color} t={t} />
        <OrbitControls
          enablePan={false}
          minDistance={view.controls.minDistance}
          maxDistance={view.controls.maxDistance}
          target={view.controls.target}
        />
      </Canvas>
      <div role="tablist" style={tabs}>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={v.id === viewId}
            onClick={() => setViewId(v.id)}
            style={{ ...tab, ...(v.id === viewId ? tabActive : null) }}
          >
            {t(`scene.${v.tabKey}`)}
          </button>
        ))}
      </div>
      <view.Overlay color={color} t={t} />
    </div>
  );
}

const tabs: CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  display: "flex",
  gap: 4,
};

const tab: CSSProperties = {
  padding: "3px 10px",
  fontSize: 12,
  color: "#fff",
  background: "rgba(0,0,0,0.45)",
  border: "1px solid rgba(255,255,255,0.35)",
  borderRadius: 14,
  cursor: "pointer",
};

const tabActive: CSSProperties = {
  background: "rgba(255,255,255,0.9)",
  color: "#111",
};
