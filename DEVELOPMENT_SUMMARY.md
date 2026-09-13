# AI Video Studio - Development Summary

## 📋 Overview

AI Video Studio is a comprehensive web-based video generation platform that leverages artificial intelligence to create professional-quality videos from text prompts. The application features a modular architecture with specialized utilities for error handling, subtitle management, video transcoding, and rendering.

## 🏗️ Architecture

### Core Modules

#### 1. **errorHandler.ts** - Centralized Error Management
- Singleton instance for application-wide error handling
- Error logging with configurable buffer size (max 100 errors)
- User-friendly error messages in Turkish
- Error validation for scenes and projects
- Supports multiple severity levels: info, warning, error, critical
- Functions:
  - `createError()`: Create standardized app errors
  - `validateScene()`: Validate scene data structure
  - `validateProject()`: Validate entire project structure
  - `getUserMessage()`: Get user-facing error messages
  - `getErrorLog()`: Retrieve error history
  - `exportErrors()`: Export errors as JSON for debugging

**Key Error Codes:**
- `RENDER_NO_SCENES`: No scenes provided
- `RENDER_FRAME_FAILED`: Frame rendering error
- `TRANSCODE_FAILED`: MP4 transcoding failure
- `TTS_FAILED`: Text-to-speech error
- `IMAGE_GENERATION_FAILED`: AI image generation error
- `STORAGE_*`: Local/remote storage errors
- `VALIDATION_*`: Data validation errors

#### 2. **subtitles.ts** - Subtitle System
- Complete subtitle lifecycle management
- Support for SRT format (parse and generate)
- Canvas-based subtitle rendering with multiple styles
- Functions:
  - `parseSRT()`: Parse SRT format strings
  - `generateSRT()`: Create SRT from scenes
  - `generateSubtitles()`: Create SubtitleEntry objects
  - `renderSubtitlesOnCanvas()`: Draw subtitles on canvas
  - `getSubtitleAtTime()`: Find subtitle at specific timestamp
  - `mergeSubtitles()`: Merge overlapping/adjacent subtitles
  - `validateSubtitles()`: Validate subtitle entries
  - `downloadSRT()`: Export SRT file

**Subtitle Styles:**
- `standard`: Basic white text with background
- `bold`: Bold text with stronger emphasis
- `minimal`: Text only, no background
- `cinematic`: Text with border and professional styling
- `karaoke`: Semi-transparent background, suitable for synchronization

**Subtitle Colors:**
- white, yellow, gold, cyan

#### 3. **mp4Transcoder.ts** - FFmpeg Wrapper
- Client-side video transcoding using FFmpeg.wasm
- Lazy initialization with promise-based loading
- Supports WebM to MP4 conversion
- Frame-by-frame video encoding pipeline
- Audio buffer to WAV conversion
- Codec detection for browser compatibility
- Functions:
  - `transcodeToMP4()`: WebM → MP4 conversion
  - `encodeFramesToMP4()`: Encode PNG frames + WAV audio → MP4
  - `audioBufferToWav()`: Convert AudioBuffer to WAV format
  - `isFFmpegReady()`: Check FFmpeg availability
  - `getAvailableCodecs()`: Detect supported codecs
  - `getSupportedExportFormats()`: List export formats

**FFmpeg Configuration:**
- Core: unpkg.com/cdnjs (@ffmpeg/core v0.12.10)
- Codec: libx264 (H.264 video), AAC audio
- Preset: fast (balance between speed and quality)
- CRF: 23 (quality level)
- Bitrate: 128k audio
- Pixel format: yuv420p (MP4 compatible)

#### 4. **videoRenderer.ts** - Video Rendering Engine
- Frame-by-frame video rendering with WebM export
- Scene composition with image backgrounds
- Subtitle overlay support
- Real-time progress tracking via RenderProgress callback
- Scene validation before rendering
- Functions:
  - `renderVideo()`: Main rendering pipeline
  - `renderSceneFrame()`: Render individual scene frame
  - `encodeFramesToWebM()`: MediaRecorder-based WebM encoding
  - `getCanvasDimensions()`: Calculate canvas size from settings
  - `supportsMP4()`: Check MP4 support
  - `getExtension()`: Get file extension from MIME type
  - `wrapText()`: Wrap narration text for canvas rendering

**Rendering Pipeline:**
1. Validate scenes and settings
2. Create canvas and get 2D context
3. Calculate total frames and duration
4. For each scene:
   - Draw background image or solid color
   - Render narration text with shadow
   - Apply subtitle overlay if enabled
   - Capture ImageData
