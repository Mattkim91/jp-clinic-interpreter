import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { countKana, numberKana, numberValue } from "../src/counters.ts";
import { hangulFromTokens, type JaToken } from "../src/reading.ts";

const require = createRequire(import.meta.url);
const kuromoji = require("kuromoji") as {
  builder: (opts: { dicPath: string }) => {
    build: (cb: (err: Error | null, tokenizer: { tokenize: (s: string) => JaToken[] }) => void) => void;
  };
};

function tokenizer() {
  return new Promise<{ tokenize: (s: string) => JaToken[] }>((resolve, reject) => {
    kuromoji.builder({ dicPath: "node_modules/kuromoji/dict" }).build((err, built) => {
      if (err || !built) reject(err ?? new Error("no tokenizer"));
      else resolve(built);
    });
  });
}

describe("analyzer readings", () => {
  it("reads the five rehab lines the way a Korean therapist should say them", async () => {
    const tokens = await tokenizer();
    const cases: [string, string][] = [
      ["お尻を上げてください", "오시리오 아게테 쿠다사이"],
      ["息を大きく吸ってください", "이키오 오오키쿠 슷테 쿠다사이"],
      ["痛い場合は教えてください", "이타이 바아이와 오시에테 쿠다사이"],
      ["ゆっくり起きてください", "윳쿠리 오키테 쿠다사이"],
      ["膝を伸ばしてください", "히자오 노바시테 쿠다사이"],
    ];
    for (const [ja, hangul] of cases) {
      assert.equal(hangulFromTokens(tokens.tokenize(ja)), hangul, ja);
    }
  });

  it("keeps other cue lines readable", async () => {
    const tokens = await tokenizer();
    const expect: Record<string, string> = {
      "力を抜いてください": "치카라오 누이테 쿠다사이",
      "今休んでください": "이마 야슨데 쿠다사이",
      "十回繰り返してください": "줏카이 쿠리카에시테 쿠다사이",
      "頑張ってください": "간밧테 쿠다사이",
      "反対側に向かって横になってください": "한타이가와니 무캇테 요코니 낫테 쿠다사이",
      "お腹に力を入れてください": "오나카니 치카라오 이레테 쿠다사이",
      "上げています": "아게테 이마스",
      "東京": "토오쿄오",
      "先生": "센세에",
    };
    for (const [ja, hangul] of Object.entries(expect)) {
      assert.equal(hangulFromTokens(tokens.tokenize(ja)), hangul, ja);
    }
  });

  it("reads numbers together with their counter and drops nothing", async () => {
    const tokens = await tokenizer();
    const expect: Record<string, string> = {
      "一人で立ち上がらないでください": "히토리데 타치아가라나이데 쿠다사이",
      "二人で支えます": "후타리데 사사에마스",
      "三人います": "산닌 이마스",
      "一歩前に出してください": "잇포 마에니 다시테 쿠다사이",
      "10分休みましょう": "줏푼 야스미마쇼오",
      "30分です": "산줏푼데스",
      "もう5回やります": "모오 고카이 야리마스",
      "8回": "핫카이",
      "１０回": "줏카이",
      "20秒": "니주우뵤오",
      "二日前": "후츠카 마에",
      "明日午前10時に": "아시타 고젠 주우지니",
      "10まで数えて": "주우마데 카조에테",
      "何時ですか": "난지데스카",
      "家族の方": "카조쿠노 카타",
      "痛い方の足": "이타이 호오노 아시",
      "お腹が空きました": "오나카가 스키마시타",
      "フットレストを上げてください": "훗토레스토오 아게테 쿠다사이",
      "いち、に、さん": "이치 니 산",
      "十分休んでください": "주우분 야슨데 쿠다사이",
    };
    for (const [ja, hangul] of Object.entries(expect)) {
      assert.equal(hangulFromTokens(tokens.tokenize(ja)), hangul, ja);
    }
  });

  it("knows the usual sound changes", () => {
    const expect: [number, string, string][] = [
      [1, "分", "イップン"], [3, "分", "サンプン"], [4, "分", "ヨンプン"], [6, "分", "ロップン"], [15, "分", "ジュウゴフン"],
      [1, "本", "イッポン"], [3, "本", "サンボン"], [100, "回", "ヒャッカイ"], [300, "メートル", "サンビャクメートル"],
      [4, "時", "ヨジ"], [9, "時", "クジ"], [12, "時", "ジュウニジ"], [4, "人", "ヨニン"], [11, "人", "ジュウイチニン"],
      [1, "週間", "イッシュウカン"], [3, "週間", "サンシュウカン"], [6, "歩", "ロッポ"], [20, "日", "ハツカ"], [1, "つ", "ヒトツ"],
    ];
    for (const [n, counter, kana] of expect) assert.equal(countKana(n, counter), kana);
    assert.equal(numberKana(365), "サンビャクロクジュウゴ");
    assert.equal(numberValue("三十二"), 32);
    assert.equal(numberValue("百二十"), 120);
  });
});
