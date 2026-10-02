// ヘッダー：タイトル、プリセット、言語切り替え、共有
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LANGS } from "../i18n";
import { PRESETS, type PresetId } from "../presets";
import { useStore } from "../store/store";
import { SET_NAMES } from "../theme";

const CUSTOM = "custom";

function PresetSelect() {
  const { t } = useTranslation();
  const active = useStore((s) => s.activeIndex);
  const presetId = useStore((s) => s.presetIds[s.activeIndex] ?? null);
  const applyPreset = useStore((s) => s.applyPreset);
  return (
    <label className="preset">
      <span className="preset-label">
        {t("preset")}
        <small>
          {t("presetAppliesTo", { name: SET_NAMES[active] ?? SET_NAMES[0] })}
        </small>
      </span>
      <select
        value={presetId ?? CUSTOM}
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v !== CUSTOM) applyPreset(active, v as PresetId);
        }}
      >
        {presetId === null && (
          <option value={CUSTOM} disabled>
            {t("presetCustom")}
          </option>
        )}
        {PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {t(`preset_${p.id}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ShareButton() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("idle"), 2000);
  };
  return (
    <span className="share">
      <button type="button" onClick={share}>
        {t("share")}
      </button>
      <span className="share-status" role="status">
        {status === "copied" && t("shareCopied")}
        {status === "failed" && t("shareFailed")}
      </span>
    </span>
  );
}

function LangSwitch() {
  const { t } = useTranslation();
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  return (
    <fieldset className="lang" aria-label={t("language")}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === lang}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </fieldset>
  );
}

export function Header() {
  const { t } = useTranslation();
  return (
    <header className="app-header">
      <h1>{t("appTitle")}</h1>
      <PresetSelect />
      <div className="header-right">
        <LangSwitch />
        <ShareButton />
      </div>
    </header>
  );
}
