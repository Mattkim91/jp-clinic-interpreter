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
  start: () => void;
  stop: () => void;
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
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
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
  let timer = 0;
  let quietRestarts = 0;
  let lastFinal = "";
  let lastFinalAt = 0;

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
    rec.lang = "ko-KR";
    rec.continuous = continuous;
    rec.interimResults = true;
    rec.onstart = () => {
      if (listening) options.onState("listening");
    };
    rec.onresult = (event) => {
      quietRestarts = 0;
      const { finals, interim } = collectUtterance(slicesOf(event), event.resultIndex);
      options.onInterim(interim);
      for (const text of finals) {
        const now = Date.now();
        if (text === lastFinal && now - lastFinalAt < 1600) continue;
        lastFinal = text;
        lastFinalAt = now;
        options.onFinal(text);
      }
      if (finals.length) options.onInterim("");
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
    start() {
      if (listening) return;
      listening = true;
      quietRestarts = 0;
      clearTimer();
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
    stop() {
      listening = false;
      clearTimer();
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
