import { arabicLatinToHangul } from "./arabic";
import { createAutoMic, type AutoMic } from "./automic";
import { romajiToHangul } from "./hangul";
import { LANG_ORDER, LANGS, isPatientLang, loadPatientLang, savePatientLang, type PatientLang } from "./lang";
import { fixedPhrase } from "./phrases";
import { detectPlatform, type PlatformInfo } from "./platform";
import { politify } from "./polite";
import { PRESET_GROUPS, PRESETS, prepare, rewriteQuery } from "./prepare";
import { hangulFromTokens } from "./reading";
import { canSpeak, getChosenVoice, getSpeechRate, setSpeechRate, getVoiceGender, primeVoices, resolveVoice, setChosenVoice, setVoiceGender, speakText, stopSpeaking, unlockSpeech, voiceMissing, voicesFor, type VoiceGender } from "./speak";
import { createListener, type Listener, type ListenState, type SpeechLang } from "./speech";
import { fetchArabicLatin, fetchJaRomaji, translateFromKo, translateToKo } from "./translate";
import { getGeminiKey, interpretAudio, setGeminiKey, translateToKoWithGemini, translateToWithGemini, translateWithGemini } from "./gemini";
import { loadTokenizer, type Tokenizer } from "./tokenizer";
import { isEcho, type Turn } from "./turns";
import { createWake, type WakeMode } from "./wake";

type Card = {
  id: number;
  /** "therapist": Korean → patient language (default). "patient": patient language → Korean. */
  speaker: "therapist" | "patient";
  /** Patient language this card was made in (kept when the setting changes later). */
  lang: PatientLang;
  ko: string;
  /** The patient-language side. */
  text: string;
  reading: string;
  status: "loading" | "ready" | "error";
  error: string;
};

const platform: PlatformInfo = detectPlatform(navigator.userAgent, {
  platform: navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints,
});

let cards: Card[] = [];
let nextId = 1;
let listening: ListenState = "idle";
let interim = "";
let wakeMode: WakeMode | "off" = "off";
let tokenizer: Tokenizer | null = null;
let dictError = "";
let clearArmed = false;
let autoSpeak = localStorage.getItem("clinic-autospeak") === "1";
/** "auto": open microphone, Gemini tells the languages apart and everything is read aloud. */
type Mode = "one" | "two" | "auto";
const MODE_KEY = "clinic-mode";
function loadMode(): Mode {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    return saved === "two" || saved === "auto" ? saved : "one";
  } catch {
    return "one";
  }
}
let mode: Mode = loadMode();
let patientLang: PatientLang = loadPatientLang();
/** Language the recognizer is (or was last) listening in. */
let hearLang: SpeechLang = "ko";

let listener: Listener | null = null;
let autoMic: AutoMic | null = null;
/** Auto mode microphone is open. */
let autoOn = false;
let autoHeard = false;
let autoSince = 0;
/** Recordings being interpreted right now. */
let autoBusy = 0;
let autoError = "";
/** Recently read lines, so the phone does not interpret its own voice. */
let spokenLately: { text: string; at: number }[] = [];

/** What is being read aloud right now. */
const aloud: { lang: SpeechLang }[] = [];

/** Would the mic turn this speech into a card? (Korean is only ever read to the therapist.) */
function micWouldHear(spoken: SpeechLang, mic: SpeechLang): boolean {
  return spoken === "ko" || spoken === mic;
}

/** Read aloud, with the mic closed meanwhile when it would otherwise hear the phone and answer itself. */
function readAloud(text: string, lang: SpeechLang, queue = false): void {
  if (autoOn) {
    autoMic?.pause();
    const now = Date.now();
    spokenLately = [...spokenLately.filter((item) => now - item.at < 20000), { text, at: now }];
  } else if (micWouldHear(lang, hearLang)) listener?.hold();
  const entry = { lang };
  const spoke = speakText(text, lang, {
    queue,
    onDone: () => {
      aloud.splice(aloud.indexOf(entry), 1);
      // A short tail so the last syllable is not heard.
      window.setTimeout(() => {
        if (!aloud.length) autoMic?.resume();
        if (mode === "auto") renderChrome();
        if (!aloud.some((item) => micWouldHear(item.lang, hearLang))) listener?.release();
      }, autoOn ? 500 : 300);
    },
  });
  if (spoke) aloud.push(entry);
  else {
    listener?.release();
    if (!aloud.length) autoMic?.resume();
  }
}

/** Lines waiting to be read: never talk (and close the mic) over someone still speaking. */
let waiting: { text: string; lang: SpeechLang }[] = [];
let interimAt = 0;
let waitTimer = 0;
const INTERIM_STALE = 6000;

