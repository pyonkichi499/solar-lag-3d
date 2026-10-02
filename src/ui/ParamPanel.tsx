// パラメータパネル：A/B タブ、スライダー + 数値入力、詳細（h₀）（§2.2, §3.1）
import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Params } from "../engine";
import type { UiKey } from "../i18n";
import { RANGES } from "../presets";
import { useStore } from "../store/store";
import { SET_COLORS, SET_NAMES } from "../theme";

type Key = keyof Params;

interface FieldSpec {
  key: Key;
  label: UiKey;
  unit: string;
  /** スライダーの刻み */
  step: number;
  /** 数値入力の刻み */
  inputStep: number;
  /** 表示する小数桁数 */
  decimals: number;
}

const MAIN_FIELDS: FieldSpec[] = [
  {
    key: "epsilon",
    label: "param_epsilon",
    unit: "°",
    step: 0.1,
    inputStep: 0.01,
    decimals: 2,
  },
  {
    key: "e",
    label: "param_e",
    unit: "",
    step: 0.001,
    inputStep: 0.0001,
    decimals: 4,
  },
  {
    key: "varpi",
    label: "param_varpi",
    unit: "°",
    step: 1,
    inputStep: 0.1,
    decimals: 1,
  },
  {
    key: "phi",
    label: "param_phi",
    unit: "°",
    step: 0.1,
    inputStep: 0.01,
    decimals: 2,
  },
];
const H0_FIELD: FieldSpec = {
  key: "h0",
  label: "param_h0",
  unit: "°",
  step: 0.01,
  inputStep: 0.001,
  decimals: 3,
};

const roundTo = (v: number, d: number) => String(Number(v.toFixed(d)));

interface FieldProps {
  spec: FieldSpec;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}

function Field({ spec, value, disabled, onChange }: FieldProps) {
  const { t } = useTranslation();
  const range = RANGES[spec.key];
  const label = t(spec.label);
  // 入力途中の文字列（"-" や "0." など）を壊さないよう、編集中だけ別に持つ
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className={`field${disabled ? " disabled" : ""}`}>
      <label className="field-label" htmlFor={`in-${spec.key}`}>
        {label}
      </label>
      <div className="field-controls">
        <input
          type="range"
          aria-label={t("paramSlider", { label })}
          min={range.min}
          max={range.max}
          step={spec.step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.valueAsNumber)}
        />
        <input
          id={`in-${spec.key}`}
          className="num"
          type="number"
          aria-label={t("paramInput", { label })}
          min={range.min}
          max={range.max}
          step={spec.inputStep}
          value={draft ?? roundTo(value, spec.decimals)}
          disabled={disabled}
          onChange={(e) => {
            const s = e.currentTarget.value;
            setDraft(s);
            const n = e.currentTarget.valueAsNumber;
            if (Number.isFinite(n)) onChange(n);
          }}
          onBlur={() => setDraft(null)}
        />
        <span className="unit">{spec.unit}</span>
      </div>
    </div>
  );
}

function SetTabs() {
  const { t } = useTranslation();
  const count = useStore((s) => s.sets.length);
  const active = useStore((s) => s.activeIndex);
  const setActive = useStore((s) => s.setActiveIndex);
  const addSet = useStore((s) => s.addSet);
  const removeSet = useStore((s) => s.removeSet);
  return (
    <div className="tabs" role="tablist" aria-label={t("tabsLabel")}>
      {Array.from({ length: count }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: セットは位置で識別する
          key={i}
          className={`tab${i === active ? " active" : ""}`}
          style={{ "--set-color": SET_COLORS[i] } as CSSProperties}
        >
          <button
            type="button"
            role="tab"
            aria-selected={i === active}
            className="tab-main"
            onClick={() => setActive(i)}
          >
            {SET_NAMES[i]}
          </button>
          {i === 1 && (
            <button
              type="button"
              className="tab-close"
              aria-label={t("removeSet", { name: SET_NAMES[i] })}
              onClick={removeSet}
            >
              ✕
            </button>
          )}
        </span>
      ))}
      {count < 2 && (
        <button type="button" className="tab-add" onClick={addSet}>
          {t("addSet")}
        </button>
      )}
    </div>
  );
}

export function ParamPanel() {
  const { t } = useTranslation();
  const active = useStore((s) => s.activeIndex);
  const params = useStore((s) => s.sets[s.activeIndex]);
  const hasB = useStore((s) => s.sets.length > 1);
  const setParam = useStore((s) => s.setParam);
  const alignLatitude = useStore((s) => s.alignLatitude);
  if (!params) return null;

  return (
    <section
      className="panel params"
      aria-labelledby="params-heading"
      style={{ "--set-color": SET_COLORS[active] } as CSSProperties}
    >
      <h2 id="params-heading">{t("paramsHeading")}</h2>
      <SetTabs />
      {MAIN_FIELDS.map((spec) => {
        const noPerihelion = spec.key === "varpi" && params.e === 0;
        return (
          <div key={`${active}-${spec.key}`}>
            <Field
              spec={spec}
              value={params[spec.key]}
              disabled={noPerihelion}
              onChange={(v) => setParam(active, spec.key, v)}
            />
            {noPerihelion && <p className="note">{t("varpiDisabled")}</p>}
          </div>
        );
      })}
      <details className="details">
        <summary>{t("details")}</summary>
        <Field
          key={`${active}-h0`}
          spec={H0_FIELD}
          value={params.h0}
          onChange={(v) => setParam(active, "h0", v)}
        />
        <div className="quick">
          <button type="button" onClick={() => setParam(active, "h0", -0.833)}>
            {t("h0Standard")}
          </button>
          <button type="button" onClick={() => setParam(active, "h0", 0)}>
            {t("h0Geometric")}
          </button>
        </div>
        <p className="note">{t("h0Note")}</p>
      </details>
      {hasB && (
        <button type="button" className="align" onClick={alignLatitude}>
          {t("alignLatitude")}
        </button>
      )}
    </section>
  );
}
