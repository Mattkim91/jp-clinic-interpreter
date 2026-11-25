import { asksCondition } from "./polite";

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
  { group: "자세 바꾸기", ko: "옮겨 앉아볼게요", ja: "移って座りましょう" },
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
/** Same spellings as EXACT, pointing at the preset's Korean line (used for other languages). */
export const EXACT_KEYS = new Map<string, string>();
for (const preset of PRESETS) {
  EXACT.set(normalize(preset.ko), preset.ja);
  EXACT.set(normalize(preset.ko).replace(/ /g, ""), preset.ja);
  EXACT.set(stripPunct(preset.ko), preset.ja);
  EXACT_KEYS.set(normalize(preset.ko), preset.ko);
  EXACT_KEYS.set(normalize(preset.ko).replace(/ /g, ""), preset.ko);
  EXACT_KEYS.set(stripPunct(preset.ko), preset.ko);
}

/** Words that may be dropped in front of a pinned command without losing meaning. */
const LEAD = "^(?:(?:자|네|예|이제|그럼|그러면)[\\s,.!]*)*";
/** Request endings after 들어/빼/숙여... A question mark is only a request with 볼까요, 시겠어요 and the like. */
const AFTER_EO =
  "\\s*(?:(?:보세요|보셔요|보십시오|봐요|봅시다|볼게요|보실게요|보겠습니다|주세요|주셔요|주십시오)[\\s.!~]*|(?:볼까요|보실까요|보시겠어요|보실래요|주시겠어요|주실래요)[\\s.!~?]*)$";
/** Request endings after the bare stem (올리-, 참-, 빼-). */
const AFTER_STEM = "(?:으?(?:세요|셔요|십시오|실게요)[\\s.!~]*|으?(?:실까요|시겠어요|실래요)[\\s.!~?]*)$";

/**
 * A pinned line replaces the whole sentence, so it must BE the whole sentence: a question,
 * a side, "~할 때" or a second instruction goes to the translator instead.
 */
function command(object: string, eo: string, stem: string): RegExp {
  return new RegExp(`${LEAD}${object}(?:(?:${eo})${AFTER_EO}|(?:${stem})${AFTER_STEM})`);
}

/** `key` names the matching line in phrases.ts for the other patient languages. */
export const PATTERNS: { re: RegExp; ja: string; key: string }[] = [
  {
    re: command("(?:숨(?:을)?\\s*)?(?:(?:크게|깊게|깊이)\\s*)?(?:숨(?:을)?\\s*)?들이(?:쉬|마시)고\\s*", "내쉬어|내뱉어|뱉어", "내쉬|내뱉|뱉"),
    ja: "深く息を吸って吐いてください",
    key: "깊게 들이쉬고 내쉬세요",
  },
  { re: command("(?:숨|호흡)(?:을)?\\s*", "참아|멈춰|멈추어", "참|멈추"), ja: "息を止めてください", key: "숨을 참으세요" },
  {
    re: command(
      "(?:숨(?:을)?\\s*(?:크게|깊이|깊게)|(?:크게|깊이|깊게)\\s*숨(?:을)?|(?:크게|깊이|깊게)(?=\\s*들이))\\s*",
      "들이쉬어|들이마셔|쉬어|마셔",
      "들이쉬|들이마시|쉬|마시",
    ),
    ja: "息を大きく吸ってください",
    key: "숨 크게 쉬세요",
  },
  { re: command("엉덩이(?:를|을)?\\s*(?:좀\\s*)?(?:위로\\s*)?", "들어\\s*올려|들어|올려", "들어\\s*올리|올리"), ja: "お尻を上げてください", key: "엉덩이 들어보세요" },
  { re: command("(?:배|복부)에?\\s*힘(?:을)?\\s*(?:좀\\s*)?", "줘|주어|넣어", "주|넣"), ja: "お腹に力を入れてください", key: "배에 힘을 주세요" },
  { re: command("어깨(?:에|의)?\\s*힘(?:을)?\\s*(?:좀\\s*)?", "빼", "빼"), ja: "肩の力を抜いてください", key: "어깨에 힘을 빼세요" },
  { re: command("허리(?:를)?\\s*", "(?:앞으로\\s*)?숙여|앞으로\\s*굽혀", "(?:앞으로\\s*)?숙이|앞으로\\s*굽히"), ja: "腰を前に曲げてください", key: "허리를 숙이세요" },
  { re: command("(?:반대쪽|반대편|반대)(?:으로|로)?\\s*", "돌아\\s*누워", "돌아\\s*누우"), ja: "反対側に向かって横になってください", key: "반대쪽으로 돌아누우세요" },
];

const BODY =
  "왼팔|오른팔|왼다리|오른다리|팔꿈치|골반|어깨|무릎|발목|손목|고개|허리|엉덩이|다리|머리|팔|발|손|가슴|턱";

export type Prepared = {
  original: string;
  query: string;
  overrideJa?: string;
  /** Korean meaning of the pinned line, when it is not word for word what was said. */
  meaning?: string;
};

export function stripPunct(input: string): string {
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
  const spelled = clarify(normalize(korean));
  const text = asksCondition(spelled) ? `${spelled.replace(/[\s.!?~]+$/, "")}?` : spelled;
  const lift = new RegExp(`(${BODY})(을|를)?\\s*((?:(?:살짝|조금|천천히|높이|더|좀|최대한|같이|번갈아)\\s*)*)들어\\s*(?:보세요|주세요|주십시오|보시오)`);
  const found = text.match(lift);
  if (found && !/들어\s*올리/.test(text)) {
    const noun = found[1];
    return text.replace(lift, `${noun}${eulReul(noun)} ${found[3]}위로 올려 주세요`);
  }
  return text;
}

