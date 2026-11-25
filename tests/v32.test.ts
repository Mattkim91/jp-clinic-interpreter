import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { dayOf, keepsCards, recallCards, setKeepsCards, storeCards } from "../src/keep.ts";
import { checkPatient, checkTranslation, koreanNumbers, mustHold } from "../src/meaning.ts";
import { pick } from "../src/phrases.ts";
import { isQuestion, politify } from "../src/polite.ts";
import { NEGATIVE_PATTERNS, PATTERNS, PRESETS, prepare, rewriteQuery } from "../src/prepare.ts";

const kinds = (ko: string, text: string, lang: "ja" | "en" | "ar" = "ja") => checkTranslation(ko, text, lang).map((problem) => problem.kind);

describe("warnings about a wrong translation", () => {
  it("never warns about the hand-checked lines", () => {
    const lines = [...PRESETS.map(({ ko, ja }) => [ko, ja]), ...[...PATTERNS, ...NEGATIVE_PATTERNS].map(({ key, ja }) => [key, ja])];
    for (const [ko, ja] of lines) {
      assert.deepEqual(checkTranslation(ko, ja, "ja"), [], `${ko} / ${ja}`);
      for (const lang of ["en", "ar"] as const) assert.deepEqual(checkTranslation(ko, pick(ko, lang)!.text, lang), [], `${ko} / ${pick(ko, lang)!.text}`);
    }
  });

  it("notices a lost or added don't", () => {
    assert.deepEqual(kinds("계단 올라갈 때는 안 아픈 다리부터 올리세요", "階段を上るときは、痛い足から上がってください"), ["negation"]);
    assert.deepEqual(kinds("움직이지 마세요", "動いてください"), ["negation"]);
    assert.deepEqual(kinds("숨 참으실 필요 없어요", "息を止めてください"), ["negation"]);
    assert.deepEqual(kinds("움직이세요", "動かないでください"), ["negation"]);
    assert.deepEqual(kinds("혼자 걸으시면 안 돼요", "You can walk alone.", "en"), ["negation"]);
    assert.deepEqual(kinds("움직이지 마세요", "الرجاء التحرك", "ar"), ["negation"]);
    assert.equal(mustHold(checkTranslation("움직이지 마세요", "動いてください", "ja")), true);
  });

  it("notices a wrong side", () => {
    assert.deepEqual(kinds("왼쪽 엉덩이 들어보세요", "お尻を上げてください"), ["side"]);
    assert.deepEqual(kinds("왼팔을 올리세요", "右腕を上げてください"), ["side"]);
    assert.deepEqual(kinds("왼발 앞으로, 오른발 뒤로 하세요", "右足を前に、左足を後ろにしてください"), ["side"]);
    assert.deepEqual(kinds("오른손을 드세요", "Please raise your left hand.", "en"), ["side"]);
    assert.deepEqual(kinds("오른손으로 왼팔을 잡으세요", "Hold your left arm with your right hand.", "en"), []);
  });

  it("notices a lost number and a lost question", () => {
    assert.deepEqual(kinds("열까지 세면서 버티세요", "熱まで数えて頑張ってください"), ["number"]);
    assert.deepEqual(kinds("열까지 세면서 버티세요", "10まで数えて頑張ってください"), []);
    assert.deepEqual(kinds("다섯 번 더 하세요", "あと五回やってください"), []);
    assert.deepEqual(kinds("삼십 분 쉬세요", "30分休んでください"), []);
    assert.deepEqual(kinds("숨 크게 쉬면 아프세요", "息を大きく吸ってください"), ["question"]);
    assert.deepEqual(kinds("어지러우세요", "Are you dizzy?", "en"), []);
    assert.deepEqual(koreanNumbers("다시 한 번 열두 번씩 이십 초"), [12, 20]);
    assert.deepEqual(koreanNumbers("이번에는 네 다리를 들고 다시 해보세요"), []);
  });

  it("stays quiet on ordinary correct lines", () => {
    const lines: [string, string, ("ja" | "en" | "ar")?][] = [
      ["안녕하세요 오늘 컨디션 어떠세요", "こんにちは、今日の体調はいかがですか"],
      ["안쪽으로 조금 더 오세요", "もう少し内側に来てください"],
      ["불편하지 않으세요?", "不快ですか"],
      ["넘어지지 않게 조심하세요", "転ばないように気をつけてください"],
      ["괜찮아요 걱정하지 마세요", "大丈夫です、心配しないでください"],
      ["운동을 해야 해요", "運動をしなければなりません"],
      ["조심하세요 위험해요", "気をつけてください、危ないです"],
      ["일어나 볼까요", "立ってみましょうか"],
      ["무릎을 완전히 펴지 말고 살짝 굽히세요", "膝を完全に伸ばさずに、軽く曲げてください"],
      ["힘을 빼지 마세요", "Don't relax.", "en"],
      ["지금 바로 앉으세요", "Please sit down right now.", "en"],
      ["두 발을 모으세요", "両足をそろえてください"],
    ];
    for (const [ko, text, lang] of lines) assert.deepEqual(checkTranslation(ko, text, lang ?? "ja"), [], `${ko} / ${text}`);
  });

  it("checks what the patient said too", () => {
    assert.deepEqual(checkPatient("痛くないです", "ja", "아파요").map((problem) => problem.kind), ["negation"]);
    assert.deepEqual(checkPatient("右の膝が痛いです", "ja", "왼쪽 무릎이 아파요").map((problem) => problem.kind), ["side"]);
    assert.deepEqual(checkPatient("右の膝が少し痛いです", "ja", "오른쪽 무릎이 조금 아파요"), []);
    assert.deepEqual(checkPatient("まだ歩けません", "ja", "아직 못 걸어요"), []);
    assert.deepEqual(checkPatient("It doesn't hurt", "en", "안 아파요"), []);
    assert.deepEqual(checkPatient("大丈夫です", "ja", "괜찮아요"), []);
  });
});

