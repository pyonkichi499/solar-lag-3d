// 導入の説明：何を見るツールかを 2 行で示し、仕組みの解説へ案内する
import { useTranslation } from "react-i18next";

export const GUIDE_URL =
  "https://github.com/pyonkichi499/solar-lag-3d/blob/main/docs/guide.md";

export function Intro() {
  const { t } = useTranslation();
  return (
    <p className="intro">
      {t("introText")}{" "}
      <a href={GUIDE_URL} target="_blank" rel="noreferrer">
        {t("introGuide")}
      </a>
    </p>
  );
}
