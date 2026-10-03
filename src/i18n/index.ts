// react-i18next の初期化。リソースはバンドルに含める（HTTP 読み込みなし）
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { useStore } from "../store/store";
import type { Lang } from "../store/types";
import chartsEn from "./charts.en";
import chartsJa from "./charts.ja";
import en from "./en";
import ja from "./ja";
import sceneEarthEn from "./scene.earth.en";
import sceneEarthJa from "./scene.earth.ja";
import sceneEn from "./scene.en";
import sceneHorizonEn from "./scene.horizon.en";
import sceneHorizonJa from "./scene.horizon.ja";
import sceneJa from "./scene.ja";

/** 翻訳リソースの型。charts / scene は担当側が埋めるので緩く持つ */
export type Translation = typeof ja & {
  charts: Record<string, string>;
  scene: Record<string, string>;
};
export type UiKey = keyof typeof ja;

const resources: Record<Lang, { translation: Translation }> = {
  ja: {
    translation: {
      ...ja,
      charts: chartsJa,
      scene: { ...sceneJa, ...sceneEarthJa, ...sceneHorizonJa },
    },
  },
  en: {
    translation: {
      ...en,
      charts: chartsEn,
      scene: { ...sceneEn, ...sceneEarthEn, ...sceneHorizonEn },
    },
  },
};

/** Intl に渡すロケール。zh-Hans / zh-Hant を足すときはここと resources に追加する */
export const INTL_LOCALES: Record<Lang, string> = {
  ja: "ja-JP",
  en: "en-US",
};

export const LANGS = Object.keys(resources) as Lang[];

function applyDocumentLang(lang: Lang) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    document.title = i18n.t("appTitle", { lng: lang });
  }
}

/** 一度だけ呼ぶ。store.lang と i18n・<html lang> を同期する。戻り値は購読の解除 */
export function setupI18n(): () => void {
  const lang = useStore.getState().lang;
  void i18n.use(initReactI18next).init({
    resources,
    lng: lang,
    fallbackLng: "en",
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  applyDocumentLang(lang);
  return useStore.subscribe((s, prev) => {
    if (s.lang === prev.lang) return;
    void i18n.changeLanguage(s.lang);
    applyDocumentLang(s.lang);
  });
}

export { i18n };
