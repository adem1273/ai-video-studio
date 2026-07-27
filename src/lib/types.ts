export type Scene = {
  id: string;
  name?: string;
  narration: string;
  image_prompt: string;
  image_url?: string;
  video_url?: string;       // stock video URL (Pexels)
  video_poster?: string;    // poster image for the video
  video_alt_urls?: string[]; // alternative stock video URLs to try if primary fails
  ai_video_url?: string;     // AI-generated video clip (Pollinations Video API)
  ai_video_status?: 'idle' | 'generating' | 'ready' | 'failed';
  mediaError?: string;       // set when this scene's media failed to load
  duration: number; // seconds
  mood?: SceneMood;
  search_query?: string;    // AI-provided search query for stock video
};

export type MediaSource = 'auto' | 'stock' | 'ai' | 'ai-video';

export type SceneMood = 'neutral' | 'calm' | 'dramatic' | 'happy' | 'tense' | 'mysterious';

export type MusicStyle = 'none' | 'ambient' | 'cinematic' | 'uplifting' | 'lofi' | 'dramatic';
export type TransitionType = 'fade' | 'slide' | 'zoom' | 'cut' | 'crossfade';
export type TTSVoice = 'alloy' | 'nova' | 'shimmer' | 'echo' | 'onyx' | 'fable' | 'ash' | 'sage' | 'coral' | 'verse';
export type TTSMode = 'browser' | 'pollinations';
export type ExportFormat = 'webm' | 'mp4';
export type ThumbnailStyle = 'bold' | 'minimal' | 'vintage' | 'neon' | 'documentary';

export type SubtitleStyle = 'standard' | 'kinetic' | 'none';
export type SubtitleColor = 'white' | 'gold' | 'yellow';

export type BrandConfig = {
  enabled: boolean;
  primaryColor: string;    // hex color, e.g. "#3b82f6"
  logoUrl?: string;         // optional logo URL
  fontFamily: string;       // font family for subtitles/title
  watermarkText?: string;   // small text in corner
};

export type EndCardConfig = {
  enabled: boolean;
  text: string;
  duration: number; // seconds
  fontColor: string; // 'gold' | 'white' | etc
};

export type ProjectSettings = {
  voice: string;
  ttsVoice: TTSVoice;
  ttsMode: TTSMode;
  rate: number;
  style: string;
  aspect: '16:9' | '9:16' | '1:1';
  resolution: '720p' | '1080p' | '1440p';
  music: MusicStyle;
  musicVolume: number;
  musicUrl?: string;
  language?: 'tr-TR' | 'en-US';
  transition: TransitionType;
  showTitleCard: boolean;
  exportFormat: ExportFormat;
  mediaSource: MediaSource;
  subtitleStyle: SubtitleStyle;
  subtitleColor: SubtitleColor;
  endCard: EndCardConfig;
  brand: BrandConfig;
};

export type YouTubeMeta = {
  youtube_title: string | null;
  youtube_description: string | null;
  youtube_tags: string[] | null;
};

export type VideoProject = {
  id: string;
  title: string;
  prompt: string;
  status: 'draft' | 'generating' | 'ready' | 'failed';
  script: Scene[] | null;
  settings: ProjectSettings | null;
  video_path: string | null;
  youtube_title: string | null;
  youtube_description: string | null;
  youtube_tags: string[] | null;
  thumbnail_url: string | null;
  thumbnail_style: ThumbnailStyle | null;
  category: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
