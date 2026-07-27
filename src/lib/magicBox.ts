// Magic Box command parser — interprets natural-language edit commands
// and returns structured actions that the UI can apply.

import type { Scene, ProjectSettings, MusicStyle, TransitionType, SubtitleStyle, SubtitleColor, SceneMood } from './types';
import { buildImagePromptFromNarration } from './visualContext';

export type MagicAction =
  | { type: 'set_pace'; rate: number }
  | { type: 'set_music'; music: MusicStyle }
  | { type: 'set_music_volume'; volume: number }
  | { type: 'set_voice'; voice: string }
  | { type: 'set_aspect'; aspect: ProjectSettings['aspect'] }
  | { type: 'set_resolution'; resolution: ProjectSettings['resolution'] }
  | { type: 'set_transition'; transition: TransitionType }
  | { type: 'set_subtitle_style'; style: SubtitleStyle }
  | { type: 'set_subtitle_color'; color: SubtitleColor }
  | { type: 'toggle_subtitles'; enabled: boolean }
  | { type: 'toggle_title_card'; enabled: boolean }
  | { type: 'set_scene_duration'; index: number; duration: number }
  | { type: 'set_all_duration'; duration: number }
  | { type: 'delete_scene'; index: number }
  | { type: 'add_scene'; afterIndex: number; narration: string }
  | { type: 'replace_scene_media'; index: number; prompt: string }
  | { type: 'set_scene_narration'; index: number; narration: string }
  | { type: 'set_scene_mood'; index: number; mood: SceneMood }
  | { type: 'set_end_card'; text: string; duration?: number }
  | { type: 'remove_end_card' }
  | { type: 'set_style'; style: string }
  | { type: 'regenerate_scene'; index: number }
  | { type: 'unknown'; raw: string };

export type CommandResult = { actions: MagicAction[]; summary: string };

