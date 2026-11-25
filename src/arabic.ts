/**
 * Rough read-aloud hangul from Google's Latin transliteration of Arabic
 * (e.g. "alraja' rafe aldhirae"). Only used when there is no hand-written or
 * Gemini reading. Google writes ع as "e", ء as "'" and leaves ال unassimilated.
 */

const CHO = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
const JUNG = [..."ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"];
const JONG: Record<string, number> = { ㄴ: 4, ㄹ: 8, ㅁ: 16, ㅅ: 19 };

const ONSET: Record<string, string> = {
  b: "ㅂ", t: "ㅌ", th: "ㅅ", j: "ㅈ", g: "ㄱ", h: "ㅎ", kh: "ㅋ", d: "ㄷ", dh: "ㄷ", r: "ㄹ", z: "ㅈ",
  s: "ㅅ", sh: "sh", gh: "ㄱ", f: "ㅍ", v: "ㅂ", p: "ㅍ", q: "ㄲ", k: "ㅋ", l: "ㄹ", m: "ㅁ", n: "ㄴ",
  w: "w", y: "y",
};

const SUN = /^al(th|dh|sh|[tdrzsn])/;

function syllable(cho: string, jung: string): string {
  return String.fromCharCode(0xac00 + CHO.indexOf(cho) * 588 + JUNG.indexOf(jung) * 28);
}

/** Consonant + vowel as one hangul block. */
function block(onset: string, vowel: "a" | "i" | "u"): string {
  const plain = { a: "ㅏ", i: "ㅣ", u: "ㅜ" }[vowel];
  const soft = { a: "ㅑ", i: "ㅣ", u: "ㅠ" }[vowel];
  if (onset === "sh") return syllable("ㅅ", soft);
  if (onset === "y") return syllable("ㅇ", soft);
  if (onset === "w") return syllable("ㅇ", { a: "ㅘ", i: "ㅟ", u: "ㅜ" }[vowel]);
  return syllable(onset, plain);
}

/** Add a final consonant to the last block; false when that block cannot take one. */
function close(out: string[], jong: string): boolean {
  const code = (out[out.length - 1] ?? "").charCodeAt(0);
  if (!(code >= 0xac00 && code <= 0xd7a3) || (code - 0xac00) % 28 !== 0) return false;
  out[out.length - 1] = String.fromCharCode(code + JONG[jong]);
  return true;
}

function wordToHangul(raw: string): string {
  let word = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z']/g, "");
  // Sun letters: al + r… is said ar-r….
  word = word.replace(SUN, "a$1$1");
  // ع is a throaty "a" unless a written vowel already follows it.
  word = word.replace(/e(?=[aiu])/g, "").replace(/e/g, "'a").replace(/o/g, "u");

  const units = word.match(/th|dh|kh|gh|sh|aa|ii|uu|[aiu]|[a-z]|'/g) ?? [];
  const out: string[] = [];
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    if (unit === "'") continue;
    if (/^[aiu]+$/.test(unit)) {
      out.push(block("ㅇ", unit[0] as "a" | "i" | "u"));
      continue;
    }
    const onset = ONSET[unit];
    if (!onset) continue;
    const next = units[i + 1];
    if (next && /^[aiu]+$/.test(next)) {
      // Between vowels l is clear: "ila" is 일라, not 이라.
      if (unit === "l") close(out, "ㄹ");
      out.push(block(onset, next[0] as "a" | "i" | "u"));
      i++;
      continue;
    }
    if (unit === "n" && close(out, "ㄴ")) continue;
    if (unit === "m" && close(out, "ㅁ")) continue;
    if (unit === "l" && close(out, "ㄹ")) continue;
    if (next === unit && !"rwy".includes(unit) && close(out, "ㅅ")) continue;
    if (unit === "y") out.push("이");
    else if (unit === "w") out.push("우");
    else if (unit === "sh") out.push("시");
    else out.push(syllable(onset, "ㅡ"));
  }
  return out.join("");
}

export function arabicLatinToHangul(latin: string): string {
  return latin
    .split(/[\s\-]+/)
    .map(wordToHangul)
    .filter(Boolean)
    .join(" ");
}
