import type { ProjectSettings, TTSVoice, MusicStyle, TransitionType, Scene, SceneMood } from './types';
import { buildImagePromptFromNarration, pickShotType } from './visualContext';

export type ParsedBrief = {
  title: string;
  scenes: { narration: string; image_prompt: string; mood: SceneMood }[];
  settings: Partial<ProjectSettings>;
  maxDuration?: number;
  endCardText?: string;
  endCardDuration?: number;
  subtitleStyle?: 'kinetic' | 'standard' | 'none';
  subtitleColor?: string;
  subtitleOutline?: string;
  stockFootageStyle?: string;
  language?: string;
  detected: boolean;
  detectionReasons: string[];
};

function matchSection(text: string, label: string): string | null {
  const labelRe = new RegExp(`(?:^|\\n)\\s*${label}\\b[^\n]*[:：]`, 'i');
  const labelMatch = text.match(labelRe);
  if (!labelMatch) return null;
  const startIdx = labelMatch.index! + labelMatch[0].length;
  const remaining = text.slice(startIdx);
  const nextSectionRe = /\n\s*(?:VISUAL STYLE|VOICEOVER|MUSIC|SUBTITLES|STOCK FOOTAGE|STOCK|END CARD|OUTPUT|SCRIPT|SCENE|TRANSITION|FORMAT|ASPECT|RESOLUTION|DURATION|THUMBNAIL|DESCRIPTION|TAGS|TITLE)\b[^\n]*[:：]/i;
  const nextMatch = remaining.match(nextSectionRe);
  const content = nextMatch ? remaining.slice(0, nextMatch.index!) : remaining;
  return content.trim();
}

function detectAspect(text: string): '16:9' | '9:16' | '1:1' | null {
  if (/\b9\s*[:x]\s*16\b/i.test(text) || /vertical/i.test(text) || /shorts/i.test(text)) return '9:16';
  if (/\b16\s*[:x]\s*9\b/i.test(text) || /horizontal|landscape/i.test(text)) return '16:9';
  if (/\b1\s*[:x]\s*1\b/i.test(text) || /square/i.test(text)) return '1:1';
  return null;
}

function detectResolution(text: string): '720p' | '1080p' | null {
  if (/\b1080p\b/i.test(text) || /\b1080\s*x\s*1920\b/i.test(text) || /\b1920\s*x\s*1080\b/i.test(text)) return '1080p';
  if (/\b720p\b/i.test(text) || /\b1280\s*x\s*720\b/i.test(text)) return '720p';
  return null;
}

function detectMaxDuration(text: string): number | null {
  const m = text.match(/(?:maximum\s+|max\s+|within\s+|under\s+)?(\d{1,3})\s*(?:seconds|sec|s)\b/i);
  if (m) return parseInt(m[1], 10); return null;
}

function detectSceneCount(text: string): number | null {
  const m = text.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*scenes/i) || text.match(/(\d+)\s*scenes/i);
  if (m) { if (m[2]) return Math.round((parseInt(m[1], 10) + parseInt(m[2], 10)) / 2); return parseInt(m[1], 10); }
  return null;
}

function detectSceneDurationRange(text: string): { min: number; max: number } | null {
  const m = text.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*seconds/i);
  if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) }; return null;
}

function detectTTSVoice(text: string): TTSVoice | null {
  const t = text.toLowerCase();
  if (/male|erkek|deep|authoritative|documentary narrator/i.test(t)) return 'onyx';
  if (/female|kadın|soft|warm|nova/i.test(t)) return 'nova';
  if (/young|genç|bright/i.test(t)) return 'shimmer';
  if (/neutral|balanced|alloy/i.test(t)) return 'alloy';
  if (/echo|robotik|electronic/i.test(t)) return 'echo';
  return null;
}

