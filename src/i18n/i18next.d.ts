// t() のキーを型チェックする
import "i18next";
import type { Translation } from "./index";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: Translation };
  }
}
