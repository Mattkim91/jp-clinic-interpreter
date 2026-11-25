import { createSegmenter, downsample, encodeWav, toBase64, type Segmenter } from "./vad";

/** Open microphone for auto mode: hands over each spoken piece as a 16 kHz WAV (base64). */
export type AutoMic = {
  start: () => Promise<void>;
  stop: () => void;
  /** Ignore the microphone while the phone itself talks. What was heard before is kept. */
  pause: () => void;
  resume: () => void;
  speaking: () => boolean;
};

const RATE = 16000;

const WORKLET = `registerProcessor("pcm", class extends AudioWorkletProcessor {
  process(inputs) {
    const data = inputs[0] && inputs[0][0];
    if (data) this.port.postMessage(data.slice(0));
    return true;
  }
});`;

function setAudioSession(type: string): void {
  // iOS: keep the speaker loud while the microphone is open.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    /* not supported */
  }
}

export function createAutoMic(options: {
  onSegment: (wav: string, info: { draftHolds: boolean; quietMs: number }) => void;
  /** Probably the end of what is being said: worth sending ahead. */
  onDraft: (wav: string) => void;
  onSpeaking: (speaking: boolean) => void;
  /** The microphone was taken away (phone call, unplugged, ...). */
  onLost: () => void;
}): AutoMic {
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let segmenter: Segmenter | null = null;
  let paused = false;
  let session = 0;

  const push = (data: Float32Array) => {
    if (!paused) segmenter?.push(data);
  };

  const close = () => {
    session += 1;
    for (const track of stream?.getTracks() ?? []) {
      track.onended = null;
      track.stop();
    }
    stream = null;
    void ctx?.close().catch(() => {});
    ctx = null;
    segmenter = null;
    paused = false;
    setAudioSession("auto");
  };

  const wakeContext = () => {
    if (document.visibilityState === "visible" && ctx && ctx.state !== "running") void ctx.resume().catch(() => {});
  };
  document.addEventListener("visibilitychange", wakeContext);

  return {
    async start() {
      close();
      const mine = session;
      const context = new AudioContext();
      ctx = context;
      // Must be asked for inside the tap on iOS.
      void context.resume().catch(() => {});
      setAudioSession("play-and-record");
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
        if (mine !== session) {
          for (const track of media.getTracks()) track.stop();
          return;
        }
        stream = media;
        for (const track of media.getTracks()) {
          track.onended = () => {
            if (mine !== session) return;
            close();
            options.onLost();
          };
        }
        const wav = (samples: Float32Array) =>
          toBase64(encodeWav(downsample(samples, context.sampleRate, RATE), Math.min(RATE, context.sampleRate)));
        segmenter = createSegmenter({
          sampleRate: context.sampleRate,
          onSegment: (samples, info) => options.onSegment(wav(samples), info),
          onDraft: (samples) => options.onDraft(wav(samples)),
          onSpeaking: options.onSpeaking,
        });
        const source = context.createMediaStreamSource(media);
        if (context.audioWorklet) {
          const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
          try {
            await context.audioWorklet.addModule(url);
          } finally {
            URL.revokeObjectURL(url);
          }
          if (mine !== session) return;
          const node = new AudioWorkletNode(context, "pcm");
          node.port.onmessage = (event: MessageEvent<Float32Array>) => push(event.data);
          // The node outputs silence; connecting it keeps it running.
          source.connect(node).connect(context.destination);
        } else {
          const node = context.createScriptProcessor(2048, 1, 1);
          node.onaudioprocess = (event) => push(event.inputBuffer.getChannelData(0).slice(0));
          source.connect(node);
          node.connect(context.destination);
        }
        await context.resume().catch(() => {});
      } catch (error) {
        if (mine === session) close();
        throw error;
      }
    },
    stop() {
      segmenter?.flush();
      close();
    },
    pause() {
      if (paused) return;
      paused = true;
      segmenter?.flush();
    },
    resume() {
      paused = false;
      wakeContext();
    },
    speaking: () => segmenter?.speaking() ?? false,
  };
}
