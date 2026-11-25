import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { PARTS, REPLIES, WANTS, isSided, painWords, placeWords } from "../src/answers.ts";
import { bodyZones, sideAt } from "../src/bodymap.ts";
import { TEXT_BUDGET_MS, translateWithGemini } from "../src/gemini.ts";
import { addPhrase, parsePhrases, phraseGroups, removePhrase, resetPhrases, toggleFavorite, visiblePhrases } from "../src/myphrases.ts";
import { fixedPhrase } from "../src/phrases.ts";
import { asksCondition, isCommand, politify } from "../src/polite.ts";
import { PATTERNS, PRESETS, prepare, rewriteQuery } from "../src/prepare.ts";

describe("pinned lines replace only a whole matching sentence", () => {
  it("leaves questions, sides and second instructions to the translator", () => {
    const lines = [
      "숨 참으실 필요 없어요",
      "숨을 참으셨어요?",
      "숨 참기 힘드세요?",
      "숨 크게 쉬면 아프세요?",
      "숨을 크게 쉬었을 때 어지러우세요?",
      "숨 크게 내쉬세요",
      "왼쪽 엉덩이 들어보세요",
      "무릎 굽히고 엉덩이 들어보세요",
      "엉덩이 들어올릴 때 아프세요?",
      "엉덩이 들어보고 싶으세요?",
      "배에 힘 주면 아프세요?",
      "배에 힘 주고 다리 들어보세요",
      "어깨에 힘 빼고 팔 들어보세요",
      "허리 숙일 때 아프세요?",
      "왼쪽으로 돌아눕겠습니다",
      "숨 들이쉬고 참았다가 내쉬세요",
      "숨 참으면 안 돼요?",
    ];
    for (const ko of lines) {
      assert.equal(prepare(ko).overrideJa, undefined, ko);
      assert.equal(fixedPhrase(ko, "en"), null, ko);
      assert.equal(fixedPhrase(ko, "ar"), null, ko);
    }
  });

  it("still pins the plain commands, and says what they mean", () => {
    const lines: [string, string][] = [
      ["숨 참으세요", "息を止めてください"],
      ["숨을 참아 보세요", "息を止めてください"],
      ["숨 멈추세요", "息を止めてください"],
      ["숨을 크게 쉬어 보세요", "息を大きく吸ってください"],
      ["크게 숨 쉬세요", "息を大きく吸ってください"],
      ["숨을 깊게 들이쉬고 내쉬세요", "深く息を吸って吐いてください"],
      ["자, 엉덩이 들어볼까요?", "お尻を上げてください"],
      ["엉덩이를 들어 올려 주세요", "お尻を上げてください"],
      ["엉덩이올려보세요", "お尻を上げてください"],
      ["배에 힘 좀 주세요", "お腹に力を入れてください"],
      ["어깨 힘 빼 보세요", "肩の力を抜いてください"],
      ["허리 앞으로 굽히세요", "腰を前に曲げてください"],
    ];
    for (const [ko, ja] of lines) {
      const prepared = prepare(ko);
      assert.equal(prepared.overrideJa, ja, ko);
      assert.ok(prepared.meaning, ko);
    }
    for (const { re, key } of PATTERNS) assert.match(key, re);
    for (const { ko } of PRESETS) assert.equal(prepare(ko).meaning, undefined, ko);
  });

  it("hands Google wording it does not misread", () => {
    assert.equal(rewriteQuery("숨 참으실 필요 없어요"), "호흡을 멈추실 필요 없어요");
    assert.equal(rewriteQuery("엉덩이 들 때 아프세요"), "엉덩이 들어올릴 때 통증이 있으세요?");
    assert.equal(rewriteQuery("숨 크게 쉬면 아프세요"), "숨을 크게 들이마시면 통증이 있으세요?");
    assert.equal(rewriteQuery("왼쪽 엉덩이 들어보세요"), "왼쪽 엉덩이를 위로 올려 주세요");
    assert.equal(rewriteQuery("왼쪽으로 돌아누우세요"), "왼쪽을 향해 옆으로 누우세요");
  });

  it("never makes an order out of a question about the patient", () => {
    for (const ko of ["배에 힘 주면 아프세요", "어지러우세요", "통증이 있으세요", "숨이 차세요"]) {
      assert.equal(asksCondition(ko), true, ko);
      assert.equal(isCommand(ko), false, ko);
    }
    for (const ko of ["가만히 있으세요", "뻥 차세요", "당기세요", "앉으세요"]) assert.equal(asksCondition(ko), false, ko);
    assert.equal(politify("腹部に力を入れると痛みます", "배에 힘 주면 아프세요"), "腹部に力を入れると痛みます？");
    assert.equal(politify("膝を伸ばす？", "무릎 펴세요"), "膝を伸ばす");
  });
});