5. Encode frames to WebM via MediaRecorder
6. Optional: Transcode to MP4
7. Return Blob

**Progress Tracking:**
```typescript
type RenderProgress = {
  scene: number;              // Current scene (0-based)
  total: number;              // Total scenes
  phase: 'preparing' | 'rendering' | 'encoding' | 'transcoding';
  message: string;            // Human-readable message
  framesRendered?: number;    // Frames processed
  totalFrames?: number;       // Total frames
};
```

### UI Components

#### 1. **VideoPreview.tsx**
- Interactive video preview and playback
- Scene carousel navigation
- Real-time render progress display
- Audio/music preview functionality
- Video format selection (WebM/MP4)
- Error handling and display
- Export format options
- SRT subtitle download
- Key Features:
  - Play/pause controls with seek bar
  - Scene thumbnail preview
  - Auto-download after render
  - Regenerate failed images
  - Fullscreen mode
  - Time display (current/total)

#### 2. **BatchExport.tsx**
- Batch processing multiple projects
- Queue persistence to IndexedDB
- Per-item and overall progress tracking
- Resume capability for interrupted batches
- Error tracking per project
- Individual video/SRT download
- Features:
  - Persistent queue across sessions
  - Scene validation before rendering
  - Granular progress updates (0-100%)
  - Error recovery and retry capability
  - Automatic download on completion
  - Overall progress bar
  - Per-project error messages

### Type System

**Core Types (types.ts):**

```typescript
// Scene definition
type Scene = {
  id: string;
  name?: string;
  narration: string;              // TTS text
  image_prompt: string;           // AI image generation prompt
  search_query?: string;          // Stock video search query
  duration: number;               // Seconds (REQUIRED)
  mood?: string;                  // Visual direction
  agentLogs?: AgentLogEntry[];
  video_url?: string;             // Stock video URL
  video_poster?: string;          // Thumbnail
  ai_video_status?: 'generating' | 'generated' | 'failed';
  image_url?: string;             // Generated/stock image
};

// Project settings
type ProjectSettings = {
  voice: string;                  // Browser voice name
  ttsVoice: TTSVoice;            // Pollinations voice
  ttsMode: 'pollinations' | 'browser';
  rate: number;                   // Speech rate
  style: string;                  // Render style
  aspect: '16:9' | '9:16' | '1:1';
  resolution: '720p' | '1080p' | '1440p';
  music: MusicStyle;
  musicVolume: number;            // 0-1
  transition: TransitionType;
  showTitleCard: boolean;
  exportFormat: 'mp4' | 'webm';
  mediaSource: 'auto' | 'stock' | 'ai';
  subtitleStyle: SubtitleStyle;
  subtitleColor: SubtitleColor;
  endCard: EndCardConfig;
  brand: BrandConfig;
};

// Subtitle entry
type SubtitleEntry = {
  startTime: number;              // Seconds
  endTime: number;               // Seconds
  text: string;
  index: number;
};

// Error information
type AppError = {
  code: string;
  message: string;
  details?: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
};
```

## 🚀 Usage Guide

### Basic Video Rendering

```typescript
import { renderVideo } from '@/lib/videoRenderer';
import { errorHandler } from '@/lib/errorHandler';

const scenes: Scene[] = [/* ... */];
const settings: ProjectSettings = { /* ... */ };

try {
  const videoBlob = await renderVideo(
    scenes,
    settings,
    'My Video',
    (progress) => {
      console.log(`${progress.phase}: ${progress.message}`);
      console.log(`${progress.scene}/${progress.total} scenes`);
    }
  );
  
  // Download or process video
  const url = URL.createObjectURL(videoBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'video.webm';
  a.click();
} catch (err) {
  const userMsg = errorHandler.getUserMessage(
    extractErrorCode(err)
  );
  console.error(userMsg);
}
```

### Subtitle Management

```typescript
import { generateSubtitles, downloadSRT } from '@/lib/subtitles';

const scenes: Scene[] = [/* ... */];

// Generate subtitle entries
const subtitles = generateSubtitles(scenes, 4); // 4 second title offset

// Download as SRT file
downloadSRT(scenes, 'my_video', 4);

// Render on canvas
const subtitle = getSubtitleAtTime(subtitles, currentTime);
renderSubtitlesOnCanvas(ctx, subtitle, {
  style: 'cinematic',
  color: 'white',
  fontSize: 32,
});
```

### Error Handling