function drainWaiting(): void {
  window.clearTimeout(waitTimer);
  if (!waiting.length) return;
  const talking = autoOn
    ? autoHeard && Date.now() - autoSince < INTERIM_STALE
    : interim && hearLang !== "ko" && Date.now() - interimAt < INTERIM_STALE;
  if (talking) {
    waitTimer = window.setTimeout(drainWaiting, 300);
    return;
  }
  const lines = waiting;
  waiting = [];
  for (const line of lines) readAloud(line.text, line.lang, true);
}

/** "끝나면 읽어 주기": always on in auto mode. */
function autoRead(text: string, lang: SpeechLang): void {
  if (!autoSpeak && mode !== "auto") return;
  if (mode !== "auto" && lang !== "ko") {
    readAloud(text, lang);
    return;
  }
  waiting.push({ text, lang });
  drainWaiting();
}

let dictPromise: Promise<void> | null = null;
/** Japanese reading dictionary (18MB): only fetched once Japanese is used. */
function loadDict(): Promise<void> {
  dictPromise ??= loadTokenizer(`${import.meta.env.BASE_URL}kuromoji-dict`)
    .then((built) => {
      tokenizer = built;
    })
    .catch(() => {
      dictError = "발음 사전을 받지 못했습니다. 로마자 발음으로 대신합니다.";
    })
    .finally(() => {
      if (document.getElementById("status")) renderChrome();
    });
  return dictPromise;
}
if (patientLang === "ja") void loadDict();

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[ch];
  });
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/429|503|빈 번역|바쁘/.test(message)) return "번역 서버가 잠시 바쁩니다. 다시 번역을 눌러 주세요.";
  if (/fetch|network|Failed|연결/i.test(message)) return "네트워크에 연결하지 못했습니다. 확인 후 다시 번역해 주세요.";
  return "번역에 실패했습니다. 다시 번역을 눌러 주세요.";
}

async function readingFor(ja: string): Promise<string> {
  await loadDict();
  if (tokenizer) {
    const hangul = hangulFromTokens(tokenizer.tokenize(ja));
    if (hangul) return hangul;
  }
  const romaji = await fetchJaRomaji(ja);
  const hangul = romajiToHangul(romaji);
  if (!hangul) throw new Error("발음을 만들지 못했습니다");
  return hangul;
}

/** A translation that already came with the recording (auto mode). */
type Given = { text: string; reading: string };

async function fillPatient(card: Card, given?: Given): Promise<void> {
  try {
    let ko = given?.text ?? "";
    if (!ko && getGeminiKey()) {
      try {
        ko = await translateToKoWithGemini(card.text, card.lang);
      } catch {
        ko = "";
      }
    }
    if (!ko) ko = await translateToKo(card.text, card.lang);
    card.ko = ko;
    card.status = "ready";
    card.error = "";
    autoRead(ko, "ko");
  } catch (error) {
    card.status = "error";
    card.error = friendlyError(error);
  }
  render();
  scrollLog();
}

function submitPatient(spoken: string, lang: PatientLang = patientLang, given?: Given): void {
  const text = spoken.replace(/\s+/g, " ").trim();
  if (!text) return;
  const card: Card = { id: nextId++, speaker: "patient", lang, ko: "", text, reading: "", status: "loading", error: "" };
  cards.push(card);
  render();
  scrollLog();
  void fillPatient(card, given);
}

/** Korean → English/Arabic: fixed phrase, then Gemini, then Google. The reading may follow later. */
async function fillOther(card: Card, lang: "en" | "ar", given?: Given): Promise<void> {
  try {
    const known = fixedPhrase(card.ko, lang) ?? given;
    let text = known?.text ?? "";
    let reading = known?.reading ?? "";
    if (!text && getGeminiKey()) {
      try {
        ({ text, reading } = await translateToWithGemini(card.ko, lang));
      } catch {
        text = "";
      }
    }
    if (!text) text = await translateFromKo(rewriteQuery(card.ko), lang);
    card.text = text;
    card.reading = reading;
    card.status = "ready";
    card.error = "";
    autoRead(text, lang);
  } catch (error) {
    card.status = "error";
    card.error = friendlyError(error);
  }
  render();
  scrollLog();
  if (card.status !== "ready" || card.reading || lang !== "ar") return;
  try {
    const reading = arabicLatinToHangul(await fetchArabicLatin(card.text));
    if (!reading) return;
    card.reading = reading;
    const line = document.querySelector<HTMLElement>(`[data-card="${card.id}"] .reading`);
    if (line) line.textContent = reading;
  } catch {
    /* the translation is still usable without a reading */
  }
}

