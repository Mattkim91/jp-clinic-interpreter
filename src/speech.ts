import { LANGS, type PatientLang } from "./lang";
import { detectPlatform, restartDelay, type PlatformKind } from "./platform";

export type RecSlice = { isFinal: boolean; transcript: string };

export function collectUtterance(results: RecSlice[], fromIndex: number): { finals: string[]; interim: string } {
  const finals: string[] = [];
  const interim: string[] = [];
  for (let i = Math.max(0, fromIndex); i < results.length; i++) {
    const text = results[i].transcript.replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (results[i].isFinal) finals.push(text);
    else interim.push(text);
  }
  return { finals, interim: interim.join(" ") };
}

export type SpeechLang = "ko" | PatientLang;

/** BCP-47 tag the recognizer listens in. */
export function recognitionLang(lang: SpeechLang): string {
  return lang === "ko" ? "ko-KR" : LANGS[lang].tag;
}

/** Korean sentence-final endings (polite/plain requests, statements, questions). */
const SENTENCE_END = /(요|다|까|죠|니다|세요|래|자|네|군|지)[\s.?!~。…]*$|[.?!。？！]\s*$/;

/** Japanese sentence-final forms (polite/plain statements, requests, questions, particles). */
const SENTENCE_END_JA =
  /(です|ます|ました|ません|でした|ましょう|ください|下さい|ない|か|ね|よ|な|わ|た|だ|い)[。？！?!…\s]*$|[。？！?!]\s*$/;

/** English and Arabic have no reliable sentence-final words, so only punctuation counts. */
const SENTENCE_END_PUNCT = /[.?!؟。？！]\s*$/;

/** True when the buffered text looks like a complete sentence in the given language. */
export function endsSentence(text: string, lang: SpeechLang = "ko"): boolean {
  if (lang === "en" || lang === "ar") return SENTENCE_END_PUNCT.test(text.trim());
  return (lang === "ja" ? SENTENCE_END_JA : SENTENCE_END).test(text.trim());
}

/**
 * Endings that leave no doubt, for sending before the recognizer confirms the words.
 * "~지" (숨 참지 … 마세요) or "~い" (痛い … です) often continue, so they wait for confirmation as before.
 */
const CLEAR_END: Record<"ko" | "ja", RegExp> = {
  ko: /(요|니다|니까|세요|까)[\s.?!~。…]*$|[.?!。？！]\s*$/,
  ja: /(です|ます|ました|ません|でした|ましょう|ください|下さい|ですか|ますか)[。？！?!…\s]*$|[。？！?!]\s*$/,
};

export function endsClearly(text: string, lang: SpeechLang = "ko"): boolean {
  if (lang === "en" || lang === "ar") return SENTENCE_END_PUNCT.test(text.trim());
  return CLEAR_END[lang].test(text.trim());
}

/** True when the buffered Japanese looks like a complete sentence. */
export function endsSentenceJa(text: string): boolean {
  return endsSentence(text, "ja");
}

/** Silence (ms) to wait before translating: short once a sentence ending is heard, long otherwise. */
export const PAUSE_AFTER_ENDING = 700;
/** (v3.6) After an ending that leaves no doubt (~요, ~니다, ください): 0.5 s, chosen by the user. */
export const PAUSE_CLEAR_END = 500;
export const PAUSE_WITHOUT_ENDING = 3000;
/** English/Arabic patients: endings cannot be heard, so a middle pause decides. */
export const PAUSE_NO_ENDING_WORDS = 1500;

export function flushDelay(text: string, lang: SpeechLang = "ko"): number {
  if (endsClearly(text, lang)) return PAUSE_CLEAR_END;
  if (endsSentence(text, lang)) return PAUSE_AFTER_ENDING;
  return lang === "en" || lang === "ar" ? PAUSE_NO_ENDING_WORDS : PAUSE_WITHOUT_ENDING;
}

/**
 * Remove phrases the recognizer restarted: "여기 여기 매트에 여기 매트에 누워 보세요" -> "여기 매트에 누워 보세요".
 * A run of words immediately followed by the same run is kept once.
 */
export function collapseRepeats(text: string): string {
  let words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < words.length && !changed; i++) {
      for (let j = 0; j < i; j++) {
        const len = i - j;
        if (i + len > words.length) continue;
        if (words.slice(j, i).join(" ") === words.slice(i, i + len).join(" ")) {
          words = [...words.slice(0, j), ...words.slice(i)];
          changed = true;
          break;
        }
      }
    }
  }
  return words.join(" ");
}

