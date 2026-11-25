import { detectPlatform } from "./platform";

let unlocked = false;
let resumeHack = 0;

export function japaneseVoices(): SpeechSynthesisVoice[] {
  const synth = window.speechSynthesis;
  if (!synth) return [];
  return synth.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("ja"));
}

export type VoiceGender = "female" | "male";
const GENDER_KEY = "chiryo.voiceGender";

const FEMALE = [/Kyoko/i, /O-?ren/i, /Google 日本語/, /Haruka/i, /Ayumi/i, /Nanami/i, /Mizuki/i, /Sayaka/i, /x-htm/i, /x-jab/i, /SMTf/i, /female/i, /女性/];
const MALE = [/Otoya/i, /Hattori/i, /Ichiro/i, /Keita/i, /Takumi/i, /Daichi/i, /Naoki/i, /x-jac/i, /x-jad/i, /SMTm/i, /\bmale/i, /男性/];

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

function prefKey(gender: VoiceGender, what: "voice" | "pitch"): string {
  return `chiryo.${what}.${gender}`;
}

/** Voice name the user picked for this gender ("" = automatic). */
export function getChosenVoice(gender: VoiceGender): string {
  try {
    return localStorage.getItem(prefKey(gender, "voice")) ?? "";
  } catch {
    return "";
  }
}

export function setChosenVoice(gender: VoiceGender, name: string): void {
  try {
    localStorage.setItem(prefKey(gender, "voice"), name);
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
export function resolveVoice(gender: VoiceGender = getVoiceGender()): { voice: SpeechSynthesisVoice | null; pitch: number; exact: boolean } {
  const chosenName = getChosenVoice(gender);
  const chosen = chosenName ? japaneseVoices().find((voice) => voice.name === chosenName) ?? null : null;
  const picked = chosen ? { voice: chosen, exact: true } : pickJapaneseVoice(gender);
  const userPitch = getChosenPitch(gender);
  const pitch = userPitch ?? (picked.exact ? 1 : gender === "male" ? 0.6 : 1.25);
  return { ...picked, pitch };
}

/** Pick a Japanese voice of the wanted gender; `exact` is false when we had to fall back to another voice. */
export function pickJapaneseVoice(gender: VoiceGender = getVoiceGender()): { voice: SpeechSynthesisVoice | null; exact: boolean } {
  const voices = japaneseVoices();
  const wanted = gender === "male" ? matchFirst(voices, MALE, FEMALE) : matchFirst(voices, FEMALE, MALE);
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

export function primeVoices(): void {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const pull = () => synth.getVoices();
  pull();
  synth.addEventListener("voiceschanged", pull);
  let tries = 0;
  const timer = window.setInterval(() => {
    pull();
    if (japaneseVoices().length || ++tries > 24) window.clearInterval(timer);
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

export function speakJapanese(text: string): boolean {
  const synth = window.speechSynthesis;
  if (!synth || !text.trim()) return false;
  unlocked = true;
  if (synth.paused) synth.resume();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.82;
  const gender = getVoiceGender();
  const { voice, pitch } = resolveVoice(gender);
  utterance.pitch = pitch;
  if (voice) utterance.voice = voice;
  if (synth.speaking) synth.cancel();
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