```typescript
import { errorHandler } from '@/lib/errorHandler';

// Validate before rendering
for (let i = 0; i < scenes.length; i++) {
  const error = errorHandler.validateScene(scenes[i]);
  if (error) {
    console.error(`Scene ${i + 1}: ${error}`);
    return;
  }
}

// Create error with context
const err = errorHandler.createError(
  'RENDER_FAILED',
  'Video rendering failed',
  'error',
  'Details about what went wrong'
);

// Get user-friendly message
const userMsg = errorHandler.getUserMessage(err.code);
alert(userMsg); // Display to user
```

### MP4 Transcoding

```typescript
import { transcodeToMP4 } from '@/lib/mp4Transcoder';

const webmBlob: Blob = /* WebM video */;

try {
  const mp4Blob = await transcodeToMP4(webmBlob, (progress) => {
    console.log(`Transcoding: ${(progress * 100).toFixed(0)}%`);
  });
  // Use mp4Blob
} catch (err) {
  console.error('Transcoding failed:', err);
  // Fall back to WebM
}
```

## 🔧 Configuration

### Environment Variables (.env)

```env
# Required
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# API Keys
VITE_GROQ_API_KEY=your-groq-key
VITE_PEXELS_API_KEY=your-pexels-key
VITE_PIXABAY_API_KEY=your-pixabay-key

# Optional
VITE_POLLINATIONS_API_URL=https://api.pollinations.ai
VITE_DEFAULT_LANGUAGE=tr-TR
VITE_DEFAULT_QUALITY=high
VITE_ENABLE_ANALYTICS=false
```

### Default Project Settings

```typescript
const defaultSettings: ProjectSettings = {
  voice: '',
  ttsVoice: 'alloy',
  ttsMode: 'pollinations',
  rate: 1,
  style: 'cinematic',
  aspect: '16:9',
  resolution: '720p',
  music: 'cinematic',
  mediaSource: 'auto',
  musicVolume: 0.5,
  transition: 'fade',
  showTitleCard: true,
  exportFormat: 'webm',
  subtitleStyle: 'standard',
  subtitleColor: 'white',
  endCard: { enabled: false, text: '', duration: 3, fontColor: 'gold' },
  brand: { enabled: false, primaryColor: '#3b82f6', fontFamily: 'sans-serif' },
};
```

## 📊 Performance Considerations

### Rendering Performance
- **Frame Rate**: 30 FPS default
- **Canvas Resolution**: 1280×720 (720p) default, up to 2560×1440
- **Encoding**: MediaRecorder + optional FFmpeg transcoding
- **Memory**: IndexedDB for batch queue persistence

### Optimization Tips
1. Use 720p for faster rendering
2. Enable MP4 transcoding for better compatibility
3. Use 'fast' FFmpeg preset for balance
4. Batch render during off-peak hours
5. Monitor error logs regularly

## 🧪 Testing

### Unit Tests
```typescript
// Test subtitle parsing
const srtContent = `1\n00:00:00,000 --> 00:00:05,000\nHello World`;
const subtitles = parseSRT(srtContent);
assert.equal(subtitles.length, 1);
assert.equal(subtitles[0].text, 'Hello World');

// Test error validation
const scene: Scene = { id: '1', narration: '', image_prompt: '', duration: 0 };
const error = errorHandler.validateScene(scene);
assert(error !== null);
```

### Integration Tests
```typescript
// Test full rendering pipeline
const scenes = [
  {
    id: '1',
    narration: 'Test narration',
    image_prompt: 'test image',
    duration: 5,
  },
];
const videoBlob = await renderVideo(scenes, defaultSettings, 'Test');
assert(videoBlob.type.includes('video'));
```

## 📚 Dependencies

### Video Processing
- `@ffmpeg/ffmpeg`: FFmpeg.wasm for transcoding
- `@ffmpeg/util`: Utility functions for FFmpeg

### UI/State Management
- `react`: Component framework
- `lucide-react`: Icon library
- `tailwindcss`: Styling

### Storage
- `@supabase/supabase-js`: Backend and auth
- IndexedDB: Local persistence

## 🔐 Security Notes

1. **API Keys**: Keep in environment variables
2. **CORS**: Stock media APIs require proper CORS setup
3. **FFmpeg**: Runs locally in browser (no data sent)
4. **Video Blobs**: Stored in memory, cleared after download
5. **Auth**: Supabase handles authentication

## 🚨 Error Handling Best Practices

1. Always validate scenes before rendering
2. Use error codes consistently
3. Provide fallback options (WebM if MP4 fails)
4. Log detailed error information
5. Show user-friendly messages
6. Handle async operations with try-catch

## 📝 License

Copyright (c) 2026. All rights reserved.

## 👥 Contributors

Built with ❤️ by the AI Video Studio team.
