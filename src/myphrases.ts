/** Which lines the "자주 쓰는 말" panel shows on this phone: own lines, hidden presets and favourites. */
import { PRESET_GROUPS, PRESETS, stripPunct } from "./prepare";

export type Phrases = {
  /** Lines the therapist added, newest first. */
  custom: string[];
  /** Presets taken off the panel. */
  hidden: string[];
  /** Shown first, in the order they were starred. */
  favs: string[];
};

const KEY = "clinic-phrases";
export const MAX_LENGTH = 60;
const MAX_CUSTOM = 100;

const empty = (): Phrases => ({ custom: [], hidden: [], favs: [] });

/** Kept for this session too, so the panel works when storage is blocked. */
let memory: Phrases | null = null;

function texts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const lines = value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return [...new Set(lines)];
}

export function parsePhrases(raw: string | null): Phrases {
  try {
    const data = JSON.parse(raw ?? "null") as Partial<Phrases> | null;
    return { custom: texts(data?.custom), hidden: texts(data?.hidden), favs: texts(data?.favs) };
  } catch {
    return empty();
  }
}

export function loadPhrases(): Phrases {
  if (memory) return memory;
  try {
    memory = parsePhrases(localStorage.getItem(KEY));
  } catch {
    memory = empty();
  }
  return memory;
}

/** False when the phone did not let us store it. */
export function savePhrases(next: Phrases): boolean {
  memory = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function isCustom(store: Phrases, ko: string): boolean {
  return store.custom.includes(ko);
}

/** Every line still on the panel: own lines first, then the presets in their order. */
export function visiblePhrases(store: Phrases): string[] {
  return [...store.custom, ...PRESETS.map((preset) => preset.ko).filter((ko) => !store.hidden.includes(ko))];
}

export function phraseGroups(store: Phrases): { title: string; items: string[] }[] {
  const shown = new Set(visiblePhrases(store));
  const favs = store.favs.filter((ko) => shown.has(ko));
  const rest = (lines: string[]) => lines.filter((ko) => shown.has(ko) && !favs.includes(ko));
  return [
    { title: "★ 즐겨찾기", items: favs },
    { title: "내 문구", items: rest(store.custom) },
    ...PRESET_GROUPS.map((group) => ({
      title: group,
      items: rest(PRESETS.filter((preset) => preset.group === group).map((preset) => preset.ko)),
    })),
  ].filter((group) => group.items.length > 0);
}

export function addPhrase(store: Phrases, ko: string): { next: Phrases; message: string; added: boolean } {
  const same = (line: string) => stripPunct(line) === stripPunct(ko);
  if (!stripPunct(ko)) return { next: store, message: "문구를 적어 주세요.", added: false };
  if (ko.length > MAX_LENGTH) return { next: store, message: `${MAX_LENGTH}자까지 넣을 수 있습니다.`, added: false };
  const hidden = store.hidden.find(same);
  if (hidden) {
    return { next: { ...store, hidden: store.hidden.filter((line) => line !== hidden) }, message: `기본 문구 ‘${hidden}’을(를) 되돌렸습니다.`, added: true };
  }
  if (visiblePhrases(store).some(same)) return { next: store, message: "이미 있는 문구입니다.", added: false };
  if (store.custom.length >= MAX_CUSTOM) return { next: store, message: `내 문구는 ${MAX_CUSTOM}개까지 넣을 수 있습니다.`, added: false };
  return { next: { ...store, custom: [ko, ...store.custom] }, message: `‘${ko}’ 추가했습니다.`, added: true };
}

/** Own lines are deleted; presets are only hidden and can be brought back. */
export function removePhrase(store: Phrases, ko: string): Phrases {
  const favs = store.favs.filter((line) => line !== ko);
  if (isCustom(store, ko)) return { ...store, favs, custom: store.custom.filter((line) => line !== ko) };
  return { ...store, favs, hidden: [...store.hidden.filter((line) => line !== ko), ko] };
}

export function toggleFavorite(store: Phrases, ko: string): Phrases {
  const on = store.favs.includes(ko);
  return { ...store, favs: on ? store.favs.filter((line) => line !== ko) : [...store.favs, ko] };
}

export function resetPhrases(store: Phrases): Phrases {
  return { ...store, hidden: [] };
}