describe("polite Japanese is not broken", () => {
  it("turns ます and なさい into requests, or leaves them alone", () => {
    assert.equal(politify("横になります", "누우세요"), "横になってください");
    assert.equal(politify("腕を上げます", "팔 올리세요"), "腕を上げてください");
    assert.equal(politify("前を見ます", "앞을 보세요"), "前を見てください");
    assert.equal(politify("右足から下ります", "오른발부터 내려가세요"), "右足から下りてください");
    assert.equal(politify("車いすブレーキをロックします", "브레이크를 잠그세요"), "車いすブレーキをロックしてください");
    assert.equal(politify("息を吐きながら起きなさい", "숨 내쉬면서 일어나세요"), "息を吐きながら起きてください");
    assert.equal(politify("ゆっくり歩きます", "천천히 걸으세요"), "ゆっくり歩いてください");
    assert.equal(politify("座っています", "앉아 계세요"), "座っていてください");
    assert.equal(politify("立ち上がりましょう", "일어나세요"), "立ち上がりましょう");
    assert.equal(politify("ゆっくり立ってくださいね", "천천히 일어나세요"), "ゆっくり立ってくださいね");
  });

  it("does not make a don't out of a statement", () => {
    assert.equal(politify("力が入らない", "힘이 안 들어가세요"), "力が入らない？");
    assert.equal(politify("動かない", "움직이지 마세요"), "動かないでください");
    assert.equal(politify("急いではいけない", "서두르지 마세요"), "急いではいけません");
  });

  it("knows questions without a question mark", () => {
    for (const ko of ["약은 드셨어요", "어제 잠은 잘 주무셨어요", "힘이 안 들어가세요", "통증이 있으신가요", "걸을 수 있습니까"]) assert.equal(isQuestion(ko), true, ko);
    for (const ko of ["잘하셨어요", "수고하셨습니다", "가만히 있으세요", "안으로 들어오세요", "일어나 볼까요", "앉아 보시겠어요?"]) assert.equal(isQuestion(ko), false, ko);
    assert.equal(politify("薬は食べました", "약은 드셨어요"), "薬は食べました？");
    assert.equal(politify("痛いですか", "아프세요"), "痛いですか");
  });
});

describe("dangerous wording", () => {
  it("pins which leg goes first on stairs", () => {
    const good = "階段を上るときは、痛くない方の足から上げてください";
    const bad = "階段を下りるときは、痛い方の足から下ろしてください";
    for (const ko of ["계단 올라갈 때는 안 아픈 다리부터 올리세요", "올라갈 때는 안 아픈 쪽 다리부터 디디세요", "계단을 올라갈 때 아프지 않은 다리부터 올리세요"]) assert.equal(prepare(ko).overrideJa, good, ko);
    for (const ko of ["내려갈 때는 아픈 다리부터 내리세요", "계단 내려갈 때는 아픈 쪽 다리부터 내려 보세요"]) assert.equal(prepare(ko).overrideJa, ko.includes("내려 보") ? bad : bad, ko);
    for (const ko of ["올라갈 때는 아픈 다리부터 올리지 마세요", "올라갈 때 아픈 다리부터 올리면 안 돼요", "올라갈 때 다리가 아프세요", "내려갈 때는 안 아픈 다리부터 내리지 마세요"]) assert.equal(prepare(ko).overrideJa, undefined, ko);
  });

  it("spells out what Google misreads", () => {
    assert.equal(rewriteQuery("열까지 세면서 버티세요"), "10까지 세면서 버티세요");
    assert.equal(rewriteQuery("다섯 번만 더 해볼게요"), "5번 더 해볼게요");
    assert.equal(rewriteQuery("열다섯 번 반복하세요"), "15번 반복하세요");
    assert.equal(rewriteQuery("안 아픈 팔로 잡으세요"), "통증이 없는 팔로 잡으세요");
    assert.equal(rewriteQuery("약은 드셨어요"), "약은 드셨어요?");
    assert.equal(rewriteQuery("배 집어넣으세요"), "복부 집어넣으세요");
    assert.equal(rewriteQuery("오른쪽 다리는 힘을 빼세요"), "오른쪽 다리의 긴장을 풀어 주세요");
    assert.equal(rewriteQuery("한 번 해보세요"), "한 번 해보세요");
  });
});

describe("keeping today's cards", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    };
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
  const now = new Date(2026, 10, 27, 10).getTime();
  const card = (at: number, status = "ready") => ({ at, status });

  it("stores nothing unless turned on", () => {
    storeCards([card(now)], now);
    assert.equal(store.size, 0);
    assert.equal(keepsCards(), false);
  });

  it("keeps finished cards of today and deletes yesterday's", () => {
    setKeepsCards(true);
    const yesterday = now - 24 * 3600 * 1000;
    storeCards([card(yesterday), card(now), card(now, "loading"), card(now, "error")], now);
    assert.equal(recallCards(() => true, now).length, 1);
    assert.deepEqual(recallCards(() => true, now + 24 * 3600 * 1000), []);
    assert.equal(store.has("clinic-cards"), false);
    assert.notEqual(dayOf(yesterday), dayOf(now));
  });

  it("removes everything when turned off, and survives broken data", () => {
    setKeepsCards(true);
    storeCards([card(now)], now);
    setKeepsCards(false);
    assert.equal(store.size, 0);
    setKeepsCards(true);
    store.set("clinic-cards", "{oops");
    assert.deepEqual(recallCards(() => true, now), []);
  });
});
