import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Get or initialize FFmpeg instance
 */
async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ff = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
    await ff.load({
      coreURL: `${baseURL}/ffmpeg-core.js`,
      wasmURL: `${baseURL}/ffmpeg-core.wasm`,
    });
    ffmpegInstance = ff;
    return ff;
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null;
    throw err;
  }
}

/**
 * Transcode WebM to MP4 format
 */
export async function transcodeToMP4(
  blob: Blob,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  try {
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
    
    try {
      await ff.deleteFile(inputName);
      await ff.deleteFile(outputName);
    } catch {
      // best-effort cleanup
    }
    
    return new Blob([data], { type: 'video/mp4' });
  } catch (err) {
    throw new Error(`MP4 transcode failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Check if FFmpeg is ready for use
 */
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
 */
export async function encodeFramesToMP4(
  frames: Blob[],
  audio: Blob | null,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  if (!frames || frames.length === 0) {
    throw new Error('No frames provided for encoding');
  }

  try {
    const ff = await getFFmpeg();
    const outputName = 'output.mp4';
    const framePattern = 'frame_%05d.png';
    const audioName = 'audio.wav';

    // Write frames to FFmpeg memory
    for (let i = 0; i < frames.length; i++) {
      const fname = `frame_${String(i).padStart(5, '0')}.png`;
      await ff.writeFile(fname, await fetchFile(frames[i]));
      if (onProgress && (i % 30 === 0)) {
        onProgress(Math.min(0.3, (i / frames.length) * 0.3));
      }
    }

    // Write audio if provided
    let hasAudio = false;
    if (audio && audio.size > 0) {
      await ff.writeFile(audioName, await fetchFile(audio));
      hasAudio = true;
    }

    // Setup progress tracking for encoding
    ff.on('progress', ({ progress }) => {
      if (onProgress && progress >= 0 && progress <= 1) {
        onProgress(0.3 + progress * 0.7);
      }
    });

    // Build FFmpeg arguments
    const args: string[] = [
      '-framerate', '30',
      '-i', framePattern,
    ];
    
    if (hasAudio) {
      args.push('-i', audioName);
    }
    
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

    // Execute encoding
    await ff.exec(args);
    const data = await ff.readFile(outputName);

    // Cleanup
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
  } catch (err) {
    throw new Error(`Frame encoding failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Encode an AudioBuffer into a 16-bit PCM WAV Blob
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
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

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

/**
 * Helper to write ASCII string to DataView
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Detect available audio/video codecs
 */
export function getAvailableCodecs(): {
  video: string[];
  audio: string[];
} {
  const video: string[] = [];
  const audio: string[] = [];

  const videoElement = document.createElement('video');
  
  // Test common video codecs
  const videoCodecs = [
    'video/webm; codecs="vp8"',
    'video/webm; codecs="vp9"',
    'video/mp4; codecs="avc1.42E01E"',
    'video/mp4; codecs="hev1.1.6.L93.B0"',
  ];

  videoCodecs.forEach((codec) => {
    if (videoElement.canPlayType(codec)) {
      video.push(codec);
    }
  });

  const audioElement = document.createElement('audio');
  
  // Test common audio codecs
  const audioCodecs = [
    'audio/webm; codecs="opus"',
    'audio/webm; codecs="vorbis"',
    'audio/mp4; codecs="mp4a.40.2"',
    'audio/wav',
  ];

  audioCodecs.forEach((codec) => {
    if (audioElement.canPlayType(codec)) {
      audio.push(codec);
    }
  });

  return { video, audio };
}

/**
 * Get supported export format
 */
export function getSupportedExportFormats(): Array<'mp4' | 'webm'> {
  const formats: Array<'mp4' | 'webm'> = [];
  const videoElement = document.createElement('video');

  if (videoElement.canPlayType('video/webm; codecs="vp8,opus"')) {
    formats.push('webm');
  }

  if (videoElement.canPlayType('video/mp4; codecs="avc1.42E01E"')) {
    formats.push('mp4');
  }

  return formats.length > 0 ? formats : ['webm'];
}
