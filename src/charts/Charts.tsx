// 2D グラフ（日の出・日没・南中、均時差）と日付スライダー。担当: R1-3
import { line } from "d3-shape";
import {
  memo,
  type PointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { EARTH, type LagKind } from "../engine";
import { useYearResults } from "../store/derived";
import { useStore } from "../store/store";
import { SET_COLORS, SET_NAMES } from "../theme";
import { calendarLabel } from "./calendar";
import {
  buildChartModel,
  type ChartModel,
  type Domains,
  dayTicks,
  formatClock,
  formatSigned,
  type Margin,
  type Pt,
  type SetModel,
  timeTicks,
  xScaleOf,
  yScaleOf,
} from "./model";

const HALF = EARTH.yearDays / 2;
const TIME_H = 280;
const EOT_H = 190;
const TIME_M: Margin = { l: 56, r: 16, t: 20, b: 6 };
const EOT_M: Margin = { l: 56, r: 16, t: 8, b: 66 };
const GRID = { stroke: "currentColor", strokeOpacity: 0.12 } as const;
const AXIS_TEXT = {
  fill: "currentColor",
  fontSize: 11,
  opacity: 0.75,
} as const;
const HALO = {
  paintOrder: "stroke",
  stroke: "Canvas",
  strokeWidth: 3,
} as const;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** B（index 1）は破線で区別する */
function dashOf(index: number, kind: "main" | "transit"): string | undefined {
  if (kind === "transit") return index === 0 ? "1 3" : "1 5";
  return index === 0 ? undefined : "7 4";
}

interface PlotProps {
  model: ChartModel;
  width: number;
  locale: string;
}

type Scale = (v: number) => number;

function GridX({
  xs,
  ticks,
  top,
  bottom,
}: {
  xs: Scale;
  ticks: number[];
  top: number;
  bottom: number;
}) {
  return (
    <g>
      {ticks.map((v) => (
        <line key={v} x1={xs(v)} x2={xs(v)} y1={top} y2={bottom} {...GRID} />
      ))}
    </g>
  );
}

function Solstices({
  s,
  xs,
  top,
  bottom,
  withLabel,
}: {
  s: SetModel;
  xs: Scale;
  top: number;
  bottom: number;
  withLabel: boolean;
}) {
  const { t } = useTranslation();
  const south = s.hemisphere === "south";
  const color = SET_COLORS[s.index] ?? SET_COLORS[0];
  const dash = s.formalSolstice ? "5 4" : undefined;
  const key = (base: "summer" | "winter") =>
    `charts.${base}${s.formalSolstice ? "Formal" : ""}${south ? "South" : ""}`;
  return (
    <g>
      {[
        { x: 0, label: t(key("summer")) },
        { x: s.winterX, label: t(key("winter")) },
      ].map((l) => (
        <g key={l.label}>
          <line
            x1={xs(l.x)}
            x2={xs(l.x)}
            y1={top}
            y2={bottom}
            stroke={color}
            strokeOpacity={0.55}
            strokeWidth={1.25}
            strokeDasharray={dash}
          />
          {withLabel && (
            <text
              x={xs(l.x)}
              y={top + 10 + s.index * 12}
              textAnchor={l.x < 0 ? "start" : "end"}
              dx={l.x < 0 ? 4 : -4}
              fontSize={10.5}
              fill={color}
              style={HALO}
            >
              {l.label}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

/** 時刻グラフの曲線・帯・マーカー（日付カーソルでは再描画しない） */
const TimePlot = memo(function TimePlot({ model, width, locale }: PlotProps) {
  const { t } = useTranslation();
  const clipId = useId();
  const xs = useMemo(() => xScaleOf(model, width, TIME_M), [model, width]);
  const ys = useMemo(
    () => yScaleOf(model.domains.time, TIME_H, TIME_M),
    [model],
  );
  const top = TIME_M.t;
  const bottom = TIME_H - TIME_M.b;

  const paths = useMemo(() => {
    const gen = line<Pt>()
      .x((p) => xs(p[0]))
      .y((p) => ys(p[1]));
    return model.sets.map((s) => ({
      sunrise: s.sunrise.map((seg) => gen(seg) ?? ""),
      sunset: s.sunset.map((seg) => gen(seg) ?? ""),
      transit: s.transit.map((seg) => gen(seg) ?? ""),
    }));
  }, [model, xs, ys]);

  const yt = timeTicks(model.domains.time);
  const lagName = (k: LagKind) => t(`charts.${k}`);

  return (
    <g>
      <GridX
        xs={xs}
        ticks={dayTicks(model.xDomain)}
        top={top}
        bottom={bottom}
      />
      {yt.map((v) => (
        <g key={v}>
          <line
            x1={TIME_M.l}
            x2={width - TIME_M.r}
            y1={ys(v)}
            y2={ys(v)}
            {...GRID}
          />
          <text
            x={TIME_M.l - 6}
            y={ys(v)}
            dy={4}
            textAnchor="end"
            {...AXIS_TEXT}
          >
            {formatClock(v)}
          </text>
        </g>
      ))}
      <clipPath id={clipId}>
        <rect
          x={TIME_M.l}
          y={top}
          width={width - TIME_M.l - TIME_M.r}
          height={bottom - top}
        />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {model.sets.map((s) => (
          <g key={`b${s.index}`}>
            {s.bands.map((b) => (
              <g key={`${b.kind}${b.x0}`}>
                <rect
                  x={xs(b.x0)}
                  y={top}
                  width={Math.max(0, xs(b.x1) - xs(b.x0))}
                  height={bottom - top}
                  fill={SET_COLORS[s.index]}
                  opacity={b.kind === "polarDay" ? 0.14 : 0.1}
                />
                <text
                  x={(xs(b.x0) + xs(b.x1)) / 2}
                  y={bottom - 6 - s.index * 12}
                  textAnchor="middle"
                  fontSize={10.5}
                  fill={SET_COLORS[s.index]}
                  style={HALO}
                >
                  {t(`charts.${b.kind}`)}
                </text>
              </g>
            ))}
          </g>
        ))}
        {model.sets.map((s, i) => {
          const color = SET_COLORS[s.index];
          const p = paths[i];
          if (!p) return null;
          return (
            <g key={`c${s.index}`} fill="none" stroke={color}>
              {p.transit.map((d) => (
                <path
                  key={d}
                  d={d}
                  strokeWidth={1.25}
                  strokeDasharray={dashOf(s.index, "transit")}
                  opacity={0.75}
                />
              ))}
              {[...p.sunrise, ...p.sunset].map((d) => (
                <path
                  key={d}
                  d={d}
                  strokeWidth={2}
                  strokeDasharray={dashOf(s.index, "main")}
                />
              ))}
            </g>
          );
        })}
      </g>
      {model.sets.map((s) => (
        <Solstices
          key={`s${s.index}`}
          s={s}
          xs={xs}
          top={top}
          bottom={bottom}
          withLabel={
            s.index === 0 || s.hemisphere !== model.sets[0]?.hemisphere
          }
        />
      ))}
      {model.sets.map((s) => {
        const color = SET_COLORS[s.index];
        return s.markers.map((m) => {
          const cx = xs(m.x);
          const cy = ys(m.y);
          const name = lagName(m.kind);
          const value = formatSigned(m.lagDays, locale);
          const title =
            m.style === "peak"
              ? t("charts.markerPeak", { name, value })
              : t("charts.markerBoundary", { name, value });
          const arrow = m.kind === "latestSunset" && Math.abs(cx - xs(0)) > 8;
          const x0 = xs(0);
          const dir = Math.sign(cx - x0);
          return (
            <g key={`${s.index}${m.kind}`}>
              {arrow && (
                <g stroke={color} fill={color} strokeWidth={1.5}>
                  <line x1={x0} x2={cx - dir * 6} y1={cy - 10} y2={cy - 10} />
                  <polygon
                    stroke="none"
                    points={`${cx},${cy - 10} ${cx - dir * 7},${cy - 14} ${cx - dir * 7},${cy - 6}`}
                  />
                  <line x1={x0} x2={x0} y1={cy - 15} y2={cy - 5} />
                  <text
                    x={(x0 + cx) / 2}
                    y={cy - 14}
                    textAnchor="middle"
                    fontSize={11.5}
                    fontWeight={600}
                    stroke="Canvas"
                    style={HALO}
                    strokeWidth={0}
                  >
                    {t("charts.lagAnnotation", { value })}
                  </text>
                </g>
              )}
              {m.style === "peak" ? (
                <circle
                  cx={cx}
                  cy={cy}
                  r={4.5}
                  fill={color}
                  stroke="Canvas"
                  strokeWidth={1.5}
                >
                  <title>{title}</title>
                </circle>
              ) : (
                <rect
                  x={cx - 4.5}
                  y={cy - 4.5}
                  width={9}
                  height={9}
                  transform={`rotate(45 ${cx} ${cy})`}
                  fill="Canvas"
                  stroke={color}
                  strokeWidth={2}
                >
                  <title>{title}</title>
                </rect>
              )}
            </g>
          );
        });
      })}
      {/* 系列名（A の左端に直接ラベル） */}
      <SeriesLabels model={model} xs={xs} ys={ys} />
    </g>
  );
});

function SeriesLabels({
  model,
  xs,
  ys,
}: {
  model: ChartModel;
  xs: Scale;
  ys: Scale;
}) {
  const { t } = useTranslation();
  const s = model.sets[0];
  if (!s) return null;
  const at = (segs: Pt[][]) => {
    // 左端付近（x の最小に近い点）
    let best: Pt | null = null;
    for (const seg of segs)
      for (const p of seg)
        if (p[0] >= model.xDomain[0] && (!best || p[0] < best[0])) best = p;
    return best;
  };
  const items: [string, Pt | null][] = [
    ["sunrise", at(s.sunrise)],
    ["sunset", at(s.sunset)],
    ["transit", at(s.transit)],
  ];
  return (
    <g>
      {items.map(([k, p]) =>
        p ? (
          <text
            key={k}
            x={xs(p[0]) + 4}
            y={ys(p[1]) - 5}
            fontSize={10.5}
            fill={SET_COLORS[0]}
            style={HALO}
          >
            {t(`charts.${k}`)}
          </text>
        ) : null,
      )}
    </g>
  );
}

const EotPlot = memo(function EotPlot({ model, width, locale }: PlotProps) {
  const { t } = useTranslation();
  const clipId = useId();
  const refT = useYearResults()[0]?.summerSolstice ?? 0;
  const xs = useMemo(() => xScaleOf(model, width, EOT_M), [model, width]);
  const { domain, unit } = model.domains.eot;
  const ys = useMemo(() => yScaleOf(domain, EOT_H, EOT_M), [domain]);
  const top = EOT_M.t;
  const bottom = EOT_H - EOT_M.b;

  const paths = useMemo(() => {
    const gen = line<Pt>()
      .x((p) => xs(p[0]))
      .y((p) => ys(p[1]));
    return model.sets.map((s) => gen(s.eot) ?? "");
  }, [model, xs, ys]);

  const xt = dayTicks(model.xDomain);
  const step = unit === "min" ? 5 : 0.5;
  const span = domain[1] - domain[0];
  const k = Math.max(1, Math.ceil(span / step / 6));
  const yt: number[] = [];
  for (
    let v = Math.ceil(domain[0] / (step * k)) * step * k;
    v <= domain[1];
    v += step * k
  )
    yt.push(v);

  return (
    <g>
      <GridX xs={xs} ticks={xt} top={top} bottom={bottom} />
      {yt.map((v) => (
        <g key={v}>
          <line
            x1={EOT_M.l}
            x2={width - EOT_M.r}
            y1={ys(v)}
            y2={ys(v)}
            {...GRID}
            strokeOpacity={v === 0 ? 0.4 : 0.12}
          />
          <text
            x={EOT_M.l - 6}
            y={ys(v)}
            dy={4}
            textAnchor="end"
            {...AXIS_TEXT}
          >
            {v}
          </text>
        </g>
      ))}
      <text
        x={EOT_M.l - 6}
        y={top - 0}
        dy={-1}
        textAnchor="end"
        {...AXIS_TEXT}
        fontSize={10}
      >
        {unit === "min" ? "min" : "h"}
      </text>
      <clipPath id={clipId}>
        <rect
          x={EOT_M.l}
          y={top}
          width={width - EOT_M.l - EOT_M.r}
          height={bottom - top}
        />
      </clipPath>
      <g clipPath={`url(#${clipId})`} fill="none">
        {model.sets.map((s, i) => (
          <path
            key={s.index}
            d={paths[i]}
            stroke={SET_COLORS[s.index]}
            strokeWidth={2}
            strokeDasharray={dashOf(s.index, "main")}
          />
        ))}
      </g>
      {model.sets.map((s) => (
        <Solstices
          key={s.index}
          s={s}
          xs={xs}
          top={top}
          bottom={bottom}
          withLabel={false}
        />
      ))}
      {/* 共通の横軸：夏至からの日数と、参考の暦日付（A 基準） */}
      <line
        x1={EOT_M.l}
        x2={width - EOT_M.r}
        y1={bottom}
        y2={bottom}
        stroke="currentColor"
        strokeOpacity={0.4}
      />
      {xt.map((v) => (
        <g key={v}>
          <text x={xs(v)} y={bottom + 14} textAnchor="middle" {...AXIS_TEXT}>
            {v > 0 ? `+${v}` : v}
          </text>
          {v % 60 === 0 && (
            <text
              x={xs(v)}
              y={bottom + 28}
              textAnchor="middle"
              {...AXIS_TEXT}
              opacity={0.55}
            >
              {calendarLabel(refT + v, locale)}
            </text>
          )}
        </g>
      ))}
      <text
        x={EOT_M.l - 6}
        y={bottom + 14}
        textAnchor="end"
        {...AXIS_TEXT}
        fontSize={10}
      >
        {t("charts.dayAxis")}
      </text>
      <text
        x={EOT_M.l - 6}
        y={bottom + 28}
        textAnchor="end"
        {...AXIS_TEXT}
        fontSize={10}
        opacity={0.55}
      >
        {t("charts.dateAxis")}
      </text>
    </g>
  );
});

/** 日付カーソル。ドラッグで store.day を更新する */
function Cursor({
  xs,
  day,
  top,
  bottom,
  label,
}: {
  xs: Scale;
  day: number;
  top: number;
  bottom: number;
  label?: string;
}) {
  const x = xs(day);
  return (
    <g pointerEvents="none">
      <line
        x1={x}
        x2={x}
        y1={top}
        y2={bottom}
        stroke="currentColor"
        strokeWidth={1.5}
        opacity={0.85}
      />
      <circle cx={x} cy={top} r={4} fill="currentColor" />
      {label && (
        <text
          x={x}
          y={top - 7}
          textAnchor={day > HALF * 0.6 ? "end" : "start"}
          dx={day > HALF * 0.6 ? 4 : -4}
          fontSize={11}
          fill="currentColor"
          style={HALO}
        >
          {label}
        </text>
      )}
    </g>
  );
}

export function Charts() {
  const { t } = useTranslation();
  const results = useYearResults();
  const sets = useStore((s) => s.sets);
  const show = useStore((s) => s.show);
  const lockY = useStore((s) => s.lockYAxis);
  const lang = useStore((s) => s.lang);
  const day = useStore((s) => s.day);
  const playing = useStore((s) => s.playing);
  const setDay = useStore((s) => s.setDay);
  const setPlaying = useStore((s) => s.setPlaying);

  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const w = e?.contentRect.width;
      if (w && w > 120) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 縦軸の固定：固定をかける直前の自動範囲を保持する
  const lastAuto = useRef<Domains | null>(null);
  const model = useMemo(
    () =>
      buildChartModel(results, sets, {
        show,
        locked: lockY ? lastAuto.current : null,
      }),
    [results, sets, show, lockY],
  );
  useEffect(() => {
    if (!lockY) lastAuto.current = model.domains;
  }, [model, lockY]);

  const locale = lang === "ja" ? "ja" : "en";
  const dayC = clamp(day, -HALF, HALF);
  const xsTime = useMemo(() => xScaleOf(model, width, TIME_M), [model, width]);

  const dragging = useRef(false);
  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const px = ((e.clientX - rect.left) * width) / rect.width;
    setDay(clamp(xsTime.invert(px), -HALF, HALF));
  };
  const handlers = {
    onPointerDown: (e: PointerEvent<SVGSVGElement>) => {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      fromPointer(e);
    },
    onPointerMove: (e: PointerEvent<SVGSVGElement>) => {
      if (dragging.current) fromPointer(e);
    },
    onPointerUp: () => {
      dragging.current = false;
    },
    onPointerCancel: () => {
      dragging.current = false;
    },
  };
  const svgStyle = {
    display: "block",
    touchAction: "pan-y",
    cursor: "ew-resize",
  } as const;
  const cursorLabel = t("charts.cursorLabel", {
    value: formatSigned(dayC, locale),
  });

  return (
    <section aria-label={t("charts.chartLabel")} style={{ width: "100%" }}>
      <div ref={boxRef} style={{ width: "100%" }}>
        <h3 style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600 }}>
          {t("charts.timeTitle")}
        </h3>
        <Legend n={sets.length} />
        <svg
          viewBox={`0 0 ${width} ${TIME_H}`}
          width="100%"
          role="img"
          aria-label={t("charts.timeTitle")}
          style={svgStyle}
          {...handlers}
        >
          <TimePlot model={model} width={width} locale={locale} />
          <Cursor
            xs={xsTime}
            day={dayC}
            top={TIME_M.t}
            bottom={TIME_H - TIME_M.b}
            label={cursorLabel}
          />
        </svg>
        <h3 style={{ margin: "8px 0 2px", fontSize: 13, fontWeight: 600 }}>
          {t("charts.eotTitle")}（
          {model.domains.eot.unit === "min"
            ? t("charts.eotAxisMin")
            : t("charts.eotAxisH")}
          ）
        </h3>
        <svg
          viewBox={`0 0 ${width} ${EOT_H}`}
          width="100%"
          role="img"
          aria-label={t("charts.eotTitle")}
          style={svgStyle}
          {...handlers}
        >
          <EotPlot model={model} width={width} locale={locale} />
          <Cursor
            xs={xsTime}
            day={dayC}
            top={EOT_M.t}
            bottom={EOT_H - EOT_M.b}
          />
        </svg>
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}
      >
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? t("charts.pause") : t("charts.play")}
          title={playing ? t("charts.pause") : t("charts.play")}
          style={{ minWidth: 44, minHeight: 36, fontSize: 16 }}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <input
          type="range"
          min={-HALF}
          max={HALF}
          step={0.1}
          value={dayC}
          onChange={(e) => setDay(clamp(Number(e.target.value), -HALF, HALF))}
          aria-label={t("charts.daySlider")}
          style={{ flex: 1, minWidth: 0 }}
        />
        <output style={{ minWidth: 72, textAlign: "right", fontSize: 12 }}>
          {cursorLabel}
        </output>
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 11, opacity: 0.7 }}>
        {t("charts.equatorNote")}
      </p>
    </section>
  );
}

function Legend({ n }: { n: number }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        fontSize: 11,
        margin: "0 0 2px",
        flexWrap: "wrap",
      }}
    >
      {SET_NAMES.slice(0, n).map((name, i) => (
        <span
          key={name}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <svg width={26} height={8} aria-hidden="true">
            <line
              x1={0}
              x2={26}
              y1={4}
              y2={4}
              stroke={SET_COLORS[i]}
              strokeWidth={2}
              strokeDasharray={dashOf(i, "main")}
            />
          </svg>
          {t("charts.setLabel", { name })}
        </span>
      ))}
    </div>
  );
}