async function fill(card: Card, given?: Given): Promise<void> {
  if (card.speaker === "patient") return fillPatient(card, given);
  if (card.lang !== "ja") return fillOther(card, card.lang, given);
  try {
    const prepared = prepare(card.ko);
    let translated = prepared.overrideJa ?? given?.text ?? "";
    if (!translated && getGeminiKey()) {
      try {
        translated = await translateWithGemini(card.ko);
      } catch {
        translated = "";
      }
    }
    if (!translated) translated = await translateFromKo(prepared.query, "ja");
    const ja = prepared.overrideJa ? translated : politify(translated, card.ko);
    const reading = await readingFor(ja);
    card.text = ja;
    card.reading = reading;
    card.status = "ready";
    card.error = "";
    autoRead(ja, "ja");
  } catch (error) {
    card.status = "error";
    card.error = friendlyError(error);
  }
  render();
  scrollLog();
}

function submit(korean: string, lang: PatientLang = patientLang, given?: Given): void {
  const ko = korean.replace(/\s+/g, " ").trim();
  if (!ko) return;
  const card: Card = { id: nextId++, speaker: "therapist", lang, ko, text: "", reading: "", status: "loading", error: "" };
  cards.push(card);
  render();
  scrollLog();
  void fill(card, given);
}

/** Keeps the cards in spoken order even when a later recording is answered first. */
let turnOrder: Promise<void> = Promise.resolve();

function autoErrorText(error: unknown): string {
  const { status, badKey } = (error ?? {}) as { status?: number; badKey?: boolean };
  if (badKey) return "Gemini 키가 올바르지 않습니다. 설정에서 키를 확인해 주세요.";
  if (status === 429) return "Gemini 사용량 한도에 닿았습니다. 잠시 쉬거나 양방향으로 써 주세요.";
  return "방금 한 말을 통역하지 못했습니다. 다시 말해 주세요.";
}

function hearRecording(wav: string): void {
  const lang = patientLang;
  autoBusy += 1;
  renderChrome();
  const answer = interpretAudio(wav, lang).then(
    (turns): { turns: Turn[]; error: string } => ({ turns, error: "" }),
    (error: unknown) => ({ turns: [], error: autoErrorText(error) }),
  );
  turnOrder = turnOrder.then(async () => {
    const { turns, error } = await answer;
    autoBusy -= 1;
    autoError = error;
    const now = Date.now();
    const spoken = spokenLately.filter((item) => now - item.at < 20000).map((item) => item.text);
    for (const turn of turns) {
      if (isEcho(turn.heard, spoken)) continue;
      const given = { text: turn.translation, reading: turn.reading };
      if (turn.speaker === "ko") submit(turn.heard, lang, given);
      else submitPatient(turn.heard, lang, given);
    }
    renderChrome();
  });
}

function retry(id: number): void {
  const card = cards.find((item) => item.id === id);
  if (!card) return;
  card.status = "loading";
  card.error = "";
  render();
  void fill(card);
}

function speakCard(id: number): void {
  const card = cards.find((item) => item.id === id);
  if (!card || card.status !== "ready") return;
  const patient = card.speaker === "patient";
  const lang: SpeechLang = patient ? "ko" : card.lang;
  const text = patient ? card.ko : card.text;
  if (!text) return;
  const name = patient ? "한국어" : LANGS[card.lang].name;
  if (!canSpeak()) {
    setToast(`이 브라우저는 ${name} 소리 내기를 지원하지 않습니다.`);
    return;
  }
  if (lang !== "ja" && voiceMissing(lang)) {
    setToast(`이 폰에 ${name} 음성이 없어 소리가 안 날 수 있습니다. 폰의 글자 읽어주기 설정에서 받아 주세요.`);
  }
  readAloud(text, lang);
}

function speakButton(id: number, name: string): string {
  return `<button type="button" class="speak" data-speak="${id}" aria-label="${name}로 읽기">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.2L12 18.8V5.2L7.2 9.5H4z" fill="currentColor"/><path d="M15.2 8.2a5 5 0 0 1 0 7.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17.6 5.8a8 8 0 0 1 0 12.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>${name}로 읽기</span>
        </button>`;
}

function scrollLog(): void {
  const log = document.querySelector<HTMLElement>("#log");
  if (!log) return;
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  log.scrollTo({ top: log.scrollHeight, behavior });
}

function langName(lang: SpeechLang): string {
  return lang === "ko" ? "한국어" : `환자 ${LANGS[lang].name}`;
}

function statusText(): string {
  if (mode === "auto" && autoOn) return `자동 통역 중 · 한국어 ↔ ${LANGS[patientLang].name}`;
  if (mode === "auto" && listening === "unsupported") return `대기 · ${LANGS[patientLang].name}`;
  if (listening === "listening") return mode === "two" ? `듣는 중 · ${langName(hearLang)}` : "듣는 중";
  if (listening === "needs-gesture") return "마이크를 다시 눌러 주세요";
  if (listening === "denied") return "마이크 권한이 필요합니다";
  if (listening === "unsupported") return "음성 인식 없음";
  if (patientLang === "ja" && !tokenizer && !dictError) return "발음 사전 받는 중";
  return `대기 · ${LANGS[patientLang].name}`;
}

