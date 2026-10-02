// 視点: horizon（準備中の仮置き）
import type { ViewModule } from "./types";

export const horizonView: ViewModule = {
  id: "horizon",
  tabKey: "tabHorizon",
  camera: { up: [0, 0, 1], position: [0, -3, 1.5], fov: 45 },
  controls: { minDistance: 1.5, maxDistance: 8 },
  Content: () => null,
  Overlay: ({ t }) => (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 8,
        color: "#fff",
        fontSize: 12,
      }}
    >
      {t("scene.comingSoon")}
    </div>
  ),
};
