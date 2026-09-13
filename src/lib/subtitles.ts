import type { Scene, SubtitleEntry } from './types';

/**
 * Format seconds to SRT timestamp format (HH:MM:SS,mmm)
 */
function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Parse SRT format string into subtitle entries
 */
export function parseSRT(srtContent: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const blocks = srtContent.split('\n\n').filter((block) => block.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    try {
      const index = parseInt(lines[0], 10);
      const timeRange = lines[1].split(' --> ');

      if (timeRange.length !== 2) continue;

      const startTime = parseTimestamp(timeRange[0].trim());
      const endTime = parseTimestamp(timeRange[1].trim());
      const text = lines.slice(2).join('\n');

      if (isNaN(startTime) || isNaN(endTime)) continue;

      entries.push({
        startTime,
        endTime,
        text,
        index,
      });
    } catch {
      // Skip malformed entries
      continue;
    }
  }

  return entries;
}

/**
 * Parse SRT timestamp to seconds
 */
function parseTimestamp(timestamp: string): number {
  const match = timestamp.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) return NaN;

  const [, hrs, mins, secs, ms] = match;
  return parseInt(hrs, 10) * 3600 + parseInt(mins, 10) * 60 + parseInt(secs, 10) + parseInt(ms, 10) / 1000;
}

/**
 * Generate SRT format string from scenes
 */
export function generateSRT(scenes: Scene[], titleOffset: number = 0): string {
  const lines: string[] = [];
  let currentTime = titleOffset;
  let index = 1;

  for (const scene of scenes) {
    if (!scene.narration || !scene.narration.trim()) {
      currentTime += scene.duration;
      continue;
    }

    const start = currentTime;
    const end = currentTime + scene.duration;

    lines.push(String(index));
    lines.push(`${formatTimestamp(start)} --> ${formatTimestamp(end)}`);
    lines.push(scene.narration.trim());
    lines.push('');

    index++;
    currentTime += scene.duration;
  }

  return lines.join('\n');
}

/**
 * Download SRT file
 */
export function downloadSRT(scenes: Scene[], title: string, titleOffset: number = 0): void {
  const srt = generateSRT(scenes, titleOffset);
  const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = `${title || 'video'}.srt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/**
 * Generate subtitle entries from scenes
 */
export function generateSubtitles(scenes: Scene[], titleOffset: number = 0): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  let currentTime = titleOffset;
  let index = 1;

  for (const scene of scenes) {
    if (!scene.narration || !scene.narration.trim()) {
      currentTime += scene.duration;
      continue;
    }

    const startTime = currentTime;
    const endTime = currentTime + scene.duration;

    entries.push({
      startTime,
      endTime,
      text: scene.narration.trim(),
      index,
    });

    index++;
    currentTime += scene.duration;
  }

  return entries;
}

/**
 * Split text into lines for subtitle display
 */
export function splitSubtitleText(text: string, maxCharsPerLine: number = 42): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length > maxCharsPerLine) {
      if (currentLine) {
        lines.push(currentLine.trim());
      }
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
 * Render subtitles on canvas context
 */
export function renderSubtitlesOnCanvas(
  ctx: CanvasRenderingContext2D,
  subtitle: SubtitleEntry | null,
  options: {
    style: 'standard' | 'bold' | 'minimal' | 'cinematic' | 'karaoke';
    color: 'white' | 'yellow' | 'gold' | 'cyan';
    fontSize?: number;
    fontFamily?: string;
    padding?: number;
  },
): void {
  if (!subtitle || !subtitle.text) return;

  const {
    style,
    color,
    fontSize = 32,
    fontFamily = 'Arial',
    padding = 20,
  } = options;

  const canvas = ctx.canvas;
  const maxWidth = canvas.width - padding * 2;
  const lines = splitSubtitleText(subtitle.text, 42);

  // Color mapping
  const colorMap: Record<string, string> = {
    white: '#FFFFFF',
    yellow: '#FFFF00',
    gold: '#FFD700',
    cyan: '#00FFFF',
  };

  const textColor = colorMap[color] || '#FFFFFF';
  const bottomY = canvas.height - padding - 10;
  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  let y = bottomY - totalHeight;

  // Draw background based on style
  if (style !== 'minimal') {
    const bgPadding = 10;
    const bgHeight = totalHeight + bgPadding * 2;
    const bgY = y - bgPadding;

    ctx.fillStyle = style === 'karaoke' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(padding, bgY, maxWidth, bgHeight);

    if (style === 'cinematic') {
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(padding, bgY, maxWidth, bgHeight);
    }
  }

  // Draw text
  ctx.fillStyle = textColor;
  ctx.font = `${style === 'bold' ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Add shadow for better readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  for (const line of lines) {
    ctx.fillText(line, canvas.width / 2, y + fontSize / 2);
    y += lineHeight;
  }

  ctx.shadowColor = 'transparent';
}

/**
 * Get subtitle at specific time
 */
export function getSubtitleAtTime(entries: SubtitleEntry[], timeInSeconds: number): SubtitleEntry | null {
  return entries.find((entry) => timeInSeconds >= entry.startTime && timeInSeconds < entry.endTime) || null;
}

/**
 * Validate subtitle entries
 */
export function validateSubtitles(entries: SubtitleEntry[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.startTime < 0) {
      errors.push(`Subtitle ${i + 1}: Start time cannot be negative`);
    }

    if (entry.endTime <= entry.startTime) {
      errors.push(`Subtitle ${i + 1}: End time must be after start time`);
    }

    if (!entry.text || !entry.text.trim()) {
      errors.push(`Subtitle ${i + 1}: Text cannot be empty`);
    }

    // Check for overlap with previous
    if (i > 0) {
      const prev = entries[i - 1];
      if (entry.startTime < prev.endTime) {
        errors.push(`Subtitle ${i + 1}: Overlaps with subtitle ${i}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Convert subtitle entries to SRT format
 */
export function subtitleEntriesToSRT(entries: SubtitleEntry[]): string {
  const lines: string[] = [];

  for (const entry of entries) {
    lines.push(String(entry.index));
    lines.push(`${formatTimestamp(entry.startTime)} --> ${formatTimestamp(entry.endTime)}`);
    lines.push(entry.text);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Merge overlapping or adjacent subtitles
 */
export function mergeSubtitles(entries: SubtitleEntry[], gapThreshold: number = 0.5): SubtitleEntry[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => a.startTime - b.startTime);
  const merged: SubtitleEntry[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // If gap between end and next start is smaller than threshold, merge
    if (next.startTime - current.endTime < gapThreshold) {
      current = {
        ...current,
        endTime: Math.max(current.endTime, next.endTime),
        text: `${current.text}\n${next.text}`,
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}
