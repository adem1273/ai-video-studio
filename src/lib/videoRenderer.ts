// Canvas-based video renderer with:
// - Real browser TTS narration captured into the video audio track
// - Procedural background music with per-scene mood variation
// - Cinematic scene transitions (fade, slide, zoom, cut)
// - Opening title card with animated gradient
// - Ken Burns effect on images
// - Color grading and vignette overlays
// - Professional subtitle rendering with text shadows

import type { Scene, ProjectSettings, TransitionType, BrandConfig } from './types';
import { preloadImage, generateSpeech, imageUrl } from './pollinations';
import { generateMusic } from './music';
import { getVoices, detectLang, pickVoiceForLang } from './tts';
import { preloadVideo, preloadVideoWithFallbacks } from './pexels';

export type RenderProgress = {
  scene: number;
  total: number;
  phase: 'preparing' | 'rendering' | 'encoding' | 'transcoding' | 'done';
  message?: string;
};

type Dimensions = { width: number; height: number };

function dimsFor(aspect: '16:9' | '9:16' | '1:1', resolution: '720p' | '1080p' | '1440p'): Dimensions {
  const base = resolution === '1440p' ? 1440 : resolution === '1080p' ? 1080 : 720;
  switch (aspect) {
    case '16:9': return { width: Math.round((base * 16) / 9), height: base };
    case '9:16': return { width: base, height: Math.round((base * 16) / 9) };
    case '1:1': return { width: base, height: base };
  }
}

const TITLE_CARD_DURATION = 4;
const TRANSITION_DURATION = 0.8;

