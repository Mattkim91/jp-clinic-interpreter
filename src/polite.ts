/** Turn a plain dictionary-form instruction into ～てください / ～ないでください. */

const GODAN_RU = [
  "走る",
  "入る",
  "切る",
  "知る",
  "帰る",
  "減る",
  "要る",
  "蹴る",
  "滑る",
  "参る",
  "限る",
  "握る",
  "練る",
  "照る",
  "茂る",
  "罵る",
  "覆る",
  "翻る",
  "捻る",
  "散る",
  "煎る",
  "競る",
  "焦る",
  "しゃべる",
];

const I_ROW = new Set([..."いきしちにひみりぎじびぴ"]);
const E_ROW = new Set([..."えけせてねへめれげぜでべぺ"]);

export function cleanJa(ja: string): string {
  return ja.replace(/\s+/g, " ").trim().replace(/[。．.！!？?\s]+$/g, "");
}

export function isNegativeCommand(ko: string): boolean {
  return /(지\s*마세요|지\s*마십시오|지\s*말아|지\s*마|마세요|마십시오|말아\s*주세요)\s*$/.test(ko.trim());
}

/** "드셨어요", "주무셨어요": asks what the patient did. Praise (잘하셨어요, 수고하셨어요) is not a question. */
function asksPast(ko: string): boolean {
  return (
    /(주무셨|드셨|다녀오셨|보셨|넘어지셨|다치셨|받으셨|괜찮으셨|어지러우셨|아프셨|불편하셨|씻으셨|있으셨|없으셨|쉬셨|어떠셨|하셨)(어요|나요|죠|습니까)[\s.!?~]*$/.test(ko) &&
    !/(잘|수고|고생|열심히|많이|훌륭하게|성공)\s*하셨/.test(ko)
  );
}

/** "힘이 안 들어가세요": nobody is told to do a thing with 안/못 in front. */
function asksCannot(ko: string): boolean {
  return /(^|\s)(안|못)\s+[가-힣]+(세요|셔요)[\s.!?~]*$/.test(ko);
}

/** Asked, whether or not speech recognition wrote the question mark. 볼까요/시겠어요 are requests. */
export function isQuestion(ko: string): boolean {
  const s = ko.trim();
  if (/(볼까요|실까요|할까요|시겠어요|실래요|시겠습니까)[\s.!?？~]*$/.test(s)) return false;
  if (/[?？]\s*$/.test(s)) return true;
  return asksCondition(s) || /(까요|나요|[습십입합됩납]니까|[인은는던한신]가요|는지요)[\s.!~]*$/.test(s);
}

/** "아프세요" and the like: asks about the patient. Speech recognition leaves the question mark out. */
export function asksCondition(ko: string): boolean {
  if (asksPast(ko.trim()) || asksCannot(ko.trim())) return true;
  return /(아프|어지러우|힘드|피곤하|괜찮으|불편하|저리|시리|결리|무거우|뻣뻣하|답답하|숨(?:이)?\s*차|가쁘|추우|더우|졸리|메스꺼우|무서우|어떠|(?:이|가|은|는|통증|느낌)\s*있으|없으|않으|느껴지)\s*(세요|셔요|십니까)[\s.!?~]*$/.test(ko.trim());
}

export function isCommand(ko: string): boolean {
  const s = ko.trim();
  if (/[?？]\s*$/.test(s) || asksCondition(s)) return false;
  if (/(까요|나요|습니까|인가요|는지요|는지)\s*$/.test(s)) return false;
  if (isNegativeCommand(s)) return true;
  return /(세요|십시오|주세요|줘요|합시다|해보세요|바랍니다|주십시오)\s*$/.test(s);
}

function isIchidan(verb: string): boolean {
  if (!verb.endsWith("る")) return false;
  if (GODAN_RU.some((item) => verb.endsWith(item))) return false;
  const prev = verb.slice(-2, -1);
  return I_ROW.has(prev) || E_ROW.has(prev);
}

function toTe(verb: string): string | null {
  if (verb.endsWith("する")) return verb.slice(0, -2) + "して";
  if (verb.endsWith("来る")) return verb.slice(0, -1) + "て";
  if (verb.endsWith("くる")) return verb.slice(0, -2) + "きて";
  if (verb.endsWith("行く")) return verb.slice(0, -1) + "って";
  if (verb.endsWith("いく")) return verb.slice(0, -2) + "いって";
  if (isIchidan(verb)) return verb.slice(0, -1) + "て";
  const last = verb.slice(-1);
  const table: Record<string, string> = {
    う: "って",
    つ: "って",
    る: "って",
    く: "いて",
    ぐ: "いで",
    す: "して",
    ぬ: "んで",
    ぶ: "んで",
    む: "んで",
  };
  const tail = table[last];
  if (!tail) return null;
  return verb.slice(0, -1) + tail;
}

