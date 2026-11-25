/** "오늘 카드 남기기": today's cards survive a reload on this phone. Off unless the therapist turns it on. */
const ON_KEY = "clinic-keep";
const CARDS_KEY = "clinic-cards";
const MAX_CARDS = 200;

export function dayOf(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function keepsCards(): boolean {
  try {
    return localStorage.getItem(ON_KEY) === "1";
  } catch {
    return false;
  }
}

/** Turning it off also removes what was kept. */
export function setKeepsCards(on: boolean): void {
  try {
    if (on) localStorage.setItem(ON_KEY, "1");
    else {
      localStorage.removeItem(ON_KEY);
      localStorage.removeItem(CARDS_KEY);
    }
  } catch {
    /* storage blocked */
  }
}

export function forgetCards(): void {
  try {
    localStorage.removeItem(CARDS_KEY);
  } catch {
    /* storage blocked */
  }
}

type Kept = { at: number; status: string };

/** Only finished cards made today. */
export function storeCards(cards: Kept[], now = Date.now()): void {
  if (!keepsCards()) return;
  const today = cards.filter((card) => card.status === "ready" && dayOf(card.at) === dayOf(now)).slice(-MAX_CARDS);
  try {
    if (today.length) localStorage.setItem(CARDS_KEY, JSON.stringify(today));
    else localStorage.removeItem(CARDS_KEY);
  } catch {
    /* storage blocked or full */
  }
}

/** Today's cards; anything older or unreadable is deleted. */
export function recallCards(valid: (card: Record<string, unknown>) => boolean, now = Date.now()): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(CARDS_KEY);
    if (!raw) return [];
    let list: unknown;
    try {
      list = JSON.parse(raw);
    } catch {
      list = null;
    }
    const cards = (Array.isArray(list) ? (list as Record<string, unknown>[]) : []).filter(
      (card) => card && typeof card.at === "number" && dayOf(card.at) === dayOf(now) && valid(card),
    );
    if (!keepsCards() || !cards.length) {
      localStorage.removeItem(CARDS_KEY);
      return [];
    }
    return cards;
  } catch {
    return [];
  }
}
