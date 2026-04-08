import record from "node-record-lpcm16";

export interface RecorderOptions {
  sampleRate?: number;
  silenceThreshold?: number; // ms of silence before stopping
  maxDuration?: number; // ms, max recording time
}

/**
 * Compute RMS energy from a 16-bit signed LE audio buffer.
 */
function computeRMS(chunk: Buffer): number {
  // Skip WAV header if present (first chunk starts with "RIFF")
  let offset = 0;
  if (chunk.length > 44 && chunk[0] === 0x52 && chunk[1] === 0x49) {
    offset = 44;
  }

  const samples = Math.floor((chunk.length - offset) / 2);
  if (samples === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples; i++) {
    const sample = chunk.readInt16LE(offset + i * 2);
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / samples);
}

/**
 * Wait for spacebar press, then record until silence.
 */
export function waitForSpacebarThenRecord(
  options: RecorderOptions = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;

    // Enable raw mode to detect individual keypresses
    stdin.setRawMode(true);
    stdin.resume();

    const onKeypress = (key: Buffer) => {
      // Ctrl+C → exit
      if (key[0] === 3) {
        stdin.setRawMode(wasRaw ?? false);
        process.exit(0);
      }

      // Space (0x20)
      if (key[0] === 0x20) {
        stdin.removeListener("data", onKeypress);
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();

        doRecord(options)
          .then(resolve)
          .catch(reject);
      }
    };

    stdin.on("data", onKeypress);
  });
}

function doRecord(options: RecorderOptions = {}): Promise<Buffer> {
  const {
    sampleRate = 16000,
    silenceThreshold = 1500,
    maxDuration = 15000,
  } = options;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let silenceTimer: NodeJS.Timeout | null = null;
    let maxTimer: NodeJS.Timeout | null = null;
    let hasSound = false;
    let stopped = false;

    const recording = record.record({
      sampleRate,
      channels: 1,
      audioType: "wav",
      recorder: "sox",
    });

    const stream = recording.stream();

    const stopRecording = () => {
      if (stopped) return;
      stopped = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (maxTimer) clearTimeout(maxTimer);
      recording.stop();
    };

    maxTimer = setTimeout(() => {
      stopRecording();
    }, maxDuration);

    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);

      const energy = computeRMS(chunk);
      const isSilent = energy < 500;

      if (!isSilent) {
        hasSound = true;
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      } else if (hasSound && !silenceTimer) {
        silenceTimer = setTimeout(() => {
          stopRecording();
        }, silenceThreshold);
      }
    });

    stream.on("end", () => {
      if (maxTimer) clearTimeout(maxTimer);
      if (chunks.length === 0) {
        reject(new Error("No audio recorded."));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    stream.on("error", (err: Error) => {
      if (maxTimer) clearTimeout(maxTimer);
      reject(err);
    });
  });
}
