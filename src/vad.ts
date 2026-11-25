/** Cuts a live microphone stream into spoken pieces by loudness (auto mode). */

/** Quiet time that ends a spoken piece. */
export const SILENCE_MS = 900;
/** A piece is cut here even when nobody pauses. */
export const MAX_MS = 15000;
const FRAME_MS = 30;
const PREROLL_MS = 300;
const MIN_VOICED_MS = 240;
/** Loud frames (of the last 6) needed to start. */
const START_FRAMES = 4;
const MIN_LEVEL = 0.01;

export type Segmenter = {
  push: (chunk: Float32Array) => void;
  /** Hand over what was heard so far (if it is long enough) and start fresh. */
  flush: () => void;
  speaking: () => boolean;
};

function rmsOf(frame: Float32Array): number {
  let sum = 0;
  for (const value of frame) sum += value * value;
  return Math.sqrt(sum / frame.length);
}

function join(frames: Float32Array[]): Float32Array {
  const out = new Float32Array(frames.reduce((total, frame) => total + frame.length, 0));
  let at = 0;
  for (const frame of frames) {
    out.set(frame, at);
    at += frame.length;
  }
  return out;
}

export function createSegmenter(options: {
  sampleRate: number;
  onSegment: (samples: Float32Array) => void;
  onSpeaking: (speaking: boolean) => void;
}): Segmenter {
  const frameSize = Math.round((options.sampleRate * FRAME_MS) / 1000);
  let rest = new Float32Array(0);
  let floor = 0.004;
  let recent: Float32Array[] = [];
  let loud: boolean[] = [];
  let piece: Float32Array[] | null = null;
  let levels: number[] = [];
  let voiced = 0;
  let quiet = 0;

  const threshold = () => Math.max(MIN_LEVEL, floor * 3);

  const finish = () => {
    const done = piece;
    const enough = voiced * FRAME_MS >= MIN_VOICED_MS;
    piece = null;
    levels = [];
    voiced = 0;
    quiet = 0;
    recent = [];
    loud = [];
    if (!done) return;
    options.onSpeaking(false);
    if (enough) options.onSegment(join(done));
  };

  const frame = (data: Float32Array) => {
    const level = rmsOf(data);
    if (piece) {
      piece.push(data);
      levels.push(level);
      if (level > threshold() * 0.6) {
        quiet = 0;
        voiced += 1;
      } else {
        quiet += 1;
      }
      if (quiet * FRAME_MS >= SILENCE_MS) {
        finish();
      } else if (piece.length * FRAME_MS >= MAX_MS) {
        // Never got quiet: steady room noise counts as the new silence.
        const sorted = levels.sort((a, b) => a - b);
        floor = Math.max(floor, sorted[Math.floor(sorted.length * 0.2)]);
        finish();
      }
      return;
    }
    const isLoud = level > threshold();
    floor += (level - floor) * (level < floor ? 0.1 : 0.01);
    recent.push(data);
    if (recent.length * FRAME_MS > PREROLL_MS) recent.shift();
    loud.push(isLoud);
    if (loud.length > 6) loud.shift();
    if (loud.filter(Boolean).length >= START_FRAMES) {
      piece = recent;
      voiced = START_FRAMES;
      quiet = 0;
      options.onSpeaking(true);
    }
  };

  return {
    push(chunk) {
      const all = join([rest, chunk]);
      let at = 0;
      for (; at + frameSize <= all.length; at += frameSize) frame(all.slice(at, at + frameSize));
      rest = all.slice(at);
    },
    flush() {
      rest = new Float32Array(0);
      finish();
    },
    speaking: () => piece !== null,
  };
}

/** Average down to a lower rate (speech only needs 16 kHz). */
export function downsample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from <= to) return samples;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    out[i] = sum / (end - start);
  }
  return out;
}

/** 16-bit mono WAV. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i);
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((value, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, value)) * 0x7fff, true));
  return bytes;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
