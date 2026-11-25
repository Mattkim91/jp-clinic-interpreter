import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { digitsToHangul, kanaToHangul, romajiToHangul } from "../src/hangul.ts";

describe("kana to hangul", () => {
  it("reads the cue-card examples mora by mora", () => {
    assert.equal(kanaToHangul("おしりお あげて ください"), "오시리오 아게테 쿠다사이");
    assert.equal(kanaToHangul("いきお おーきく すって ください"), "이키오 오오키쿠 슷테 쿠다사이");
    assert.equal(kanaToHangul("ゆっくリ"), "윳쿠리");
    assert.equal(kanaToHangul("ユックリ"), "윳쿠리");
    assert.equal(kanaToHangul("ヒザオ ノバシテ クダサイ"), "히자오 노바시테 쿠다사이");
  });

  it("marks long vowels and the long-vowel bar", () => {
    assert.equal(kanaToHangul("とうきょう"), "토오쿄오");
    assert.equal(kanaToHangul("トーキョー"), "토오쿄오");
    assert.equal(kanaToHangul("コーヒー"), "코오히이");
    assert.equal(kanaToHangul("せんせい"), "센세에");
    assert.equal(kanaToHangul("おおきく"), "오오키쿠");
  });

  it("does not treat ている as a long e", () => {
    assert.equal(kanaToHangul("あげています"), "아게테이마스");
    assert.equal(kanaToHangul("あげて います"), "아게테 이마스");
  });

  it("writes っ as ㅅ batchim and ん as ㅇ before k and ㄴ otherwise", () => {
    assert.equal(kanaToHangul("がっこう"), "갓코오");
    assert.equal(kanaToHangul("まって"), "맛테");
    assert.equal(kanaToHangul("さっぽろ"), "삿포로");
    assert.equal(kanaToHangul("ちょっと"), "촛토");
    assert.equal(kanaToHangul("がんばって"), "간밧테");
    assert.equal(kanaToHangul("きんかく"), "킹카쿠");
    assert.equal(kanaToHangul("こんにちは"), "콘니치하");
    assert.equal(kanaToHangul("コンニチワ"), "콘니치와");
    assert.equal(kanaToHangul("しゃしん"), "샤신");
  });

  it("reads particles を and keeps ゃゅょ", () => {
    assert.equal(kanaToHangul("を"), "오");
    assert.equal(kanaToHangul("りょこう"), "료코오");
    assert.equal(kanaToHangul("しゅ"), "슈");
    assert.equal(kanaToHangul("ちょ"), "초");
  });
});

describe("romaji fallback", () => {
  it("joins honorific お and particle を the way the cue card does", () => {
    assert.equal(romajiToHangul("O shiri o agete kudasai"), "오시리오 아게테 쿠다사이");
    assert.equal(romajiToHangul("Iki o ōkiku sutte kudasai"), "이키오 오오키쿠 슷테 쿠다사이");
    assert.equal(romajiToHangul("Yukkuri okite kudasai"), "윳쿠리 오키테 쿠다사이");
    assert.equal(romajiToHangul("Hiza o nobashite kudasai"), "히자오 노바시테 쿠다사이");
    assert.equal(romajiToHangul("Itai baai wa oshietekudasai"), "이타이 바아이와 오시에테 쿠다사이");
  });

  it("reads a plain number", () => {
    assert.equal(digitsToHangul("10"), "주우");
  });
});