describe("gemini waiting time", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
  });

  it("gives up within the budget, over all models together", async () => {
    let calls = 0;
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        // A plain timer too: AbortSignal.timeout alone does not keep Node running.
        const keep = setInterval(() => {}, 50);
        init.signal?.addEventListener("abort", () => {
          clearInterval(keep);
          reject(init.signal?.reason);
        });
      });
    }) as typeof fetch;
    const started = Date.now();
    await assert.rejects(translateWithGemini("안녕", "test", 700));
    assert.ok(Date.now() - started < 1500);
    assert.equal(calls, 1);
    assert.ok(TEXT_BUDGET_MS <= 5000);
  });

  it("still tries the next model when one is refused quickly, and keeps the safety rules", async () => {
    const bodies: string[] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      if (bodies.length === 1) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "左の膝は痛いですか" }] } }] }));
    }) as typeof fetch;
    assert.equal(await translateWithGemini("왼쪽 무릎 아프세요", "test"), "左の膝は痛いですか");
    assert.equal(bodies.length, 2);
    assert.match(bodies[0], /negation/);
    assert.match(bodies[0], /left\/right/);
  });
});

describe("patient answers", () => {
  it("has every language for every answer and body part", () => {
    for (const item of [...REPLIES, ...WANTS]) {
      assert.match(item.ko, /[가-힣]/, item.id);
      assert.match(item.ja, /[ぁ-んァ-ン一-龯]/, item.id);
      assert.match(item.en, /^[A-Za-z' ]+$/, item.id);
      assert.match(item.ar, /^[؀-ۿ\s]+$/, item.id);
    }
    assert.equal(new Set([...REPLIES, ...WANTS].map((item) => item.id)).size, REPLIES.length + WANTS.length);
    for (const part of Object.keys(PARTS)) {
      for (const side of ["right", "left"] as const) {
        const words = placeWords({ part, side });
        for (const text of Object.values(words)) assert.doesNotMatch(text, /\*/, part);
        if (!isSided(part)) continue;
        assert.match(words.ko, side === "right" ? /^오른쪽/ : /^왼쪽/);
        assert.match(words.ja, side === "right" ? /右/ : /左/);
        assert.match(words.en, new RegExp(`\\b${side}\\b`));
        assert.match(words.ar, side === "right" ? /الأيمن|اليمنى/ : /الأيسر|اليسرى/);
        assert.doesNotMatch(words.ar, side === "right" ? /الأيسر|اليسرى/ : /الأيمن|اليمنى/);
      }
    }
  });

  it("puts the patient's right on the correct half of the picture", () => {
    assert.equal(sideAt("front", "left"), "right");
    assert.equal(sideAt("back", "left"), "left");
    const front = bodyZones("front").filter((zone) => zone.part === "knee");
    assert.equal(front.find((zone) => zone.x < 160)?.side, "right");
    const back = bodyZones("back").filter((zone) => zone.part === "kneeback");
    assert.equal(back.find((zone) => zone.x < 160)?.side, "left");
    for (const view of ["front", "back"] as const) {
      for (const zone of bodyZones(view)) {
        assert.ok(PARTS[zone.part], zone.part);
        assert.equal(Boolean(zone.side), isSided(zone.part), zone.part);
      }
    }
  });

  it("makes one line from a place and a score", () => {
    const place = { part: "knee", side: "left" } as const;
    assert.equal(painWords(place, null).ko, "왼쪽 무릎이 아파요");
    assert.equal(painWords(place, 7).ko, "왼쪽 무릎이 아파요. 통증 7점 (10점 만점)");
    assert.equal(painWords(place, 7).ja, "左ひざ：痛みの強さ 7／10");
    assert.equal(painWords(place, 0).ko, "왼쪽 무릎, 통증 0점 (10점 만점)");
    assert.equal(painWords(null, 10).en, "Pain level 10 out of 10");
    assert.equal(painWords({ part: "waist" }, null).ko, "허리가 아파요");
  });
});

describe("own phrases", () => {
  const start = parsePhrases(null);

  it("starts as the built-in list and survives broken storage", () => {
    assert.deepEqual(visiblePhrases(start), PRESETS.map((preset) => preset.ko));
    assert.deepEqual(parsePhrases("{oops"), start);
    assert.deepEqual(parsePhrases('{"custom":[1,"가","가"],"favs":"x"}'), { custom: ["가"], hidden: [], favs: [] });
  });

  it("adds, refuses doubles, stars first, removes", () => {
    const added = addPhrase(start, "오른발부터 내려가세요");
    assert.equal(added.added, true);
    assert.equal(addPhrase(added.next, "오른발부터 내려가세요.").added, false);
    assert.equal(addPhrase(start, "무릎펴세요").added, false);
    assert.equal(addPhrase(start, " ?").added, false);
    const starred = toggleFavorite(toggleFavorite(added.next, "무릎 펴세요"), "오른발부터 내려가세요");
    const groups = phraseGroups(starred);
    assert.deepEqual(groups[0], { title: "★ 즐겨찾기", items: ["무릎 펴세요", "오른발부터 내려가세요"] });
    assert.equal(groups.flatMap((group) => group.items).length, PRESETS.length + 1);
    const removed = removePhrase(removePhrase(starred, "오른발부터 내려가세요"), "무릎 펴세요");
    assert.deepEqual(removed, { custom: [], hidden: ["무릎 펴세요"], favs: [] });
    assert.deepEqual(resetPhrases(removed), start);
    assert.deepEqual(addPhrase(removed, "무릎 펴세요").next, start);
  });
});