export async function renderVideo(
  scenes: Scene[],
  settings: ProjectSettings,
  title: string,
  onProgress?: (p: RenderProgress) => void,
): Promise<Blob> {
  const { width, height } = dimsFor(settings.aspect, settings.resolution);
  const total = scenes.length;
  const showTitle = settings.showTitleCard;

  onProgress?.({ scene: 0, total, phase: 'preparing', message: 'Görseller ve videolar yükleniyor...' });

  const media: (HTMLVideoElement | HTMLImageElement | null)[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    try {
      if (scene.ai_video_url && scene.ai_video_status === 'ready') {
        const video = await preloadVideo(scene.ai_video_url, 20000);
        video.play();
        media.push(video);
      } else if (scene.video_url) {
        const allUrls = [scene.video_url, ...(scene.video_alt_urls ?? [])];
        const video = await preloadVideoWithFallbacks(allUrls, 12000);
        if (video) { video.play(); media.push(video); }
        else if (scene.image_url) media.push(await preloadImage(scene.image_url));
        else if (scene.video_poster) media.push(await preloadImage(scene.video_poster));
        else { const fallbackUrl = imageUrl(scene.image_prompt, { width, height }); media.push(await preloadImage(fallbackUrl, 20000)); }
      } else if (scene.image_url) media.push(await preloadImage(scene.image_url));
      else if (scene.video_poster) media.push(await preloadImage(scene.video_poster));
      else { const fallbackUrl = imageUrl(scene.image_prompt, { width, height }); media.push(await preloadImage(fallbackUrl, 20000)); }
    } catch {
      try {
        if (scene.image_url) media.push(await preloadImage(scene.image_url));
        else if (scene.video_poster) media.push(await preloadImage(scene.video_poster));
        else { const fallbackUrl = imageUrl(scene.image_prompt, { width, height }); media.push(await preloadImage(fallbackUrl, 20000)); }
      } catch { media.push(null); }
    }
    onProgress?.({ scene: i + 1, total, phase: 'preparing', message: `Medya ${i + 1}/${total}` });
  }

  onProgress?.({ scene: 0, total, phase: 'preparing', message: 'Seslendirme hazırlanıyor...' });
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  const usePollinationsTTS = settings.ttsMode === 'pollinations';
  const narrationBuffers: (AudioBuffer | null)[] = [];
  if (usePollinationsTTS) {
    for (let i = 0; i < scenes.length; i++) {
      try {
        onProgress?.({ scene: i, total, phase: 'preparing', message: `Seslendirme ${i + 1}/${total} (AI TTS)` });
        const buf = await generateSpeech(scenes[i].narration, settings.ttsVoice, audioCtx);
        narrationBuffers.push(buf);
      } catch { narrationBuffers.push(null); }
    }
  } else {
    for (let i = 0; i < scenes.length; i++) narrationBuffers.push(null);
  }

  const narrationDurations: number[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const buf = narrationBuffers[i];
    if (buf && buf.duration > 0) narrationDurations.push(buf.duration);
    else { const words = scenes[i].narration.trim().split(/\s+/).length; const estimatedDur = Math.max(4, (words / 130) * 60 / Math.max(0.5, settings.rate)); narrationDurations.push(estimatedDur); }
    if (narrationDurations[i] > scenes[i].duration + 2) scenes[i] = { ...scenes[i], duration: narrationDurations[i] + 0.5 };
  }

  const titleDur = showTitle ? TITLE_CARD_DURATION : 0;
  const totalDuration = titleDur + scenes.reduce((sum, s) => sum + s.duration, 0);

  onProgress?.({ scene: total, total, phase: 'preparing', message: 'Müzik oluşturuluyor...' });
  const sceneDurations = scenes.map((s) => s.duration);
  const sceneMoods = scenes.map((s) => s.mood ?? 'neutral');

  let musicBuffer: AudioBuffer;
  if (settings.musicUrl) {
    try {
      const musicRes = await fetch(settings.musicUrl);
      const musicArr = await musicRes.arrayBuffer();
      musicBuffer = await audioCtx.decodeAudioData(musicArr);
      if (musicBuffer.duration < totalDuration) {
        const extended = audioCtx.createBuffer(musicBuffer.numberOfChannels, Math.ceil(totalDuration * 44100), 44100);
        const loopCount = Math.ceil(totalDuration / musicBuffer.duration);
        for (let ch = 0; ch < musicBuffer.numberOfChannels; ch++) {
          const srcData = musicBuffer.getChannelData(ch);
          const dstData = extended.getChannelData(ch);
          for (let loop = 0; loop < loopCount; loop++) {
            const offset = loop * srcData.length;
            const remaining = Math.min(srcData.length, dstData.length - offset);
            dstData.set(srcData.subarray(0, remaining), offset);
          }
        }
        musicBuffer = extended;
      } else {
        const trimmed = audioCtx.createBuffer(musicBuffer.numberOfChannels, Math.ceil(totalDuration * 44100), 44100);
        for (let ch = 0; ch < musicBuffer.numberOfChannels; ch++) {
          const srcData = musicBuffer.getChannelData(ch);
          const dstData = trimmed.getChannelData(ch);
          dstData.set(srcData.subarray(0, dstData.length));
        }
        musicBuffer = trimmed;
      }
    } catch (err) {
      console.warn('Custom music URL failed, falling back to procedural:', err);
      musicBuffer = await generateMusic(settings.music, totalDuration, settings.musicVolume, 44100, sceneDurations, sceneMoods, titleDur);
    }
  } else {
    musicBuffer = await generateMusic(settings.music, totalDuration, settings.musicVolume, 44100, sceneDurations, sceneMoods, titleDur);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const stream = canvas.captureStream(60);

  const audioDest = audioCtx.createMediaStreamDestination();
  const musicBus = audioCtx.createGain();
  musicBus.gain.value = 1.0;
  const musicSource = audioCtx.createBufferSource();
  musicSource.buffer = musicBuffer;
  musicSource.connect(musicBus);
  musicBus.connect(audioDest);
  musicSource.start();

  let narrationStart = titleDur;
  for (let i = 0; i < scenes.length; i++) {
    const sceneStart = narrationStart;
    const sceneDur = scenes[i].duration;
    const narrationBufDur = narrationBuffers[i]?.duration ?? 0;
    const estimatedNarrationDur = Math.min(sceneDur * 0.85, (scenes[i].narration.trim().split(/\s+/).length / 2.5));
    const narrationDur = narrationBufDur > 0 ? Math.min(sceneDur * 0.9, narrationBufDur) : estimatedNarrationDur;
    const duckStart = Math.max(0, sceneStart - 0.3);
    const restoreTime = sceneStart + narrationDur + 0.5;
    musicBus.gain.setValueAtTime(1.0, duckStart);
    musicBus.gain.linearRampToValueAtTime(0.45, duckStart + 0.2);
    musicBus.gain.setValueAtTime(0.45, Math.max(duckStart + 0.2, restoreTime - 0.3));
    musicBus.gain.linearRampToValueAtTime(1.0, restoreTime);
    narrationStart += sceneDur;
  }

  const narrationBus = audioCtx.createGain();
  narrationBus.gain.value = 1.0;
  narrationBus.connect(audioDest);
  narrationBus.connect(audioCtx.destination);

  const audioTrack = audioDest.stream.getAudioTracks()[0];
  if (audioTrack) stream.addTrack(audioTrack);

  const mimeType = pickMime(settings.exportFormat);
  const bitrate = settings.resolution === '1440p' ? 32_000_000 : settings.resolution === '1080p' ? 20_000_000 : 12_000_000;
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => { audioCtx.close(); resolve(new Blob(chunks, { type: mimeType })); };
  });

  recorder.start();
  onProgress?.({ scene: 0, total, phase: 'rendering' });

  if (showTitle) {
    const start = performance.now();
    while (performance.now() - start < TITLE_CARD_DURATION * 1000) {
      const progress = (performance.now() - start) / (TITLE_CARD_DURATION * 1000);
      drawTitleCard(ctx, width, height, title, scenes.length, progress);
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  let currentTime = showTitle ? TITLE_CARD_DURATION : 0;
  const voices = getVoices();
  const previewVoice = voices.find((v) => v.voiceURI === settings.voice) ?? null;
  const detectedLang = settings.language ?? (scenes.length > 0 ? detectLang(scenes[0].narration) : 'en-US');
  const langVoice = previewVoice ?? pickVoiceForLang(detectedLang, voices);
  const brand = settings.brand;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const m = media[i];
    const durMs = Math.max(1000, scene.duration * 1000);
    const start = performance.now();
    const prevMedia = i > 0 ? media[i - 1] : null;

    if (m instanceof HTMLVideoElement) { m.currentTime = 0; m.play().catch(() => {}); }

    const narrationBuf = narrationBuffers[i];
    if (narrationBuf && usePollinationsTTS) {
      const src = audioCtx.createBufferSource();
      src.buffer = narrationBuf;
      src.connect(narrationBus);
      src.start();
    } else {
      speakNarration(scene.narration, langVoice, settings.rate, detectedLang);
    }

    while (performance.now() - start < durMs) {
      const elapsed = performance.now() - start;
      const progress = elapsed / durMs;
      const isTransitioning = elapsed < TRANSITION_DURATION * 1000 && i > 0;
      drawScene(ctx, m, scene, width, height, progress, i, total, isTransitioning ? elapsed / (TRANSITION_DURATION * 1000) : 1, prevMedia, settings.transition, settings.subtitleStyle ?? 'standard', settings.subtitleColor ?? 'white', brand, narrationDurations[i]);
      await new Promise((r) => requestAnimationFrame(r));
    }

    if (m instanceof HTMLVideoElement) m.pause();
    currentTime += scene.duration;
    onProgress?.({ scene: i + 1, total, phase: 'rendering' });
  }

  if (settings.endCard?.enabled && settings.endCard.text) {
    const cardDur = settings.endCard.duration;
    const start = performance.now();
    while (performance.now() - start < cardDur * 1000) {
      const progress = (performance.now() - start) / (cardDur * 1000);
      drawEndCard(ctx, width, height, settings.endCard.text, settings.endCard.fontColor, progress);
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  await new Promise((r) => setTimeout(r, 300));
  window.speechSynthesis?.cancel();

  onProgress?.({ scene: total, total, phase: 'encoding' });
  recorder.stop();
  const blob = await done;
  onProgress?.({ scene: total, total, phase: 'done' });
  return blob;
}

function speakNarration(text: string, voice: SpeechSynthesisVoice | null, rate: number, lang?: string) {
  if (!text.trim() || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  if (voice) utter.voice = voice;
  utter.rate = rate; utter.volume = 1.0; utter.lang = lang ?? detectLang(text);
  window.speechSynthesis.speak(utter);
}

function drawTitleCard(ctx: CanvasRenderingContext2D, width: number, height: number, title: string, sceneCount: number, progress: number) {
  const t = progress * Math.PI * 2;
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, `hsl(${220 + Math.sin(t) * 15}, 30%, 8%)`);
  grad.addColorStop(0.5, `hsl(${210 + Math.cos(t) * 10}, 25%, 12%)`);
  grad.addColorStop(1, `hsl(${230 + Math.sin(t + 1) * 12}, 20%, 6%)`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);

  ctx.save();
  for (let i = 0; i < 30; i++) {
    const px = (Math.sin(i * 7.3 + t * 0.5) * 0.5 + 0.5) * width;
    const py = (Math.cos(i * 5.1 + t * 0.3) * 0.5 + 0.5) * height;
    const size = Math.max(0.5, 1 + Math.sin(i * 3 + t) * 1.5);
    const alpha = 0.1 + Math.sin(i * 2 + t * 0.5) * 0.05;
    ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
    ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(59, 130, 246, 0.12)'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = height * (0.2 + i * 0.15);
    ctx.beginPath(); ctx.moveTo(width * 0.1, y); ctx.lineTo(width * 0.9, y); ctx.stroke();
  }

  let alpha = 1;
  if (progress < 0.15) alpha = progress / 0.15;
  else if (progress > 0.85) alpha = (1 - progress) / 0.15;
  ctx.globalAlpha = alpha;

  const scale = 0.95 + Math.min(progress * 2, 1) * 0.05;
  ctx.save();
  ctx.translate(width / 2, height / 2 - height * 0.05);
  ctx.scale(scale, scale);

  const titleSize = Math.round(height * 0.08);
  ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 4;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  let titleText = title || 'Video';
  while (ctx.measureText(titleText).width > width * 0.8 && titleText.length > 10) titleText = titleText.slice(0, -1);
  if (titleText !== (title || 'Video')) titleText = titleText.slice(0, -1) + '...';
  ctx.fillText(titleText, 0, 0);
  ctx.restore();

  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const subSize = Math.round(height * 0.03);
  ctx.font = `400 ${subSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
  ctx.fillText(`${sceneCount} sahne`, width / 2, height / 2 + height * 0.08);
  ctx.globalAlpha = 1;
}

function drawScene(ctx: CanvasRenderingContext2D, media: HTMLVideoElement | HTMLImageElement | null, scene: Scene, width: number, height: number, progress: number, index: number, total: number, transitionProgress: number, prevMedia: HTMLVideoElement | HTMLImageElement | null, transition: TransitionType, subtitleStyle: 'standard' | 'kinetic' | 'none' = 'standard', subtitleColor: 'white' | 'gold' | 'yellow' = 'white', brand?: BrandConfig | null, narrationDuration?: number) {
  if (transition === 'crossfade' && transitionProgress < 1 && prevMedia) {
    ctx.save();
    drawMediaFill(ctx, prevMedia, width, height, 0, scene);
    const prevGrade = ctx.createLinearGradient(0, 0, 0, height);
    prevGrade.addColorStop(0, 'rgba(20, 30, 60, 0.15)');
    prevGrade.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    prevGrade.addColorStop(1, 'rgba(10, 15, 40, 0.2)');
    ctx.fillStyle = prevGrade; ctx.fillRect(0, 0, width, height);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = transitionProgress;
    drawSceneContent(ctx, media, scene, width, height, progress, index, total, subtitleStyle, subtitleColor, narrationDuration, scene.duration);
    ctx.restore();
  } else {
    ctx.save();
    applyTransition(ctx, transition, transitionProgress, width, height, 'in');
    drawSceneContent(ctx, media, scene, width, height, progress, index, total, subtitleStyle, subtitleColor, narrationDuration, scene.duration);
    ctx.restore();
    if (transitionProgress < 1 && prevMedia) {
      ctx.save();
      applyTransition(ctx, transition, transitionProgress, width, height, 'out');
      drawMediaFill(ctx, prevMedia, width, height, 0, scene);
      ctx.restore();
    }
  }
  if (brand?.enabled) drawBrandOverlay(ctx, brand, width, height);
}

function applyTransition(ctx: CanvasRenderingContext2D, type: TransitionType, progress: number, width: number, height: number, direction: 'in' | 'out') {
  const p = direction === 'out' ? 1 - progress : progress;
  switch (type) {
    case 'crossfade': ctx.globalAlpha = p; break;
    case 'fade': ctx.globalAlpha = p; break;
    case 'slide': if (direction === 'in') ctx.translate(-width * (1 - p) * 0.3, 0); else ctx.translate(width * progress * 0.3, 0); break;
    case 'zoom': { ctx.globalAlpha = p; const scale = 0.92 + p * 0.08; ctx.translate(width / 2, height / 2); ctx.scale(scale, scale); ctx.translate(-width / 2, -height / 2); break; }
    case 'cut': ctx.globalAlpha = progress < 0.05 ? 0 : 1; break;
  }
}

function drawSceneContent(ctx: CanvasRenderingContext2D, media: HTMLVideoElement | HTMLImageElement | null, scene: Scene, width: number, height: number, progress: number, index: number, total: number, subtitleStyle: 'standard' | 'kinetic' | 'none' = 'standard', subtitleColor: 'white' | 'gold' | 'yellow' = 'white', narrationDuration?: number, sceneDuration?: number) {
  drawMediaFill(ctx, media, width, height, progress, scene);

  const grade = ctx.createLinearGradient(0, 0, 0, height);
  grade.addColorStop(0, 'rgba(20, 30, 60, 0.15)');
  grade.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  grade.addColorStop(1, 'rgba(10, 15, 40, 0.2)');
  ctx.fillStyle = grade; ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.25, width / 2, height / 2, height * 0.8);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.7, 'rgba(0,0,0,0.15)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);

  if (subtitleStyle === 'kinetic' && scene.narration.trim()) {
    drawKineticSubtitle(ctx, scene.narration, width, height, progress, subtitleColor, narrationDuration, sceneDuration);
  } else if (subtitleStyle === 'standard' && scene.narration.trim()) {
    const subtitleY = height - height * 0.22;
    const barHeight = height * 0.18;
    const grad2 = ctx.createLinearGradient(0, subtitleY, 0, subtitleY + barHeight);
    grad2.addColorStop(0, 'rgba(0,0,0,0)');
    grad2.addColorStop(0.3, 'rgba(0,0,0,0.5)');
    grad2.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = grad2; ctx.fillRect(0, subtitleY, width, barHeight);

    const fontSize = Math.round(height * 0.042);
    ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    const subColor = subtitleColor === 'gold' ? 'rgba(212,175,55,0.97)' : subtitleColor === 'yellow' ? 'rgba(251,191,36,0.97)' : 'rgba(255,255,255,0.97)';
    ctx.fillStyle = subColor;
    wrapText(ctx, scene.narration, width / 2, subtitleY + barHeight / 2, width * 0.82, fontSize * 1.5);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }

  const badgeSize = Math.round(height * 0.04);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(width * 0.03, height * 0.03, badgeSize * 2.5, badgeSize);
  ctx.font = `600 ${Math.round(badgeSize * 0.5)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText(`${index + 1} / ${total}`, width * 0.03 + badgeSize * 0.3, height * 0.03 + badgeSize * 0.5);

  const segW = width / total;
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0, 0, width, 3);
  ctx.fillStyle = '#3b82f6'; ctx.fillRect(0, 0, segW * (index + progress), 3);
}

function drawMediaFill(ctx: CanvasRenderingContext2D, media: HTMLVideoElement | HTMLImageElement | null, width: number, height: number, progress: number, scene?: Scene) {
  if (media) {
    const isVideo = media instanceof HTMLVideoElement;
    const scale = isVideo ? 1.02 + progress * 0.03 : 1.05 + progress * 0.06;
    const panX = isVideo ? (progress - 0.5) * 10 : (progress - 0.5) * 15;
    const panY = isVideo ? (progress - 0.5) * 5 : (progress - 0.5) * 8;
    const mw = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const mh = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
    const canvasRatio = width / height;
    const mediaRatio = mw / mh;
    let drawW: number, drawH: number;
    if (mediaRatio > canvasRatio) { drawH = height * scale; drawW = drawH * mediaRatio; }
    else { drawW = width * scale; drawH = drawW / mediaRatio; }
    const dx = (width - drawW) / 2 - panX;
    const dy = (height - drawH) / 2 - panY;
    ctx.drawImage(media, dx, dy, drawW, drawH);

    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
  } else {
    const t = progress * Math.PI;
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, `hsl(210, 60%, ${32 + Math.sin(t) * 4}%)`);
    grad.addColorStop(0.5, `hsl(220, 50%, ${26 + Math.cos(t) * 3}%)`);
    grad.addColorStop(1, `hsl(250, 40%, ${22 + Math.sin(t + 1) * 3}%)`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);

    if (scene?.image_prompt) {
      const fontSize = Math.round(height * 0.038);
      ctx.save();
      ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'; ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      wrapText(ctx, scene.image_prompt, width / 2, height / 2, width * 0.75, fontSize * 1.5);
      ctx.restore();
    }
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) { lines.push(current); current = word; }
    else current = test;
  }
  if (current) lines.push(current);
  const totalH = lines.length * lineHeight;
  let startY = y - totalH / 2 + lineHeight / 2;
  for (const line of lines) { ctx.fillText(line, x, startY); startY += lineHeight; }
}

