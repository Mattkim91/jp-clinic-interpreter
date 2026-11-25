/**
 * Clinic phrases where a literal translation is unsafe.
 * 들다 is both "lift" and "listen", 쉬다 is both "breathe" and "rest",
 * 배 is both "belly" and "boat". Exact lines and a few patterns are pinned
 * to polite Japanese that was checked against a physical-therapy reading.
 */

export type Preset = { group: string; ko: string; ja: string };

export const PRESET_GROUPS: string[] = ["인사·상태", "자세 바꾸기", "팔·손", "다리·걷기", "호흡·운동", "칭찬·마무리"];

export const PRESETS: Preset[] = [
  { group: "인사·상태", ko: "안녕하세요?", ja: "こんにちは。" },
  { group: "인사·상태", ko: "식사는 하셨나요?", ja: "お食事はされましたか？" },
  { group: "인사·상태", ko: "컨디션은 괜찮으세요?", ja: "体調はいかがですか？" },
  { group: "인사·상태", ko: "아프세요?", ja: "痛いですか？" },
  { group: "인사·상태", ko: "어지러우세요?", ja: "めまいはしますか？" },
  { group: "인사·상태", ko: "피곤하세요?", ja: "お疲れですか？" },
  { group: "인사·상태", ko: "화장실 가고 싶으세요?", ja: "トイレに行きたいですか？" },
  { group: "인사·상태", ko: "아프면 말씀해 주세요", ja: "痛い場合は教えてください" },
  { group: "자세 바꾸기", ko: "옮겨 안아볼게요", ja: "体を支えて移しますね" },
  { group: "자세 바꾸기", ko: "제가 도와드릴게요", ja: "お手伝いしますね" },
  { group: "자세 바꾸기", ko: "일어나보세요", ja: "立ってみてください" },
  { group: "자세 바꾸기", ko: "천천히 일어나세요", ja: "ゆっくり起きてください" },
  { group: "자세 바꾸기", ko: "앉아보세요", ja: "座ってみてください" },
  { group: "자세 바꾸기", ko: "누워보세요", ja: "横になってみてください" },
  { group: "자세 바꾸기", ko: "옆으로 돌아누워 보세요", ja: "横向きになってみてください" },
  { group: "자세 바꾸기", ko: "침대 끝에 앉아볼게요", ja: "ベッドの端に座りましょう" },
  { group: "자세 바꾸기", ko: "똑바로 앉으세요", ja: "まっすぐ座ってください" },
  { group: "자세 바꾸기", ko: "앞으로 숙이세요", ja: "前にかがんでください" },
  { group: "자세 바꾸기", ko: "엉덩이 들어보세요", ja: "お尻を上げてください" },
  { group: "자세 바꾸기", ko: "발을 바닥에 붙이세요", ja: "足を床につけてください" },
  { group: "팔·손", ko: "팔 들어보세요", ja: "腕を上げてみてください" },
  { group: "팔·손", ko: "약한 쪽 팔을 들어보세요", ja: "弱い方の腕を上げてみてください" },
  { group: "팔·손", ko: "밀어보세요", ja: "押してみてください" },
  { group: "팔·손", ko: "당겨보세요", ja: "引いてみてください" },
  { group: "팔·손", ko: "올려보세요", ja: "上げてみてください" },
  { group: "팔·손", ko: "내려보세요", ja: "下ろしてみてください" },
  { group: "팔·손", ko: "손을 쥐어보세요", ja: "手を握ってみてください" },
  { group: "팔·손", ko: "손을 펴보세요", ja: "手を開いてみてください" },
  { group: "팔·손", ko: "제 손을 꽉 잡아보세요", ja: "私の手をぎゅっと握ってください" },
  { group: "팔·손", ko: "팔꿈치를 펴세요", ja: "肘を伸ばしてください" },
  { group: "팔·손", ko: "어깨에 힘을 빼세요", ja: "肩の力を抜いてください" },
  { group: "다리·걷기", ko: "다리 들어보세요", ja: "足を上げてみてください" },
  { group: "다리·걷기", ko: "뻥 차보세요", ja: "足を前に蹴り出してみてください" },
  { group: "다리·걷기", ko: "무릎 펴세요", ja: "膝を伸ばしてください" },
  { group: "다리·걷기", ko: "무릎을 굽히세요", ja: "膝を曲げてください" },
  { group: "다리·걷기", ko: "발목을 위로 당기세요", ja: "足首を上に曲げてください" },
  { group: "다리·걷기", ko: "약한 쪽 다리에 체중을 실어보세요", ja: "弱い方の足に体重をかけてみてください" },
  { group: "다리·걷기", ko: "난간을 잡으세요", ja: "手すりを持ってください" },
  { group: "다리·걷기", ko: "지팡이를 잡으세요", ja: "杖を持ってください" },
  { group: "다리·걷기", ko: "한 발 앞으로 내딛으세요", ja: "一歩前に出してください" },
  { group: "다리·걷기", ko: "천천히 걸어볼게요", ja: "ゆっくり歩きましょう" },
  { group: "다리·걷기", ko: "넘어지지 않게 잡고 있을게요", ja: "転ばないように支えていますね" },
  { group: "호흡·운동", ko: "숨 크게 쉬세요", ja: "息を大きく吸ってください" },
  { group: "호흡·운동", ko: "깊게 들이쉬고 내쉬세요", ja: "深く息を吸って吐いてください" },
  { group: "호흡·운동", ko: "배에 힘을 주세요", ja: "お腹に力を入れてください" },
  { group: "호흡·운동", ko: "힘을 빼세요", ja: "力を抜いてください" },
  { group: "호흡·운동", ko: "그대로 멈춰 주세요", ja: "そのまま止めてください" },
  { group: "호흡·운동", ko: "저를 보세요", ja: "私を見てください" },
  { group: "호흡·운동", ko: "하나, 둘, 셋", ja: "いち、に、さん" },
  { group: "호흡·운동", ko: "열 번 반복하세요", ja: "十回繰り返してください" },
  { group: "호흡·운동", ko: "다시 한번 해보세요", ja: "もう一度やってみてください" },
  { group: "호흡·운동", ko: "조금만 더요", ja: "もう少しです" },
  { group: "호흡·운동", ko: "통증이 있으면 멈추세요", ja: "痛みがある場合は止めてください" },
  { group: "칭찬·마무리", ko: "좋아요", ja: "いいですね" },
  { group: "칭찬·마무리", ko: "잘하셨어요", ja: "よくできました" },
  { group: "칭찬·마무리", ko: "잠깐 쉬었다 할게요", ja: "少し休みましょう" },
  { group: "칭찬·마무리", ko: "오늘은 여기까지입니다", ja: "今日はここまでです" },
  { group: "칭찬·마무리", ko: "수고하셨습니다", ja: "お疲れさまでした" },
];

const EXACT = new Map<string, string>();
for (const preset of PRESETS) {
  EXACT.set(normalize(preset.ko), preset.ja);
  EXACT.set(normalize(preset.ko).replace(/ /g, ""), preset.ja);
  EXACT.set(stripPunct(preset.ko), preset.ja);
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

function stripPunct(input: string): string {
  return input.replace(/[\s.,?!~。、？！]/g, "");
}

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
  const exact = EXACT.get(original) ?? EXACT.get(compact) ?? EXACT.get(stripPunct(original));
  if (exact) return { original, query: original, overrideJa: exact };
  for (const pattern of PATTERNS) {
    if (pattern.re.test(original) || pattern.re.test(compact)) {
      return { original, query: original, overrideJa: pattern.ja };
    }
  }
  return { original, query: rewriteQuery(original) };
}
