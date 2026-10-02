// scene の文言（horizon の視点・ja）。キーは "scene.<キー>" で参照する
const messages: Record<string, string> = {
  horizonNorth: "北",
  horizonEast: "東",
  horizonSouth: "南",
  horizonWest: "西",
  horizonTitle: "地表の観測者から見た太陽",
  horizonLmt: "地方平均時",
  horizonAltitude: "高度",
  horizonAzimuth: "方位",
  horizonSunrise: "日の出",
  horizonSunset: "日没",
  horizonDayLength: "昼の長さ",
  horizonPolarDay: "白夜（太陽が沈みません）",
  horizonPolarNight: "極夜（太陽が昇りません）",
  horizonH0: "高度 h₀ の線",
  horizonAnalemma: "アナレンマ（毎日同じ時刻の太陽）を表示",
  horizonSun: "太陽",
  horizonHint:
    "ドラッグで見回す ・ 太陽の通り道は今日の 24 時間分、白い点は 1 年分の同時刻の太陽",
};
export default messages;
