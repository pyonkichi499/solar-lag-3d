// URL とストアの同期（docs/requirements.md §5）。担当: R1-2
import { useStore } from "./store";
import type { Lang } from "./types";
import { decodeState, encodeState, presetIdFor } from "./url";

const LANG_KEY = "solar-lag-3d.lang";
const THROTTLE_MS = 300;

function storedLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "ja" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // 保存できなくても動作に影響しない
  }
}

function browserLang(): Lang {
  try {
    return navigator.language?.toLowerCase().startsWith("en") ? "en" : "ja";
  } catch {
    return "ja";
  }
}

/** 起動時に URL を読んでストアに反映し、以降の変更を URL に書き戻す。戻り値は購読の解除 */
export function installUrlSync(): () => void {
  const d = decodeState(window.location.search);
  useStore.setState({
    sets: d.sets,
    presetIds: d.sets.map(presetIdFor),
    activeIndex: d.activeIndex,
    day: d.day,
    show: d.show,
    lang: d.lang ?? storedLang() ?? browserLang(),
  });

  let timer: ReturnType<typeof setTimeout> | null = null;
  const write = () => {
    timer = null;
    const s = useStore.getState();
    if (s.playing) return;
    const url = `${window.location.pathname}?${encodeState(s)}${window.location.hash}`;
    try {
      window.history.replaceState(null, "", url);
    } catch {
      // 書き込めない環境では何もしない
    }
  };

  let lastLang = useStore.getState().lang;
  const unsub = useStore.subscribe((s) => {
    if (s.lang !== lastLang) {
      lastLang = s.lang;
      saveLang(s.lang);
    }
    // 再生中は書かない。止まったときの変更で 1 回書く
    if (s.playing) return;
    if (timer === null) timer = setTimeout(write, THROTTLE_MS);
  });

  return () => {
    unsub();
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
}