/** Append a recognized chunk to the pending sentence, merging overlaps that Android re-sends. */
export function appendChunk(pending: string, chunk: string, lang: SpeechLang = "ko"): string {
  const c = collapseRepeats(chunk);
  if (!c) return pending;
  if (!pending) return c;
  if (lang === "en" || lang === "ar") {
    // Whole words only: a short answer such as "no" must not vanish inside "know".
    if (` ${c} `.startsWith(` ${pending} `)) return c;
    if (` ${pending} `.includes(` ${c} `)) return pending;
  } else {
    if (c.startsWith(pending)) return c;
    if (pending.endsWith(c) || pending.includes(c)) return pending;
  }
  const pw = pending.split(" ");
  const cw = c.split(" ");
  for (let k = Math.min(pw.length, cw.length); k >= 1; k--) {
    if (pw.slice(-k).join(" ") === cw.slice(0, k).join(" ")) {
      return collapseRepeats([...pw, ...cw.slice(k)].join(" "));
    }
  }
  if (lang === "ja") {
    // Japanese usually arrives without spaces: merge character overlaps and join without a space.
    for (let k = Math.min(pending.length, c.length) - 1; k >= 2; k--) {
      if (pending.endsWith(c.slice(0, k))) return pending + c.slice(k);
    }
    return `${pending}${c}`;
  }
  return collapseRepeats(`${pending} ${c}`);
}

