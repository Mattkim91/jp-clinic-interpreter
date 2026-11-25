/** Patient languages the app can interpret into (the therapist always speaks Korean). */
export type PatientLang = "ja" | "en" | "ar";

export type LangInfo = {
  /** Korean name; every name ends in 어, so 로/가/를 can follow directly. */
  name: string;
  flag: string;
  /** BCP-47 tag for speech recognition and text-to-speech. */
  tag: string;
  dir: "ltr" | "rtl";
  /** Patient-facing button text in two-way mode. */
  patientButton: string;
  listening: string;
  /** Patient-facing line on the empty two-way screen. */
  invite: string;
  /** Spoken when testing the voice in settings. */
  sample: string;
};

export const LANGS: Record<PatientLang, LangInfo> = {
  ja: {
    name: "일본어",
    flag: "🇯🇵",
    tag: "ja-JP",
    dir: "ltr",
    patientButton: "患者さん 話す",
    listening: "聞いています",
    invite: "日本語で話すときは「患者さん」ボタンを押してください",
    sample: "こんにちは。お尻を上げてください。",
  },
  en: {
    name: "영어",
    flag: "🇺🇸",
    tag: "en-US",
    dir: "ltr",
    patientButton: "Patient speaks",
    listening: "Listening",
    invite: "Press “Patient speaks” to talk in English",
    sample: "Hello. Please lift your hips.",
  },
  ar: {
    name: "아랍어",
    flag: "🇸🇦",
    tag: "ar-SA",
    dir: "rtl",
    patientButton: "التحدث بالعربية",
    listening: "جارٍ الاستماع",
    invite: "للتحدث بالعربية، يُرجى الضغط على زر «التحدث بالعربية»",
    sample: "مرحبًا. الرجاء رفع الوركين.",
  },
};

export const LANG_ORDER: PatientLang[] = ["ja", "en", "ar"];

const LANG_KEY = "clinic-lang";

export function isPatientLang(value: unknown): value is PatientLang {
  return value === "ja" || value === "en" || value === "ar";
}

/** Saved patient language; Japanese unless the therapist picked another. */
export function loadPatientLang(): PatientLang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    return isPatientLang(saved) ? saved : "ja";
  } catch {
    return "ja";
  }
}

export function savePatientLang(lang: PatientLang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage blocked */
  }
}
