import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arabicLatinToHangul } from "../src/arabic.ts";
import { fixedPhrase, pick } from "../src/phrases.ts";
import { NEGATIVE_PATTERNS, PATTERNS, PRESETS, isNegated, prepare, rewriteQuery } from "../src/prepare.ts";
import { appendChunk, endsSentence, flushDelay, recognitionLang } from "../src/speech.ts";

describe("english and arabic phrases", () => {
  it("has both languages with a hangul-only reading for every preset and pattern", () => {
    const lines = [
      ...PRESETS.map((preset) => preset.ko),
      ...PATTERNS.map((pattern) => pattern.key),
      ...NEGATIVE_PATTERNS.map((pattern) => pattern.key),
    ];
    for (const ko of lines) {
      const en = pick(ko, "en");
      const ar = pick(ko, "ar");
      assert.ok(en && ar, `missing: ${ko}`);
      assert.match(en.text, /^[A-Za-z][A-Za-z ,.'?]+$/, ko);
      assert.match(ar.text, /^[؀-ۿ\s]+$/, ko);
      for (const reading of [en.reading, ar.reading]) assert.match(reading, /^[가-힣 ,.?]+$/, ko);
    }
  });

  it("sends every preset button to its own line", () => {
    for (const { ko } of PRESETS) {
      assert.deepEqual(fixedPhrase(ko, "en"), pick(ko, "en"), ko);
      assert.deepEqual(fixedPhrase(ko, "ar"), pick(ko, "ar"), ko);
    }
  });

  it("keeps Arabic neutral to the patient's gender", () => {
    for (const preset of PRESETS) {
      assert.doesNotMatch(fixedPhrase(preset.ko, "ar")?.text ?? "", /فضلك|لديك|تشعرين/, preset.ko);
    }
  });

  it("resolves 들다 and 배 the same way as Japanese", () => {
    assert.equal(fixedPhrase("엉덩이 들어 주세요", "en")?.text, "Please lift your hips.");
    assert.equal(fixedPhrase("배에 힘 주세요", "ar")?.text, "الرجاء شد عضلات البطن");
    assert.equal(fixedPhrase("오늘 날씨가 좋네요", "en"), null);
  });

  it("never turns a don't into a do", () => {
    const lines: [string, string][] = [
      ["숨 참지 마세요", "息を止めないでください"],
      ["숨을 참지마세요", "息を止めないでください"],
      ["절대 숨 참지 마세요.", "息を止めないでください"],
      ["숨 참으면 안 돼요", "息を止めないでください"],
      ["숨 참지 말고 편하게 쉬세요", "息を止めないで、楽に呼吸してください"],
      ["허리 숙이지 마세요", "腰を前に曲げないでください"],
      ["엉덩이 들어올리지 마세요", "お尻を上げないでください"],
      ["엉덩이 들지 마세요", "お尻を上げないでください"],
      ["배에 힘 주지 마세요", "お腹に力を入れないでください"],
      ["어깨에 힘 빼지 마세요", "肩の力を抜かないでください"],
      ["돌아눕지 마세요", "横向きにならないでください"],
    ];
    for (const [ko, ja] of lines) {
      assert.equal(prepare(ko).overrideJa, ja, ko);
      assert.match(fixedPhrase(ko, "en")?.text ?? "", /do not/, ko);
      assert.match(fixedPhrase(ko, "ar")?.text ?? "", /عدم/, ko);
    }
  });

  it("sends longer don't sentences to the translator, spelled out", () => {
    for (const ko of ["무릎 펴고 숨 참지 마세요", "배에 힘 주지 말고 다리만 올리세요"]) {
      assert.equal(prepare(ko).overrideJa, undefined, ko);
      assert.equal(fixedPhrase(ko, "en"), null, ko);
    }
    assert.equal(rewriteQuery("무릎 펴고 숨 참지 마세요"), "무릎 펴고 호흡을 멈추지 마세요");
    assert.equal(rewriteQuery("배에 힘 주지 말고 다리만 올리세요"), "복부에 힘 주지 말고 다리만 올리세요");
  });

  it("keeps a preset's own line even when it contains 지 않게", () => {
    assert.equal(isNegated("넘어지지 않게 잡고 있을게요"), true);
    assert.equal(prepare("넘어지지 않게 잡고 있을게요").overrideJa, "転ばないように支えていますね");
    assert.equal(fixedPhrase("넘어지지 않게 잡고 있을게요", "en")?.text, "I'm holding you so you don't fall.");
  });

  it("leaves Japanese phrases untouched", () => {
    assert.equal(fixedPhrase("무릎 펴세요", "ja"), null);
    for (const preset of PRESETS) assert.equal(prepare(preset.ko).overrideJa, preset.ja);
  });
});

describe("english and arabic listening", () => {
  it("uses the right recognizer language", () => {
    assert.equal(recognitionLang("ko"), "ko-KR");
    assert.equal(recognitionLang("ja"), "ja-JP");
    assert.equal(recognitionLang("en"), "en-US");
    assert.equal(recognitionLang("ar"), "ar-SA");
  });

  it("ends on punctuation, otherwise after a middle pause", () => {
    assert.equal(endsSentence("my knee hurts.", "en"), true);
    assert.equal(endsSentence("هل انتهينا؟", "ar"), true);
    assert.equal(flushDelay("my knee hurts", "en"), 1500);
    assert.equal(flushDelay("عندي ألم", "ar"), 1500);
    assert.equal(flushDelay("아파요", "ko"), 500);
    assert.equal(flushDelay("숨 참지", "ko"), 700);
    assert.equal(flushDelay("my knee hurts.", "en"), 500);
    assert.equal(flushDelay("痛くて", "ja"), 3000);
  });

  it("merges re-sent chunks by whole words", () => {
    assert.equal(appendChunk("my knee", "my knee hurts", "en"), "my knee hurts");
    assert.equal(appendChunk("I don't know", "no", "en"), "I don't know no");
    assert.equal(appendChunk("my right knee", "knee hurts", "en"), "my right knee hurts");
  });
});

describe("arabic transliteration to hangul", () => {
  it("reads Google's spelling as hangul with sun letters", () => {
    assert.equal(arabicLatinToHangul("alraja'"), "아르라자");
    assert.equal(arabicLatinToHangul("rafe aldhirae"), "라프아 앗디라아");
    assert.equal(arabicLatinToHangul("sanamshi bibut'"), "사남시 비부트");
    assert.equal(arabicLatinToHangul("thalath"), "살라스");
    assert.match(arabicLatinToHangul("alraja' alnazar 'ily. thany alrukba shukran yawm"), /^[가-힣 ]+$/);
  });
});
