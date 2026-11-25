/** How Japanese numbers are read together with the counter behind them (一人 is ひとり, 十回 is じゅっかい). */

const ONES = ["", "イチ", "ニ", "サン", "ヨン", "ゴ", "ロク", "ナナ", "ハチ", "キュウ"];
const HUNDREDS = ["", "ヒャク", "ニヒャク", "サンビャク", "ヨンヒャク", "ゴヒャク", "ロッピャク", "ナナヒャク", "ハッピャク", "キュウヒャク"];
const THOUSANDS = ["", "セン", "ニセン", "サンゼン", "ヨンセン", "ゴセン", "ロクセン", "ナナセン", "ハッセン", "キュウセン"];
const KANJI: Record<string, number> = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** "10", "１０" or "三十" → its value; null when it is not a plain number up to 9999. */
export function numberValue(text: string): number | null {
  const ascii = text.replace(/[０-９]/g, (ch) => String(ch.charCodeAt(0) - 0xff10));
  if (/^\d+$/.test(ascii)) return ascii.length <= 4 ? Number(ascii) : null;
  if (!/^[〇一二三四五六七八九十百千]+$/.test(text)) return null;
  let total = 0;
  let unit = 0;
  for (const ch of text) {
    const size = ch === "十" ? 10 : ch === "百" ? 100 : ch === "千" ? 1000 : 0;
    if (size) {
      total += (unit || 1) * size;
      unit = 0;
    } else unit = unit * 10 + KANJI[ch];
  }
  return total + unit;
}

export function numberKana(n: number): string {
  if (n === 0) return "ゼロ";
  const ten = Math.floor((n % 100) / 10);
  return THOUSANDS[Math.floor(n / 1000)] + HUNDREDS[Math.floor((n % 1000) / 100)] + (ten ? (ten > 1 ? ONES[ten] : "") + "ジュウ" : "") + ONES[n % 10];
}

/** Number with its last sound doubled where Japanese does so (イッ, ロッ, ハッ, ジュッ, ヒャッ). */
function doubled(n: number, last: number[]): string {
  const kana = numberKana(n);
  const digit = n % 10;
  if (digit === 0) {
    if (n % 100 !== 0 && last.includes(10)) return kana.replace(/ジュウ$/, "ジュッ");
    if (n % 100 === 0 && last.includes(100)) return kana.replace(/ク$/, "ッ");
    return kana;
  }
  if (!last.includes(digit)) return kana;
  return kana.slice(0, -1) + "ッ";
}

const K = [1, 6, 8, 10, 100];
const S = [1, 8, 10];

/** Counters that start with は/ほ/ふ change sound: [plain, ぱ-row, ば-row]. */
function hRow(n: number, plain: string, p: string, b: string, four: string): string {
  const digit = n % 10;
  if (digit === 3) return numberKana(n) + b;
  if (digit === 4) return numberKana(n) + four;
  return K.includes(digit) || digit === 0 ? doubled(n, K) + p : numberKana(n) + plain;
}

/** 4, 7, 9 have older readings before some counters. */
function older(n: number, kana: string, four: string, seven: string, nine: string): string {
  const base = numberKana(n);
  const digit = n % 10;
  if (digit === 4) return base.replace(/ヨン$/, four) + kana;
  if (digit === 7) return base.replace(/ナナ$/, seven) + kana;
  if (digit === 9) return base.replace(/キュウ$/, nine) + kana;
  return base + kana;
}

const DAYS: Record<number, string> = { 2: "フツカ", 3: "ミッカ", 4: "ヨッカ", 5: "イツカ", 6: "ムイカ", 7: "ナノカ", 8: "ヨウカ", 9: "ココノカ", 10: "トオカ", 14: "ジュウヨッカ", 20: "ハツカ", 24: "ニジュウヨッカ" };
const THINGS: Record<number, string> = { 1: "ヒトツ", 2: "フタツ", 3: "ミッツ", 4: "ヨッツ", 5: "イツツ", 6: "ムッツ", 7: "ナナツ", 8: "ヤッツ", 9: "ココノツ" };

const kType = (kana: string) => (n: number) => doubled(n, K) + kana;
const sType = (kana: string) => (n: number) => doubled(n, S) + kana;
const plain = (kana: string) => (n: number) => numberKana(n) + kana;

const COUNTERS: Record<string, (n: number) => string> = {
  人: (n) => (n === 1 ? "ヒトリ" : n === 2 ? "フタリ" : older(n, "ニン", "ヨ", "シチ", "キュウ")),
  回: kType("カイ"),
  個: kType("コ"),
  か月: kType("カゲツ"),
  カ月: kType("カゲツ"),
  ヶ月: kType("カゲツ"),
  ヵ月: kType("カゲツ"),
  キロ: kType("キロ"),
  週間: sType("シュウカン"),
  週: sType("シュウ"),
  歳: (n) => (n === 20 ? "ハタチ" : sType("サイ")(n)),
  セット: sType("セット"),
  センチ: sType("センチ"),
  点: sType("テン"),
  歩: (n) => hRow(n, "ホ", "ポ", "ポ", "ホ"),
  本: (n) => hRow(n, "ホン", "ポン", "ボン", "ホン"),
  杯: (n) => hRow(n, "ハイ", "パイ", "バイ", "ハイ"),
  分: (n) => hRow(n, "フン", "プン", "プン", "プン"),
  分間: (n) => hRow(n, "フンカン", "プンカン", "プンカン", "プンカン"),
  秒: plain("ビョウ"),
  秒間: plain("ビョウカン"),
  番: plain("バン"),
  度: plain("ド"),
  枚: plain("マイ"),
  名: plain("メイ"),
  段: plain("ダン"),
  台: plain("ダイ"),
  倍: plain("バイ"),
  割: plain("ワリ"),
  メートル: plain("メートル"),
  時: (n) => older(n, "ジ", "ヨ", "シチ", "ク"),
  時間: (n) => older(n, "ジカン", "ヨ", "シチ", "ク"),
  年: (n) => older(n, "ネン", "ヨ", "ナナ", "キュウ"),
  月: (n) => older(n, "ガツ", "シ", "シチ", "ク"),
  日: (n) => DAYS[n] ?? numberKana(n) + "ニチ",
  日間: (n) => (n === 1 ? "イチニチカン" : (DAYS[n] ?? numberKana(n) + "ニチ") + "カン"),
  つ: (n) => THINGS[n] ?? numberKana(n),
};

/** Reading of a number with its counter, or null for a counter not listed here. */
export function countKana(n: number, counter: string): string | null {
  return COUNTERS[counter]?.(n) ?? null;
}
