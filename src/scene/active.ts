// 3D に表示するセット（アクティブなタブ）を選ぶセレクタ。A は常に存在する
import type { Params } from "../engine";
import type { AppStore } from "../store/types";

export const selectActive = (s: AppStore): Params =>
  s.sets[s.activeIndex] ?? (s.sets[0] as Params);
