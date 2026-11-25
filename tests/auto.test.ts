import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { interpretAudio } from "../src/gemini";
import { isEcho, parseTurns } from "../src/turns";
import { createSegmenter, downsample, encodeWav, MAX_MS, SILENCE_MS, toBase64 } from "../src/vad";

const RATE = 16000;

function sound(ms: number, level: number): Float32Array {
  const out = new Float32Array((RATE * ms) / 1000);
  for (let i = 0; i < out.length; i++) out[i] = level * Math.SQRT2 * Math.sin((2 * Math.PI * 200 * i) / RATE);
  return out;
}

function listen() {
  const pieces: number[] = [];
  const states: boolean[] = [];
  const segmenter = createSegmenter({
    sampleRate: RATE,
    onSegment: (samples) => pieces.push((samples.length / RATE) * 1000),
    onSpeaking: (on) => states.push(on),
  });
  /** Feed in small uneven chunks like a real microphone. */
  const feed = (ms: number, level: number) => {
    const data = sound(ms, level);
    for (let i = 0; i < data.length; i += 128) segmenter.push(data.slice(i, i + 128));
  };
  return { pieces, states, segmenter, feed };
}

describe("auto mode: cutting speech out of the microphone", () => {
  it("hands over one piece per utterance, with the start kept", () => {
    const { pieces, states, feed } = listen();
    feed(1000, 0.002);
    feed(1500, 0.1);
    feed(1500, 0.002);
    feed(1200, 0.1);
    feed(1500, 0.002);
    assert.equal(pieces.length, 2);
    // 300 ms before + 1500 ms of speech + 240 ms after; the rest of the silence is not uploaded.
    assert.ok(pieces[0] >= 1800 && pieces[0] <= 2150, String(pieces[0]));
    assert.deepEqual(states, [true, false, true, false]);
  });

  it("does not cut at a short breath inside a sentence", () => {
    const { pieces, feed } = listen();
    feed(500, 0.002);
    feed(800, 0.1);
    feed(600, 0.002);
    feed(800, 0.1);
    feed(1500, 0.002);
    assert.equal(pieces.length, 1);
  });

  it("sends ahead at the first pause and says whether that still holds", () => {
    const run = (parts: [number, number][]) => {
      const log: string[] = [];
      const segmenter = createSegmenter({
        sampleRate: RATE,
        onSegment: (_samples, info) => log.push(`end ${info.draftHolds} ${info.quietMs}`),
        onDraft: () => log.push("draft"),
        onSpeaking: () => {},
      });
      for (const [ms, level] of parts) segmenter.push(sound(ms, level));
      return log;
    };
    assert.deepEqual(run([[500, 0.002], [1000, 0.1], [1200, 0.002]]), ["draft", `end true ${Math.ceil(SILENCE_MS / 30) * 30}`]);
    // More was said after the pause: the draft must not be used.
    assert.deepEqual(run([[500, 0.002], [800, 0.1], [500, 0.002], [400, 0.1], [1200, 0.002]]).map((line) => line.slice(0, 9)), ["draft", "end false"]);
  });

  it("notices the end of speech over room noise that started meanwhile", () => {
    const { pieces, feed } = listen();
    feed(800, 0.002);
    feed(1200, 0.15);
    // Louder than the quiet room was, far below the voice.
    feed(1000, 0.015);
    assert.equal(pieces.length, 1);
    assert.ok(pieces[0] < 2200, String(pieces[0]));
  });

  it("notices the end over a loud steady hum, and does not take the hum for the next speaker", () => {
    const { pieces, feed } = listen();
    feed(800, 0.002);
    feed(1200, 0.15);
    feed(1300, 0.04);
    assert.equal(pieces.length, 1);
    feed(6000, 0.04);
    assert.equal(pieces.length, 1);
    feed(1200, 0.2);
    feed(1300, 0.04);
    assert.equal(pieces.length, 2);
  });

  it("does not cut uneven soft speech after a loud word", () => {
    const { pieces, feed } = listen();
    feed(500, 0.002);
    feed(400, 0.2);
    for (let i = 0; i < 12; i++) {
      feed(120, 0.07);
      feed(90, 0.012);
    }
    assert.equal(pieces.length, 0);
    feed(1200, 0.002);
    assert.equal(pieces.length, 1);
    assert.ok(pieces[0] > 2800, String(pieces[0]));
  });

  it("ignores quiet rooms and short clicks", () => {
    const { pieces, feed } = listen();
    feed(5000, 0.006);
    feed(60, 0.3);
    feed(2000, 0.006);
    assert.equal(pieces.length, 0);
  });

  it("gets used to steady room noise instead of sending it forever", () => {
    const { pieces, feed } = listen();
    feed(MAX_MS * 4, 0.03);
    assert.ok(pieces.length <= 1, String(pieces.length));
    feed(1500, 0.2);
    feed(1500, 0.03);
    assert.ok(pieces.length >= 1);
    assert.ok(pieces.at(-1)! < 3500, String(pieces.at(-1)));
  });

  it("keeps what was heard when flushed", () => {
    const { pieces, segmenter, feed } = listen();
    feed(500, 0.002);
    feed(1000, 0.1);
    assert.equal(segmenter.speaking(), true);
    segmenter.flush();
    assert.equal(pieces.length, 1);
    assert.equal(segmenter.speaking(), false);
  });

  it("makes a 16 kHz mono WAV", () => {
    const low = downsample(new Float32Array(48000).fill(0.5), 48000, RATE);
    assert.equal(low.length, RATE);
    assert.ok(Math.abs(low[100] - 0.5) < 1e-6);
    const wav = encodeWav(low, RATE);
    const buffer = Buffer.from(toBase64(wav), "base64");
    assert.equal(buffer.toString("latin1", 0, 4), "RIFF");
    assert.equal(buffer.toString("latin1", 8, 16), "WAVEfmt ");
    assert.equal(buffer.readUInt32LE(24), RATE);
    assert.equal(buffer.readUInt32LE(40), RATE * 2);
    assert.equal(buffer.length, 44 + RATE * 2);
  });
});

