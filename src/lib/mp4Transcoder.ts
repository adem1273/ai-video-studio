import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ff = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
    await ff.load({
      coreURL: `${baseURL}/ffmpeg-core.js`,
      wasmURL: `${baseURL}/ffmpeg-core.wasm`,
    });    ffmpegInstance = ff;
    return ff;
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null;
    throw err;
  }
}

export async function transcodeToMP4(
  blob: Blob,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const ff = await getFFmpeg();
  const inputName = 'input.webm';
  const outputName = 'output.mp4';

  ff.on('progress', ({ progress }) => {
    if (onProgress && progress >= 0 && progress <= 1) {
      onProgress(progress);
    }
  });

  await ff.writeFile(inputName, await fetchFile(blob));
  await ff.exec([
    '-i', inputName,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputName,
  ]);
  const data = await ff.readFile(outputName);
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);
  return new Blob([data], { type: 'video/mp4' });
}

export async function isFFmpegReady(): Promise<boolean> {
  try {
    await getFFmpeg();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encode a sequence of PNG frame blobs + a WAV audio blob into an MP4
 * using a deterministic frame-by-frame pipeline (no MediaRecorder).
 * Frames are written to FFmpeg's MEMFS as frame_00000.png ... frame_NNNNN.png
 * and combined with the audio track via libx264 + aac.
 */
export async function encodeFramesToMP4(
  frames: Blob[],
  audio: Blob | null,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  if (frames.length === 0) throw new Error('No frames to encode');

  const ff = await getFFmpeg();
  const outputName = 'output.mp4';
  const framePattern = 'frame_%05d.png';
  const audioName = 'audio.wav';

  for (let i = 0; i < frames.length; i++) {
    const fname = `frame_${String(i).padStart(5, '0')}.png`;
    await ff.writeFile(fname, await fetchFile(frames[i]));
    if (onProgress && (i % 30 === 0)) {
      onProgress(Math.min(0.3, (i / frames.length) * 0.3));
    }
  }

  let hasAudio = false;
  if (audio && audio.size > 0) {
    await ff.writeFile(audioName, await fetchFile(audio));
    hasAudio = true;
  }

  ff.on('progress', ({ progress }) => {
    if (onProgress && progress >= 0 && progress <= 1) {
      onProgress(0.3 + progress * 0.7);
    }
  });

  const args: string[] = [
    '-framerate', '30',
    '-i', framePattern,
  ];
  if (hasAudio) args.push('-i', audioName);
  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
  );
  if (hasAudio) {
    args.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
  }
  args.push('-movflags', '+faststart', outputName);

  await ff.exec(args);
  const data = await ff.readFile(outputName);

  try {
    for (let i = 0; i < frames.length; i++) {
      const fname = `frame_${String(i).padStart(5, '0')}.png`;
      await ff.deleteFile(fname);
    }
    if (hasAudio) await ff.deleteFile(audioName);
    await ff.deleteFile(outputName);
  } catch {
    // best-effort cleanup
  }

  return new Blob([data], { type: 'video/mp4' });
}

/**
 * Encode an AudioBuffer (e.g. from OfflineAudioContext.startRendering) into a
 * 16-bit PCM WAV Blob suitable as FFmpeg audio input.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arr = new ArrayBuffer(totalSize);
  const view = new DataView(arr);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);

  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch));
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arr], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
