/**
 * Audio helpers for synthesized speech. Pure functions (no I/O).
 *
 * Speech is billed per started minute, so its length must be exact and not
 * depend on what the provider reports: `mp3DurationMs` walks the MPEG frame
 * headers of the MP3 that Deepgram returns (any bitrate / sample rate), and
 * falls back to the nominal bitrate only if the stream can't be parsed.
 */

/** Layer III bitrates (kbps) by bitrate index. */
const MPEG1_L3_KBPS = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
];
const MPEG2_L3_KBPS = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160,
];

/** Sample rates by MPEG version bits (0 = 2.5, 2 = MPEG-2, 3 = MPEG-1). */
const SAMPLE_RATES: Record<number, readonly number[]> = {
  0: [11025, 12000, 8000],
  2: [22050, 24000, 16000],
  3: [44100, 48000, 32000],
};

interface Mp3Frame {
  length: number;
  samples: number;
  sampleRate: number;
}

/** Reads the MPEG Layer III frame header at `offset`, or null. */
export function readMp3Frame(buf: Uint8Array, offset: number): Mp3Frame | null {
  if (offset + 4 > buf.length) return null;
  const b0 = buf[offset]!;
  const b1 = buf[offset + 1]!;
  const b2 = buf[offset + 2]!;
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

  const version = (b1 >> 3) & 0x3; // 0: 2.5, 1: reserved, 2: 2, 3: 1
  const layer = (b1 >> 1) & 0x3; // 1: Layer III
  if (version === 1 || layer !== 1) return null;

  const bitrateIndex = (b2 >> 4) & 0xf;
  const sampleRateIndex = (b2 >> 2) & 0x3;
  if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
    return null;
  }
  const padding = (b2 >> 1) & 0x1;
  const isMpeg1 = version === 3;
  const kbps = (isMpeg1 ? MPEG1_L3_KBPS : MPEG2_L3_KBPS)[bitrateIndex]!;
  const sampleRate = SAMPLE_RATES[version]![sampleRateIndex]!;
  const coefficient = isMpeg1 ? 144 : 72;
  const length = Math.floor((coefficient * kbps * 1000) / sampleRate) + padding;
  return { length, samples: isMpeg1 ? 1152 : 576, sampleRate };
}

/** Size of a leading ID3v2 tag (0 if none). */
function id3v2Size(buf: Uint8Array): number {
  if (
    buf.length < 10 ||
    buf[0] !== 0x49 || // I
    buf[1] !== 0x44 || // D
    buf[2] !== 0x33 // 3
  ) {
    return 0;
  }
  // Syncsafe integer: 7 bits per byte.
  const size =
    ((buf[6]! & 0x7f) << 21) |
    ((buf[7]! & 0x7f) << 14) |
    ((buf[8]! & 0x7f) << 7) |
    (buf[9]! & 0x7f);
  const footer = buf[5]! & 0x10 ? 10 : 0;
  return 10 + size + footer;
}

/**
 * Duration of an MP3 stream from its frames. Bytes that aren't frames
 * (tags, junk between frames) are skipped. `fallbackBitrate` (bps) is used
 * when no frame can be read.
 */
export function mp3DurationMs(
  data: Uint8Array,
  fallbackBitrate = 48_000,
): number {
  let offset = id3v2Size(data);
  let seconds = 0;
  let frames = 0;

  while (offset + 4 <= data.length) {
    const frame = readMp3Frame(data, offset);
    if (!frame || frame.length < 4) {
      offset += 1; // resync
      continue;
    }
    seconds += frame.samples / frame.sampleRate;
    frames += 1;
    offset += frame.length;
  }

  if (frames === 0) {
    return Math.round((data.length * 8 * 1000) / fallbackBitrate);
  }
  return Math.round(seconds * 1000);
}

/** Duration of a PCM WAV file (reads the `fmt ` and `data` chunks). */
export function wavDurationMs(data: Uint8Array): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length < 12 || view.getUint32(0, false) !== 0x52494646) return 0; // RIFF
  let offset = 12;
  let byteRate = 0;
  while (offset + 8 <= data.length) {
    const id = view.getUint32(offset, false);
    const size = view.getUint32(offset + 4, true);
    if (id === 0x666d7420 /* "fmt " */ && offset + 16 <= data.length) {
      byteRate = view.getUint32(offset + 16, true);
    } else if (id === 0x64617461 /* "data" */) {
      const bytes = Math.min(size, data.length - offset - 8);
      return byteRate > 0 ? Math.round((bytes * 1000) / byteRate) : 0;
    }
    offset += 8 + size + (size % 2);
  }
  return 0;
}

/** A silent 16-bit mono PCM WAV of `durationMs` (the mock provider's audio). */
export function silentWav(durationMs: number, sampleRate = 8000): Buffer {
  const samples = Math.max(0, Math.round((durationMs / 1000) * sampleRate));
  const dataBytes = samples * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  return buf;
}

/**
 * Rough speaking time of a text (~14 characters per second, at least
 * 400 ms): only for the mock provider — real speech is measured.
 */
export function estimateSpeechMs(text: string): number {
  return Math.max(400, Math.round((text.trim().length / 14) * 1000));
}