function drawEndCard(ctx: CanvasRenderingContext2D, width: number, height: number, text: string, fontColor: string, progress: number) {
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, width, height);
  let alpha = 1;
  if (progress < 0.15) alpha = progress / 0.15;
  else if (progress > 0.85) alpha = (1 - progress) / 0.15;
  ctx.globalAlpha = alpha;
  const fontSize = Math.round(height * 0.07);
  ctx.font = `600 ${fontSize}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const color = fontColor === 'gold' ? '#d4af37' : fontColor === 'yellow' ? '#fbbf24' : '#ffffff';
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2);
  ctx.globalAlpha = 1;
}

function drawKineticSubtitle(ctx: CanvasRenderingContext2D, text: string, width: number, height: number, progress: number, color: string, narrationDuration?: number, sceneDuration?: number) {
  if (!text.trim()) return;
  const words = text.trim().split(/\s+/);
  const totalWords = words.length;
  const narrationEndRatio = narrationDuration && sceneDuration ? Math.min(0.95, narrationDuration / sceneDuration) : 0.85;
  const wordProgress = Math.min(1, progress / narrationEndRatio);
  const currentWordIdx = Math.min(Math.floor(wordProgress * totalWords), totalWords - 1);

  const fontSize = Math.round(height * 0.055);
  ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const textColor = color === 'gold' ? '#d4af37' : color === 'yellow' ? '#fbbf24' : '#ffffff';
  const subtitleY = height - height * 0.15;

  let xCursor = width / 2;
  const totalWidth = ctx.measureText(words.join(' ')).width;
  xCursor = width / 2 - totalWidth / 2;

  for (let i = 0; i <= currentWordIdx && i < words.length; i++) {
    const word = words[i];
    const wordWidth = ctx.measureText(word).width;
    const isCurrent = i === currentWordIdx;
    const isPast = i < currentWordIdx;
    ctx.globalAlpha = isCurrent ? 1 : isPast ? 0.4 : 0;
    ctx.fillStyle = textColor;
    ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    if (isCurrent) {
      ctx.save();
      const scale = 1.1;
      ctx.translate(xCursor + wordWidth / 2, subtitleY);
      ctx.scale(scale, scale);
      ctx.fillText(word, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(word, xCursor + wordWidth / 2, subtitleY);
    }
    xCursor += wordWidth + ctx.measureText(' ').width;
  }
  ctx.globalAlpha = 1; ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
}

function pickMime(format?: string): string {
  if (format === 'mp4') {
    const mp4Types = ['video/mp4;codecs=h264,aac', 'video/mp4;codecs=avc1', 'video/mp4'];
    for (const t of mp4Types) if (MediaRecorder.isTypeSupported(t)) return t;
  }
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  for (const t of types) if (MediaRecorder.isTypeSupported(t)) return t;
  return 'video/webm';
}

export function supportsMP4(): boolean {
  const types = ['video/mp4;codecs=h264,aac', 'video/mp4;codecs=avc1', 'video/mp4'];
  return types.some((t) => MediaRecorder.isTypeSupported(t));
}

export function getExtension(mime: string): string {
  if (mime.includes('mp4')) return 'mp4';
  return 'webm';
}

function drawBrandOverlay(ctx: CanvasRenderingContext2D, brand: BrandConfig, width: number, height: number) {
  if (brand.watermarkText) {
    const fontSize = Math.max(12, Math.round(height * 0.022));
    ctx.save();
    ctx.font = `600 ${fontSize}px ${brand.fontFamily || 'sans-serif'}`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = brand.primaryColor;
    ctx.globalAlpha = 0.7;
    ctx.fillText(brand.watermarkText, width - 16, height - 14);
    ctx.restore();
  }
}