function hintText(): string {
  if (mode === "auto") {
    if (autoError) return autoError;
    if (!getGeminiKey()) return "자동 모드는 Gemini 키가 필요합니다. 설정에서 넣어 주세요.";
    if (!autoOn) return `한국어와 ${LANGS[patientLang].name}를 알아서 구분해 통역하고 읽어 줍니다.`;
    if (aloud.length) return "읽어 주는 중에는 듣지 않습니다. 끝난 뒤 말해 주세요.";
    return "한 사람씩 말하고 잠깐 쉬면 바로 통역합니다.";
  }
  if (wakeMode === "unsupported" && listening === "listening") {
    return "화면 켜 두기를 지원하지 않습니다. 자동 잠금을 꺼 주세요.";
  }
  if (listening === "listening" && wakeMode === "video") {
    return "화면이 꺼지면 자동 잠금을 꺼 주세요. 문장마다 이어서 듣습니다.";
  }
  if (listening === "listening" && mode === "two") {
    return hearLang !== "ko"
      ? `환자 ${LANGS[hearLang].name}를 듣는 중. 내 차례면 ‘내가 말하기’를 누르세요.`
      : "한국어를 듣는 중. 환자 차례면 환자 버튼을 누르세요.";
  }
  if (listening === "listening") return "문장이 끝나면 바로 번역됩니다. 화면은 켜 둔 상태입니다.";
  if (platform.kind === "ios") return "아이폰은 문장마다 다시 듣습니다. 멈추면 마이크를 다시 누르세요.";
  if (dictError && patientLang === "ja") return dictError;
  if (mode === "two") return "말하는 사람 버튼을 누르세요. 다시 누르면 멈춥니다.";
  return `말하면 ${LANGS[patientLang].name} 카드가 쌓입니다.`;
}

function installLine(): string {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone || cards.length > 0) return "";
  if (platform.kind === "ios") return "Safari의 공유 버튼에서 ‘홈 화면에 추가’하면 전체 화면으로 열립니다.";
  return "브라우저 메뉴에서 홈 화면에 추가하면 치료 중에 전체 화면으로 쓸 수 있습니다.";
}

