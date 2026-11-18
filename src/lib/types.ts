export type AgentLogEntry = {
  iteration: number;
  action: string;
  detail: string;
  timestamp: number;
};

export type PositiveNumber = number & { __positive: true };

export type Scene = {
  id: string;
  name?: string;
  narration: string;
  image_prompt: string;
  search_query?: string;    // AI-provided search query for stock video
  duration: PositiveNumber; // Scene duration in seconds (REQUIRED, must be > 0)
  mood?: string;            // Scene mood for visual direction
  agentLogs?: AgentLogEntry[]; // AI stock agent decision log
  video_url?: string;       // Stock video URL if found
  video_poster?: string;    // Stock video thumbnail
  video_alt_urls?: string[]; // Alternative video URLs for fallback loading
  ai_video_url?: string;    // AI-generated video URL
  ai_video_status?: 'generating' | 'generated' | 'failed'; // AI video generation status
  image_url?: string;       // Generated or stock image URL
  mediaError?: string;      // Error message if media loading failed
};

export type VideoProject = {
  id: string;
  title: string;
  prompt: string;
  status: 'draft' | 'ready' | 'published';
  script: Scene[];
  settings: ProjectSettings;
  youtube_title: string | null;
  youtube_description: string | null;
  youtube_tags: string[] | null;
  thumbnail_url: string | null;
  thumbnail_style: ThumbnailStyle | null;
  is_published: boolean;
  published_at: string | null;
  category?: string | null;
  video_blob_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TTSVoice =
  | 'nova' | 'shimmer' | 'coral' | 'sage'
  | 'echo' | 'onyx' | 'ash' | 'fable' | 'verse' | 'alloy';

export type TTSMode = 'pollinations' | 'browser';

export type MusicStyle =
  | 'cinematic' | 'upbeat' | 'calm' | 'dramatic' | 'corporate'
  | 'lofi' | 'electronic' | 'ambient' | 'rock' | 'jazz' | 'none';

export type TransitionType = 'fade' | 'slide' | 'zoom' | 'none' | 'cut' | 'crossfade';

export type ExportFormat = 'mp4' | 'webm';

export type MediaSource = 'auto' | 'stock' | 'ai' | 'ai-video';

export type SubtitleStyle = 'standard' | 'kinetic' | 'minimal' | 'cinematic' | 'karaoke' | 'none' | 'bold';

export type SubtitleColor = 'white' | 'yellow' | 'gold' | 'cyan';

export type ThumbnailStyle = 'bold' | 'minimal' | 'cinematic' | 'vlog' | 'gaming';

export type EndCardConfig = {
  enabled: boolean;
  text: string;
  duration: number;
  fontColor: 'gold' | 'white' | 'cyan';
};

export type BrandConfig = {
  enabled: boolean;
  primaryColor: string;
  fontFamily: string;
  watermarkText?: string;
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
  contentLanguage?: 'auto' | 'en' | 'tr';
  ttsTurkishVoice?: 'Emel' | 'Ahmet';
  transition: TransitionType;
  showTitleCard: boolean;
  exportFormat: ExportFormat;
  mediaSource: MediaSource;
  subtitleStyle: SubtitleStyle;
  subtitleColor: SubtitleColor;
  endCard: EndCardConfig;
  brand: BrandConfig;
};

// Type definitions for rendering
export type RenderProgress = {
  scene: number;           // Current scene index
  total: number;           // Total scenes
  phase: 'preparing' | 'rendering' | 'encoding' | 'transcoding';
  message: string;         // Human-readable progress message
  framesRendered?: number; // Frames rendered so far
  totalFrames?: number;    // Total frames to render
};

export type RenderOptions = {
  outputFormat: ExportFormat;
  quality?: 'low' | 'medium' | 'high';
  fps?: number;
  shouldTranscode?: boolean;
};

export type SubtitleEntry = {
  startTime: number;       // Start time in seconds
  endTime: number;         // End time in seconds
  text: string;           // Subtitle text
  index: number;          // Sequential index
};

export type AudioTrack = {
  audioBuffer: AudioBuffer;
  startTime: number;      // Absolute start time in seconds
  endTime: number;        // Absolute end time in seconds
};

export type AppError = {
  code: string;
  message: string;
  details?: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
};

export type RenderError = AppError & {
  framesRendered: number;
  totalFrames: number;
  sceneIndex: number;
  sceneId: string;
};

export type AgentOutput<T> = {
  success: boolean;
  data?: T;
  error?: RenderError;
  progress?: number;
  message?: string;
};

export type SceneValidationError = {
  sceneIndex: number;
  errors: string[];
};

export type ProjectValidationError = {
  field: keyof ProjectSettings;
  message: string;
};

export type ProgressCallback = (
  progress: {
    phase: 'preparing' | 'rendering' | 'encoding' | 'transcoding';
    message: string;
    percentage: number;
    scene?: number;
  }) => void;



/** Type guard: checks if obj is a valid Scene */
export function isScene(obj: unknown): obj is Scene {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return !!s.id && typeof s.id === 'string' &&
    !!s.narration && typeof s.narration === 'string' &&
    typeof s.duration === 'number' && s.duration > 0 &&
    !!s.image_prompt && typeof s.image_prompt === 'string';
}

/** Type guard: checks if obj is a valid VideoProject */
export function isProject(obj: unknown): obj is VideoProject {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;
  return !!p.id && typeof p.id === 'string' &&
    !!p.title && typeof p.title === 'string' &&
    Array.isArray(p.script) && p.script.length > 0;
}

/** Type guard: checks if obj is valid ProjectSettings */
export function isProjectSettings(obj: unknown): obj is ProjectSettings {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  const required: (keyof ProjectSettings)[] = [
    'voice', 'ttsVoice', 'ttsMode', 'rate', 'style',
    'aspect', 'resolution', 'music', 'musicVolume'
  ];
  return required.every(key => key in s && typeof s[key] !== 'undefined');
}
export type VideoMetadata = {
  title: string;
  description: string;
  tags: string[];
  thumbnail: string | null;
  duration: number;
  format: ExportFormat;
};