function letters(text: string): string {
  return text.toLowerCase().replace(/[\s.,!?、。！？…~'"-]/g, "");
}

/**
 * A sentence was already sent from the still-unconfirmed text (sooner); now the recognizer confirms it.
 * Returns only what was not sent yet: "" for the same sentence (or a small correction of it).
 */
export function afterEarly(sent: string, confirmed: string): string {
  const s = letters(sent);
  const c = letters(confirmed);
  if (!c || c === s || s.includes(c)) return "";
  if (c.startsWith(s)) {
    // Keep the words that came after the sentence already sent.
    let seen = 0;
    for (let i = 0; i < confirmed.length; i++) {
      if (letters(confirmed[i])) seen += 1;
      if (seen === s.length) return confirmed.slice(i + 1).replace(/^[\s.,!?、。！？…~]+/, "").trim();
    }
    return "";
  }
  // About as long as what was sent: the recognizer only corrected a word.
  return Math.abs(c.length - s.length) <= Math.max(2, s.length * 0.3) ? "" : confirmed;
}

type RecHandle = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type RecCtor = new () => RecHandle;

export type ListenState = "idle" | "listening" | "needs-gesture" | "denied" | "unsupported";

export type Listener = {
  supported: boolean;
  /** Start listening in a language (default Korean). Restarts when already listening in another language. */
  start: (lang?: SpeechLang) => void;
  stop: () => void;
  /** Close the mic while the phone itself talks (so it does not hear itself); still counts as listening. */
  hold: () => void;
  /** Open the mic again after hold(). */
  release: () => void;
  lang: () => SpeechLang;
};

function getCtor(): RecCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecCtor;
    webkitSpeechRecognition?: RecCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function slicesOf(event: RecEvent): RecSlice[] {
  const list: RecSlice[] = [];
  for (let i = 0; i < event.results.length; i++) {
    list.push({ isFinal: event.results[i].isFinal, transcript: event.results[i][0].transcript });
  }
  return list;
}

export function createListener(options: {
  onFinal: (text: string, lang: SpeechLang) => void;
  onInterim: (text: string) => void;
  /** What the sentence will probably be, while waiting for it to end: worth translating already. */
  onLikely?: (text: string, lang: SpeechLang) => void;
  onState: (state: ListenState) => void;
  onError: (message: string) => void;
  kind?: PlatformKind;
}): Listener {
  const Ctor = getCtor();
  if (!Ctor) {
    return {
      supported: false,
      start() {
        options.onState("unsupported");
      },
      stop() {
        options.onState("unsupported");
      },
      hold() {},
      release() {},
      lang: () => "ko",
    };
  }

  const kind =
    options.kind ??
    detectPlatform(navigator.userAgent, {
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    }).kind;
  const continuous = kind !== "ios";
  let recognition: RecHandle | null = null;
  let listening = false;
  let held = false;
  let timer = 0;
  let quietRestarts = 0;
  let pending = "";
  let flushTimer = 0;
  let currentLang: SpeechLang = "ko";
  /** A finished-sounding sentence still being shown as unconfirmed; it is sent if the words stop changing. */
  let armed = "";
  /** Sent from unconfirmed words; its confirmation must not become a second card. */
  let sentEarly = "";

  const clearFlush = () => {
    if (flushTimer) window.clearTimeout(flushTimer);
    flushTimer = 0;
  };

  const flush = () => {
    clearFlush();
    // The unconfirmed words, when they say more than what is confirmed.
    const early = armed && letters(armed).length > letters(pending).length;
    const text = collapseRepeats(early ? armed : pending);
    pending = "";
    armed = "";
    if (early) sentEarly = text;
    options.onInterim("");
    if (text) options.onFinal(text, currentLang);
  };

  const scheduleFlush = () => {
    clearFlush();
    armed = "";
    if (!pending) return;
    flushTimer = window.setTimeout(flush, flushDelay(pending, currentLang));
  };

  /**
   * The words heard so far already end a sentence: count the wait from now, not from when the
   * recognizer confirms them (that can take most of a second more). New words start it again.
   */
  const armFlush = (heard: string) => {
    if (armed === heard && flushTimer) return;
    clearFlush();
    armed = heard;
    flushTimer = window.setTimeout(flush, flushDelay(heard, currentLang));
  };

  const clearTimer = () => {
    if (timer) window.clearTimeout(timer);
    timer = 0;
  };

  const scheduleRestart = () => {
    if (!listening || timer) return;
    timer = window.setTimeout(() => {
      timer = 0;
      if (!listening) return;
      begin(false);
    }, restartDelay(kind, quietRestarts));
  };

  const begin = (fromGesture: boolean) => {
    if (!listening) return;
    if (!recognition) recognition = new Ctor();
    const rec = recognition;
    rec.lang = recognitionLang(currentLang);
    rec.continuous = continuous;
    rec.interimResults = true;
    rec.onstart = () => {
      if (listening) options.onState("listening");
    };
    rec.onresult = (event) => {
      quietRestarts = 0;
      const utterance = collectUtterance(slicesOf(event), event.resultIndex);
      let { finals, interim } = utterance;
      if (sentEarly) {
        // The confirmation of a sentence that was already sent: keep only what is new.
        if (finals.length) {
          const rest = afterEarly(sentEarly, finals.reduce((all, text) => appendChunk(all, text, currentLang), ""));
          sentEarly = "";
          finals = rest ? [rest] : [];
        } else if (interim && !afterEarly(sentEarly, interim)) {
          interim = "";
        }
      }
      for (const text of finals) pending = appendChunk(pending, text, currentLang);
      const heard = interim ? appendChunk(pending, interim, currentLang) : pending;
      options.onInterim(heard);
      // Already sounds finished, or nothing more is coming: the translation can start during the wait.
      if (heard && (!interim || endsSentence(heard, currentLang))) options.onLikely?.(collapseRepeats(heard), currentLang);
      if (interim) {
        // Still talking, unless the words so far already end a sentence.
        if (endsClearly(heard, currentLang)) armFlush(heard);
        else {
          clearFlush();
          armed = "";
        }
      } else if (!(armed && letters(armed) === letters(pending) && flushTimer)) {
        // Confirmed as heard: the wait that already started keeps running.
        scheduleFlush();
      }
    };
    rec.onerror = (event) => {
      const code = event.error;
      if (!listening) return;
      if (code === "aborted" || code === "no-speech") {
        quietRestarts += code === "no-speech" ? 1 : 0;
        return;
      }
      if (code === "not-allowed" || code === "service-not-allowed") {
        if (fromGesture) {
          listening = false;
          options.onState("denied");
          options.onError("마이크 권한이 없습니다. 브라우저 설정에서 마이크를 허용한 뒤 다시 눌러 주세요.");
        } else {
          listening = false;
          options.onState("needs-gesture");
          options.onError("음성 인식이 멈췄습니다. 마이크 버튼을 다시 눌러 주세요.");
        }
        return;
      }
      if (code === "audio-capture") {
        listening = false;
        options.onState("idle");
        options.onError("마이크를 찾지 못했습니다.");
        return;
      }
      if (code === "network") {
        options.onError("음성 인식 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.");
        quietRestarts += 1;
      }
    };
    rec.onend = () => {
      if (!listening) {
        options.onState("idle");
        options.onInterim("");
        return;
      }
      if (pending && !flushTimer) scheduleFlush();
      quietRestarts += 1;
      if (quietRestarts > 12) {
        listening = false;
        options.onState("needs-gesture");
        options.onError("인식이 반복해서 멈췄습니다. 마이크 버튼을 다시 눌러 주세요.");
        return;
      }
      scheduleRestart();
    };
    try {
      rec.start();
      options.onState("listening");
    } catch {
      quietRestarts += 1;
      if (fromGesture && quietRestarts > 2) {
        options.onError("음성 인식을 시작하지 못했습니다. 잠시 뒤 다시 눌러 주세요.");
      }
      scheduleRestart();
    }
  };

  return {
    supported: true,
    lang: () => currentLang,
    start(lang: SpeechLang = "ko") {
      if (listening && lang === currentLang) return;
      if (listening) {
        // Switching language: send what was heard so far in the old language first.
        clearTimer();
        flush();
      }
      currentLang = lang;
      listening = true;
      held = false;
      quietRestarts = 0;
      clearTimer();
      clearFlush();
      pending = "";
      armed = "";
      sentEarly = "";
      if (recognition) {
        try {
          recognition.onend = null;
          recognition.onerror = null;
          recognition.abort();
        } catch {
          /* already stopped */
        }
        recognition = null;
      }
      begin(true);
    },
    hold() {
      if (!listening || held) return;
      held = true;
      clearTimer();
      if (recognition) {
        recognition.onend = null;
        recognition.onerror = null;
        recognition.onresult = null;
        try {
          recognition.abort();
        } catch {
          /* already stopped */
        }
        recognition = null;
      }
      flush();
    },
    release() {
      if (!held) return;
      held = false;
      if (!listening) return;
      quietRestarts = 0;
      begin(false);
    },
    stop() {
      listening = false;
      held = false;
      clearTimer();
      flush();
      options.onInterim("");
      options.onState("idle");
      if (!recognition) return;
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          /* ignore */
        }
      }
    },
  };
}
