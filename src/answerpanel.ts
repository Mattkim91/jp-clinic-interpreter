import { PANEL, REPLIES, WANTS, painWords, placeWords, type Place, type Side, type Words } from "./answers";
import { bodySvg, sideAt, type View } from "./bodymap";
import { LANGS, type PatientLang } from "./lang";

type Tab = "reply" | "place" | "score" | "want";
const TABS: { tab: Tab; icon: string }[] = [
  { tab: "reply", icon: "💬" },
  { tab: "place", icon: "📍" },
  { tab: "score", icon: "🔢" },
  { tab: "want", icon: "🙋" },
];
const ASK = { reply: "askReply", place: "askPlace", score: "askScore", want: "askWant" } as const;
const FACES = ["😀", "🙂", "🙂", "😐", "😐", "😕", "😟", "😣", "😖", "😫", "😭"];

/** Full-screen panel handed to the patient: every tap becomes a patient card at once. */
export function setupAnswers(options: {
  lang: () => PatientLang;
  onOpen: () => void;
  onAnswer: (answer: { text: string; ko: string; lang: PatientLang }) => void;
}): void {
  const dialog = document.querySelector<HTMLDialogElement>("#answers");
  if (!dialog) return;
  let tab: Tab = "reply";
  let view: View = "front";
  /** Tapped on the body, waiting for its score. */
  let place: Place | null = null;
  /** Language the panel was opened in. */
  let lang: PatientLang = "ja";

  /** Patient's language with the Korean underneath, for the therapist. */
  const both = (words: Words) => `<bdi class="pw" lang="${lang}">${words[lang]}</bdi><small lang="ko">${words.ko}</small>`;

  const page = (): string => {
    if (tab === "reply" || tab === "want") {
      const list = tab === "reply" ? REPLIES : WANTS;
      return `<div class="an-grid is-${tab}">${list
        .map((item) => `<button type="button" class="an-tile" data-answer="${item.id}"><span class="an-icon" aria-hidden="true">${item.icon}</span>${both(item)}</button>`)
        .join("")}</div>`;
    }
    if (tab === "place") {
      const views = (["front", "back"] as const)
        .map((item) => `<button type="button" role="radio" data-view="${item}" aria-checked="${view === item}" class="${view === item ? "is-on" : ""}">${both(PANEL[item])}</button>`)
        .join("");
      const mark = (half: "left" | "right") => `<span class="an-side">${both(PANEL[sideAt(view, half)])}</span>`;
      return `<div class="an-views" role="radiogroup">${views}</div><div class="an-body" dir="ltr">${mark("left")}${bodySvg(view, lang)}${mark("right")}</div>`;
    }
    const at = place ? `<p class="an-at">📍 ${both(placeWords(place))}</p>` : "";
    const steps = FACES.map(
      (face, n) => `<button type="button" class="an-step" data-score="${n}" style="--n:${n}" aria-label="${n}"><b>${n}</b><span aria-hidden="true">${face}</span></button>`,
    ).join("");
    return `${at}<div class="an-scale" dir="ltr">${steps}</div><div class="an-ends" dir="ltr"><span>0 · ${both(PANEL.none)}</span><span>10 · ${both(PANEL.worst)}</span></div>`;
  };

  const draw = () => {
    const tabs = TABS.map(
      (item) =>
        `<button type="button" role="tab" data-tab="${item.tab}" aria-selected="${item.tab === tab}" class="${item.tab === tab ? "is-on" : ""}"><span aria-hidden="true">${item.icon}</span>${both(PANEL[item.tab])}</button>`,
    ).join("");
    dialog.innerHTML = `<div class="an-head"><p class="an-ask" dir="${LANGS[lang].dir}">${both(PANEL[ASK[tab]])}</p><button type="button" class="an-close" data-close>닫기</button></div><div class="an-page" dir="${LANGS[lang].dir}">${page()}</div><div class="an-tabs" role="tablist" dir="${LANGS[lang].dir}">${tabs}</div>`;
  };

  const send = (words: Words) => options.onAnswer({ text: words[lang], ko: words.ko, lang });
  /** A place tapped without a score is still an answer. */
  const flushPlace = () => {
    if (place) send(painWords(place, null));
    place = null;
  };

  dialog.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const hit = target.closest<HTMLElement>("[data-tab],[data-view],[data-answer],[data-score],[data-part],[data-close]");
    if (!hit) return;
    const data = hit.dataset;
    if ("close" in data) {
      flushPlace();
      dialog.close();
    } else if (data.tab) {
      // Going back to the body means choosing again.
      if (data.tab === "place") place = null;
      tab = data.tab as Tab;
      draw();
    } else if (data.view) {
      view = data.view as View;
      draw();
    } else if (data.part) {
      place = { part: data.part, side: (data.side || undefined) as Side | undefined };
      tab = "score";
      draw();
    } else if (data.score) {
      send(painWords(place, Number(data.score)));
      place = null;
      dialog.close();
    } else if (data.answer) {
      const answer = [...REPLIES, ...WANTS].find((item) => item.id === data.answer);
      flushPlace();
      if (answer) send(answer);
      dialog.close();
    }
  });
  dialog.addEventListener("keydown", (event) => {
    const zone = (event.target as Element).closest("[data-part]");
    if (!zone || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    zone.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  // Back button or Esc.
  dialog.addEventListener("close", flushPlace);

  document.querySelector<HTMLButtonElement>("#open-answers")?.addEventListener("click", () => {
    options.onOpen();
    flushPlace();
    lang = options.lang();
    tab = "reply";
    view = "front";
    place = null;
    draw();
    dialog.showModal();
  });
}
