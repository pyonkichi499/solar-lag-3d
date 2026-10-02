// scene の文言（horizon の視点・en）。キーは "scene.<キー>" で参照する
const messages: Record<string, string> = {
  horizonNorth: "N",
  horizonEast: "E",
  horizonSouth: "S",
  horizonWest: "W",
  horizonTitle: "The Sun as seen from the ground",
  horizonLmt: "Local mean time",
  horizonAltitude: "Altitude",
  horizonAzimuth: "Azimuth",
  horizonSunrise: "Sunrise",
  horizonSunset: "Sunset",
  horizonDayLength: "Day length",
  horizonPolarDay: "Polar day (the Sun does not set)",
  horizonPolarNight: "Polar night (the Sun does not rise)",
  horizonH0: "Altitude h₀ line",
  horizonAnalemma: "Show analemma (the Sun at the same time every day)",
  horizonSun: "Sun",
  horizonHint:
    "Drag to look around ・ The arc is today's 24 hours; white dots are the Sun at this time of day over a year",
};
export default messages;
