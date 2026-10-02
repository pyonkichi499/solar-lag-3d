// アプリの状態の型。仕様は docs/requirements.md §2.2, §5, §8。
import type { LagKind, Params } from "../engine";
import type { PresetId } from "../presets";

export type Lang = "ja" | "en";

export interface AppState {
  /** パラメータの組。先頭が A、2 番目が B（B は「比較を追加」で作られる） */
  sets: Params[];
  /** 各セットで最後に適用したプリセット。値を手で変えたら null（「カスタム」） */
  presetIds: (PresetId | null)[];
  /** パラメータパネルと 3D で選択中のセット */
  activeIndex: number;
  /** 日付カーソル：各セットの夏至の瞬間からの日数（A/B で共通の相対値） */
  day: number;
  playing: boolean;
  /** 結果欄・グラフに出すズレの種類 */
  show: Record<LagKind, boolean>;
  lang: Lang;
  /** グラフの縦軸を固定する */
  lockYAxis: boolean;
}

export interface AppActions {
  setParam: <K extends keyof Params>(
    index: number,
    key: K,
    value: number,
  ) => void;
  applyPreset: (index: number, id: PresetId) => void;
  /** B を追加（A の値を複製）。すでにあれば何もしない */
  addSet: () => void;
  /** B を削除し、A のみに戻る */
  removeSet: () => void;
  setActiveIndex: (index: number) => void;
  /** B の緯度を A に揃える */
  alignLatitude: () => void;
  setDay: (day: number) => void;
  setPlaying: (playing: boolean) => void;
  toggleShow: (kind: LagKind) => void;
  setLang: (lang: Lang) => void;
  setLockYAxis: (lock: boolean) => void;
}

export type AppStore = AppState & AppActions;
