# Montaj — AI Video Studio

Yapay zeka destekli, tarayıcıda çalışan, tamamen ücretsiz YouTube video üretim platformu. Bir fikir yazın, gerisini yapay zeka halletsin — senaryo, görsel, video, seslendirme, müzik, altyazı, thumbnail ve SEO metadata tek tıkla üretilir.

## Sistem Nasıl Çalışır?

Montaj, 4 yapay zeka ajanının sırayla çalıştığı bir **Fabrika Modu** sunar:

1. **Senarist** — Kullanıcının fikrini alır, sahne sahne senaryo yazar. Her sahne için anlatım metni, görsel betimi ve stok video arama terimi üretir.
2. **Görsel Yönetmen** — Her sahneyi analiz eder, kompozisyon, ışık ve ruh hali planlar. Görsel betimleri optimize eder.
3. **Video Küratör** — Pexels ve Pixabay'de her sahne için en uygun telifsiz stok videoları arar, alternatif klipler de bulur.
4. **SEO Uzmanı** — YouTube için optimize edilmiş başlık, açıklama ve etiketler üretir.

Ajanlar tamamlandığında, kullanıcı düzenleme ekranında senaryoyu, görselleri ve videoları inceleyip değiştirebilir, ardından tek tıkla videoyu render edebilir.

## Özellikler

### İçerik Üretimi
- **Senaryo Üretimi** — Yapay zeka ile konu bazlı, sahne sahne senaryo yazımı (Türkçe ve İngilizce destekli)
- **AI Görsel Üretimi** — Her sahne için Flux modeliyle yüksek kaliteli görseller
- **AI Video Üretimi** — Her sahne için hareketli AI video klipleri (Wan, Seedance, Veo modelleri)
- **Stok Video Entegrasyonu** — Pexels ve Pixabay üzerinden milyonlarca telifsiz stok video
- **Akıllı Medya Seçimi** — Otomatik (stok öncelikli), Sadece Stok, Sadece AI Görsel veya Sadece AI Video modları

### Ses ve Müzik
- **Seslendirme (TTS)** — 10 farklı ses seçeneği (Nova, Shimmer, Echo, Onyx, vs.), Amazon Polly sinematik sesler veya tarayıcı sesi
- **Prosedürel Müzik** — Sahne ruh haline göre otomatik üretilen arka plan müziği (Ambient, Sinematik, Lo-Fi, Dramatik, Yükseliyor)
- **Özel Müzik Desteği** — Telifsiz MP3 URL'si ile kendi müziğinizi ekleme
- **Müzik Ducking** — Seslendirme sırasında müziğin otomatik kısılması

### Video Render
- **Canvas Tabanlı Render** — Tarayıcı içinde gerçek zamanlı video oluşturma
- **Sinematik Geçişler** — Fade, Çapraz Geçiş, Kaydırma, Zoom, Kesme
- **Ken Burns Efekti** — Görsellerde yavaş pan ve zoom
- **Renk Derecelendirme** — Vinyet ve renk kalibrasyonu
- **Açılış Jeneriği** — Animasyonlu başlık kartı
- **Bitiş Kartı** — Özelleştirilebilir kapanış ekranı
- **Marka Kontrolü** — Tutarlı marka renkleri ve filigran
- **Çoklu Format** — WebM ve MP4 (FFmpeg.wasm ile dönüştürme)
- **Çoklu Çözünürlük** — 720p, 1080p, 1440p
- **Çoklu En-Boy Oranı** — 16:9 (Yatay), 9:16 (Dikey), 1:1 (Kare)

### Altyazı ve Erişilebilirlik
- **SRT Altyazı Dosyası** — Her video için altyazı dosyası dışa aktarımı
- **Altyazı Stilleri** — Standart (tüm cümle), Kinetik (kelime kelime), Kapalı
- **Altyazı Renkleri** — Beyaz, Altın, Sarı

### Thumbnail ve SEO
- **AI Thumbnail Üretimi** — 5 farklı tasarım stili (Kalın, Minimal, Vintage, Neon, Belgesel)
- **YouTube Metadata** — SEO uyumlu başlık, açıklama ve etiketler
- **YouTube'a Direkt Yükleme** — OAuth token ile doğrudan YouTube'a video yükleme

### Proje Yönetimi
- **Proje Kütüphanesi** — Tüm projeler tek ekranda, arama ve filtreleme
- **Otomatik Kaydetme** — Düzenlemeler otomatik kaydedilir (hem yerel hem bulut)
- **Toplu Dışa Aktarım** — Birden fazla projeyi sırayla render etme
- **Medya Yöneticisi** — Video, görsel ve ses dosyalarını yükleme ve yönetme
- **Kontrol Paneli** — İstatistikler ve son projeler genel görünümü
- **Sahne Zaman Çizelgesi** — Sürükle-bırak ile sahne sıralama, kopyalama, yeniden adlandırma

## Teknoloji Mimarisi

### Frontend
- **React 18** + **TypeScript** — Tip güvenli UI bileşenleri
- **Vite** — Hızlı geliştirme ve build aracı
- **Tailwind CSS** — Utility-first stil sistemi
- **lucide-react** — İkon kütüphanesi
- **@dnd-kit** — Sürükle-bırak sahne zaman çizelgesi

