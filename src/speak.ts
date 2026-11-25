import type { PatientLang } from "./lang";
import { detectPlatform } from "./platform";
import { recognitionLang, type SpeechLang } from "./speech";

let unlocked = false;
let resumeHack = 0;

const VOICE_LANG: Record<PatientLang, RegExp> = {
  ja: /^ja/i,
  en: /^(en|eng)([-_]|$)/i,
  ar: /^(ar|ara)([-_]|$)/i,
};

export function voicesFor(lang: PatientLang): SpeechSynthesisVoice[] {
  const synth = window.speechSynthesis;
  if (!synth) return [];
  const list = synth.getVoices().filter((voice) => VOICE_LANG[lang].test(voice.lang));
  if (lang !== "en") return list;
  // Many English accents: list American ones first.
  const us = (voice: SpeechSynthesisVoice) => (/^(en|eng)[-_]us/i.test(voice.lang) ? 0 : 1);
  return list.sort((a, b) => us(a) - us(b));
}

export type VoiceGender = "female" | "male";
const GENDER_KEY = "chiryo.voiceGender";

const FEMALE_JA = [/Kyoko/i, /O-?ren/i, /Google 日本語/, /Haruka/i, /Ayumi/i, /Nanami/i, /Mizuki/i, /Sayaka/i, /x-htm/i, /x-jab/i, /SMTf/i, /female/i, /女性/];
const MALE_JA = [/Otoya/i, /Hattori/i, /Ichiro/i, /Keita/i, /Takumi/i, /Daichi/i, /Naoki/i, /x-jac/i, /x-jad/i, /SMTm/i, /\bmale/i, /男性/];

const FEMALE: Record<PatientLang, RegExp[]> = {
  ja: FEMALE_JA,
  en: [/Samantha/i, /\bAva\b/i, /Allison/i, /Susan/i, /\bZoe\b/i, /Nicky/i, /Joelle/i, /Google US English/i, /Aria/i, /Jenny/i, /Zira/i, /Karen/i, /Moira/i, /Tessa/i, /SMTf/i, /female/i],
  ar: [/Mariam/i, /Laila/i, /Hoda/i, /Salma/i, /Zariyah/i, /SMTf/i, /female/i],
};
const MALE: Record<PatientLang, RegExp[]> = {
  ja: MALE_JA,
  en: [/\bEvan\b/i, /Nathan/i, /\bAaron\b/i, /\bTom\b/i, /\bAlex\b/i, /Daniel/i, /\bDavid\b/i, /\bMark\b/i, /\bGuy\b/i, /Arthur/i, /Gordon/i, /Rishi/i, /SMTm/i, /\bmale/i],
  ar: [/Majed/i, /Maged/i, /Tari[kq]/i, /Naayf/i, /Shakir/i, /Hamed/i, /SMTm/i, /\bmale/i],
};

export function getVoiceGender(): VoiceGender {
  try {
    return localStorage.getItem(GENDER_KEY) === "male" ? "male" : "female";
  } catch {
    return "female";
  }
}

export function setVoiceGender(gender: VoiceGender): void {
  try {
    localStorage.setItem(GENDER_KEY, gender);
  } catch {
    /* storage blocked */
  }
}

function matchFirst(voices: SpeechSynthesisVoice[], patterns: RegExp[], avoid: RegExp[]): SpeechSynthesisVoice | null {
  for (const pattern of patterns) {
    const found = voices.find((voice) => pattern.test(voice.name) && !avoid.some((a) => a.test(voice.name)));
    if (found) return found;
  }
  return null;
}

/** Japanese keeps its original key; other languages get their own. */
function prefKey(gender: VoiceGender, what: "voice" | "pitch", lang: PatientLang = "ja"): string {
  return lang === "ja" ? `chiryo.${what}.${gender}` : `chiryo.${what}.${lang}.${gender}`;
}

/** Voice name the user picked for this gender ("" = automatic). */
export function getChosenVoice(gender: VoiceGender, lang: PatientLang = "ja"): string {
  try {
    return localStorage.getItem(prefKey(gender, "voice", lang)) ?? "";
  } catch {
    return "";
  }
}

export function setChosenVoice(gender: VoiceGender, name: string, lang: PatientLang = "ja"): void {
  try {
    localStorage.setItem(prefKey(gender, "voice", lang), name);
  } catch {
    /* storage blocked */
  }
}

