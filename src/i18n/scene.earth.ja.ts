// scene の文言（earth の視点・ja）。キーは "scene.<キー>" で参照する
const messages: Record<string, string> = {
  earthAxis: "地軸",
  earthObserver: "観測者",
  earthSun: "太陽の向き",
  earthTerminator: "昼夜の境界",
  earthDayLength: "緯度 {{phi}}° の昼の長さ",
  earthDeclination: "太陽の赤緯",
  earthDaySide: "昼",
  earthNightSide: "夜",
  earthNotToScale:
    "大きさと太陽までの距離は実寸ではありません（太陽の向きと地軸の傾きは正確）",
  earthHint:
    "橙の線が昼夜の境界、帯が観測者の緯度円。ドラッグで回転、ホイールで拡大縮小",
};
export default messages;
