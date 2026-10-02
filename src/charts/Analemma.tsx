// アナレンマ（毎日同じ時刻の太陽の位置）のパネル。縦は赤緯、横は均時差。
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useYearResults } from "../store/derived";
import { useStore } from "../store/store";
import { SET_COLORS, SET_NAMES } from "../theme";
import { analemmaBounds, analemmaCursor, analemmaModel } from "./analemma";

const W = 320;
const H = 300;
const M = { l: 42, r: 14, t: 14, b: 38 };

// 縦と横の縮尺は別々に決める（実際の太陽の位置は縦長で細いため、横を引き伸ばして読みやすくする）
export function Analemma() {
  const { t: typedT } = useTranslation();
  const t = typedT as unknown as (key: string) => string;
  const sets = useStore((s) => s.sets);
  const day = useStore((s) => s.day);
  const results = useYearResults();

  const models = useMemo(() => sets.map((p) => analemmaModel(p)), [sets]);
  const bounds = useMemo(() => analemmaBounds(models), [models]);

  const xs = scaleLinear()
    .domain([bounds.xMin, bounds.xMax])
    .range([M.l, W - M.r]);
  const ys = scaleLinear()
    .domain([bounds.yMin, bounds.yMax])
    .range([H - M.b, M.t]);
  const path = line<{ x: number; y: number }>()
    .x((q) => xs(q.x))
    .y((q) => ys(q.y));
  // 横軸の目盛りは時間（分）で表す。15° = 1 時間
  const xTicks = scaleLinear()
    .domain([bounds.xMin * 4, bounds.xMax * 4])
    .ticks(5);
  const yTicks = ys.ticks(6);

  return (
    <div className="panel analemma">
      <h2>{t("charts.analemmaTitle")}</h2>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t("charts.analemmaTitle")}
        className="analemma-svg"
      >
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line
              x1={M.l}
              x2={W - M.r}
              y1={ys(v)}
              y2={ys(v)}
              stroke="currentColor"
              strokeOpacity={v === 0 ? 0.35 : 0.12}
            />
            <text
              x={M.l - 5}
              y={ys(v)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="currentColor"
            >
              {v}°
            </text>
          </g>
        ))}
        {xTicks.map((v) => (
          <g key={`x${v}`}>
            <line
              x1={xs(v / 4)}
              x2={xs(v / 4)}
              y1={M.t}
              y2={H - M.b}
              stroke="currentColor"
              strokeOpacity={v === 0 ? 0.35 : 0.12}
            />
            <text
              x={xs(v / 4)}
              y={H - M.b + 13}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
            >
              {v}
            </text>
          </g>
        ))}
        <text
          x={(M.l + W - M.r) / 2}
          y={H - 5}
          textAnchor="middle"
          fontSize={10.5}
          fill="currentColor"
        >
          {t("charts.analemmaX")}
        </text>
        <text
          x={11}
          y={(M.t + H - M.b) / 2}
          textAnchor="middle"
          fontSize={10.5}
          fill="currentColor"
          transform={`rotate(-90 11 ${(M.t + H - M.b) / 2})`}
        >
          {t("charts.analemmaY")}
        </text>

        {models.map((m, i) => {
          const params = sets[i];
          if (!params) return null;
          const color = SET_COLORS[i] ?? SET_COLORS[0];
          const cursor = analemmaCursor(
            params,
            results[i]?.summerSolstice ?? 0,
            day,
          );
          return (
            <g key={SET_NAMES[i]}>
              <path
                d={path(m.curve) ?? ""}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeDasharray={i === 1 ? "6 3" : undefined}
              />
              {m.marks.map((k) => (
                <g key={k.lambda}>
                  <circle cx={xs(k.x)} cy={ys(k.y)} r={2.5} fill={color} />
                  {i === 0 && (
                    <text
                      x={xs(k.x)}
                      y={ys(k.y)}
                      dx={5}
                      dy={-4}
                      fontSize={9.5}
                      fill="currentColor"
                    >
                      λ={k.lambda}°
                    </text>
                  )}
                </g>
              ))}
              <circle
                cx={xs(cursor.x)}
                cy={ys(cursor.y)}
                r={5.5}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
              />
            </g>
          );
        })}
      </svg>
      <p className="note">{t("charts.analemmaNote")}</p>
    </div>
  );
}