/** "~지 마세요", "~지 말고", "~면 안 돼요": must never be swapped for the positive command. */
export function isNegated(korean: string): boolean {
  return /지\s*(는|도|를)?\s*(마세|마셔|마시|마십|마요|마라|마$|마[\s.,!?]|말|않|못)|면\s*안\s*(돼|되|됩|된)/.test(normalize(korean));
}

/** Optional lead-in and "don't" ending; anything longer goes to the translator so no clause is lost. */
const NOT_START = "^(?:절대로?\\s*|아직\\s*|지금은?\\s*|이제\\s*)?";
const NOT_END =
  "(?:지\\s*(?:는|도|를)?\\s*(?:마세요|마셔요|마십시오|마요|마|말아\\s*주세요|말아요)|으?면\\s*안\\s*(?:돼요|되요|됩니다|돼))[\\s.!]*$";

function dont(body: string): RegExp {
  return new RegExp(NOT_START + body + NOT_END);
}

/** Fixed "don't" lines: the keyless translator turns 숨 참지 마세요 into "don't breathe" and 배 into a boat. */
export const NEGATIVE_PATTERNS: { re: RegExp; ja: string; key: string }[] = [
  { re: dont("(?:숨|호흡)(?:을|은)?\\s*(?:참|멈추)"), ja: "息を止めないでください", key: "숨을 참지 마세요" },
  {
    re: /^(?:숨|호흡)(?:을|은)?\s*(?:참|멈추)지\s*말고\s*(?:편하게|편안하게|천천히|계속)?\s*(?:숨(?:을)?\s*)?(?:쉬세요|쉬어\s*보세요|쉬어\s*주세요|호흡하세요)[\s.!]*$/,
    ja: "息を止めないで、楽に呼吸してください",
    key: "숨을 참지 말고 편하게 쉬세요",
  },
  { re: dont("엉덩이(?:를|는)?\\s*(?:들|들어\\s*올리|올리)"), ja: "お尻を上げないでください", key: "엉덩이를 들지 마세요" },
  { re: dont("(?:배|복부)에?\\s*힘(?:을|은)?\\s*(?:주|넣)"), ja: "お腹に力を入れないでください", key: "배에 힘을 주지 마세요" },
  { re: dont("어깨에?\\s*힘(?:을|은)?\\s*빼"), ja: "肩の力を抜かないでください", key: "어깨에 힘을 빼지 마세요" },
  { re: dont("허리(?:를|는)?\\s*(?:앞으로\\s*)?(?:숙이|굽히)"), ja: "腰を前に曲げないでください", key: "허리를 숙이지 마세요" },
  { re: dont("(?:옆으로\\s*)?돌아\\s*눕"), ja: "横向きにならないでください", key: "돌아눕지 마세요" },
];

/** Spell out words the keyless translator misreads: 숨 참다 becomes "breathe", 배 a boat, 들 때 "when listening". */
function clarify(korean: string): string {
  return korean
    .replace(/숨(?:을)?\s*(크게|깊게|깊이)\s*쉬었/g, "숨을 $1 들이마셨")
    .replace(/숨(?:을)?\s*(크게|깊게|깊이)\s*쉴/g, "숨을 $1 들이마실")
    .replace(/숨(?:을)?\s*(크게|깊게|깊이)\s*쉬(면|고|니까)/g, "숨을 $1 들이마시$2")
    .replace(new RegExp(`(${BODY})(을|를)?\\s*들\\s*때`, "g"), "$1$2 들어올릴 때")
    .replace(new RegExp(`(${BODY})(을|를)?\\s*들(면|고)(?=\\s|$)`, "g"), "$1$2 들어올리$3")
    .replace(/(면|때)\s*아프(?=세요|셔요|십니까)/g, "$1 통증이 있으")
    .replace(/(^|\s)배(?:가|는)?\s*아프(?=세요|셔요|십니까)/g, "$1복부에 통증이 있으")
    .replace(/허리(?:를)?\s*숙일\s*때/g, "허리를 앞으로 굽힐 때")
    .replace(/허리(?:를)?\s*숙이면/g, "허리를 앞으로 굽히면")
    .replace(/(왼쪽|오른쪽)(?:으로)?\s*돌아\s*(?=누우|누워|누울|눕)/g, "$1을 향해 옆으로 ")
    .replace(/숨(을|은)?\s*참(지|기|고|는)/g, "호흡을 멈추$2")
    .replace(/숨(을|은)?\s*참으/g, "호흡을 멈추")
    .replace(/숨(을|은)?\s*참아/g, "호흡을 멈춰")
    .replace(/숨(을|은)?\s*참았/g, "호흡을 멈췄")
    .replace(/숨(을|은)?\s*참을/g, "호흡을 멈출")
    .replace(/(^|\s)배에\s*힘/g, "$1복부에 힘")
    .replace(/돌아\s*눕지/g, "옆으로 돌아서 눕지");
}

export function prepare(input: string): Prepared {
  const original = normalize(input);
  const compact = original.replace(/ /g, "");
  const exact = EXACT.get(original) ?? EXACT.get(compact) ?? EXACT.get(stripPunct(original));
  if (exact) return { original, query: original, overrideJa: exact };
  for (const pattern of isNegated(original) ? NEGATIVE_PATTERNS : PATTERNS) {
    if (pattern.re.test(original) || pattern.re.test(compact)) {
      return { original, query: original, overrideJa: pattern.ja, meaning: pattern.key };
    }
  }
  return { original, query: rewriteQuery(original) };
}