/** Pitch the user set for this gender, or null when untouched. */
export function getChosenPitch(gender: VoiceGender): number | null {
  try {
    const raw = localStorage.getItem(prefKey(gender, "pitch"));
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function setChosenPitch(gender: VoiceGender, pitch: number): void {
  try {
    localStorage.setItem(prefKey(gender, "pitch"), String(pitch));
  } catch {
    /* storage blocked */
  }
}

/** Voice + pitch actually used for the current gender setting. */
export function resolveVoice(gender: VoiceGender = getVoiceGender(), lang: PatientLang = "ja"): { voice: SpeechSynthesisVoice | null; pitch: number; exact: boolean } {
  const chosenName = getChosenVoice(gender, lang);
  const chosen = chosenName ? voicesFor(lang).find((voice) => voice.name === chosenName) ?? null : null;
  const picked = chosen ? { voice: chosen, exact: true } : pickVoice(gender, lang);
  const pitch = (picked.exact ? 1 : gender === "male" ? 0.6 : 1.25);
  return { ...picked, pitch };
}

/** Pick a voice of the wanted gender; `exact` is false when we had to fall back to another voice. */
export function pickVoice(gender: VoiceGender = getVoiceGender(), lang: PatientLang = "ja"): { voice: SpeechSynthesisVoice | null; exact: boolean } {
  const voices = voicesFor(lang);
  const wanted =
    gender === "male" ? matchFirst(voices, MALE[lang], FEMALE[lang]) : matchFirst(voices, FEMALE[lang], MALE[lang]);
  if (wanted) return { voice: wanted, exact: true };
  // No clearly-named voice: leave the voice unset so the phone's own default
  // (e.g. Samsung TTS "음성 1") speaks. Most default Japanese voices are female.
  if (gender === "female") return { voice: null, exact: true };
  return { voice: voices[0] ?? null, exact: false };
}

// v1.8: earlier builds could save a voice/pitch that forced the male voice; reset once.
try {
  if (!localStorage.getItem("chiryo.voiceReset18")) {
    for (const g of ["female", "male"]) {
      localStorage.removeItem(`chiryo.voice.${g}`);
      localStorage.removeItem(`chiryo.pitch.${g}`);
    }
    localStorage.setItem("chiryo.voiceReset18", "1");
  }
} catch {
  /* storage blocked */
}

const RATE_KEY = "chiryo.rate2";
export const DEFAULT_RATE = 1;

export function getSpeechRate(): number {
  try {
    const raw = localStorage.getItem(RATE_KEY);
    const value = Number(raw);
    return raw !== null && Number.isFinite(value) && value > 0 ? value : DEFAULT_RATE;
  } catch {
    return DEFAULT_RATE;
  }
}

export function setSpeechRate(rate: number): void {
  try {
    localStorage.setItem(RATE_KEY, String(rate));
  } catch {
    /* storage blocked */
  }
}

export function primeVoices(): void {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const pull = () => synth.getVoices();
  pull();
  synth.addEventListener("voiceschanged", pull);
  let tries = 0;
  const timer = window.setInterval(() => {
    pull();
    if (voicesFor("ja").length || ++tries > 24) window.clearInterval(timer);
  }, 250);
}

/** Call from a tap that is not itself about to speak, so later auto-speak is allowed on iOS. */
export function unlockSpeech(): void {
  const synth = window.speechSynthesis;
  if (!synth || unlocked) return;
  unlocked = true;
  const primer = new SpeechSynthesisUtterance("\u200b");
  primer.volume = 0;
  primer.lang = "ja-JP";
  primer.rate = 1;
  synth.speak(primer);
}

/** True when the phone lists voices but none for this language (sound may not come out). */
export function voiceMissing(lang: SpeechLang): boolean {
  const all = window.speechSynthesis?.getVoices() ?? [];
  if (lang === "ko") return all.length > 0 && !all.some((voice) => /^(ko|kor)([-_]|$)/i.test(voice.lang));
  return all.length > 0 && voicesFor(lang).length === 0;
}

/** Speeches asked for and not finished yet. Holding the utterance also keeps Chrome from dropping its end event. */
const active = new Map<SpeechSynthesisUtterance, () => void>();

function finishAll(): void {
  for (const done of [...active.values()]) done();
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
  finishAll();
}

/** Call `onDone` once: at the end event, when the phone went quiet without one, or at a time limit. */
function trackEnd(utterance: SpeechSynthesisUtterance, onDone: () => void): void {
  const synth = window.speechSynthesis;
  const started = Date.now();
  const limit = 6000 + (utterance.text.length * 350) / utterance.rate;
  let timer = 0;
  const done = () => {
    if (!active.delete(utterance)) return;
    window.clearInterval(timer);
    onDone();
  };
  active.set(utterance, done);
  utterance.onend = done;
  utterance.onerror = done;
  timer = window.setInterval(() => {
    const waited = Date.now() - started;
    if (waited > limit * active.size || (waited > 1500 && !synth.speaking && !synth.pending)) done();
  }, 250);
}

/** Read aloud. Normally replaces what is being read; `queue` waits for it instead. */
export function speakText(text: string, lang: SpeechLang, options: { queue?: boolean; onDone?: () => void } = {}): boolean {
  const synth = window.speechSynthesis;
  if (!synth || !text.trim()) return false;
  unlocked = true;
  if (synth.paused) synth.resume();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = recognitionLang(lang);
  utterance.rate = getSpeechRate();
  // Korean is for the therapist: the phone's own default voice.
  if (lang !== "ko") {
    const { voice, pitch } = resolveVoice(getVoiceGender(), lang);
    utterance.pitch = pitch;
    if (voice) utterance.voice = voice;
  }
  if (!options.queue) {
    if (synth.speaking) synth.cancel();
    finishAll();
  }
  trackEnd(utterance, options.onDone ?? (() => {}));
  synth.speak(utterance);

  const ios =
    detectPlatform(navigator.userAgent, {
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    }).kind === "ios";
  if (ios) {
    window.clearInterval(resumeHack);
    resumeHack = window.setInterval(() => {
      if (!synth.speaking) {
        window.clearInterval(resumeHack);
        return;
      }
      synth.pause();
      synth.resume();
    }, 8000);
  }
  return true;
}

export function canSpeak(): boolean {
  return "speechSynthesis" in window;
}
