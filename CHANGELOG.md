# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Type Safety improvements: PositiveNumber branded type for Scene.duration
- Type guard functions: isScene(), isProject(), isProjectSettings()
- Zod schema validation for component props (planned)
- ESLint stricter rules configuration (planned)

### Fixed
- VideoPreview.tsx - TypeScript syntax error (extra `)` in template literal)
- mp4Transcoder.ts - FFmpeg CDN URL'leri VITE_FFMPEG_CORE_URL ile yapılandırılabilir
- BatchExport.tsx - Güvenli type casting with `as string | undefined || 'pending'`
- scriptGenerator.ts - Turkish regex'ler düzeltildi (olu.tur → olu\.tur, haz.rla → haz\.rla)
- visualContext.ts - Duplicate VISUAL_KEYWORDS declaration removed
- PromptInput.tsx - Unsafe cast replaced with isScene() type guard

### Changed
- README.md - Comprehensive project documentation added
- types.ts - PositiveNumber branded type, type guard fonksiyonları eklendi

### Deprecated
- (None)

### Removed
- (None)

## [1.0.0] - 2024-01-01
- Initial release
- Core video rendering functionality
- AI agent factory mode (Senarist, Görsel Yönetmen, Video Küratör, SEO Uzmanı)
- Pexels/Pixabay stok video entegrasyonu
- TTS seslendirme (Amazon Polly ve tarayıcı sesi)
- Prosedürel müzik üretimi
- Canvas tabanlı video render
- WebM ve MP4 format çıkışı
- 720p, 1080p, 1440p çözünürlük desteği
- 16:9, 9:16, 1:1 en-boy Oranı desteği
- SRT altyazı dosyası üretimi
- AI Thumbnail üretimi (5 stil)
- YouTube SEO metadata ve direkt yükleme
- Toplu dışa aktarım (Batch Export)
- Proje kütüphanesi ve otomatik kaydetme

## [0.9.0] - 2023-12-15
- Beta preview sürümü
- Temel senaryo oluşturma
- Tek sahne önizleme
- Basit stok video arama
