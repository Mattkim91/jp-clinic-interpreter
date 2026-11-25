/**
 * Read-aloud hangul for Japanese, for a Korean speaker treating a patient.
 *
 * This is not the loanword orthography (which writes word-initial カ as 가 and
 * drops long vowels). Every カ-row kana stays 카/키/쿠/케/코, long vowels are
 * doubled so the therapist holds them, っ is ㅅ batchim, and ん is ㅇ before
 * k/g and ㄴ otherwise. Korean consonant assimilation then makes ㅅ and ㄴ
 * sound like the following consonant when the therapist reads straight through.
 */

export type Vowel = "a" | "i" | "u" | "e" | "o";
type Onset =
  | "vowel"
  | "k"
  | "g"
  | "s"
  | "z"
  | "t"
  | "d"
  | "n"
  | "h"
  | "b"
  | "p"
  | "m"
  | "y"
  | "r"
  | "w"
  | "f";

type Mora =
  | { type: "space" }
  | { type: "sokuon" }
  | { type: "hatsuon" }
  | { type: "chouon" }
  | { type: "kana"; kana: string; hangul: string; vowel: Vowel; onset: Onset };

const JONG: Record<string, number> = {
  ㄴ: 4,
  ㅁ: 16,
  ㅅ: 19,
  ㅇ: 21,
};

const VOWEL_HANGUL: Record<Vowel, string> = {
  a: "아",
  i: "이",
  u: "우",
  e: "에",
  o: "오",
};

function row(
  kanas: string,
  hanguls: string[],
  vowels: Vowel[],
  onset: Onset,
): [string, string, Vowel, Onset][] {
  const chars = [...kanas];
  return chars.map((kana, i) => [kana, hanguls[i], vowels[i], onset]);
}

const VOWELS: Vowel[] = ["a", "i", "u", "e", "o"];
const AYE: Vowel[] = ["a", "u", "o"];

const TABLE = new Map<string, { hangul: string; vowel: Vowel; onset: Onset }>();

function add(entries: [string, string, Vowel, Onset][]) {
  for (const [kana, hangul, vowel, onset] of entries) {
    TABLE.set(kana, { hangul, vowel, onset });
  }
}

add([
  ...row("あいうえお", ["아", "이", "우", "에", "오"], VOWELS, "vowel"),
  ...row("かきくけこ", ["카", "키", "쿠", "케", "코"], VOWELS, "k"),
  ...row("がぎぐげご", ["가", "기", "구", "게", "고"], VOWELS, "g"),
  ...row("さしすせそ", ["사", "시", "스", "세", "소"], VOWELS, "s"),
  ...row("ざじずぜぞ", ["자", "지", "즈", "제", "조"], VOWELS, "z"),
  ...row("たちつてと", ["타", "치", "츠", "테", "토"], VOWELS, "t"),
  ...row("だぢづでど", ["다", "지", "즈", "데", "도"], VOWELS, "d"),
  ...row("なにぬねの", ["나", "니", "누", "네", "노"], VOWELS, "n"),
  ...row("はひふへほ", ["하", "히", "후", "헤", "호"], VOWELS, "h"),
  ...row("ばびぶべぼ", ["바", "비", "부", "베", "보"], VOWELS, "b"),
  ...row("ぱぴぷぺぽ", ["파", "피", "푸", "페", "포"], VOWELS, "p"),
  ...row("まみむめも", ["마", "미", "무", "메", "모"], VOWELS, "m"),
  ...row("やゆよ", ["야", "유", "요"], AYE, "y"),
  ...row("らりるれろ", ["라", "리", "루", "레", "로"], VOWELS, "r"),
  ...row("わゐゑを", ["와", "이", "에", "오"], ["a", "i", "e", "o"], "w"),
  ["ゔ", "브", "u", "b"],
  ["きゃ", "캬", "a", "k"], ["きゅ", "큐", "u", "k"], ["きょ", "쿄", "o", "k"],
  ["ぎゃ", "갸", "a", "g"], ["ぎゅ", "규", "u", "g"], ["ぎょ", "교", "o", "g"],
  ["しゃ", "샤", "a", "s"], ["しゅ", "슈", "u", "s"], ["しょ", "쇼", "o", "s"],
  ["じゃ", "자", "a", "z"], ["じゅ", "주", "u", "z"], ["じょ", "조", "o", "z"],
  ["ちゃ", "차", "a", "t"], ["ちゅ", "추", "u", "t"], ["ちょ", "초", "o", "t"],
  ["にゃ", "냐", "a", "n"], ["にゅ", "뉴", "u", "n"], ["にょ", "뇨", "o", "n"],
  ["ひゃ", "햐", "a", "h"], ["ひゅ", "휴", "u", "h"], ["ひょ", "효", "o", "h"],
  ["びゃ", "뱌", "a", "b"], ["びゅ", "뷰", "u", "b"], ["びょ", "뵤", "o", "b"],
  ["ぴゃ", "퍄", "a", "p"], ["ぴゅ", "퓨", "u", "p"], ["ぴょ", "표", "o", "p"],
  ["みゃ", "먀", "a", "m"], ["みゅ", "뮤", "u", "m"], ["みょ", "묘", "o", "m"],
  ["りゃ", "랴", "a", "r"], ["りゅ", "류", "u", "r"], ["りょ", "료", "o", "r"],
  ["ふぁ", "파", "a", "f"],
  ["ふぃ", "피", "i", "f"],
  ["ふぇ", "페", "e", "f"],
  ["ふぉ", "포", "o", "f"],
  ["てぃ", "티", "i", "t"],
  ["とぅ", "투", "u", "t"],
  ["でぃ", "디", "i", "d"],
  ["どぅ", "두", "u", "d"],
  ["うぃ", "위", "i", "w"],
  ["うぇ", "웨", "e", "w"],
  ["うぉ", "워", "o", "w"],
  ["ヴぁ", "바", "a", "b"],
  ["ヴぃ", "비", "i", "b"],
  ["ヴぇ", "베", "e", "b"],
  ["ヴぉ", "보", "o", "b"],
  ["ちぇ", "체", "e", "t"],
  ["じぇ", "제", "e", "z"],
  ["しぇ", "셰", "e", "s"],
  ["つぁ", "차", "a", "t"],
  ["つぃ", "치", "i", "t"],
  ["つぇ", "체", "e", "t"],
  ["つぉ", "초", "o", "t"],
]);