function renderChrome(): void {
  const status = document.querySelector<HTMLElement>("#status");
  const hint = document.querySelector<HTMLElement>("#hint");
  const interimEl = document.querySelector<HTMLElement>("#interim");
  const interimText = document.querySelector<HTMLElement>("#interim-text");
  const mic = document.querySelector<HTMLButtonElement>("#mic");
  const micLabel = document.querySelector<HTMLElement>("#mic-label");
  const banner = document.querySelector<HTMLElement>("#banner");
  if (!status || !hint || !interimEl || !interimText || !mic || !micLabel || !banner) return;

  status.textContent = statusText();
  hint.textContent = hintText();
  const doing = mode !== "auto" ? interim : autoHeard ? "듣는 중…" : autoBusy ? "통역하는 중…" : "";
  interimText.textContent = doing;
  interimEl.hidden = !doing;
  interimEl.classList.toggle("is-patient", mode === "two" && hearLang !== "ko");
  interimText.dir = hearLang === "ko" ? "ltr" : LANGS[hearLang].dir;
  const interimLang = document.querySelector<HTMLElement>("#interim-lang");
  if (interimLang) {
    interimLang.hidden = mode !== "two";
    interimLang.textContent = hearLang === "ko" ? "🇰🇷 나" : `${LANGS[hearLang].flag} 환자`;
  }

  const live = listening === "listening";
  mic.classList.toggle("is-live", live);
  mic.setAttribute("aria-pressed", live ? "true" : "false");
  micLabel.textContent =
    mode === "auto" ? (live ? "자동 통역 중 · 멈추기" : "자동 통역 시작") : live ? "음성 입력 중 · 멈추기" : "음성 입력 시작";
  const autoLabel = document.querySelector<HTMLElement>("#auto-label");
  if (autoLabel) autoLabel.hidden = mode === "auto";

  const pair = document.querySelector<HTMLElement>("#mic-pair");
  mic.hidden = mode === "two";
  if (pair) pair.hidden = mode !== "two";
  const info = LANGS[patientLang];
  for (const side of ["ko", "patient"] as const) {
    const button = document.querySelector<HTMLButtonElement>(`#mic-${side}`);
    const label = document.querySelector<HTMLElement>(`#mic-${side}-label`);
    if (!button || !label) continue;
    const on = live && (side === "ko") === (hearLang === "ko");
    button.classList.toggle("is-live", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
    if (side === "ko") {
      label.innerHTML = on ? "듣는 중<small>누르면 멈춤</small>" : "내가 말하기";
      continue;
    }
    button.lang = patientLang;
    const flag = document.querySelector<HTMLElement>("#mic-patient-flag");
    if (flag) flag.textContent = info.flag;
    label.innerHTML = on
      ? `<bdi>${info.listening}</bdi><small>(환자 듣는 중 · 누르면 멈춤)</small>`
      : `<bdi>${info.patientButton}</bdi><small>(환자)</small>`;
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("#mode [data-mode]")) {
    const on = button.dataset.mode === mode;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-checked", on ? "true" : "false");
  }

  if (listening === "unsupported" && mode !== "auto") {
    banner.hidden = false;
    banner.textContent =
      "이 브라우저에서는 음성 인식을 쓸 수 없습니다. 안드로이드는 Chrome 또는 삼성 인터넷, 아이폰은 음성 인식이 되는 최신 Safari를 사용해 주세요. 아래 입력창으로 번역할 수 있습니다.";
  } else if (listening === "denied" || listening === "needs-gesture") {
    banner.hidden = false;
    banner.textContent =
      listening === "denied"
        ? "마이크 권한이 없습니다. 주소창의 자물쇠 또는 브라우저 설정에서 마이크를 허용해 주세요."
        : "음성 인식이 멈췄습니다. 마이크 버튼을 다시 눌러 이어 가세요.";
  } else {
    banner.hidden = true;
  }
}

function renderCards(): void {
  const log = document.querySelector<HTMLElement>("#log");
  if (!log) return;
  const info = LANGS[patientLang];
  if (!cards.length) {
    log.innerHTML =
      mode === "auto"
        ? `<div class="empty"><p class="empty-title">자동 통역</p><p><b>자동 통역 시작</b>을 한 번 누르세요. 한국어가 들리면 ${info.name}로, ${info.name}가 들리면 한국어로 바로 읽어 줍니다.</p><p class="empty-note">말소리가 Google Gemini로 전송됩니다. 환자에게 먼저 알려 주세요.${getGeminiKey() ? "" : "<br>Gemini 키가 필요합니다 (설정)."}</p></div>`
        : mode === "two"
        ? `<div class="empty"><p class="empty-title">양방향 통역</p><p>내가 말할 때는 <b>🇰🇷 내가 말하기</b>, 환자가 말할 때는 <b>${info.flag} <bdi>${info.patientButton}</bdi></b> 버튼을 누르세요. 환자 말은 한국어로 크게 보여 줍니다.</p><p class="empty-ja" lang="${patientLang}" dir="${info.dir}">${info.invite}</p><p class="empty-note">${escapeHtml(installLine())}</p></div>`
        : `<div class="empty"><p class="empty-title">아직 문장이 없습니다</p><p>마이크를 누르고 환자에게 할 말을 한국어로 하세요. 한 문장이 끝나면 ${info.name}가 큰 글씨로 쌓입니다.</p><p class="empty-note">${escapeHtml(installLine())}</p></div>`;
    return;
  }

  log.innerHTML = cards
    .map((card, index) => {
      const newest = index === cards.length - 1 ? " is-newest" : "";
      const { name, flag, dir } = LANGS[card.lang];
      const src = `<p class="ja-src" lang="${card.lang}" dir="${dir}">${escapeHtml(card.text)}</p>`;
      if (card.speaker === "patient") {
        const label = `<p class="who">${flag} 환자</p>`;
        if (card.status === "loading") {
          return `<article class="card is-patient is-loading${newest}" data-card="${card.id}">${label}<p class="ko-big ja-wait">번역하는 중…</p>${src}</article>`;
        }
        if (card.status === "error") {
          return `<article class="card is-patient is-error${newest}" data-card="${card.id}">${label}<p class="ko-big ja-wait">번역되지 않았습니다</p><p class="error-text">${escapeHtml(card.error)}</p>${src}<button type="button" class="retry" data-retry="${card.id}">다시 번역</button></article>`;
        }
        return `<article class="card is-patient${newest}" data-card="${card.id}">${label}<p class="ko-big">${escapeHtml(card.ko)}</p>${src}${speakButton(card.id, "한국어")}</article>`;
      }
      if (card.status === "loading") {
        return `<article class="card is-loading${newest}" data-card="${card.id}"><p class="ja ja-wait">번역하는 중…</p><p class="ko">${escapeHtml(card.ko)}</p></article>`;
      }
      if (card.status === "error") {
        return `<article class="card is-error${newest}" data-card="${card.id}"><p class="ja ja-wait">번역되지 않았습니다</p><p class="error-text">${escapeHtml(card.error)}</p><p class="ko">${escapeHtml(card.ko)}</p><button type="button" class="retry" data-retry="${card.id}">다시 번역</button></article>`;
      }
      return `<article class="card${newest}" data-card="${card.id}">
        ${speakButton(card.id, name)}
        <p class="ja" lang="${card.lang}" dir="${dir}">${escapeHtml(card.text)}</p>
        <p class="reading">${escapeHtml(card.reading)}</p>
        <p class="ko">${escapeHtml(card.ko)}</p>
      </article>`;
    })
    .join("");
}

function render(): void {
  renderChrome();
  renderCards();
}

function setToast(message: string): void {
  const hint = document.querySelector<HTMLElement>("#hint");
  if (hint) hint.textContent = message;
}

export function startApp(): void {
  primeVoices();
  const video = document.querySelector<HTMLVideoElement>("#nosleep");
  const wake = video ? createWake(video) : null;
  const mic = createListener({
    onFinal: (text, lang) => (lang === "ko" ? submit(text) : submitPatient(text, lang)),
    onInterim: (text) => {
      interim = text;
      interimAt = Date.now();
      renderChrome();
      if (!interim) drainWaiting();
    },
    onState: (state) => {
      listening = state;
      if (state !== "listening") interim = "";
      renderChrome();
    },
    onError: (message) => setToast(message),
    kind: platform.kind,
  });

  listener = mic;
  if (!mic.supported) listening = "unsupported";

  const presetRow = document.querySelector<HTMLElement>("#presets");
  if (presetRow) {
    presetRow.innerHTML = PRESET_GROUPS.map(
      (group) =>
        `<div class="preset-group"><p class="preset-title">${escapeHtml(group)}</p><div class="preset-chips">` +
        PRESETS.filter((preset) => preset.group === group)
          .map((preset) => `<button type="button" class="chip" data-preset="${escapeHtml(preset.ko)}">${escapeHtml(preset.ko)}</button>`)
          .join("") +
        `</div></div>`,
    ).join("");
    presetRow.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-preset]");
      if (!button) return;
      unlockSpeech();
      submit(button.dataset.preset ?? "");
    });
  }

  document.querySelector<HTMLElement>("#log")?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const retryButton = target.closest<HTMLElement>("[data-retry]");
    if (retryButton?.dataset.retry) {
      retry(Number(retryButton.dataset.retry));
      return;
    }
    const speakButton = target.closest<HTMLElement>("[data-speak]");
    const card = target.closest<HTMLElement>("[data-card]");
    const id = speakButton?.dataset.speak ?? card?.dataset.card;
    if (!id) return;
    speakCard(Number(id));
  });

  document.querySelector<HTMLFormElement>("#manual")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector<HTMLInputElement>("#manual-input");
    if (!input) return;
    unlockSpeech();
    submit(input.value);
    input.value = "";
    input.blur();
  });

  const auto = document.querySelector<HTMLInputElement>("#auto-speak");
  if (auto) {
    auto.checked = autoSpeak;
    auto.addEventListener("change", () => {
      autoSpeak = auto.checked;
      if (!autoSpeak) waiting = [];
      localStorage.setItem("clinic-autospeak", autoSpeak ? "1" : "0");
      if (autoSpeak) unlockSpeech();
    });
  }

  autoMic = createAutoMic({
    onSegment: hearRecording,
    onSpeaking: (speaking) => {
      autoHeard = speaking;
      if (speaking) {
        autoSince = Date.now();
        autoError = "";
      }
      renderChrome();
      if (!speaking) drainWaiting();
    },
    onLost: () => {
      autoOn = false;
      autoHeard = false;
      listening = "needs-gesture";
      void wake?.release();
      render();
    },
  });
  const stopAuto = () => {
    autoMic?.stop();
    autoOn = false;
    autoHeard = false;
    waiting = [];
    stopSpeaking();
    listening = mic.supported ? "idle" : "unsupported";
    void wake?.release().then(() => {
      wakeMode = "off";
      render();
    });
  };
  const toggleAuto = () => {
    unlockSpeech();
    autoError = "";
    if (autoOn) {
      stopAuto();
      render();
      return;
    }
    if (!getGeminiKey()) {
      render();
      document.querySelector<HTMLButtonElement>("#open-settings")?.click();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      autoError = "이 브라우저에서는 마이크를 쓸 수 없습니다.";
      render();
      return;
    }
    stopSpeaking();
    autoOn = true;
    listening = "listening";
    hearLang = "ko";
    render();
    autoMic?.start().catch((error: unknown) => {
      autoOn = false;
      listening = (error as { name?: string })?.name === "NotAllowedError" ? "denied" : "idle";
      if (listening === "idle") autoError = "마이크를 열지 못했습니다. 다시 눌러 주세요.";
      void wake?.release();
      render();
    });
    void wake?.acquire(true).then((acquired) => {
      wakeMode = acquired;
      render();
    });
  };

  const stopListening = () => {
    mic.stop();
    void wake?.release().then(() => {
      wakeMode = "off";
      render();
    });
  };
  /** Tap a mic for a language: start it, switch to it, or stop when it is already live. */
  const toggleMic = (lang: SpeechLang) => {
    unlockSpeech();
    if (!mic.supported) {
      listening = "unsupported";
      render();
      document.querySelector<HTMLInputElement>("#manual-input")?.focus();
      return;
    }
    if (listening === "listening" && hearLang === lang) {
      stopListening();
      return;
    }
    const wasLive = listening === "listening";
    // Starting to talk ends a reading the new mic would pick up.
    if (aloud.some((item) => micWouldHear(item.lang, lang))) stopSpeaking();
    hearLang = lang;
    mic.start(lang);
    render();
    if (!wasLive) {
      void wake?.acquire(true).then((acquired) => {
        wakeMode = acquired;
        render();
      });
    }
  };

  document.querySelector<HTMLButtonElement>("#mic")?.addEventListener("click", () => (mode === "auto" ? toggleAuto() : toggleMic("ko")));
  document.querySelector<HTMLButtonElement>("#mic-ko")?.addEventListener("click", () => toggleMic("ko"));
  document.querySelector<HTMLButtonElement>("#mic-patient")?.addEventListener("click", () => toggleMic(patientLang));

  document.querySelector<HTMLElement>("#mode")?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-mode]");
    const next = button?.dataset.mode as Mode | undefined;
    if (!next || next === mode) return;
    // The auto microphone and the speech recognizer never run together.
    if (autoOn) stopAuto();
    else if (next === "auto" && listening === "listening") stopListening();
    if (next === "auto" && listening !== "unsupported") listening = "idle";
    autoError = "";
    mode = next;
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* storage blocked */
    }
    // One-way only listens in Korean: stop a patient session when leaving two-way.
    if (mode === "one" && listening === "listening" && hearLang !== "ko") stopListening();
    render();
  });

  /** Switch the patient language. Existing cards keep the language they were made in. */
  const changeLang = (next: PatientLang) => {
    if (next === patientLang) return;
    // A patient session in the old language must not keep listening.
    if (listening === "listening" && hearLang !== "ko") stopListening();
    patientLang = next;
    savePatientLang(next);
    if (next === "ja") void loadDict();
    render();
    scrollLog();
  };
  setupSettings(changeLang);
  const clear = document.querySelector<HTMLButtonElement>("#clear");
  clear?.addEventListener("click", () => {
    if (!cards.length) return;
    if (!clearArmed) {
      clearArmed = true;
      clear.textContent = "한 번 더 누르면 지움";
      window.setTimeout(() => {
        clearArmed = false;
        if (clear) clear.textContent = "기록 지우기";
      }, 2500);
      return;
    }
    cards = [];
    waiting = [];
    clearArmed = false;
    clear.textContent = "기록 지우기";
    render();
  });

  const syncViewport = () => {
    const height = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty("--app-h", `${Math.round(height)}px`);
  };
  syncViewport();
  window.visualViewport?.addEventListener("resize", syncViewport);
  window.visualViewport?.addEventListener("scroll", syncViewport);
  window.addEventListener("orientationchange", () => window.setTimeout(syncViewport, 250));

  window.__clinic = {
    submit,
    submitPatient,
    setMode: (next: Mode) => {
      mode = next;
      render();
    },
    setLang: changeLang,
    cards: () => cards.map((card) => ({ ...card })),
    dictReady: () => loadDict().then(() => Boolean(tokenizer)),
  };

  document.fonts?.ready.then(() => {
    if (cards.length) scrollLog();
  });
  render();
}

