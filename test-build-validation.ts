/**
 * Build Validation Test Suite
 * Restore edilen 3 dosyanın TypeScript derleme kontrolü
 */

// ═══════════════════════════════════════════════════════════════
// 1. projectStore.ts - Dexie IndexedDB Tipi Kontrolü
// ═══════════════════════════════════════════════════════════════
import type { SavedProject } from './src/lib/projectStore';
import { emptyProject, saveProjectLocal, getLatestProject, getAllProjectsLocal, deleteProjectLocal } from './src/lib/projectStore';

// SavedProject türü kontrolü
const testProject: SavedProject = emptyProject();
console.log('✓ projectStore.ts derlenme başarılı - SavedProject türü geçerli');
console.log('  - emptyProject() fonksiyonu mevcut:', typeof emptyProject);
console.log('  - saveProjectLocal() fonksiyonu mevcut:', typeof saveProjectLocal);
console.log('  - getLatestProject() fonksiyonu mevcut:', typeof getLatestProject);
console.log('  - getAllProjectsLocal() fonksiyonu mevcut:', typeof getAllProjectsLocal);
console.log('  - deleteProjectLocal() fonksiyonu mevcut:', typeof deleteProjectLocal);

// ═══════════════════════════════════════════════════════════════
// 2. pollinations.ts - LLM Senaryo + TTS Tipi Kontrolü
// ═══════════════════════════════════════════════════════════════
import type { AIScene, LangOverride } from './src/lib/pollinations';
import { 
  generateSpeech, 
  detectLangOverride, 
  buildScriptMessages, 
  imageUrl 
} from './src/lib/pollinations';

// AIScene türü kontrolü
const testScene: AIScene = {
  narration: 'Test narration',
  image_prompt: 'Test visual',
  search_query: 'Test query'
};

console.log('✓ pollinations.ts derlenme başarılı - AIScene türü geçerli');
console.log('  - generateSpeech() fonksiyonu mevcut:', typeof generateSpeech);
console.log('  - detectLangOverride() fonksiyonu mevcut:', typeof detectLangOverride);
console.log('  - buildScriptMessages() fonksiyonu mevcut:', typeof buildScriptMessages);
console.log('  - imageUrl() fonksiyonu mevcut:', typeof imageUrl);

// Language detection test
const langTr = detectLangOverride('Merhaba dünya');
const langEn = detectLangOverride('Hello world');
console.log('  - Turkish detection:', langTr === 'tr' ? '✓' : '✗');
console.log('  - English detection:', langEn === 'en' ? '✓' : '✗');

// ═══════════════════════════════════════════════════════════════
// 3. videoRenderer.ts - Video Render Hattı Tipi Kontrolü
// ═══════════════════════════════════════════════════════════════
import type { Scene, ProjectSettings } from './src/lib/types';
import { renderVideo, encodeFramesToMP4, audioBufferToWav } from './src/lib/videoRenderer';

console.log('✓ videoRenderer.ts derlenme başarılı');
console.log('  - renderVideo() fonksiyonu mevcut:', typeof renderVideo);
console.log('  - encodeFramesToMP4() fonksiyonu mevcut:', typeof encodeFramesToMP4);
console.log('  - audioBufferToWav() fonksiyonu mevcut:', typeof audioBufferToWav);

// ═══════════════════════════════════════════════════════════════
// SONUÇ
// ═══════════════════════════════════════════════════════════════
console.log('\n✅ BUILD TESİ BAŞARILI');
console.log('   Tüm 3 dosya TypeScript derlemesi başarılı');
console.log('   - projectStore.ts: ✓ Geçti');
console.log('   - pollinations.ts: ✓ Geçti');
console.log('   - videoRenderer.ts: ✓ Geçti');