const SMALL = new Set([..."ゃゅょぁぃぅぇぉ"]);

export function katakanaToHiragana(input: string): string {
  return input.normalize("NFKC").replace(/[\u30a1-\u30f6]/g, (ch) => {
    return String.fromCharCode(ch.charCodeAt(0) - 0x60);
  });
}

function tokenize(input: string): Mora[] {
  const s = katakanaToHiragana(input);
  const out: Mora[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === " " || c === "\u3000" || c === "・" || c === "、" || c === "。") {
      out.push({ type: "space" });
      continue;
    }
    if (c === "っ") {
      out.push({ type: "sokuon" });
      continue;
    }
    if (c === "ん") {
      out.push({ type: "hatsuon" });
      continue;
    }
    if (c === "ー" || c === "-" || c === "−") {
      out.push({ type: "chouon" });
      continue;
    }
    const next = s[i + 1];
    if (next && SMALL.has(next)) {
      const combo = c + next;
      const hit = TABLE.get(combo);
      if (hit) {
        out.push({ type: "kana", kana: combo, ...hit });
        i++;
        continue;
      }
    }
    const hit = TABLE.get(c);
    if (hit) {
      out.push({ type: "kana", kana: c, ...hit });
      continue;
    }
  }
  return out;
}

function addJong(chars: string[], jong: "ㅅ" | "ㄴ" | "ㅇ" | "ㅁ") {
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i] === " ") continue;
    const code = chars[i].charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return;
    const n = code - 0xac00;
    const cho = Math.floor(n / 588);
    const jung = Math.floor((n % 588) / 28);
    const existing = n % 28;
    if (existing !== 0) return;
    chars[i] = String.fromCharCode(0xac00 + cho * 588 + jung * 28 + JONG[jong]);
    return;
  }
}

function lengthen(chars: string[], vowels: (Vowel | null)[]) {
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i] === " ") continue;
    const vowel = vowels[i];
    if (!vowel) return;
    chars.push(VOWEL_HANGUL[vowel]);
    vowels.push(vowel);
    return;
  }
}

function isLongPair(current: Extract<Mora, { type: "kana" }>, next: Mora): boolean {
  if (next.type !== "kana") return false;
  if ((current.kana === "て" || current.kana === "で") && next.kana === "い") return false;
  if (current.vowel === "o" && (next.kana === "う" || next.kana === "お")) return true;
  if (current.vowel === "e" && (next.kana === "い" || next.kana === "え")) return true;
  if (current.vowel === "a" && next.kana === "あ") return true;
  if (current.vowel === "i" && next.kana === "い") return true;
  if (current.vowel === "u" && next.kana === "う") return true;
  return false;
}

function hatsuonJong(next: Mora | undefined): "ㄴ" | "ㅇ" {
  if (!next || next.type !== "kana") return "ㄴ";
  if (next.onset === "k" || next.onset === "g") return "ㅇ";
  return "ㄴ";
}

