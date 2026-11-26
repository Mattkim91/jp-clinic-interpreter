/**
 * Live transcription for 동시통역: the words appear while someone is still talking, so
 * translating can start the moment they stop. gemini-3.5-transcribe-live over a WebSocket.
 * When it does not work the caller falls back to sending each recording (interpretAudio).
 */
import type { PatientLang } from "./lang";

const URL_BASE = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
export const LIVE_MODEL = "models/gemini-3.5-transcribe-live";
const SETUP_TIMEOUT_MS = 6000;
const LANG_CODES: Record<PatientLang, string> = { ja: "ja-JP", en: "en-US", ar: "ar-EG" };

type Socket = Pick<WebSocket, "send" | "close" | "readyState"> & {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
};
export type SocketMaker = (url: string) => Socket;

export type LiveStt = {
  /** Connected and transcribing. */
  ready: () => boolean;
  /** What has been heard since the last take(). */
  text: () => string;
  /** The speaker stopped: wait briefly for the last words, then hand over the text and start fresh. */
  take: (waitMs?: number) => Promise<string>;
  /** 16 kHz 16-bit mono PCM, base64. */
  send: (pcm: string) => void;
  /** The phone is talking: send nothing and forget what is heard. */
  pause: () => void;
  resume: () => void;
  close: () => void;
};

/** Joins two transcript pieces; Japanese and Chinese characters need no space. */
export function joinText(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  if (/\s$/.test(a) || /^\s/.test(b) || /^[,.!?、。！？]/.test(b)) return a + b;
  if (/[぀-ヿ一-鿿]$/.test(a) || /^[぀-ヿ一-鿿]/.test(b)) return a + b;
  return `${a} ${b}`;
}

async function messageText(data: unknown): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof Blob) return data.text();
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  return "";
}

export function createLiveStt(options: {
  key: string;
  lang: PatientLang;
  /** Text heard so far changed. */
  onText: (text: string) => void;
  /** Gave up: the caller uses recordings instead. */
  onBroken: (reason: string) => void;
  makeSocket?: SocketMaker;
}): LiveStt {
  const make = options.makeSocket ?? ((url: string) => new WebSocket(url) as unknown as Socket);
  let socket: Socket | null = null;
  let isReady = false;
  let closed = false;
  let paused = false;
  let final = "";
  let interim = "";
  let failures = 0;
  let openedAt = 0;
  let setupTimer: ReturnType<typeof setTimeout> | undefined;
  /** Resolves a waiting take() when the last words arrive. */
  let gotFinal: (() => void) | null = null;

  const heard = () => {
    const tail = interim.trim();
    if (tail && final && tail.startsWith(final.trim())) return tail;
    return joinText(final, interim).replace(/\s+/g, " ").trim();
  };

  const fail = (reason: string) => {
    if (closed) return;
    closed = true;
    isReady = false;
    clearTimeout(setupTimer);
    try {
      socket?.close();
    } catch {
      /* already closed */
    }
    socket = null;
    options.onBroken(reason);
  };

  const connect = () => {
    if (closed) return;
    isReady = false;
    openedAt = Date.now();
    let ws: Socket;
    try {
      ws = make(`${URL_BASE}?key=${encodeURIComponent(options.key)}`);
    } catch {
      fail("연결할 수 없음");
      return;
    }
    socket = ws;
    clearTimeout(setupTimer);
    setupTimer = setTimeout(() => {
      if (socket === ws && !isReady) fail("응답 없음");
    }, SETUP_TIMEOUT_MS);
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          setup: {
            model: LIVE_MODEL,
            generationConfig: { responseModalities: ["TEXT"] },
            inputAudioTranscription: { languageCodes: ["ko-KR", LANG_CODES[options.lang]] },
          },
        }),
      );
    };
    ws.onmessage = (event) => {
      void messageText(event.data).then((raw) => {
        if (socket !== ws || !raw) return;
        let message: Record<string, unknown>;
        try {
          message = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return;
        }
        if ("setupComplete" in message) {
          isReady = true;
          failures = 0;
          clearTimeout(setupTimer);
          return;
        }
        const content = message.serverContent as
          | { inputTranscription?: { text?: string }; interimInputTranscription?: { text?: string } }
          | undefined;
        if (!content || paused) return;
        const piece = content.inputTranscription?.text;
        if (typeof piece === "string") {
          final = joinText(final, piece);
          interim = "";
          gotFinal?.();
        }
        const partial = content.interimInputTranscription?.text;
        if (typeof partial === "string") interim = partial;
        if (typeof piece === "string" || typeof partial === "string") options.onText(heard());
      });
    };
    ws.onerror = () => {
      /* onclose follows */
    };
    ws.onclose = (event) => {
      if (socket !== ws || closed) return;
      socket = null;
      isReady = false;
      // A session ends after about 10 minutes: open the next one. Quick repeated closes mean it does not work here.
      failures = Date.now() - openedAt < 20000 ? failures + 1 : 0;
      if (failures >= 2) fail(event.reason || `연결 끊김 (${event.code})`);
      else setTimeout(connect, failures ? 1000 : 0);
    };
  };

  const sendJson = (value: object) => {
    if (socket && isReady && socket.readyState === 1) socket.send(JSON.stringify(value));
  };

  connect();

  return {
    ready: () => isReady,
    text: heard,
    async take(waitMs = 300) {
      // Tell the server the speaker stopped, so it finishes the last words now.
      sendJson({ realtimeInput: { audioStreamEnd: true } });
      if (interim.trim() && waitMs > 0) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, waitMs);
          gotFinal = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        gotFinal = null;
      }
      const text = heard();
      final = "";
      interim = "";
      return text;
    },
    send(pcm) {
      if (!paused) sendJson({ realtimeInput: { audio: { data: pcm, mimeType: "audio/pcm;rate=16000" } } });
    },
    pause() {
      if (paused) return;
      paused = true;
      sendJson({ realtimeInput: { audioStreamEnd: true } });
      final = "";
      interim = "";
    },
    resume() {
      paused = false;
      final = "";
      interim = "";
    },
    close() {
      closed = true;
      isReady = false;
      clearTimeout(setupTimer);
      try {
        socket?.close();
      } catch {
        /* already closed */
      }
      socket = null;
    },
  };
}

/** Which side spoke, from the letters themselves. */
export function scriptLang(text: string, patient: PatientLang): "ko" | PatientLang | null {
  const count = (re: RegExp) => (text.match(re) ?? []).length;
  const hangul = count(/[가-힣]/g);
  const kana = count(/[぀-ヿ]/g);
  const kanji = count(/[一-鿿]/g);
  const arabic = count(/[؀-ۿ]/g);
  const latin = count(/[A-Za-z]/g);
  const other = patient === "ja" ? kana + kanji : patient === "ar" ? arabic : latin;
  if (!hangul && !other) return null;
  return hangul >= other ? "ko" : patient;
}
