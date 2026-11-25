import { romajiToHangul } from "./hangul";
import { detectPlatform, type PlatformInfo } from "./platform";
import { politify } from "./polite";
import { PRESETS, prepare } from "./prepare";
import { hangulFromTokens } from "./reading";
import { canSpeak, getVoiceGender, pickJapaneseVoice, primeVoices, setVoiceGender, speakJapanese, unlockSpeech, type VoiceGender } from "./speak";
import { createListener, type ListenState } from "./speech";
import { fetchJaRomaji, translateKoToJa } from "./translate";
import { getGeminiKey, setGeminiKey, translateWithGemini } from "./gemini";
import { loadTokenizer, type Tokenizer } from "./tokenizer";
import { createWake, type WakeMode } from "./wake";

type Card = {
  id: number;
  ko: string;
  ja: string;
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

const dictReady = loadTokenizer(`${import.meta.env.BASE_URL}kuromoji-dict`)
  .then((built) => {
    tokenizer = built;
  })
  .catch(() => {
    dictError = "발음 사전을 받지 못했습니다. 로마자 발음으로 대신합니다.";
  })
  .finally(() => {
    if (document.getElementById("status")) renderChrome();
  });

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
  await dictReady;
  if (tokenizer) {
    const hangul = hangulFromTokens(tokenizer.tokenize(ja));
    if (hangul) return hangul;
  }
  const romaji = await fetchJaRomaji(ja);
  const hangul = romajiToHangul(romaji);
  if (!hangul) throw new Error("발음을 만들지 못했습니다");
  return hangul;
}

async function fill(card: Card): Promise<void> {
  try {
    const prepared = prepare(card.ko);
    let translated = prepared.overrideJa ?? "";
    if (!translated && getGeminiKey()) {
      try {
        translated = await translateWithGemini(card.ko);
      } catch {
        translated = "";
      }
    }
    if (!translated) translated = await translateKoToJa(prepared.query);
    const ja = prepared.overrideJa ? translated : politify(translated, card.ko);
    const reading = await readingFor(ja);
    card.ja = ja;
    card.reading = reading;
    card.status = "ready";
    card.error = "";
    if (autoSpeak) speakJapanese(ja);
  } catch (error) {
    card.status = "error";
    card.error = friendlyError(error);
  }
  render();
  scrollLog();
}

function submit(korean: string): void {
  const ko = korean.replace(/\s+/g, " ").trim();
  if (!ko) return;
  const card: Card = { id: nextId++, ko, ja: "", reading: "", status: "loading", error: "" };
  cards.push(card);
  render();
  scrollLog();
  void fill(card);
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
  if (!card || card.status !== "ready" || !card.ja) return;
  if (!canSpeak()) {
    setToast("이 브라우저는 일본어 소리 내기를 지원하지 않습니다.");
    return;
  }
  speakJapanese(card.ja);
}

function scrollLog(): void {
  const log = document.querySelector<HTMLElement>("#log");
  if (!log) return;
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  log.scrollTo({ top: log.scrollHeight, behavior });
}

function statusText(): string {
  if (listening === "listening") return "듣는 중";
  if (listening === "needs-gesture") return "마이크를 다시 눌러 주세요";
  if (listening === "denied") return "마이크 권한이 필요합니다";
  if (listening === "unsupported") return "음성 인식 없음";
  if (!tokenizer && !dictError) return "발음 사전 받는 중";
  return "대기";
}

