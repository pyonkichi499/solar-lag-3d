// 視点（3D ビューの見せ方）の共通の型。視点を足すときは views/ に 1 つ追加して Scene.tsx に登録する。
import type { ComponentType } from "react";

export type ViewId = "outside" | "earth" | "horizon";

/** Scene が useTranslation から渡す翻訳関数（Canvas の内側には i18n の文脈が届かないため props で渡す） */
export type Tr = (key: string, options?: Record<string, unknown>) => string;

export interface ViewProps {
  /** 選択中のセットの色 */
  color: string;
  t: Tr;
}

export interface ViewModule {
  id: ViewId;
  /** タブに出す文言のキー（scene.<キー>） */
  tabKey: string;
  camera: {
    position: [number, number, number];
    up: [number, number, number];
    fov: number;
  };
  controls: {
    minDistance: number;
    maxDistance: number;
    /** 注視点（既定は原点） */
    target?: [number, number, number];
  };
  /** Canvas の内側に描く 3D の内容 */
  Content: ComponentType<ViewProps>;
  /** Canvas の外側に重ねる HTML（凡例、読み出しなど） */
  Overlay: ComponentType<ViewProps>;
}