declare global {
  interface Window {
    __clinic?: {
      submit: (text: string) => void;
      submitPatient: (text: string) => void;
      setLang: (lang: PatientLang) => void;
      setMode: (mode: "one" | "two" | "auto") => void;
      cards: () => Card[];
      dictReady: () => Promise<boolean>;
    };
  }
}


function setupSettings(changeLang: (lang: PatientLang) => void): void {
  const dialog = document.querySelector<HTMLDialogElement>("#settings");
  const open = document.querySelector<HTMLButtonElement>("#open-settings");
  const input = document.querySelector<HTMLInputElement>("#gemini-key");
  const save = document.querySelector<HTMLButtonElement>("#save-key");
  const remove = document.querySelector<HTMLButtonElement>("#remove-key");
  const close = document.querySelector<HTMLButtonElement>("#close-settings");
  const state = document.querySelector<HTMLParagraphElement>("#engine-state");
  if (!dialog || !open || !input || !save || !remove || !close || !state) return;
  const showState = (message?: string) => {
    state.textContent =
      message ?? (getGeminiKey() ? "현재 번역: Gemini (실패하면 구글 번역)" : "현재 번역: 구글 번역 (Gemini 키 없음)");
    open.textContent = "설정";
  };
  showState();
  const voiceNote = document.querySelector<HTMLParagraphElement>("#voice-note");
  const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="voice-gender"]'));
  const voiceSelect = document.querySelector<HTMLSelectElement>("#voice-select");
  const testVoice = document.querySelector<HTMLButtonElement>("#test-voice");
  const sample = () => readAloud(LANGS[patientLang].sample, patientLang);
  const langButtons = document.querySelector<HTMLElement>("#lang-choice");
  const showLang = () => {
    if (!langButtons) return;
    langButtons.innerHTML = LANG_ORDER.map((lang) => {
      const on = lang === patientLang;
      return `<button type="button" role="radio" data-lang="${lang}" aria-checked="${on}" class="${on ? "is-on" : ""}">${LANGS[lang].flag} ${LANGS[lang].name}</button>`;
    }).join("");
  };
  const showVoice = () => {
    const gender = getVoiceGender();
    for (const radio of radios) radio.checked = radio.value === gender;
    const { voice, exact } = resolveVoice(gender, patientLang);
    const voices = voicesFor(patientLang);
    const { name } = LANGS[patientLang];
    if (voiceSelect) {
      const chosen = getChosenVoice(gender, patientLang);
      voiceSelect.replaceChildren(new Option("폰 기본 목소리 (자동)", ""));
      for (const v of voices) voiceSelect.add(new Option(v.name, v.name));
      voiceSelect.value = chosen && voices.some((v) => v.name === chosen) ? chosen : "";
    }
    if (!voiceNote) return;
    const count = voices.length;
    voiceNote.textContent = voice
      ? `사용 중: ${voice.name} · 이 폰의 ${name} 음성 ${count}개` +
        (!exact ? " (맞는 성별 음성이 없어 음높이로 조절)" : "")
      : `사용 중: 폰 기본 ${name} 목소리 · 이 폰의 ${name} 음성 ${count}개`;
    if (patientLang !== "ja" && voiceMissing(patientLang)) {
      voiceNote.textContent = `이 폰에 ${name} 음성이 없습니다. 폰의 글자 읽어주기(TTS) 설정에서 ${name} 음성을 받아 주세요.`;
    }
  };
  langButtons?.addEventListener("click", (event) => {
    const lang = (event.target as HTMLElement).closest<HTMLElement>("[data-lang]")?.dataset.lang;
    if (!isPatientLang(lang)) return;
    changeLang(lang);
    showLang();
    showVoice();
  });
  for (const radio of radios) {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      setVoiceGender(radio.value as VoiceGender);
      showVoice();
      sample();
    });
  }
  voiceSelect?.addEventListener("change", () => {
    setChosenVoice(getVoiceGender(), voiceSelect.value, patientLang);
    showVoice();
    sample();
  });
  const rateInput = document.querySelector<HTMLInputElement>("#voice-rate");
  const rateValue = document.querySelector<HTMLSpanElement>("#voice-rate-value");
  const showRate = () => {
    const rate = rateInput ? Number(rateInput.value) : getSpeechRate();
    if (rateValue) rateValue.textContent = `${rate.toFixed(2)}배`;
  };
  if (rateInput) rateInput.value = String(getSpeechRate());
  showRate();
  rateInput?.addEventListener("input", showRate);
  rateInput?.addEventListener("change", () => {
    setSpeechRate(Number(rateInput.value));
    sample();
  });
  testVoice?.addEventListener("click", sample);
  window.speechSynthesis?.addEventListener("voiceschanged", () => {
    if (dialog.open) showVoice();
  });
  open.addEventListener("click", () => {
    input.value = getGeminiKey();
    showState();
    showLang();
    showVoice();
    dialog.showModal();
  });
  close.addEventListener("click", () => dialog.close());
  // A key may have been added or removed.
  dialog.addEventListener("close", render);
  remove.addEventListener("click", () => {
    setGeminiKey("");
    input.value = "";
    showState("키를 지웠어요. 구글 번역을 씁니다.");
  });
  save.addEventListener("click", async () => {
    const key = input.value.trim();
    if (!key) return;
    save.disabled = true;
    showState("키 확인 중…");
    try {
      const ja = await translateWithGemini("엉덩이 들어보세요", key);
      setGeminiKey(key);
      showState(`저장 완료. 테스트: ${ja}`);
    } catch (error) {
      showState(`키 확인 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      save.disabled = false;
    }
  });
}
