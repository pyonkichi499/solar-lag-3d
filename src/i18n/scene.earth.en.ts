// scene の文言（earth の視点・en）。キーは "scene.<キー>" で参照する
const messages: Record<string, string> = {
  earthAxis: "Axis",
  earthObserver: "Observer",
  earthSun: "Direction of the Sun",
  earthTerminator: "Terminator",
  earthDayLength: "Day length at latitude {{phi}}°",
  earthDeclination: "Solar declination",
  earthDaySide: "Day",
  earthNightSide: "Night",
  earthNotToScale:
    "Sizes and the distance to the Sun are not to scale (Sun direction and axial tilt are accurate)",
  earthHint:
    "Orange line: day/night boundary; band: observer's latitude circle. Drag to rotate, scroll to zoom",
};
export default messages;