describe("auto mode: Gemini's answer", () => {
  it("keeps Korean and patient turns and drops the rest", () => {
    const turns = parseTurns(
      JSON.stringify({
        turns: [
          { language: "korean", heard: "엉덩이 들어보세요", translation: "お尻を上げてください", reading: "오시리오 아게테 쿠다사이" },
          { language: "patient", heard: "膝が痛いです", translation: "무릎이 아파요", reading: "" },
          { language: "none", heard: "...", translation: "...", reading: "" },
          { language: "korean", heard: "hello", translation: "こんにちは", reading: "" },
          { language: "patient", heard: "はい", translation: "", reading: "" },
        ],
      }),
    );
    assert.deepEqual(turns.map((turn) => [turn.speaker, turn.translation]), [
      ["ko", "お尻を上げてください"],
      ["patient", "무릎이 아파요"],
    ]);
    assert.deepEqual(parseTurns('```json\n{"turns":[]}\n```'), []);
    assert.throws(() => parseTurns("sorry"));
  });

  it("recognizes its own voice but never a short answer", () => {
    assert.equal(isEcho("お尻を上げてください。", ["お尻を上げてください"]), true);
    assert.equal(isEcho("尻を上げてください", ["お尻を上げてください"]), true);
    assert.equal(isEcho("はい", ["はい"]), false);
    assert.equal(isEcho("膝が少し痛いです", ["お尻を上げてください"]), false);
  });
});

describe("auto mode: request", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
  });

  it("sends the recording with the patient's language and reads the turns", async () => {
    let sent = { url: "", body: "" };
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      sent = { url, body: String(init.body) };
      const text = JSON.stringify({ turns: [{ language: "patient", heard: "My knee hurts", translation: "무릎이 아파요", reading: "" }] });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));
    }) as typeof fetch;
    const turns = await interpretAudio("UklGRg==", "en", "test");
    assert.equal(turns[0].translation, "무릎이 아파요");
    assert.match(sent.url, /:generateContent$/);
    const body = JSON.parse(sent.body);
    assert.deepEqual(body.contents[0].parts[0].inlineData, { mimeType: "audio/wav", data: "UklGRg==" });
    assert.match(body.systemInstruction.parts[0].text, /English/);
    assert.doesNotMatch(body.systemInstruction.parts[0].text, /Japanese/);
  });

  it("asks the next model as well when the first is slow, and takes the first answer", async () => {
    const ok = () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ turns: [{ language: "patient", heard: "膝が痛い", translation: "무릎이 아파요" }] }) }] } }] }));
    const urls: string[] = [];
    let aborted = false;
    globalThis.fetch = ((url: string, init: RequestInit) => {
      urls.push(url);
      if (urls.length > 1) return Promise.resolve(ok());
      return new Promise((_resolve, reject) =>
        init.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new Error("aborted"));
        }),
      );
    }) as typeof fetch;
    const started = Date.now();
    const turns = await interpretAudio("UklGRg==", "ja", "test");
    assert.equal(turns[0].translation, "무릎이 아파요");
    assert.equal(urls.length, 2);
    assert.notEqual(urls[0], urls[1]);
    assert.equal(aborted, true);
    assert.ok(Date.now() - started < 4000);
  });

  it("can be cancelled", async () => {
    globalThis.fetch = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as typeof fetch;
    const stop = new AbortController();
    const asked = interpretAudio("UklGRg==", "ja", "test", stop.signal);
    stop.abort();
    await assert.rejects(asked);
  });

  it("reports the usage limit even when another model fails differently", async () => {
    let n = 0;
    globalThis.fetch = (async () => new Response("{}", { status: n++ === 0 ? 429 : 404 })) as typeof fetch;
    await assert.rejects(interpretAudio("UklGRg==", "ja", "test"), (error: { status?: number }) => error.status === 429);
  });
});
