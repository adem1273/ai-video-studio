import type { Scene } from './types';

function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function generateSRT(scenes: Scene[], titleOffset: number = 0): string {
  const lines: string[] = [];
  let currentTime = titleOffset;
  let index = 1;
  for (const scene of scenes) {
    if (!scene.narration.trim()) { currentTime += scene.duration; continue; }
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

export function downloadSRT(scenes: Scene[], title: string, titleOffset: number = 0) {
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