function detectMusicStyle(text: string): MusicStyle | null {
  const t = text.toLowerCase();
  if (/no\s*music|music\s*none|müzik\s*yok/i.test(t)) return 'none';
  if (/orchestral|dramatic|strings|bass|cinematic|belgesel|documentary/i.test(t)) return 'dramatic';
  if (/ambient|atmospheric|chill/i.test(t)) return 'ambient';
  if (/uplifting|cheerful|happy|positive|upbeat/i.test(t)) return 'uplifting';
  if (/lofi|lo-fi|chill\s*hop/i.test(t)) return 'lofi';
  if (/cinematic|epic|film/i.test(t)) return 'cinematic';
  return null;
}

function detectTransition(text: string): TransitionType | null {
  const t = text.toLowerCase();
  if (/sharp\s*cut|hard\s*cut|cut/i.test(t)) return 'cut';
  if (/flash|whip/i.test(t)) return 'cut';
  if (/fade/i.test(t)) return 'fade';
  if (/slide/i.test(t)) return 'slide';
  if (/zoom/i.test(t)) return 'zoom';
  return null;
}

function detectRate(text: string): number | null {
  const t = text.toLowerCase();
  if (/slow.*powerful|starts\s*slow|builds?\s+intensity/i.test(t)) return 0.85;
  if (/fast|rapid|quick\s*pacing/i.test(t)) return 1.2;
  return null;
}

function detectMusicVolume(text: string): number | null {
  const t = text.toLowerCase();
  if (/background\s*level|music.*background|voiceover\s*louder/i.test(t)) return 0.15;
  if (/subtle\s*music|quiet\s*music|low\s*music/i.test(t)) return 0.1;
  if (/loud\s*music|prominent\s*music/i.test(t)) return 0.3;
  return null;
}

function detectSubtitleStyle(text: string): 'kinetic' | 'standard' | 'none' | null {
  const t = text.toLowerCase();
  if (/no\s+subtitles?\s*[,.;]/i.test(text) || /without\s+subtitles?/i.test(text)) return 'none';
  if (/kinetic\s*typography|word\s*by\s*word|word-by-word/i.test(t)) return 'kinetic';
  if (/subtitle|altyaz/i.test(t)) return 'standard';
  return null;
}

function detectSubtitleColors(text: string): { color: string; outline: string } | null {
  const t = text.toLowerCase();
  let color = 'white'; let outline = 'black';
  if (/white\s*font/i.test(t)) color = 'white';
  if (/gold.*font|font.*gold/i.test(t)) color = 'gold';
  if (/black\s*outline/i.test(t)) outline = 'black';
  if (/no.*background\s*box|without.*background/i.test(t)) outline = 'none';
  return { color, outline };
}

function detectEndCard(text: string): { text: string; duration: number } | null {
  const section = matchSection(text, 'END CARD');
  if (!section) return null;
  const durMatch = section.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*seconds/i) || section.match(/(\d+)\s*seconds/i);
  let duration = 3;
  if (durMatch) duration = durMatch[2] ? Math.round((parseInt(durMatch[1]) + parseInt(durMatch[2])) / 2) : parseInt(durMatch[1]);
  const textMatch = section.match(/"([^"]+)"/) || section.match(/text\s+"([^"]+)"/i);
  const endText = textMatch ? textMatch[1] : 'Game of Company';
  return { text: endText, duration };
}

function detectStockFootageStyle(text: string): string | null {
  const section = matchSection(text, 'STOCK FOOTAGE') || matchSection(text, 'STOCK');
  if (!section) return null;
  if (/nano\s*banana/i.test(section)) return 'nano-banana';
  if (/istock\s*premium/i.test(section)) return 'istock-premium';
  if (/dark\s*cinematic/i.test(section)) return 'dark-cinematic';
  return 'standard';
}

function detectMediaSource(text: string): 'stock' | 'ai' | 'auto' | null {
  const t = text.toLowerCase();
  if (/stock\s*footage|stok\s*video|pexels/i.test(t)) return 'stock';
  if (/ai\s*(image|visual|görsel)|ai\s*generated/i.test(t)) return 'ai';
  return null;
}