/** Convert a kana string (hiragana or katakana, spaces allowed) to hangul. */
export function kanaToHangul(input: string): string {
  const morae = tokenize(input);
  const chars: string[] = [];
  const vowels: (Vowel | null)[] = [];
  const push = (text: string, vowel: Vowel | null) => {
    chars.push(text);
    vowels.push(vowel);
  };

  for (let i = 0; i < morae.length; i++) {
    const mora = morae[i];
    if (mora.type === "space") {
      if (chars.length && chars[chars.length - 1] !== " ") push(" ", null);
      continue;
    }
    if (mora.type === "sokuon") {
      addJong(chars, "ㅅ");
      continue;
    }
    if (mora.type === "hatsuon") {
      addJong(chars, hatsuonJong(morae[i + 1]));
      continue;
    }
    if (mora.type === "chouon") {
      lengthen(chars, vowels);
      continue;
    }
    const next = morae[i + 1];
    if (next && isLongPair(mora, next)) {
      push(mora.hangul, mora.vowel);
      lengthen(chars, vowels);
      i++;
      continue;
    }
    push(mora.hangul, mora.vowel);
  }

  return spaceCueWords(chars.join("").replace(/\s+/g, " ").trim());
}

/** Put a breath space before the request ending when it was glued on. */
export function spaceCueWords(hangul: string): string {
  return hangul
    .replace(/([가-힣])(쿠다사이)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

export function digitsToHangul(raw: string): string {
  return /^\d+$/.test(raw) ? kanaToHangul(numberToKana(raw)) : raw;
}

const DOUBLED = new Set(["k", "g", "s", "t", "d", "p", "b", "c", "f", "j"]);
const JOIN_PARTICLE = new Set(["wa", "ga", "o", "wo", "ni", "e", "de", "to", "mo", "no", "ya", "ne", "yo"]);
const JOIN_PREFIX = new Set(["o", "go"]);

const ROMAJI_TO_KANA = new Map<string, string>([
  ["kya", "きゃ"], ["kyu", "きゅ"], ["kyo", "きょ"],
  ["gya", "ぎゃ"], ["gyu", "ぎゅ"], ["gyo", "ぎょ"],
  ["sha", "しゃ"], ["shu", "しゅ"], ["sho", "しょ"], ["shi", "し"],
  ["sya", "しゃ"], ["syu", "しゅ"], ["syo", "しょ"],
  ["cha", "ちゃ"], ["chu", "ちゅ"], ["cho", "ちょ"], ["chi", "ち"],
  ["tya", "ちゃ"], ["tyu", "ちゅ"], ["tyo", "ちょ"], ["tsu", "つ"],
  ["ja", "じゃ"], ["ju", "じゅ"], ["jo", "じょ"], ["ji", "じ"],
  ["jya", "じゃ"], ["jyu", "じゅ"], ["jyo", "じょ"],
  ["nya", "にゃ"], ["nyu", "にゅ"], ["nyo", "にょ"],
  ["hya", "ひゃ"], ["hyu", "ひゅ"], ["hyo", "ひょ"],
  ["bya", "びゃ"], ["byu", "びゅ"], ["byo", "びょ"],
  ["pya", "ぴゃ"], ["pyu", "ぴゅ"], ["pyo", "ぴょ"],
  ["mya", "みゃ"], ["myu", "みゅ"], ["myo", "みょ"],
  ["rya", "りゃ"], ["ryu", "りゅ"], ["ryo", "りょ"],
  ["fa", "ふぁ"], ["fi", "ふぃ"], ["fe", "ふぇ"], ["fo", "ふぉ"], ["fu", "ふ"],
  ["va", "ヴぁ"], ["vi", "ヴぃ"], ["ve", "ヴぇ"], ["vo", "ヴぉ"],
  ["ka", "か"], ["ki", "き"], ["ku", "く"], ["ke", "け"], ["ko", "こ"],
  ["ga", "が"], ["gi", "ぎ"], ["gu", "ぐ"], ["ge", "げ"], ["go", "ご"],
  ["sa", "さ"], ["si", "し"], ["su", "す"], ["se", "せ"], ["so", "そ"],
  ["za", "ざ"], ["zi", "じ"], ["zu", "ず"], ["ze", "ぜ"], ["zo", "ぞ"],
  ["ta", "た"], ["ti", "ち"], ["tu", "つ"], ["te", "て"], ["to", "と"],
  ["da", "だ"], ["di", "ぢ"], ["du", "づ"], ["de", "で"], ["do", "ど"],
  ["na", "な"], ["ni", "に"], ["nu", "ぬ"], ["ne", "ね"], ["no", "の"],
  ["ha", "は"], ["hi", "ひ"], ["hu", "ふ"], ["he", "へ"], ["ho", "ほ"],
  ["ba", "ば"], ["bi", "び"], ["bu", "ぶ"], ["be", "べ"], ["bo", "ぼ"],
  ["pa", "ぱ"], ["pi", "ぴ"], ["pu", "ぷ"], ["pe", "ぺ"], ["po", "ぽ"],
  ["ma", "ま"], ["mi", "み"], ["mu", "む"], ["me", "め"], ["mo", "も"],
  ["ya", "や"], ["yu", "ゆ"], ["yo", "よ"],
  ["ra", "ら"], ["ri", "り"], ["ru", "る"], ["re", "れ"], ["ro", "ろ"],
  ["wa", "わ"], ["wi", "うぃ"], ["we", "うぇ"], ["wo", "を"],
  ["a", "あ"], ["i", "い"], ["u", "う"], ["e", "え"], ["o", "お"],
]);

const DIGIT_KANA = ["", "イチ", "ニ", "サン", "ヨン", "ゴ", "ロク", "ナナ", "ハチ", "キュウ"];

function numberToKana(raw: string): string {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 999) return raw;
  if (n === 0) return "ゼロ";
  if (n < 10) return DIGIT_KANA[n];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return (tens === 1 ? "" : DIGIT_KANA[tens]) + "ジュー" + (ones ? DIGIT_KANA[ones] : "");
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = (hundreds === 1 ? "" : DIGIT_KANA[hundreds]) + "ヒャク";
  return rest === 0 ? head : head + numberToKana(String(rest));
}

function romajiWordToKana(word: string): string {
  const s = word
    .toLowerCase()
    .replace(/[āâ]/g, "a-")
    .replace(/[īî]/g, "i-")
    .replace(/[ūû]/g, "u-")
    .replace(/[ēê]/g, "e-")
    .replace(/[ōô]/g, "o-")
    .replace(/tch/g, "っch")
    .replace(/cch/g, "っch");
  let kana = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const next = s[i + 1];
    if (c === "-") {
      kana += "ー";
      continue;
    }
    if (c === "'" || c === "っ") {
      if (c === "っ") kana += "っ";
      continue;
    }
    if (DOUBLED.has(c) && next === c) {
      kana += "っ";
      continue;
    }
    if (c === "n" && (next === undefined || next === "'" || (next !== "-" && !"aiueoy".includes(next)))) {
      kana += "ん";
      if (next === "'") i++;
      continue;
    }
    if (c === "m" && (next === "b" || next === "p")) {
      kana += "ん";
      continue;
    }
    let matched = "";
    for (const len of [3, 2, 1]) {
      const slice = s.slice(i, i + len);
      if (ROMAJI_TO_KANA.has(slice)) {
        matched = slice;
        break;
      }
    }
    if (!matched) continue;
    kana += ROMAJI_TO_KANA.get(matched) ?? "";
    i += matched.length - 1;
  }
  return kana;
}

