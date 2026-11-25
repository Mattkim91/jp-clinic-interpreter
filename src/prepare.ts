/**
 * Clinic phrases where a literal translation is unsafe.
 * 들다 is both "lift" and "listen", 쉬다 is both "breathe" and "rest",
 * 배 is both "belly" and "boat". Exact lines and a few patterns are pinned
 * to polite Japanese that was checked against a physical-therapy reading.
 */

export type Preset = { label: string; ko: string; ja: string };

export const PRESETS: Preset[] = [
  { label: "엉덩이 들기", ko: "엉덩이 들어보세요", ja: "お尻を上げてください" },
  { label: "숨 크게", ko: "숨 크게 쉬세요", ja: "息を大きく吸ってください" },
  { label: "아프면 말하기", ko: "아프면 말씀해 주세요", ja: "痛い場合は教えてください" },
  { label: "천천히 일어나기", ko: "천천히 일어나세요", ja: "ゆっくり起きてください" },
  { label: "무릎 펴기", ko: "무릎 펴세요", ja: "膝を伸ばしてください" },
  { label: "팔 들기", ko: "팔 들어 올리세요", ja: "腕を上に持ち上げてください" },
  { label: "힘 빼기", ko: "힘을 빼세요", ja: "力を抜いてください" },
  { label: "잠깐 참기", ko: "조금만 참아 주세요", ja: "少し我慢してください" },
  { label: "이제 쉬기", ko: "이제 쉬세요", ja: "今休んでください" },
  { label: "아프면 멈추기", ko: "통증이 있으면 멈추세요", ja: "痛みがある場合は止めてください" },
  { label: "들이쉬고 내쉬기", ko: "깊게 들이쉬고 내쉬세요", ja: "深く息を吸って吐いてください" },
  { label: "그대로 멈춤", ko: "그대로 멈춰 주세요", ja: "そのまま止めてください" },
  { label: "이쪽 보기", ko: "이쪽을 보세요", ja: "こちらをご覧ください" },
  { label: "허리 펴기", ko: "허리를 펴세요", ja: "腰を伸ばしてください" },
  { label: "발목 돌리기", ko: "발목을 돌리세요", ja: "足首を回してください" },
  { label: "반대쪽 눕기", ko: "반대쪽으로 돌아누워 주세요", ja: "反対側に向かって横になってください" },
  { label: "고개 돌리기", ko: "고개를 천천히 돌리세요", ja: "頭をゆっくり回してください" },
  { label: "열 번", ko: "열 번 반복하세요", ja: "十回繰り返してください" },
  { label: "어깨 힘 빼기", ko: "어깨에 힘을 빼세요", ja: "肩の力を抜いてください" },
  { label: "배에 힘", ko: "배에 힘을 주세요", ja: "お腹に力を入れてください" },
];

const EXACT = new Map<string, string>();
for (const preset of PRESETS) {
  EXACT.set(normalize(preset.ko), preset.ja);
  EXACT.set(normalize(preset.ko).replace(/ /g, ""), preset.ja);
}

const PATTERNS: { re: RegExp; ja: string }[] = [
  { re: /들이쉬고\s*.*내쉬|들이마시고\s*.*내쉬|들이쉬고\s*.*뱉|깊게\s*들이쉬/, ja: "深く息を吸って吐いてください" },
  { re: /숨\s*참|숨을\s*참|숨\s*멈추|숨을\s*멈추/, ja: "息を止めてください" },
  { re: /숨\s*(을\s*)?(크게|깊이)|크게\s*숨|깊이\s*숨/, ja: "息を大きく吸ってください" },
  { re: /엉덩이.{0,8}(들어|올려)/, ja: "お尻を上げてください" },
  { re: /(배|복부).{0,6}힘.{0,6}(주|넣)/, ja: "お腹に力を入れてください" },
  { re: /어깨.{0,6}힘.{0,6}빼/, ja: "肩の力を抜いてください" },
  { re: /허리.{0,8}(숙|앞으로\s*굽)/, ja: "腰を前に曲げてください" },
  { re: /돌아\s*눕|돌아눕/, ja: "反対側に向かって横になってください" },
];

const BODY =
  "왼팔|오른팔|왼다리|오른다리|팔꿈치|골반|어깨|무릎|발목|손목|고개|허리|엉덩이|다리|머리|팔|발|손|가슴|턱";

export type Prepared = {
  original: string;
  query: string;
  overrideJa?: string;
};

export function normalize(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function eulReul(noun: string): "을" | "를" {
  const code = noun.charCodeAt(noun.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return "를";
  return (code - 0xac00) % 28 === 0 ? "를" : "을";
}

/** Korean sent to the translator, with homonyms nudged toward the rehab sense. */
export function rewriteQuery(korean: string): string {
  const text = normalize(korean);
  const lift = new RegExp(`(${BODY})(을|를)?\\s*들어\\s*(?:보세요|주세요|주십시오|보시오)`);
  const found = text.match(lift);
  if (found && !/들어\s*올리/.test(text)) {
    const noun = found[1];
    return text.replace(lift, `${noun}${eulReul(noun)} 위로 올려 주세요`);
  }
  return text;
}

export function prepare(input: string): Prepared {
  const original = normalize(input);
  const compact = original.replace(/ /g, "");
  const exact = EXACT.get(original) ?? EXACT.get(compact);
  if (exact) return { original, query: original, overrideJa: exact };
  for (const pattern of PATTERNS) {
    if (pattern.re.test(original) || pattern.re.test(compact)) {
      return { original, query: original, overrideJa: pattern.ja };
    }
  }
  return { original, query: rewriteQuery(original) };
}
