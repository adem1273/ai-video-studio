import type { Scene, ProjectSettings } from './types';

export async function renderVideo(
  scenes: Scene[],
  settings: ProjectSettings,
  onProgress?: (frame: number, total: number, phase: string) => void,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const { width, height } = getCanvasDimensions(settings);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  const totalFrames = Math.ceil(
    scenes.reduce((sum, s) => sum + (s.duration || 5), 0) * 30,
  );
  const audioCtx = new OfflineAudioContext(
    2,
    totalFrames * (44100 / 30),
    44100,
  );

  let frameIndex = 0;

  for (const scene of scenes) {
    const sceneDuration = scene.duration || 5;
    const sceneFrames = Math.ceil(sceneDuration * 30);

    for (let i = 0; i < sceneFrames; i++) {
      await renderScene(ctx, scene, settings);
      const imageData = ctx.getImageData(0, 0, width, height);
      onProgress?.(frameIndex, totalFrames, 'rendering');
      frameIndex++;
    }
  }

  const audioBuffer = await audioCtx.startRendering();
  const mp4Blob = await encodeFramesToMP4(canvas, audioBuffer, 30);

  return mp4Blob;
}

function getCanvasDimensions(settings: ProjectSettings): { width: number; height: number } {
  const resolutions: Record<string, { width: number; height: number }> = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '1440p': { width: 2560, height: 1440 },
  };

  const base = resolutions[settings.resolution] || resolutions['1080p'];

  if (settings.aspect === '9:16') {
    return { width: Math.round(base.height * 9 / 16), height: base.height };
  } else if (settings.aspect === '1:1') {
    return { width: base.height, height: base.height };
  }

  return base;
}

async function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  settings: ProjectSettings,
): Promise<void> {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(scene.narration.slice(0, 100), ctx.canvas.width / 2, ctx.canvas.height / 2);
}

export async function encodeFramesToMP4(
  canvas: HTMLCanvasElement,
  audioBuffer: AudioBuffer,
  fps: number = 30,
): Promise<Blob> {
  const blob = canvas.toBlob((canvasBlob) => {
    if (!canvasBlob) throw new Error('Failed to create canvas blob');
  });

  const wav = audioBufferToWav(audioBuffer);
  const wavBlob = new Blob([wav], { type: 'audio/wav' });

  return new Promise((resolve) => {
    resolve(wavBlob);
  });
}

export function audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1;
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  const arrayLength = numberOfChannels * audioBuffer.length * bytesPerSample + 44;
  const arrayBuffer = new ArrayBuffer(arrayLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, arrayLength - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, audioBuffer.length * numberOfChannels * bytesPerSample, true);

  const offset = 44;
  const volume = 0.8;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i])) * volume;
      view.setInt16(offset + (i * numberOfChannels + channel) * bytesPerSample, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }
  }

  return arrayBuffer;
}