### Veri Saklama
- **Supabase (PostgreSQL)** — Bulut tabanlı proje saklama (RLS korumalı)
- **Dexie (IndexedDB)** — Tarayıcıda yerel otomatik kaydetme
- Çift katmanlı: Yerel IndexedDB anlık kayıt + Supabase bulut senkronizasyonu

### Yapay Zeka Servisleri
- **Pollinations.ai** — Ücretsiz metin, görsel, video ve ses üretimi (API anahtarı gerektirmez)
  - Metin API: Senaryo üretimi (OpenAI uyumlu endpoint)
  - Görsel API: Flux modeliyle sahne görselleri
  - Video API: Wan, Seedance, Veo modelleriyle hareketli video klipleri
  - Ses API: Amazon Polly sinematik seslendirme

### Stok Medya
- **Pexels API** — Telifsiz stok videolar (Supabase Edge Function ile proxylenir)
- **Pixabay API** — Alternatif telifsiz stok video kaynağı
- API anahtarları sunucu tarafında güvenli şekilde saklanır

### Video İşleme
- **Canvas API + MediaRecorder** — Tarayıcıda gerçek zamanlı video render
- **Web Audio API** — Ses miksajı, müzik ducking, seslendirme birleştirme
- **FFmpeg.wasm** — WebM'den MP4'e dönüştürme (tarayıcıda)

### Backend
- **Supabase Edge Functions (Deno)** — Pexels ve Pixabay API proxy'leri
- **Supabase PostgreSQL** — Proje veritabanı (RLS ile güvenli)

## Proje Yapısı

```
src/
├── App.tsx                    # Ana uygulama, sekme yönlendirme
├── components/
│   ├── Dashboard.tsx          # Kontrol paneli ve istatistikler
│   ├── PromptInput.tsx        # Senaryo oluşturma ekranı
│   ├── FactoryMode.tsx         # 4 ajanlı Fabrika Modu
│   ├── ScriptEditor.tsx       # Sahne düzenleme
│   ├── SceneTimeline.tsx       # Sürükle-bırak sahne zaman çizelgesi
│   ├── VideoPreview.tsx        # Video önizleme ve render
│   ├── ThumbnailGenerator.tsx  # AI thumbnail üretimi
│   ├── YouTubeMetaPanel.tsx    # YouTube SEO ve yükleme
│   ├── SettingsPanel.tsx       # Video ayarları
│   ├── BatchExport.tsx         # Toplu dışa aktarım
│   ├── MediaManager.tsx        # Medya dosya yöneticisi
│   └── ProjectLibrary.tsx      # Proje kütüphanesi
├── lib/
│   ├── agents.ts              # 4 AI ajanı (Senarist, Görsel, Video, SEO)
│   ├── pollinations.ts        # AI metin/görsel/video/ses API'leri
│   ├── pexels.ts              # Stok video arama
│   ├── videoRenderer.ts       # Canvas tabanlı video render motoru
│   ├── mp4Transcoder.ts       # FFmpeg.wasm MP4 dönüştürücü
│   ├── tts.ts                 # Seslendirme (tarayıcı + AI)
│   ├── music.ts               # Prosedürel müzik üretimi
│   ├── subtitles.ts           # SRT altyazı üretimi
│   ├── thumbnail.ts           # Thumbnail oluşturma
│   ├── youtube.ts             # YouTube metadata üretimi
│   ├── scriptGenerator.ts     # Yerel senaryo üretimi (fallback)
│   ├── briefParser.ts         # Brief/metin ayrıştırma
│   ├── magicBox.ts            # Akıllı içerik işleme
│   ├── visualContext.ts       # Görsel bağlam analizi
│   ├── mediaStore.ts          # IndexedDB medya saklama
│   ├── projectStore.ts        # Yerel proje saklama
│   ├── supabase.ts            # Supabase istemcisi
│   └── types.ts               # TypeScript tip tanımları
supabase/
├── functions/
│   ├── pexels-videos/         # Pexels API proxy
│   └── pixabay-videos/        # Pixabay API proxy
└── migrations/
    ├── create_video_projects.sql  # Proje tablosu
    └── add_youtube_metadata.sql   # YouTube metadata kolonları
```

## Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev

# Production build
npm run build

# Tip kontrolü
npm run typecheck
```

## Kullanım

1. **Yeni Proje** — "Oluştur" sekmesinde video fikrinizi yazın veya "Fabrika" sekmesinde 4 ajanı birden çalıştırın
2. **Senaryo Düzenleme** — "Senaryo" sekmesinde her sahnenin metnini, görselini ve süresini düzenleyin
3. **Ayarlar** — Ses, müzik, format, çözünürlük, altyazı ve marka ayarlarını yapılandırın
4. **Önizleme** — "Video" sekmesinde sesli önizleme yapın veya videoyu render edin
5. **Thumbnail** — "Thumbnail" sekmesinde YouTube için dikkat çekici küçük resim oluşturun
6. **YouTube** — "YouTube" sekmesinde SEO metadata oluşturun ve videoyu yükleyin
7. **Toplu Aktarım** — "Toplu" sekmesinde birden fazla projeyi sırayla render edip indirin

## Dil Desteği

Sistem Türkçe ve İngilizce dilinde çalışır. Prompt diline göre otomatik algılama yapar veya "bunu türkçe üret" / "produce in english" gibi yönergelerle dil zorlanabilir.

## Lisans

Özel proje. Tüm hakları saklıdır.