function parseNumber(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function tr(text: string): string {
  return text
    .replace(/[üÜ]/g, 'u').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
    .replace(/[âÂ]/g, 'a').replace(/[îÎ]/g, 'i').replace(/[ûÛ]/g, 'u')
    .toLowerCase().trim();
}

function parseSceneIndex(text: string, total: number): number | null {
  const m = text.match(/(?:scene|sahne|sahnesi|sahneyi)\s*(\d+)/);
  if (m) { const idx = parseInt(m[1], 10) - 1; if (idx >= 0 && idx < total) return idx; }
  const num = parseNumber(text);
  if (num !== null && num >= 1 && num <= total) return num - 1;
  return null;
}

function detectMusic(text: string): MusicStyle | null {
  if (/upbeat|neseli|enerji|happy|mutlu|positive|pozitif/.test(text)) return 'uplifting';
  if (/ambient|atmosfer|calm|sakin|soft|yumusak/.test(text)) return 'ambient';
  if (/cinematic|sinematik|film|epic|epik/.test(text)) return 'cinematic';
  if (/lofi|lo-fi|chill|relax/.test(text)) return 'lofi';
  if (/dramatic|dramatik|tense|gerilim|dark|karanlik/.test(text)) return 'dramatic';
  if (/none|sil|kapat|no music|muzik olmas/.test(text)) return 'none';
  return null;
}

function detectTransition(text: string): TransitionType | null {
  if (/slide|kaydir|kayarak/.test(text)) return 'slide';
  if (/zoom|yakinlastir|zoomla/.test(text)) return 'zoom';
  if (/cut|kesme|hard cut|aniden/.test(text)) return 'cut';
  if (/fade|solukla|yavasa gec/.test(text)) return 'fade';
  return null;
}

function detectMood(text: string): SceneMood | null {
  if (/dramatic|dramatik/.test(text)) return 'dramatic';
  if (/calm|sakin/.test(text)) return 'calm';
  if (/happy|mutlu|neseli/.test(text)) return 'happy';
  if (/tense|gerilim/.test(text)) return 'tense';
  if (/mysterious|gizem/.test(text)) return 'mysterious';
  if (/neutral|notr/.test(text)) return 'neutral';
  return null;
}

export function parseCommand(input: string, context: { sceneCount: number; settings: ProjectSettings }): CommandResult {
  const text = tr(input);
  const actions: MagicAction[] = [];
  const summaryParts: string[] = [];

  if (/slower|yavas|yavas la|slow down|pace down|daha yavas/.test(text)) {
    const newRate = Math.max(0.5, context.settings.rate - 0.15);
    actions.push({ type: 'set_pace', rate: newRate });
    summaryParts.push(`konuşma hızı yavaşlatıldı (${newRate.toFixed(2)}x)`);
  } else if (/faster|hizli|hizlan|speed up|pace up|daha hizli/.test(text)) {
    const newRate = Math.min(2.0, context.settings.rate + 0.15);
    actions.push({ type: 'set_pace', rate: newRate });
    summaryParts.push(`konuşma hızı hızlandırıldı (${newRate.toFixed(2)}x)`);
  }

  if (/(each scene|her sahne|per scene|sahne suresi|sahneleri.*saniye)/.test(text)) {
    const dur = parseNumber(text);
    if (dur && dur >= 1 && dur <= 30) {
      actions.push({ type: 'set_all_duration', duration: dur });
      summaryParts.push(`tüm sahneler ${dur} sn olarak ayarlandı`);
    }
  }

  const music = detectMusic(text);
  if (music && /(music|muzik|muzigi|background|arka plan|soundtrack)/.test(text)) {
    actions.push({ type: 'set_music', music });
    summaryParts.push(`müzik: ${music}`);
  }

  if (/(music volume|muzik sesi|volume|ses seviyesi|lower the music|muzik.*kis|muzik.*ac)/.test(text)) {
    const vol = parseNumber(text);
    if (vol !== null) {
      const normalized = vol > 1 ? vol / 100 : vol;
      actions.push({ type: 'set_music_volume', volume: Math.max(0, Math.min(1, normalized)) });
      summaryParts.push(`müzik sesi ${Math.round(normalized * 100)}%`);
    } else if (/(lower|quieter|kis|daha kis)/.test(text)) {
      const v = Math.max(0, context.settings.musicVolume - 0.1);
      actions.push({ type: 'set_music_volume', volume: v });
      summaryParts.push(`müzik sesi kısıldı (${Math.round(v * 100)}%)`);
    } else if (/(louder|higher|daha yuksek|artir)/.test(text)) {
      const v = Math.min(1, context.settings.musicVolume + 0.1);
      actions.push({ type: 'set_music_volume', volume: v });
      summaryParts.push(`müzik sesi açıldı (${Math.round(v * 100)}%)`);
    }
  }

  if (/(9.*16|vertical|dikey|portrait|portre|phone|telefon|reels|shorts|tiktok)/.test(text)) {
    actions.push({ type: 'set_aspect', aspect: '9:16' }); summaryParts.push('format: 9:16 dikey');
  } else if (/(16.*9|horizontal|yatay|landscape|youtube|genis ekran)/.test(text)) {
    actions.push({ type: 'set_aspect', aspect: '16:9' }); summaryParts.push('format: 16:9 yatay');
  } else if (/(1.*1|square|kare|instagram post)/.test(text)) {
    actions.push({ type: 'set_aspect', aspect: '1:1' }); summaryParts.push('format: 1:1 kare');
  }

  if (/(1080|full hd|fhd)/.test(text)) {
    actions.push({ type: 'set_resolution', resolution: '1080p' }); summaryParts.push('çözünürlük: 1080p');
  } else if (/(720|hd)/.test(text)) {
    actions.push({ type: 'set_resolution', resolution: '720p' }); summaryParts.push('çözünürlük: 720p');
  }

  const transition = detectTransition(text);
  if (transition && /(transition|gecis|aralarda|between)/.test(text)) {
    actions.push({ type: 'set_transition', transition }); summaryParts.push(`geçiş: ${transition}`);
  }

  if (/(remove subtitle|altyazi.*kaldir|altyazi.*sil|no subtitle|altyazi olmas)/.test(text)) {
    actions.push({ type: 'set_subtitle_style', style: 'none' }); summaryParts.push('altyazılar kaldırıldı');
  } else if (/(kinetic|kinetik|word.by.word|kelime kelime)/.test(text)) {
    actions.push({ type: 'set_subtitle_style', style: 'kinetic' }); summaryParts.push('altyazı stili: kinetik');
  } else if (/(subtitle|altyazi)/.test(text) && !/(none|kaldir|sil)/.test(text)) {
    actions.push({ type: 'set_subtitle_style', style: 'standard' }); summaryParts.push('altyazılar etkin');
  }

  if (/gold|altin/.test(text)) {
    actions.push({ type: 'set_subtitle_color', color: 'gold' }); summaryParts.push('altyazı rengi: altın');
  } else if (/yellow|sari/.test(text)) {
    actions.push({ type: 'set_subtitle_color', color: 'yellow' }); summaryParts.push('altyazı rengi: sarı');
  } else if (/(white|beyaz).*(subtitle|altyazi)/.test(text)) {
    actions.push({ type: 'set_subtitle_color', color: 'white' }); summaryParts.push('altyazı rengi: beyaz');
  }

  if (/(remove title|title card.*remove|acilis.*kaldir|baslik kart.*kaldir|no title|no intro)/.test(text)) {
    actions.push({ type: 'toggle_title_card', enabled: false }); summaryParts.push('açılış kartı kaldırıldı');
  } else if (/(add title|title card|acilis kart|baslik kart)/.test(text)) {
    actions.push({ type: 'toggle_title_card', enabled: true }); summaryParts.push('açılış kartı eklendi');
  }

  const endCardMatch = text.match(/(?:end card|bitis kart)\s*[iI]?\s*[:：]\s*["']?(.+?)["']?$/);
  if (endCardMatch && endCardMatch[1] && endCardMatch[1].length > 1) {
    const dur = parseNumber(text);
    actions.push({ type: 'set_end_card', text: endCardMatch[1], duration: dur ?? 3 });
    summaryParts.push(`bitiş kartı: "${endCardMatch[1]}"`);
  } else if (/(remove end card|bitis kart.*kaldir|no end card)/.test(text)) {
    actions.push({ type: 'remove_end_card' }); summaryParts.push('bitiş kartı kaldırıldı');
  }

  if (/(delete|remove|sil|kaldir).*(scene|sahne)/.test(text) || /(scene|sahne).*(delete|remove|sil|kaldir)/.test(text)) {
    const idx = parseSceneIndex(text, context.sceneCount);
    if (idx !== null) { actions.push({ type: 'delete_scene', index: idx }); summaryParts.push(`sahne ${idx + 1} silindi`); }
  }

  const addMatch = text.match(/(?:add|ekle|insert).*(?:scene|sahne).*?(?:saying|narration|anlatim|text|yaz:)\s*["']?(.+?)["']?$/);
  if (addMatch) {
    const afterIdx = parseSceneIndex(text, context.sceneCount);
    actions.push({ type: 'add_scene', afterIndex: afterIdx ?? context.sceneCount - 1, narration: addMatch[1] });
    summaryParts.push(`yeni sahne eklendi: "${addMatch[1].slice(0, 40)}..."`);
  }

  const changeNarrationMatch = text.match(/(?:change|edit|degistir).*(?:narration|anlatim|voiceover).*(?:scene|sahne)\s*(\d+).*?(?:to|yaz:)\s*["']?(.+?)["']?$/);
  if (changeNarrationMatch) {
    const idx = parseInt(changeNarrationMatch[1], 10) - 1;
    if (idx >= 0 && idx < context.sceneCount) {
      actions.push({ type: 'set_scene_narration', index: idx, narration: changeNarrationMatch[2] });
      summaryParts.push(`sahne ${idx + 1} anlatımı değiştirildi`);
    }
  }

  const mood = detectMood(text);
  if (mood && /(mood|mod|feeling|duygu)/.test(text)) {
    const idx = parseSceneIndex(text, context.sceneCount);
    if (idx !== null) { actions.push({ type: 'set_scene_mood', index: idx, mood }); summaryParts.push(`sahne ${idx + 1} modu: ${mood}`); }
  }

  if (/(style|stil|look|gorunum)/.test(text)) {
    if (/cinematic|sinematik/.test(text)) { actions.push({ type: 'set_style', style: 'cinematic' }); summaryParts.push('stil: sinematik'); }
    else if (/documentary|belgesel/.test(text)) { actions.push({ type: 'set_style', style: 'documentary' }); summaryParts.push('stil: belgesel'); }
    else if (/minimal/.test(text)) { actions.push({ type: 'set_style', style: 'minimal' }); summaryParts.push('stil: minimal'); }
    else if (/vintage|retro|eski/.test(text)) { actions.push({ type: 'set_style', style: 'vintage' }); summaryParts.push('stil: vintage'); }
  }

  if (/(regenerate|yeniden olustur|yeni gorsel|new image|replace media|gorseli degistir)/.test(text)) {
    const idx = parseSceneIndex(text, context.sceneCount);
    if (idx !== null) { actions.push({ type: 'regenerate_scene', index: idx }); summaryParts.push(`sahne ${idx + 1} görseli yeniden oluşturuluyor`); }
  }

  if (actions.length === 0) {
    return { actions: [{ type: 'unknown', raw: input }], summary: 'Bu komut anlaşılamadı. Örnek: "müziği upbeat yap", "sahne 3\'ü sil", "daha yavaş konuş"' };
  }
  return { actions, summary: summaryParts.join(', ') };
}

export function applyActions(scenes: Scene[], settings: ProjectSettings, actions: MagicAction[]): { scenes: Scene[]; settings: ProjectSettings } {
  let s = [...scenes]; let st = { ...settings };
  for (const action of actions) {
    switch (action.type) {
      case 'set_pace': st = { ...st, rate: action.rate }; break;
      case 'set_music': st = { ...st, music: action.music }; break;
      case 'set_music_volume': st = { ...st, musicVolume: action.volume }; break;
      case 'set_aspect': st = { ...st, aspect: action.aspect }; break;
      case 'set_resolution': st = { ...st, resolution: action.resolution }; break;
      case 'set_transition': st = { ...st, transition: action.transition }; break;
      case 'set_subtitle_style': st = { ...st, subtitleStyle: action.style }; break;
      case 'set_subtitle_color': st = { ...st, subtitleColor: action.color }; break;
      case 'toggle_title_card': st = { ...st, showTitleCard: action.enabled }; break;
      case 'set_all_duration': s = s.map((scene) => ({ ...scene, duration: action.duration })); break;
      case 'set_scene_duration': if (s[action.index]) { s[action.index] = { ...s[action.index], duration: action.duration }; } break;
      case 'delete_scene': s = s.filter((_, i) => i !== action.index); break;
      case 'add_scene': {
        const newScene: Scene = { id: crypto.randomUUID(), narration: action.narration, image_prompt: buildImagePromptFromNarration(action.narration, st.style, 'cinematic shot'), duration: 4, mood: 'neutral' };
        s = [...s.slice(0, action.afterIndex + 1), newScene, ...s.slice(action.afterIndex + 1)]; break;
      }
      case 'set_scene_narration': if (s[action.index]) { s[action.index] = { ...s[action.index], narration: action.narration }; } break;
      case 'set_scene_mood': if (s[action.index]) { s[action.index] = { ...s[action.index], mood: action.mood }; } break;
      case 'set_end_card': st = { ...st, endCard: { enabled: true, text: action.text, duration: action.duration ?? 3, fontColor: 'gold' } }; break;
      case 'remove_end_card': st = { ...st, endCard: { ...st.endCard, enabled: false } }; break;
      case 'set_style': st = { ...st, style: action.style }; break;
      case 'replace_scene_media': if (s[action.index]) { s[action.index] = { ...s[action.index], image_prompt: action.prompt }; } break;
    }
  }
  return { scenes: s, settings: st };
}

export const COMMAND_SUGGESTIONS = [
  'Müziği upbeat yap', 'Daha yavaş konuş', 'Sahne 3\'ü sil', 'Formatı 9:16 yap',
  'Altyazıları kaldır', 'Kinetik altyazı ekle', 'Bitiş kartı: Abone ol!',
  'Açılış kartını kaldır', 'Müzik sesini kıs', 'Çözünürlüğü 1080p yap',
  'Stili belgesel yap', 'Sahne 2 modu dramatik',
];
