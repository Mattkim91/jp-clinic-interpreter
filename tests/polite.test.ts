import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCommand, politify } from "../src/polite.ts";

describe("polite requests", () => {
  it("turns dictionary forms into てください", () => {
    assert.equal(politify("膝を伸ばす", "무릎 펴세요"), "膝を伸ばしてください");
    assert.equal(politify("力を抜く", "힘을 빼세요"), "力を抜いてください");
    assert.equal(politify("拳を握る", "주먹을 쥐세요"), "拳を握ってください");
    assert.equal(politify("左膝を曲げる", "왼쪽 무릎을 굽히세요"), "左膝を曲げてください");
    assert.equal(politify("10回繰り返す", "열 번 반복하세요"), "10回繰り返してください");
    assert.equal(politify("腕を持ち上げる", "팔 들어 올리세요"), "腕を持ち上げてください");
    assert.equal(politify("行く", "가세요"), "行ってください");
    assert.equal(politify("運動する", "운동하세요"), "運動してください");
  });

  it("leaves an existing polite request alone", () => {
    assert.equal(politify("ゆっくり起きてください。", "천천히 일어나세요"), "ゆっくり起きてください");
    assert.equal(politify("痛い場合は教えてください", "아프면 말씀해 주세요"), "痛い場合は教えてください");
  });

  it("makes a negative command ないでください", () => {
    assert.equal(politify("動かない", "움직이지 마세요"), "動かないでください");
    assert.equal(isCommand("어디가 아프세요?"), false);
    assert.equal(isCommand("천천히 일어나세요"), true);
  });
});
