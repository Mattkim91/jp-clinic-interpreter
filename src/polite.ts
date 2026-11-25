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

/** "아프세요" and the like: asks how the patient feels. Speech recognition leaves the question mark out. */
export function asksCondition(ko: string): boolean {
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
  return /(ください|下さい|なさい|ましょう|ません)$/.test(s);
}

export function politify(ja: string, ko: string): string {
  const s = cleanJa(ja);
  if (!s) return s;
  // A translation that came back as a question is never made into an order.
  if (/[?？]\s*$/.test(ja.trim()) || !isCommand(ko)) return s;
  if (alreadyPolite(s)) return s;
  if (isNegativeCommand(ko)) return toNegativeRequest(s);
  if (/ない$/.test(s)) return s + "でください";
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