function romajiWordToHangul(word: string): string {
  if (/^\d+$/.test(word)) return kanaToHangul(numberToKana(word));
  return kanaToHangul(romajiWordToKana(word));
}

/**
 * Google romaji fallback. Particles は/を/へ are already pronounced (wa/o/e)
 * when the romaji comes from that API. A lone leading "o"/"go" is the honorific
 * and is joined to the next word; a later lone "o" is を.
 */
export function romajiToHangul(romaji: string): string {
  const words = romaji
    .replace(/[.,!?]/g, " ")
    .split(/[\s\-]+/)
    .map((w) => w.trim())
    .filter(Boolean);

  const groups: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const key = words[i].toLowerCase().replace(/[āīūēōâîûêô]/g, (ch) => {
      const map: Record<string, string> = { ā: "a", ī: "i", ū: "u", ē: "e", ō: "o", â: "a", î: "i", û: "u", ê: "e", ô: "o" };
      return map[ch] ?? ch;
    });
    const bare = key.replace(/-/g, "");
    if (groups.length > 0 && JOIN_PARTICLE.has(bare) && bare !== "go") {
      groups[groups.length - 1] += words[i];
      continue;
    }
    if (JOIN_PREFIX.has(bare) && i === 0 && words[i + 1]) {
      words[i + 1] = words[i] + words[i + 1];
      continue;
    }
    if (bare === "go" && words[i + 1]) {
      words[i + 1] = words[i] + words[i + 1];
      continue;
    }
    groups.push(words[i]);
  }
  return spaceCueWords(
    groups
      .map((word) => romajiWordToHangul(word))
      .filter(Boolean)
      .join(" "),
  );
}
