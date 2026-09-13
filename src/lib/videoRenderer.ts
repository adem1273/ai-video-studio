import type { Scene, ProjectSettings, RenderProgress, AudioTrack, SubtitleEntry } from './types';
import { errorHandler } from './errorHandler';
import { generateSubtitles, getSubtitleAtTime, renderSubtitlesOnCanvas } from './subtitles';
import { audioBufferToWav } from './mp4Transcoder';

/**
 * Render video from scenes with proper audio/video synchronization
 */
export async function renderVideo(
  scenes: Scene[],
  settings: ProjectSettings,
  title: string,
  onProgress?: (progress: RenderProgress) => void,
): Promise<Blob> {
  if (!scenes || scenes.length === 0) {
    throw errorHandler.createError('RENDER_NO_SCENES', 'No scenes provided', 'error');
  }

  // Validate all scenes
  for (let i = 0; i < scenes.length; i++) {
    const error = errorHandler.validateScene(scenes[i]);
    if (error) {
      throw errorHandler.createError('RENDER_INVALID_SCENE', `Scene ${i + 1}: ${error}`, 'error');
    }
  }

  try {
    const canvas = document.createElement('canvas');
    const { width, height } = getCanvasDimensions(settings);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Calculate total duration
    const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
    const fps = 30;
    const totalFrames = Math.ceil(totalDuration * fps);

    onProgress?.({
      scene: 0,
      total: scenes.length,
      phase: 'preparing',
      message: 'Video rendering başlanıyor...',
      totalFrames,
      framesRendered: 0,
    });

    // Generate subtitles if enabled
    const subtitles = settings.showTitleCard ? generateSubtitles(scenes, 4) : [];

    // Collect frames as ImageData
    const frames: ImageData[] = [];
    let frameIndex = 0;
    let currentSceneTime = 0;

    for (let sceneIdx = 0; sceneIdx < scenes.length; sceneIdx++) {
      const scene = scenes[sceneIdx];
      const sceneFrames = Math.ceil(scene.duration * fps);

      onProgress?.({
        scene: sceneIdx,
        total: scenes.length,
        phase: 'rendering',
        message: `Sahne ${sceneIdx + 1}/${scenes.length} render ediliyor...`,
        framesRendered: frameIndex,
        totalFrames,
      });

      for (let frameIdx = 0; frameIdx < sceneFrames; frameIdx++) {
        try {
          const frameTime = (frameIndex / fps);
          
          // Render scene background
          await renderSceneFrame(ctx, scene, settings);

          // Render subtitles if enabled
          if (settings.subtitleStyle !== 'minimal' || settings.showTitleCard) {
            const subtitle = getSubtitleAtTime(subtitles, frameTime);
            if (subtitle) {
              renderSubtitlesOnCanvas(ctx, subtitle, {
                style: settings.subtitleStyle,
                color: settings.subtitleColor,
                fontSize: Math.max(20, height / 20),
              });
            }
          }

          // Capture frame
          const imageData = ctx.getImageData(0, 0, width, height);
          frames.push(imageData);
          frameIndex++;
        } catch (err) {
          errorHandler.createError(
            'RENDER_FRAME_FAILED',
            `Frame rendering failed at frame ${frameIndex}`,
            'warning',
            err instanceof Error ? err.message : String(err),
          );
          // Continue rendering despite error
        }
      }

      currentSceneTime += scene.duration;
    }

    onProgress?.({
      scene: scenes.length,
      total: scenes.length,
      phase: 'encoding',
      message: 'Video frames kodlanıyor...',
      framesRendered: frameIndex,
      totalFrames,
    });

    // Convert frames to WebM blob
    const videoBlob = await encodeFramesToWebM(frames, fps, onProgress);

    return videoBlob;
  } catch (err) {
    if (err instanceof Error && err.message.includes('RENDER_')) {
      throw err;
    }
    throw errorHandler.createError(
      'RENDER_FAILED',
      'Video rendering failed',
      'error',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Render a single frame for a scene
 */
async function renderSceneFrame(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  settings: ProjectSettings,
): Promise<void> {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Clear canvas
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  // Draw background image if available
  if (scene.image_url) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
          resolve();
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = scene.image_url!;
      });
    } catch (err) {
      errorHandler.createError('IMAGE_LOAD_FAILED', 'Failed to load scene image', 'warning');
    }
  }

  // Draw narration text overlay
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = `bold ${Math.max(16, height / 25)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Add text shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  const maxWidth = width - 40;
  const lines = wrapText(scene.narration, ctx, maxWidth);
  const lineHeight = Math.max(20, height / 20);
  const totalHeight = lines.length * lineHeight;
  const startY = height / 2 - totalHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], width / 2, startY + i * lineHeight);
  }

  ctx.shadowColor = 'transparent';
}

/**
 * Wrap text to fit within canvas width
 */
function wrapText(text: string, ctx: CanvasRenderingContext2D, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const metrics = ctx.measureText(currentLine + word);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines;
}

/**
 * Get canvas dimensions based on settings
 */
export function getCanvasDimensions(settings: ProjectSettings): { width: number; height: number } {
  const resolutions: Record<string, { width: number; height: number }> = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '1440p': { width: 2560, height: 1440 },
  };

  const base = resolutions[settings.resolution] || resolutions['1080p'];

  if (settings.aspect === '9:16') {
    return { width: Math.round((base.height * 9) / 16), height: base.height };
  } else if (settings.aspect === '1:1') {
    return { width: base.height, height: base.height };
  }

  return base;
}

/**
 * Encode frames to WebM video using MediaRecorder
 */
export async function encodeFramesToWebM(
  frames: ImageData[],
  fps: number,
  onProgress?: (progress: RenderProgress) => void,
): Promise<Blob> {
  if (!frames || frames.length === 0) {
    throw new Error('No frames to encode');
  }

  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context for encoding'));
        return;
      }

      canvas.width = frames[0].width;
      canvas.height = frames[0].height;

      let recordedChunks: Blob[] = [];

      let mediaRecorder: MediaRecorder;
      try {
        const stream = canvas.captureStream(fps);
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8,opus',
        });
      } catch (err) {
        reject(new Error(`MediaRecorder initialization failed: ${err instanceof Error ? err.message : String(err)}`));
        return;
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        reject(new Error(`MediaRecorder error: ${event.error}`));
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        resolve(blob);
      };

      mediaRecorder.start();

      // Draw frames sequentially
      let frameIndex = 0;
      const drawNextFrame = () => {
        if (frameIndex < frames.length) {
          ctx.putImageData(frames[frameIndex], 0, 0);
          frameIndex++;

          onProgress?.({
            scene: 0,
            total: frames.length,
            phase: 'encoding',
            message: `Frame ${frameIndex}/${frames.length} encoded`,
            framesRendered: frameIndex,
            totalFrames: frames.length,
          });

          setTimeout(drawNextFrame, 1000 / fps);
        } else {
          mediaRecorder.stop();
        }
      };

      drawNextFrame();
    } catch (err) {
      reject(
        new Error(
          `Frame encoding failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  });
}

/**
 * Check if browser supports MP4 playback
 */
export function supportsMP4(): boolean {
  const video = document.createElement('video');
  return video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
}

/**
 * Get file extension based on MIME type
 */
export function getExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  return 'webm';
}

// Export types
export type { RenderProgress };
