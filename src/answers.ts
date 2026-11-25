/**
 * What the patient can answer by tapping (no speech, no translation server needed).
 * Arabic stays neutral to the patient's gender: first person verbs or nouns only.
 */
import type { PatientLang } from "./lang";

export type Words = { ko: string } & Record<PatientLang, string>;
export type Answer = Words & { id: string; icon: string };

export const REPLIES: Answer[] = [
  { id: "yes", icon: "⭕", ko: "네", ja: "はい", en: "Yes", ar: "نعم" },
  { id: "no", icon: "❌", ko: "아니요", ja: "いいえ", en: "No", ar: "لا" },
  { id: "little", icon: "🤏", ko: "조금요", ja: "少し", en: "A little", ar: "قليلًا" },
  { id: "unsure", icon: "❓", ko: "모르겠어요", ja: "わかりません", en: "I don't know", ar: "لا أعرف" },
  { id: "again", icon: "🔁", ko: "다시 말해 주세요", ja: "もう一度言ってください", en: "Please say it again", ar: "الرجاء إعادة الكلام" },
  { id: "fine", icon: "👌", ko: "괜찮아요", ja: "大丈夫です", en: "I'm okay", ar: "أنا بخير" },
];

export const WANTS: Answer[] = [
  { id: "stop", icon: "✋", ko: "멈춰 주세요", ja: "止めてください", en: "Please stop", ar: "الرجاء التوقف" },
  { id: "hurts", icon: "😣", ko: "아파요", ja: "痛いです", en: "It hurts", ar: "أشعر بالألم" },
  { id: "rest", icon: "🪑", ko: "쉬고 싶어요", ja: "休みたいです", en: "I want to rest", ar: "أريد الراحة" },
  { id: "dizzy", icon: "😵", ko: "어지러워요", ja: "めまいがします", en: "I feel dizzy", ar: "أشعر بالدوخة" },
  { id: "breath", icon: "😮‍💨", ko: "숨이 차요", ja: "息が苦しいです", en: "I'm short of breath", ar: "أشعر بضيق في التنفس" },
  { id: "nausea", icon: "🤢", ko: "메스꺼워요", ja: "吐き気がします", en: "I feel sick to my stomach", ar: "أشعر بالغثيان" },
  { id: "tired", icon: "😫", ko: "힘들어요", ja: "疲れました", en: "I'm tired", ar: "أشعر بالتعب" },
  { id: "numb", icon: "⚡", ko: "저려요", ja: "しびれます", en: "I feel tingling", ar: "أشعر بالتنميل" },
  { id: "toilet", icon: "🚻", ko: "화장실에 가고 싶어요", ja: "トイレに行きたいです", en: "I need the restroom", ar: "أريد الذهاب إلى الحمام" },
  { id: "water", icon: "🥤", ko: "물을 마시고 싶어요", ja: "水が飲みたいです", en: "I want some water", ar: "أريد شرب الماء" },
  { id: "cold", icon: "🥶", ko: "추워요", ja: "寒いです", en: "I'm cold", ar: "أشعر بالبرد" },
  { id: "hot", icon: "🥵", ko: "더워요", ja: "暑いです", en: "I'm hot", ar: "أشعر بالحر" },
];

export type Side = "right" | "left";

/** `*` in ja/en is the side. Arabic lists [right, left] because the side follows the noun's gender. */
type Part = { ko: string; ja: string; en: string; ar: string | [right: string, left: string] };

export const PARTS: Record<string, Part> = {
  head: { ko: "머리", ja: "頭", en: "head", ar: "الرأس" },
  neck: { ko: "목", ja: "首", en: "neck", ar: "الرقبة" },
  chest: { ko: "가슴", ja: "胸", en: "chest", ar: "الصدر" },
  belly: { ko: "배", ja: "お腹", en: "stomach", ar: "البطن" },
  back: { ko: "등", ja: "背中", en: "upper back", ar: "أعلى الظهر" },
  waist: { ko: "허리", ja: "腰", en: "lower back", ar: "أسفل الظهر" },
  shoulder: { ko: "어깨", ja: "*肩", en: "* shoulder", ar: ["الكتف الأيمن", "الكتف الأيسر"] },
  arm: { ko: "위팔", ja: "*の二の腕", en: "* upper arm", ar: ["أعلى الذراع اليمنى", "أعلى الذراع اليسرى"] },
  elbow: { ko: "팔꿈치", ja: "*ひじ", en: "* elbow", ar: ["الكوع الأيمن", "الكوع الأيسر"] },
  forearm: { ko: "아래팔", ja: "*の前腕", en: "* forearm", ar: ["الساعد الأيمن", "الساعد الأيسر"] },
  hand: { ko: "손·손목", ja: "*の手・手首", en: "* hand or wrist", ar: ["اليد اليمنى أو المعصم الأيمن", "اليد اليسرى أو المعصم الأيسر"] },
  hip: { ko: "고관절", ja: "*の股関節", en: "* hip", ar: ["الورك الأيمن", "الورك الأيسر"] },
  thigh: { ko: "허벅지", ja: "*の太もも", en: "* thigh", ar: ["الفخذ الأيمن", "الفخذ الأيسر"] },
  knee: { ko: "무릎", ja: "*ひざ", en: "* knee", ar: ["الركبة اليمنى", "الركبة اليسرى"] },
  shin: { ko: "정강이", ja: "*のすね", en: "* shin", ar: ["مقدمة الساق اليمنى", "مقدمة الساق اليسرى"] },
  foot: { ko: "발·발목", ja: "*の足首・足", en: "* ankle or foot", ar: ["القدم اليمنى أو الكاحل الأيمن", "القدم اليسرى أو الكاحل الأيسر"] },
  buttock: { ko: "엉덩이", ja: "*のお尻", en: "* buttock", ar: ["الردف الأيمن", "الردف الأيسر"] },
  thighback: { ko: "허벅지 뒤", ja: "*の太ももの裏", en: "back of the * thigh", ar: ["خلف الفخذ الأيمن", "خلف الفخذ الأيسر"] },
  kneeback: { ko: "무릎 뒤", ja: "*ひざの裏", en: "back of the * knee", ar: ["خلف الركبة اليمنى", "خلف الركبة اليسرى"] },
  calf: { ko: "종아리", ja: "*のふくらはぎ", en: "* calf", ar: ["خلف الساق اليمنى", "خلف الساق اليسرى"] },
};