function detectStyle(text: string): string | null {
  const section = matchSection(text, 'VISUAL STYLE');
  if (!section) return null;
  const keywords: string[] = [];
  if (/deep\s*black/i.test(section)) keywords.push('dark');
  if (/navy\s*blue/i.test(section)) keywords.push('navy');
  if (/gold/i.test(section)) keywords.push('gold');
  if (/dark\s*red/i.test(section)) keywords.push('crimson');
  if (/cinematic/i.test(section)) keywords.push('cinematic');
  if (/dramatic/i.test(section)) keywords.push('dramatic');
  if (keywords.length === 0) return null;
  return keywords.join(' ');
}

function extractScriptLines(text: string): string[] | null {
  const section = matchSection(text, 'SCRIPT');
  if (!section) return null;
  let cleanSection = section;
  const openQuotes = (cleanSection.match(/"/g) ?? []).length;
  if (openQuotes % 2 === 1) cleanSection = cleanSection + '"';
  const quoted = cleanSection.match(/"([^"]+)"/g);
  if (quoted && quoted.length >= 2) {
    const lines: string[] = [];
    for (const q of quoted) { const inner = q.replace(/^"|"$/g, '').trim(); if (inner) lines.push(inner); }
    if (lines.length >= 2) return lines;
  }
  if (quoted && quoted.length === 1) {
    const inner = quoted[0].replace(/^"|"$/g, '').trim();
    const innerLines = inner.split('\n').map((l) => l.trim()).filter((l) => l);
    if (innerLines.length >= 2) return innerLines;
  }
  const rawLines = cleanSection.split('\n').map((l) => l.trim()).filter((l) => l && !l.match(/^(script|senaryo)\s*[:：]/i));
  if (rawLines.length >= 3) return rawLines;
  const sentences = cleanSection.replace(/^(script|senaryo)\s*[:：]\s*/i, '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 5);
  if (sentences.length >= 3) return sentences;
  return null;
}

function generateImagePromptFromLine(line: string, style: string, index: number, total: number): string {
  const shotType = pickShotType(index, total);
  return buildImagePromptFromNarration(line, style, shotType);
}

function detectMood(line: string, index: number, total: number): SceneMood {
  const t = line.toLowerCase();
  if (/crash|crisis|bankrupt|gone|fell|collapse|refused|failure|disaster|largest|global/i.test(t)) return 'dramatic';
  if (/subscribe|comment|next|beginning|game/i.test(t)) return 'tense';
  if (index === 0) return 'dramatic';
  if (index >= total - 3) return 'tense';
  return 'dramatic';
}

function extractTitle(text: string, fallback: string): string {
  const scriptLines = extractScriptLines(text);
  if (scriptLines && scriptLines.length > 0) {
    const first = scriptLines[0];
    const words = first.split(/\s+/).slice(0, 6).join(' ');
    return words.length > 10 ? words : first.slice(0, 50);
  }
  return fallback;
}

export function parseBrief(prompt: string): ParsedBrief {
  const reasons: string[] = [];
  const settings: Partial<ProjectSettings> = {};
  const hasSections = /(?:VISUAL STYLE|VOICEOVER|MUSIC|SUBTITLES|STOCK FOOTAGE|END CARD|OUTPUT|SCRIPT)\s*[:：]/i.test(prompt);
  const hasFormat = /\b(9\s*[:x]\s*16|16\s*[:x]\s*9|1\s*[:x]\s*1|1080x1920|1920x1080)\b/i.test(prompt);
  const hasDuration = /\b\d+\s*seconds?\b/i.test(prompt) && /\b(maximum|within|under)\b/i.test(prompt);
  if (!hasSections && !hasFormat && !hasDuration) return { title: '', scenes: [], settings: {}, detected: false, detectionReasons: [] };
  if (hasSections) reasons.push('Yapılandırılmış bölümler bulundu');
  if (hasFormat) reasons.push('Video formatı belirtildi');
  if (hasDuration) reasons.push('Süre limiti belirtildi');
  const aspect = detectAspect(prompt);
  if (aspect) { settings.aspect = aspect; reasons.push(`Format: ${aspect}`); }
  const res = detectResolution(prompt);
  if (res) { settings.resolution = res; reasons.push(`Çözünürlük: ${res}`); }
  const maxDur = detectMaxDuration(prompt);
  let sceneCount = detectSceneCount(prompt);
  const sceneDurRange = detectSceneDurationRange(prompt);
  const voice = detectTTSVoice(prompt);
  if (voice) { settings.ttsVoice = voice; reasons.push(`Ses: ${voice}`); }
  const rate = detectRate(prompt);
  if (rate) settings.rate = rate;
  const music = detectMusicStyle(prompt);
  if (music) { settings.music = music; reasons.push(`Müzik: ${music}`); }
  const musicVol = detectMusicVolume(prompt);
  if (musicVol) settings.musicVolume = musicVol;
  const transition = detectTransition(prompt);
  if (transition) settings.transition = transition;
  const mediaSource = detectMediaSource(prompt);
  if (mediaSource) settings.mediaSource = mediaSource;
  const style = detectStyle(prompt) ?? 'cinematic';
  settings.style = style;
  const subtitleStyle = detectSubtitleStyle(prompt);
  const subtitleColors = detectSubtitleColors(prompt);
  const endCard = detectEndCard(prompt);
  const stockStyle = detectStockFootageStyle(prompt);
  const scriptLines = extractScriptLines(prompt);
  let scenes: ParsedBrief['scenes'] = [];
  let title = '';
  let language: string | undefined;
  if (scriptLines && scriptLines.length > 0) {
    reasons.push(`Senaryo: ${scriptLines.length} satır bulundu`);
    const allText = scriptLines.join(' ');
    if (/[çğıöşüÇĞİÖŞÜ]/.test(allText)) { language = 'tr-TR'; reasons.push('Dil: Türkçe'); }
    else { language = 'en-US'; reasons.push('Dil: English'); }
    if (!sceneCount) sceneCount = scriptLines.length;
    const perSceneDur = maxDur ? maxDur / scriptLines.length : null;
    scenes = scriptLines.map((line, i) => ({ narration: line, image_prompt: generateImagePromptFromLine(line, style, i, scriptLines.length), mood: detectMood(line, i, scriptLines.length) }));
    title = extractTitle(prompt, scriptLines[0]);
  }
  if (/no\s*intro|no\s*logo|no\s*brand|no\s*title\s*card/i.test(prompt)) { settings.showTitleCard = false; reasons.push('Açılış kartı devre dışı'); }
  return { title, scenes, settings, maxDuration: maxDur ?? undefined, endCardText: endCard?.text, endCardDuration: endCard?.duration, subtitleStyle: subtitleStyle ?? undefined, subtitleColor: subtitleColors?.color, subtitleOutline: subtitleColors?.outline, stockFootageStyle: stockStyle ?? undefined, language, detected: true, detectionReasons: reasons };
}

export function applyBriefToSettings(base: ProjectSettings, parsed: ParsedBrief): ProjectSettings { return { ...base, ...parsed.settings }; }

export function buildScenesFromBrief(parsed: ParsedBrief, maxDuration?: number): { narration: string; image_prompt: string; duration: number; mood: SceneMood }[] {
  if (parsed.scenes.length === 0) return [];
  const totalLines = parsed.scenes.length;
  let perScene: number;
  if (maxDuration) { const endCardTime = parsed.endCardDuration ?? 0; const availableTime = maxDuration - endCardTime; perScene = availableTime / totalLines; perScene = Math.max(2.5, Math.min(perScene, 5)); }
  else perScene = 4;
  return parsed.scenes.map((s) => ({ narration: s.narration, image_prompt: s.image_prompt, duration: perScene, mood: s.mood }));
}