function toNai(verb: string): string | null {
  if (verb.endsWith("する")) return verb.slice(0, -2) + "しない";
  if (verb.endsWith("来る")) return verb.slice(0, -1) + "ない";
  if (verb.endsWith("くる")) return verb.slice(0, -2) + "こない";
  if (verb.endsWith("行く")) return verb.slice(0, -1) + "かない";
  if (isIchidan(verb)) return verb.slice(0, -1) + "ない";
  const last = verb.slice(-1);
  const table: Record<string, string> = {
    う: "わない",
    つ: "たない",
    る: "らない",
    く: "かない",
    ぐ: "がない",
    す: "さない",
    ぬ: "なない",
    ぶ: "ばない",
    む: "まない",
  };
  const tail = table[last];
  if (!tail) return null;
  return verb.slice(0, -1) + tail;
}

function splitVerb(sentence: string): { prefix: string; verb: string } | null {
  const withParticle = sentence.match(/^(.*[をにへでとがはもや])([一-龯々〆ヵヶ]*[ぁ-んー]+)$/);
  if (withParticle) return { prefix: withParticle[1], verb: withParticle[2] };
  const whole = sentence.match(/^([一-龯々〆ヵヶ]+[ぁ-んー]+|[ぁ-んー]{2,})$/);
  if (whole) return { prefix: "", verb: whole[1] };
  const tail = sentence.match(/^(.*)([一-龯々〆ヵヶ]+[ぁ-んー]+)$/);
  if (tail) return { prefix: tail[1], verb: tail[2] };
  return null;
}

function alreadyPolite(s: string): boolean {
  return /(ください|下さい|ましょう|ません|くださいね|ましょうね|でした|です)$/.test(s);
}

const ICHIDAN_STEMS = /(起き|降り|下り|落ち|閉じ|借り|感じ|信じ|過ぎ|足り|浴び|伸び|[てで]い|^い|[見着寝出似煮])$/;
const GODAN_TE: Record<string, string> = { い: "って", き: "いて", ぎ: "いで", し: "して", ち: "って", り: "って", み: "んで", び: "んで", に: "んで" };

/** Polite stem (before ます/なさい) → て form; null when unsure. */
function stemToTe(stem: string): string | null {
  if (/(でき|あり|られ)$/.test(stem)) return null;
  if (/行き$/.test(stem)) return `${stem.slice(0, -1)}って`;
  const last = stem.slice(-1);
  if (ICHIDAN_STEMS.test(stem) || E_ROW.has(last)) return `${stem}て`;
  const te = GODAN_TE[last];
  return te ? stem.slice(0, -1) + te : null;
}

/** A question shown without any question mark or か reads like a statement. */
function markQuestion(s: string): string {
  return /(い|う|く|ぐ|す|つ|ぬ|ぶ|む|る|た|だ|ん)$/.test(s) ? `${s}？` : s;
}

export function politify(ja: string, ko: string): string {
  const s = cleanJa(ja);
  if (!s) return s;
  if (isQuestion(ko)) return markQuestion(s);
  // A translation that came back as a question is never made into an order.
  if (/[?？]\s*$/.test(ja.trim()) || !isCommand(ko)) return s;
  if (alreadyPolite(s)) return s;
  if (isNegativeCommand(ko)) return toNegativeRequest(s);
  // "don't" only when the Korean says so: 力が入らない is no order.
  if (/ない$/.test(s)) return /지\s*(는|도|를)?\s*(말|마)/.test(ko) ? s + "でください" : s;
  const polite = s.match(/^(.+)(ます|なさい)$/);
  if (polite) {
    const te = stemToTe(polite[1]);
    return te ? `${te}ください` : s;
  }
  const parts = splitVerb(s);
  if (!parts) return s;
  const te = toTe(parts.verb);
  if (!te) return s;
  return parts.prefix + te + "ください";
}

function toNegativeRequest(s: string): string {
  if (/(ないでください|ないで下さい|ないで)$/.test(s)) {
    return s.endsWith("ください") || s.endsWith("下さい") ? s : s + "ください";
  }
  if (/ません$/.test(s)) return s;
  if (/(ては|では|ちゃ|じゃ)(いけない|ならない)$/.test(s)) return s.replace(/(いけ|なら)ない$/, "$1ません");
  if (/ない$/.test(s)) return s + "でください";
  if (/[くな]$/.test(s) && s.endsWith("な") && splitVerb(s.slice(0, -1))) {
    const stem = s.slice(0, -1);
    const parts = splitVerb(stem);
    if (parts) {
      const nai = toNai(parts.verb);
      if (nai) return parts.prefix + nai + "でください";
    }
  }
  const parts = splitVerb(s);
  if (!parts) return s;
  const nai = toNai(parts.verb);
  if (!nai) return s;
  return parts.prefix + nai + "でください";
}