export type Place = { part: string; side?: Side };

export function isSided(part: string): boolean {
  return Array.isArray(PARTS[part].ar);
}

export function placeWords({ part, side }: Place): Words {
  const { ko, ja, en, ar } = PARTS[part];
  if (!Array.isArray(ar)) return { ko, ja, en, ar };
  if (!side) throw new Error(`side missing: ${part}`);
  const right = side === "right";
  return {
    ko: `${right ? "오른쪽" : "왼쪽"} ${ko}`,
    ja: ja.replace("*", right ? "右" : "左"),
    en: en.replace("*", side),
    ar: ar[right ? 0 : 1],
  };
}

function subject(ko: string): string {
  const code = ko.charCodeAt(ko.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? "이" : "가";
}

/** The card for a place, a 0-10 score, or both. */
export function painWords(place: Place | null, score: number | null): Words {
  const at = place ? placeWords(place) : null;
  if (at && score === null) {
    return { ko: `${at.ko}${subject(at.ko)} 아파요`, ja: `${at.ja}が痛いです`, en: `It hurts here: ${at.en}`, ar: `مكان الألم: ${at.ar}` };
  }
  const points = { ko: `통증 ${score}점 (10점 만점)`, ja: `痛みの強さ ${score}／10`, en: `Pain level ${score} out of 10`, ar: `شدة الألم ${score} من 10` };
  if (!at) return points;
  return {
    ko: score === 0 ? `${at.ko}, ${points.ko}` : `${at.ko}${subject(at.ko)} 아파요. ${points.ko}`,
    ja: `${at.ja}：${points.ja}`,
    en: `${at.en[0].toUpperCase()}${at.en.slice(1)}: ${points.en.toLowerCase()}`,
    ar: `${at.ar}: ${points.ar}`,
  };
}

/** Patient-facing words on the panel itself. */
export const PANEL: Record<"reply" | "place" | "score" | "want" | "askReply" | "askPlace" | "askScore" | "askWant" | "front" | "back" | "right" | "left" | "none" | "worst", Words> = {
  reply: { ko: "대답", ja: "返事", en: "Answer", ar: "الإجابة" },
  place: { ko: "아픈 곳", ja: "痛い場所", en: "Where", ar: "مكان الألم" },
  score: { ko: "통증 점수", ja: "痛みの強さ", en: "How much", ar: "شدة الألم" },
  want: { ko: "요청", ja: "伝えたい", en: "I need", ar: "الطلبات" },
  askReply: { ko: "하나를 눌러 주세요", ja: "一つ押してください", en: "Please tap one", ar: "الرجاء اختيار إجابة" },
  askPlace: { ko: "아픈 곳을 눌러 주세요", ja: "痛いところを押してください", en: "Please tap where it hurts", ar: "الرجاء الضغط على مكان الألم" },
  askScore: { ko: "얼마나 아프세요?", ja: "どのくらい痛いですか？", en: "How much does it hurt?", ar: "ما شدة الألم؟" },
  askWant: { ko: "원하는 것을 눌러 주세요", ja: "伝えたいことを押してください", en: "Please tap what you need", ar: "الرجاء اختيار الطلب" },
  front: { ko: "앞", ja: "前", en: "Front", ar: "الأمام" },
  back: { ko: "뒤", ja: "後ろ", en: "Back", ar: "الخلف" },
  right: { ko: "오른쪽", ja: "右", en: "Right", ar: "اليمين" },
  left: { ko: "왼쪽", ja: "左", en: "Left", ar: "اليسار" },
  none: { ko: "안 아픔", ja: "痛くない", en: "No pain", ar: "لا ألم" },
  worst: { ko: "가장 아픔", ja: "最も痛い", en: "Worst pain", ar: "أشد ألم" },
};