function hintText(): string {
  if (wakeMode === "unsupported" && listening === "listening") {
    return "화면 켜 두기를 지원하지 않습니다. 자동 잠금을 꺼 주세요.";
  }
  if (listening === "listening" && wakeMode === "video") {
    return "화면이 꺼지면 자동 잠금을 꺼 주세요. 문장마다 이어서 듣습니다.";
  }
  if (listening === "listening") return "문장이 끝나면 바로 번역됩니다. 화면은 켜 둔 상태입니다.";
  if (platform.kind === "ios") return "아이폰은 문장마다 다시 듣습니다. 멈추면 마이크를 다시 누르세요.";
  if (dictError) return dictError;
  return "말하면 일본어 카드가 쌓입니다.";
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
  interimText.textContent = interim;
  interimEl.hidden = !interim;

  const live = listening === "listening";
  mic.classList.toggle("is-live", live);
  mic.setAttribute("aria-pressed", live ? "true" : "false");
  micLabel.textContent = live ? "음성 입력 중 · 멈추기" : "음성 입력 시작";

  if (listening === "unsupported") {
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
  if (!cards.length) {
    log.innerHTML = `<div class="empty"><p class="empty-title">아직 문장이 없습니다</p><p>마이크를 누르고 환자에게 할 말을 한국어로 하세요. 한 문장이 끝나면 일본어가 큰 글씨로 쌓입니다.</p><p class="empty-note">${escapeHtml(installLine())}</p></div>`;
    return;
  }

  log.innerHTML = cards
    .map((card, index) => {
      const newest = index === cards.length - 1 ? " is-newest" : "";
      if (card.status === "loading") {
        return `<article class="card is-loading${newest}" data-card="${card.id}"><p class="ja ja-wait">번역하는 중…</p><p class="ko">${escapeHtml(card.ko)}</p></article>`;
      }
      if (card.status === "error") {
        return `<article class="card is-error${newest}" data-card="${card.id}"><p class="ja ja-wait">번역되지 않았습니다</p><p class="error-text">${escapeHtml(card.error)}</p><p class="ko">${escapeHtml(card.ko)}</p><button type="button" class="retry" data-retry="${card.id}">다시 번역</button></article>`;
      }
      return `<article class="card${newest}" data-card="${card.id}">
        <button type="button" class="speak" data-speak="${card.id}" aria-label="일본어로 읽기">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.2L12 18.8V5.2L7.2 9.5H4z" fill="currentColor"/><path d="M15.2 8.2a5 5 0 0 1 0 7.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17.6 5.8a8 8 0 0 1 0 12.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <p class="ja" lang="ja">${escapeHtml(card.ja)}</p>
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
  const listener = createListener({
    onFinal: (text) => submit(text),
    onInterim: (text) => {
      interim = text;
      renderChrome();
    },
    onState: (state) => {
      listening = state;
      if (state !== "listening") interim = "";
      renderChrome();
    },
    onError: (message) => setToast(message),
    kind: platform.kind,
  });

  if (!listener.supported) listening = "unsupported";

  const presetRow = document.querySelector<HTMLElement>("#presets");
  if (presetRow) {
    presetRow.innerHTML = PRESETS.map(
      (preset) =>
        `<button type="button" class="chip" data-preset="${escapeHtml(preset.ko)}">${escapeHtml(preset.label)}</button>`,
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
      localStorage.setItem("clinic-autospeak", autoSpeak ? "1" : "0");
      if (autoSpeak) unlockSpeech();
    });
  }

  const mic = document.querySelector<HTMLButtonElement>("#mic");
  mic?.addEventListener("click", () => {
    unlockSpeech();
    if (!listener.supported) {
      listening = "unsupported";
      render();
      document.querySelector<HTMLInputElement>("#manual-input")?.focus();
      return;
    }
    if (listening === "listening") {
      listener.stop();
      void wake?.release().then(() => {
        wakeMode = "off";
        render();
      });
      return;
    }
    listener.start();
    void wake?.acquire(true).then((mode) => {
      wakeMode = mode;
      render();
    });
  });

  setupSettings();
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
    cards: () => cards.map((card) => ({ ...card })),
    dictReady: () => dictReady.then(() => Boolean(tokenizer)),
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
      cards: () => Card[];
      dictReady: () => Promise<boolean>;
    };
  }
}


function setupSettings(): void {
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
    open.textContent = getGeminiKey() ? "설정 · Gemini" : "설정";
  };
  showState();
  const voiceNote = document.querySelector<HTMLParagraphElement>("#voice-note");
  const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="voice-gender"]'));
  const showVoice = () => {
    const gender = getVoiceGender();
    for (const radio of radios) radio.checked = radio.value === gender;
    if (!voiceNote) return;
    const { voice, exact } = pickJapaneseVoice(gender);
    voiceNote.textContent = voice
      ? exact
        ? `사용 중: ${voice.name}`
        : `이 폰에 ${gender === "male" ? "남자" : "여자"} 일본어 음성이 없어 음높이를 바꿔 읽어요 (${voice.name})`
      : "이 폰에서 일본어 음성을 찾지 못했어요";
  };
  for (const radio of radios) {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      setVoiceGender(radio.value as VoiceGender);
      showVoice();
      speakJapanese("こんにちは。よろしくお願いします。");
    });
  }
  open.addEventListener("click", () => {
    input.value = getGeminiKey();
    showState();
    showVoice();
    dialog.showModal();
  });
  close.addEventListener("click", () => dialog.close());
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
