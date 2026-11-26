import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLiveStt, joinText, LIVE_MODEL, scriptLang, type SocketMaker } from "../src/livestt.ts";
import { encodePcm } from "../src/vad.ts";

/** A pretend Gemini server: records what the app sends and lets the test answer. */
function fakeServer() {
  const sent: Record<string, unknown>[] = [];
  const urls: string[] = [];
  let current: ReturnType<SocketMaker> | null = null;
  const make: SocketMaker = (url) => {
    urls.push(url);
    const socket = {
      readyState: 1,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: (data: string) => void sent.push(JSON.parse(data)),
      close: () => {
        socket.readyState = 3;
      },
    } as unknown as ReturnType<SocketMaker>;
    current = socket;
    setTimeout(() => socket.onopen?.(new Event("open")), 0);
    return socket;
  };
  const reply = (message: object) => current?.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
  const drop = (code = 1011, reason = "") => current?.onclose?.({ code, reason } as CloseEvent);
  return { make, sent, urls, reply, drop };
}

const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

describe("live transcription", () => {
  it("sets up the transcription model with Korean and the patient's language", async () => {
    const server = fakeServer();
    const live = createLiveStt({ key: "k y", lang: "ja", onText: () => {}, onBroken: () => {}, makeSocket: server.make });
    await tick();
    assert.match(server.urls[0], /^wss:\/\/generativelanguage\.googleapis\.com\/ws\/.*BidiGenerateContent\?key=k%20y$/);
    assert.deepEqual(server.sent[0], {
      setup: { model: LIVE_MODEL, generationConfig: { responseModalities: ["TEXT"] }, inputAudioTranscription: { languageCodes: ["ko-KR", "ja-JP"] } },
    });
    // No audio before the server is ready.
    live.send("AAAA");
    assert.equal(server.sent.length, 1);
    server.reply({ setupComplete: {} });
    await tick();
    assert.equal(live.ready(), true);
    live.send("AAAA");
    assert.deepEqual(server.sent[1], { realtimeInput: { audio: { data: "AAAA", mimeType: "audio/pcm;rate=16000" } } });
    live.close();
  });

  it("shows words while they are spoken and hands them over once", async () => {
    const server = fakeServer();
    const seen: string[] = [];
    const live = createLiveStt({ key: "k", lang: "ja", onText: (text) => seen.push(text), onBroken: () => {}, makeSocket: server.make });
    await tick();
    server.reply({ setupComplete: {} });
    server.reply({ serverContent: { interimInputTranscription: { text: "엉덩이" } } });
    server.reply({ serverContent: { inputTranscription: { text: "엉덩이 들어" } } });
    server.reply({ serverContent: { interimInputTranscription: { text: "보세요" } } });
    await tick();
    assert.deepEqual(seen, ["엉덩이", "엉덩이 들어", "엉덩이 들어 보세요"]);
    const taken = live.take(200);
    await tick();
    assert.deepEqual(server.sent.at(-1), { realtimeInput: { audioStreamEnd: true } });
    server.reply({ serverContent: { inputTranscription: { text: " 보세요" } } });
    assert.equal(await taken, "엉덩이 들어 보세요");
    assert.equal(live.text(), "");
    live.close();
  });

  it("forgets what it hears while the phone talks", async () => {
    const server = fakeServer();
    const live = createLiveStt({ key: "k", lang: "en", onText: () => {}, onBroken: () => {}, makeSocket: server.make });
    await tick();
    server.reply({ setupComplete: {} });
    live.pause();
    live.send("AAAA");
    server.reply({ serverContent: { inputTranscription: { text: "Please lift your hips" } } });
    await tick();
    assert.equal(live.text(), "");
    assert.equal(server.sent.filter((message) => "realtimeInput" in message && "audio" in (message.realtimeInput as object)).length, 0);
    live.resume();
    server.reply({ serverContent: { inputTranscription: { text: "My knee hurts" } } });
    await tick();
    assert.equal(live.text(), "My knee hurts");
    live.close();
  });

  it("opens a new session when one ends, and gives up when it keeps failing", async () => {
    const server = fakeServer();
    let broken = "";
    createLiveStt({ key: "k", lang: "ja", onText: () => {}, onBroken: (reason) => (broken = reason), makeSocket: server.make });
    await tick();
    server.reply({ setupComplete: {} });
    server.drop(1000);
    await tick(1100);
    assert.equal(server.urls.length, 2);
    assert.equal(broken, "");
    server.drop(1008, "quota");
    await tick(20);
    assert.equal(broken, "quota");
  });

  it("gives up when the server never says it is ready", async () => {
    const server = fakeServer();
    let broken = "";
    const live = createLiveStt({ key: "k", lang: "ja", onText: () => {}, onBroken: (reason) => (broken = reason), makeSocket: () => ({ ...server.make("x"), onopen: null }) as never });
    assert.equal(live.ready(), false);
    live.close();
    assert.equal(broken, "");
  });
});

describe("telling the speakers apart by their letters", () => {
  it("knows Korean from the patient's language", () => {
    assert.equal(scriptLang("엉덩이 들어보세요", "ja"), "ko");
    assert.equal(scriptLang("膝が痛いです", "ja"), "ja");
    assert.equal(scriptLang("右膝", "ja"), "ja");
    assert.equal(scriptLang("My knee hurts", "en"), "en");
    assert.equal(scriptLang("무릎 MRI 찍으셨어요", "en"), "ko");
    assert.equal(scriptLang("عندي ألم في الركبة", "ar"), "ar");
    assert.equal(scriptLang("...", "ja"), null);
    assert.equal(scriptLang("Hello", "ja"), null);
  });

  it("joins pieces with spaces only where the language has them", () => {
    assert.equal(joinText("엉덩이", "들어보세요"), "엉덩이 들어보세요");
    assert.equal(joinText("膝が", "痛いです"), "膝が痛いです");
    assert.equal(joinText("Hello", ", there"), "Hello, there");
  });

  it("sends raw 16-bit sound", () => {
    const bytes = encodePcm(new Float32Array([0, 1, -1]));
    assert.deepEqual([...bytes], [0, 0, 0xff, 0x7f, 0x01, 0x80]);
  });
});
