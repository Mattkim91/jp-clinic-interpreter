import { detectPlatform } from "./platform";

let unlocked = false;
let resumeHack = 0;

function japaneseVoices(): SpeechSynthesisVoice[] {
  const synth = window.speechSynthesis;
  if (!synth) return [];
  return synth.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("ja"));
}

export function pickJapaneseVoice(): SpeechSynthesisVoice | null {
  const voices = japaneseVoices();
  const preferred = [/Google 日本語/, /Kyoko/, /O-ren/, /Otoya/, /Hattori/, /Google/];
  for (const pattern of preferred) {
    const found = voices.find((voice) => pattern.test(voice.name));
    if (found) return found;
  }
  return voices[0] ?? null;
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
  utterance.pitch = 1;
  const voice = pickJapaneseVoice();
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
