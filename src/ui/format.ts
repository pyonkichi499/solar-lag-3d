// 数値の整形（符号付き小数と h:mm:ss）
const MINUS = "−";

/** 符号付きの小数。0 に丸まる値は符号なし。負は U+2212 */
export function formatSigned(value: number, digits = 1): string {
  const s = Math.abs(value).toFixed(digits);
  if (Number(s) === 0) return s;
  return `${value < 0 ? MINUS : "+"}${s}`;
}

/** 時間 [h] を h:mm:ss に整形（秒で丸める） */
export function formatHms(hours: number): string {
  const total = Math.round(hours * 3600);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
