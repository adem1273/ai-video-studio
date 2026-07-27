// Local script generator — works entirely in the browser, no external API needed.
// Uses sophisticated topic analysis and rich narrative templates to create
// engaging, professional video scripts.

import type { Scene } from './types';
import { buildImagePromptFromNarration, pickShotType } from './visualContext';

type GeneratedScene = {
  narration: string;
  image_prompt: string;
};

type GeneratedScript = {
  title: string;
  scenes: GeneratedScene[];
};

type VideoType = 'tutorial' | 'story' | 'listicle' | 'review' | 'documentary' | 'cartoon' | 'generic';

function detectVideoType(prompt: string): VideoType {
  const p = prompt.toLowerCase();
  if (/çizgi.?film|çizgi|animasyon|animation|cartoon|anime|manga|çocuk|masal|fairy|tale|karakterler|karakter|kahraman|hero|macera|adventure|hikaye|story|öykü|öykü/.test(p)) return 'cartoon';
  if (/tutorial|how to|nas.l|e.itim|rehber|guide|yap.m|kullan|ö.ren|learn/.test(p)) return 'tutorial';
  if (/facts|bilgi|ilgin.|interesting|list|top \d|liste|s.ralar|kaç .ey/.test(p)) return 'listicle';
  if (/review|inceleme|comparison|kar.la.t.rma|vs|en iyi|test/.test(p)) return 'review';
  if (/belgesel|documentary|do.a|nature|gezi|travel|şehir|city|ülke/.test(p)) return 'documentary';
  return 'generic';
}

function extractTopic(prompt: string): string {
  let topic = prompt.trim();
  topic = topic.replace(/^(create|make|generate|write|build|produce|olu.tur|yap|yaz|üret|haz.rla)\s+(a|an|the|bir)\s+/gi, '');
  topic = topic.replace(/^(video|film|content|içerik|video)\s+(about|about|hakk.nda|konusunda|konu)\s+/i, '');
  topic = topic.replace(/^(about|hakk.nda|konu)\s+/i, '');
  topic = topic.replace(/\s+(t[uü]rk[ççe]+|ingilizce|english|türkçe)\s+(olsun|olarak)?/gi, '');
  topic = topic.replace(/\s+olsun$/gi, '');
  topic = topic.replace(/\b(script|senaryo|video|film|content|içerik|kısa|short|uzun|long)\b/gi, '');
  topic = topic.replace(/^(bir|a|an|the)\s+/i, '');
  topic = topic.trim();
  if (topic.length > 80) topic = topic.slice(0, 77) + '...';
  return topic || 'bu konu';
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

function generateTitle(topic: string, type: VideoType): string {
  const t = capitalize(topic);
  const titles: Record<VideoType, string[]> = {
    cartoon: [`${t}: Animasyon Macera`, `${t}: Çizgi Film Hikâyesi`, `${t} ve Sihirli Orman`, `${t}: Kahramanımızın Yolculuğu`],
    tutorial: [`${t}: Adım Adım Tam Rehber`, `${t} Nasıl Yapılır?`, `${t} için Başlangıç Kılavuzu`, `${t} Sanatı`],
    story: [`${t}: Bir Hikâye`, `${t} Gününün Hikâyesi`, `${t}: Yolculuk`, `${t} Hikâyesi`],
    listicle: [`${t} Hakkında Bilmediğiniz 10 Şey`, `${t}: En İlginç Bilgiler`, `${t} Listesi`],
    review: [`${t} İncelemesi`, `${t}: Değer mi?`, `${t} Detaylı İnceleme`],
    documentary: [`${t}: Bir Belgesel`, `${t} Keşfi`, `${t}: Doğanın Görünmeyen Yüzü`],
    generic: [`${t}`, `${t}: Bir Video`, `${t} Hakkında`],
  };
  const opts = titles[type];
  return opts[Math.floor(Math.random() * opts.length)];
}

type NarrationFn = (topic: string, i: number, total: number) => string;

const TUTORIAL_NARRATIONS: Record<string, NarrationFn> = {
  intro: (topic) => `${capitalize(topic)} konusunda her şeyi bu videoda ele alacağız. Detaylara girmeden önce, neden bu konu önemli, kısıca bakalım.`,
  hook: (topic) => `Çoğu kişi ${topic} konusunda yanlış başlıyor. Oysa doğru yaklaşım çok daha basit — gelin adım adım görelim.`,
  overview: (topic) => `${capitalize(topic)} için temel kavramları anlamak şart. Üç ana bileşen var: hazırlık, uygulama ve değerlendirme.`,
  step1: (topic) => `İlk adım: doğru araçları seçmek. ${capitalize(topic)} için kaliteli malzeme kullanmak, sonucu doğrudan etkiliyor.`,
  step2: (topic) => `İkinci adımda temel tekniği kavrayalım. ${capitalize(topic)} öğrenirken acele etmemek, en önemli kural.`,
  step3: (topic, i) => `Üçüncü adım: pratik. ${capitalize(topic)} becerisi tekrarla gelişir — ne kadar çok yaparsanız, o kadar doğal gelir.`,
  step4: (topic) => `Dördüncü adım: ince ayarlar. İşin püf noktası, küçük detaylarda gizli. ${capitalize(topic)} ustaları bu ayrıntılara dikkat eder.`,
  tips: (topic) => `Şimdi sıra profesyonel tüyolarda. ${capitalize(topic)} konusunda deneyimli isimlerin kullandığı beş altın kuralı paylaşalım.`,
  mistakes: (topic) => `En sık yapılan hatalara bakalım. ${capitalize(topic)} sürecinde bu hataları yapmamak, zaman ve emek kazandırır.`,
  recap: (topic) => `Özetleyelim: ${topic} için doğru araç, sağlam temel, bol pratik ve ince ayar gerekiyor.`,
  outro: (topic) => `${capitalize(topic)} rehberimizin sonuna geldik. Beğendiyseniz abone olun, yeni içerikler için takipte kalın!`,
};

const STORY_NARRATIONS: Record<string, NarrationFn> = {
  intro: (topic) => `Size ${topic} hakkında bir hikâye anlatacağım. Bu hikâye, beklenmedik keşifler ve sürprizlerle dolu.`,
  setting: (topic) => `Her şey, ${topic} ile ilgili sıradan bir günün sabahında başladı. Güneş yeni doğmuş, şehir henüz uyanmamıştı.`,
  character: (topic) => `Asıl kahramanımız, ${topic} dünyasına ilk adım attığında, henüz neler olacağından habersizdi.`,
  inciting: (topic) => `O gün, ${topic} hakkında hiç kimse beklemeyen bir şey ortaya çıktı. Her şey bir anda değişti.`,
  rising1: (topic) => `İlk zorluk geldi çattı. ${capitalize(topic)} artık basit bir merak değil, gerçek bir yolculuğa dönüşmüştü.`,
  rising2: (topic) => `Derinlere indikçe, ${topic} hakkında daha fazla gizem yüzeye çıktı. Her cevap, yeni bir soru getiriyordu.`,
  midpoint: (topic) => `Tam her şey yolunda gidiyor sanarken, beklenmedik bir ters köşe geldi. ${capitalize(topic)} artık eskisi gibi değildi.`,
  complication: (topic) => `Ortaya çıkan engel, ${topic} yolculuğunu tamamen tehlikeye attı. Geri dönüş yoktu artık.`,
  climax: (topic) => `Final anı geldi. ${capitalize(topic)} ile ilgili tüm soruların cevabı, tek bir anda açığa çıkacaktı.`,
  falling: (topic) => `Toz bulutları yavaşça dağıldı. ${capitalize(topic)} yolculuğunun yorgunluğu yüzünden okunuyordu.`,
  resolution: (topic) => `Sonunda ${topic} hikâyesi, beklenmedik bir mutlu sonla tamamlandı. Ama asıl değişen, kahramanımızdı.`,
  outro: (topic) => `${capitalize(topic)} hikâyesi böyle sona erdi. Beğendiyseniz, daha fazla hikâye için abone olun!`,
};

const LISTICLE_NARRATIONS: Record<string, NarrationFn> = {
  intro: (topic) => `${capitalize(topic)} hakkında şaşırtıcı gerçeklerle karşınızdayız. Hazırlayın, çünkü bazıları inanılması güç olabilir.`,
  item: (topic, i) => {
    const ordinals = ['Birinci', 'İkinci', 'Üçüncü', 'Dördüncü', 'Beşinci', 'Altıncı', 'Yedinci', 'Sekizinci', 'Dokuzuncu', 'Onuncu'];
    const ord = ordinals[i] || `${i + 1}.`;
    const items = [
      `${ord} sırada: ${topic} hakkında çoğu kişinin hiç duymadığı bir gerçek var.`,
      `${ord} madde: ${topic} ile ilgili inanılmaz bir detay, uzmanları bile şaşırtıyor.`,
      `${ord} sırada: ${topic} dünyasından, beklenmedik bir bulgu.`,
      `${ord} madde: ${topic} hakkında az bilinen ama etkileyici bir sır.`,
      `${ord} sırada: ${topic} konusunda çığır açan bir gelişme.`,
      `${ord} madde: ${topic} ile ilgili en çok tartışılan detay.`,
      `${ord} sırada: ${topic} hakkında yeni keşfedilmiş bir gerçek.`,
      `${ord} madde: ${topic} dünyasından şaşırtıcı bir istatistik.`,
      `${ord} sırada: ${topic} konusunda en az bilinen ipucu.`,
      `${ord} madde: ${topic} ile ilgili en çarpıcı bilgi.`,
    ];
    return items[i] || `${ord} sırada: ${topic} hakkında ilginç bir başka detay.`;
  },
  summary: (topic) => `İşte ${topic} hakkında en ilginç bilgiler bunlardı. Hangisi en çok şaşırttı? Yorumlarda paylaşın.`,
  outro: (topic) => `${capitalize(topic)} listemizin sonuna geldik. Daha fazla içerik için abone olun, kaçırmayın!`,
};

const REVIEW_NARRATIONS: Record<string, NarrationFn> = {
  intro: (topic) => `${capitalize(topic)} için detaylı bir inceleme hazırladık. Artıları, eksileri ve genel değerlendirmemizle birlikte.`,
  overview: (topic) => `Önce ${topic} için genel bir bakış atalım. Tasarım, performans ve fiyat — üç kritik nokta.`,
  feature1: (topic) => `İlk olarak tasarım. ${capitalize(topic)} konusunda ilk izlenim, kullanım kolaylığını doğrudan etkiliyor.`,
  feature2: (topic) => `Performans açısından ${topic} nasıl performans gösteriyor? Hız, verimlilik ve kararlılık.`,
  feature3: (topic) => `Fiyat ve değer önermesi. ${capitalize(topic)} için ödediğiniz para, aldığınız karşılığa değer mi?`,
  pros: (topic) => `${capitalize(topic)} konusunda beğendiğimiz yanları sıralayalım. Bazıları gerçekten etkileyici.`,
  cons: (topic) => `Ancak ${topic} için bazı eksikler de yok değil. Düzeltmesi gereken noktalar var.`,
  verdict: (topic) => `Sonuç olarak ${topic} değer mi? Genel değerlendirmemiz net: bu kriterlere dikkat edin.`,
  alternatives: (topic) => `${capitalize(topic)} yerine değerlendirebileceğiniz alternatifleri de kısaca inceleyelim.`,
  recap: (topic) => `Özetle ${topic}: iyi tasarım, yeterli performans, ama bazı eksikler mevcut.`,
  outro: (topic) => `${capitalize(topic)} incelememizin sonuna geldik. Sorularınızı yorumlara bırakın!`,
};

const DOCUMENTARY_NARRATIONS: Record<string, NarrationFn> = {
  intro: (topic) => `${capitalize(topic)}... Bu kelime, pek çoğumuz için uzak bir kavram. Ama yakından baktığınızda, inanılmaz bir dünya keşfediyorsunuz.`,
  scene1: (topic) => `Sabah ışıkları ${topic} üzerinde ilk kez beliriyor. Doğanın bu anı, saatler sürer ama saniyeler içinde geçer.`,
  scene2: (topic) => `Burada yaşam, ${topic} ile iç içe geçmiş. Her detay, milyonlarca yıllık evrimin izlerini taşıyor.`,
  scene3: (topic) => `İnsan gözü, ${topic} üzerindeki bu zarafeti tam olarak algılayamıyor bile. Ama kamera yakalıyor.`,
  scene4: (topic) => `Mikro dünya... ${topic} içinde, gözle görülmeyen bir yaşam döngüsü dönüyor durmadan.`,
  scene5: (topic) => `Öğle vakti. ${capitalize(topic)} artık tam parlaklığında. Renkler, ışığın dansıyla şekil değiştiriyor.`,
  scene6: (topic) => `Burada ses bile farklı. ${capitalize(topic)} çevresinde doğanın nefesini duyabilirsiniz.`,
  scene7: (topic) => `Gün ilerledikçe ${topic} üzerinde gölgeler uzuyor. Her saat, yeni bir manzara sunuyor.`,
  scene8: (topic) => `Akşam yaklaşırken ${topic} altın bir ton alıyor. Bu ışık, fotoğrafçıların altın saati diyor.`,
  scene9: (topic) => `Gün batımı. ${capitalize(topic)} üzerinde son ışıklar sönmek üzere. Doğanın sessizliği başlıyor.`,
  scene10: (topic) => `Gece düşer. ${capitalize(topic)} artık farklı bir dünyaya ev sahipliği yapıyor.`,
  outro: (topic) => `${capitalize(topic)} keşfimiz böyle sona eriyor. Doğanın her köşesinde yeni bir hikâye var.`,
};

const CARTOON_NARRATIONS: Record<string, NarrationFn> = {
  intro: (topic) => `Bir varmıș, bir yokmuș. ${capitalize(topic)} adında cesur bir kahramanımız varmıș. Bugün onun en büyük macerasını anlatacağım.`,
  setting: (topic) => `${capitalize(topic)}, küçük bir köyde yaşıyordu. Her sabah erken kalkar, kahraman olmak için antrenman yapardı.`,
  call: (topic) => `Bir gün köye haber geldi: ${topic} köyünü kurtarmak için uzak bir diyara gitmeliydi. Görevi kabul etti.`,
  journey: (topic) => `${capitalize(topic)} yola çıktı. Önünde uçsuz bucaksız ormanlar, yüksek dağlar ve bilinmeyen tehlikeler vardı.`,
  friend: (topic) => `Yolda küçük bir sincapla karşılaştı. Sincap, ${topic}'ya yardım etmek istedi ve ikisi birlikte yola koyuldu.`,
  challenge: (topic) => `Derken büyük bir ırmak önlerini kesti. ${topic} cesurca suya atladı ve sincabı sırtına aldı.`,
  villain: (topic) => `Karşılarında kötü bir ejderha çıktı. Ejderha, ${topic}'nın geçmesine izin vermek istemedi.`,
  battle: (topic) => `${capitalize(topic)} ve ejderha arasında büyük bir mücadele başladı. Sincap da ${topic}'ya yardım ediyordu.`,
  victory: (topic) => `Sonunda ${topic} ejderhayı yendi. Ejderha kaçtı ve yol artık açıktı.`,
  treasure: (topic) => `Yolun sonunda ${topic} sihirli bir hazıra ulaştı. Hazırede, köyünü kurtaracak sihirli bir taş vardı.`,
  return: (topic) => `${capitalize(topic)} köyüne döndü. Herkes onu sevinçle karşıladı. Artık o gerçek bir kahramandı.`,
  outro: (topic) => `${capitalize(topic)} masalı böyle bitti. Bir kahraman, bir dost ve büyük bir macera. Abone olun, daha çok masal geliyor!`,
};

const GENERIC_NARRATIONS: NarrationFn[] = [
  (topic) => `${capitalize(topic)} ile ilgili ilk durağımız burası. Detaylara yakından bakalım.`,
  (topic) => `${capitalize(topic)} konusunda dikkat çekici bir başka nokta daha.`,
  (topic) => `Burada ${topic} farklı bir boyut kazanıyor. İnce detaylar önemli.`,
  (topic) => `${capitalize(topic)} anlatısında bu kısım özellikle önemli.`,
  (topic) => `Şimdi ${topic} ile ilgili farklı bir açıdan bakalım.`,
  (topic) => `${capitalize(topic)} konusunda en az bilinen yanlardan biri.`,
  (topic) => `Bu aşamada ${topic} daha net bir şekil alıyor.`,
  (topic) => `${capitalize(topic)} hikâyesinin son bölümüne yaklaşıyoruz.`,
];

type ImageFn = (topic: string, style: string, i: number, total: number) => string;

const TUTORIAL_IMAGES: Record<string, ImageFn> = {
  intro: (t, s) => `cinematic establishing shot, ${t}, professional lighting, shallow depth of field, ${s} style, ultra detailed, 4k`,
  hook: (t, s) => `close-up of person looking determined, ${t} concept, moody dramatic lighting, ${s} style`,
  overview: (t, s) => `flat lay overhead shot, tools and materials for ${t}, organized neatly, warm natural light, ${s} style`,
  step1: (t, s) => `hands working on ${t}, detailed close-up, macro photography, soft natural light, ${s} style`,
  step2: (t, s) => `person concentrating on ${t} task, mid shot, warm lighting, blurred background, ${s} style`,
  step3: (t, s) => `action shot, person practicing ${t}, dynamic angle, motion blur background, ${s} style`,
  step4: (t, s) => `expert hands performing advanced ${t} technique, dramatic side lighting, ${s} style`,
  tips: (t, s) => `professional workspace, ${t} mastery, clean modern aesthetic, soft diffused light, ${s} style`,
  mistakes: (t, s) => `conceptual shot, common mistakes in ${t}, dramatic shadow, split lighting, ${s} style`,
  recap: (t, s) => `satisfied person, completed ${t} project, warm golden light, wide shot, ${s} style`,
  outro: (t, s) => `farewell scene, ${t} journey complete, sunset through window, ${s} style, wide cinematic`,
};

const STORY_IMAGES: Record<string, ImageFn> = {
  intro: (t, s) => `mysterious atmospheric opening scene, ${t} theme, fog and dramatic light, ${s} style, cinematic wide`,
  setting: (t, s) => `peaceful small town at dawn, ${t} atmosphere, golden morning light, establishing shot, ${s} style`,
  character: (t, s) => `hero character portrait, backlit, ${t} theme, dramatic rim light, shallow depth of field, ${s} style`,
  inciting: (t, s) => `discovery moment, object in hands, ${t} revelation, dramatic close-up, dark background, ${s} style`,
  rising1: (t, s) => `journey on winding road, ${t} adventure, dynamic perspective, dramatic sky, ${s} style`,
  rising2: (t, s) => `exploring deep dark environment, ${t} mystery, torchlight, atmospheric fog, ${s} style`,
  midpoint: (t, s) => `dramatic turning point, ${t} twist, intense facial expression, low angle shot, ${s} style`,
  complication: (t, s) => `obstacle in path, ${t} challenge, dramatic stormy sky, wide shot, ${s} style`,
  climax: (t, s) => `epic confrontation scene, ${t} climax, dramatic backlight, dust particles, ${s} style, cinematic`,
  falling: (t, s) => `aftermath, calm dawn light, ${t} resolution, peaceful atmosphere, ${s} style`,
  resolution: (t, s) => `happy ending, warm golden sunset, ${t} conclusion, character walking away, ${s} style`,
  outro: (t, s) => `cinematic farewell, ${t} story ending, beautiful sunset landscape, ${s} style, wide`,
};

const LISTICLE_IMAGES: Record<string, ImageFn> = {
  intro: (t, s) => `eye-catching opening, ${t} concept, bold colors, dynamic composition, ${s} style`,
  item: (t, s, i) => {
    const shots = [
      `fascinating close-up, ${t} detail, macro photography, dramatic lighting, ${s} style`,
      `surprising visual, ${t} revelation, high contrast, bold composition, ${s} style`,
      `incredible moment, ${t} discovery, cinematic close-up, shallow depth of field, ${s} style`,
      `unexpected angle, ${t} artifact, museum lighting, detailed texture, ${s} style`,
      `hidden detail, ${t} secret, moody atmosphere, selective focus, ${s} style`,
      `stunning visualization, ${t} data, modern clean aesthetic, vibrant, ${s} style`,
      `breakthrough moment, ${t} innovation, futuristic, glowing edges, ${s} style`,
      `viral scene, ${t} trending, vibrant colors, dynamic, ${s} style`,
      `rare capture, ${t} moment, golden hour, telephoto compression, ${s} style`,
      `jaw-dropping view, ${t} spectacle, wide panoramic, epic scale, ${s} style`,
    ];
    return shots[i] || shots[i % shots.length];
  },
  summary: (t, s) => `collage of ${t} highlights, clean modern layout, ${s} style`,
  outro: (t, s) => `engaging outro scene, ${t} complete, bright optimistic, ${s} style`,
};

const REVIEW_IMAGES: Record<string, ImageFn> = {
  intro: (t, s) => `product hero shot, ${t}, studio lighting, clean white background, ${s} style`,
  overview: (t, s) => `product on table, ${t}, natural light, shallow depth of field, ${s} style`,
  feature1: (t, s) => `product design detail, ${t} close-up, macro, studio lighting, ${s} style`,
  feature2: (t, s) => `product in use, ${t} performance, action shot, motion blur, ${s} style`,
  feature3: (t, s) => `price tag or value concept, ${t}, clean flat lay, ${s} style`,
  pros: (t, s) => `highlight reel, ${t} benefits, bright warm lighting, ${s} style`,
  cons: (t, s) => `dramatic shadow, ${t} drawbacks, moody lighting, ${s} style`,
  verdict: (t, s) => `balanced composition, ${t} verdict, professional setting, ${s} style`,
  alternatives: (t, s) => `comparison lineup, ${t} alternatives, product showcase, ${s} style`,
  recap: (t, s) => `final summary, ${t} review complete, clean modern, ${s} style`,
  outro: (t, s) => `outro scene, ${t} review, professional, ${s} style`,
};

const DOCUMENTARY_IMAGES: Record<string, ImageFn> = {
  intro: (t, s) => `breathtaking landscape, ${t}, golden hour, aerial drone shot, ${s} style, nature photography, 8k`,
  scene1: (t, s) => `morning light breaking over ${t}, dew on surfaces, macro, ${s} style`,
  scene2: (t, s) => `wildlife in natural habitat, ${t} ecosystem, telephoto, golden light, ${s} style`,
  scene3: (t, s) => `extreme close-up, ${t} texture, macro photography, dramatic side light, ${s} style`,
  scene4: (t, s) => `microscopic world, ${t} detail, abstract, colorful, ${s} style`,
  scene5: (t, s) => `midday sun, ${t} full brightness, vivid colors, wide landscape, ${s} style`,
  scene6: (t, s) => `sound waves visualizing, ${t} environment, abstract, flowing, ${s} style`,
  scene7: (t, s) => `long shadows, afternoon light, ${t} landscape, warm tones, ${s} style`,
  scene8: (t, s) => `golden hour, ${t} bathed in warm light, cinematic, ${s} style`,
  scene9: (t, s) => `sunset, ${t} silhouette, dramatic sky, wide cinematic, ${s} style`,
  scene10: (t, s) => `night scene, ${t} under starlight, moonlight, ${s} style`,
  outro: (t, s) => `panoramic landscape, ${t} farewell, twilight, ${s} style, cinematic wide`,
};

const CARTOON_IMAGES: Record<string, ImageFn> = {
  intro: (t) => `colorful 2d animation scene, brave young hero character ${t} standing in a small village, bright cheerful colors, cartoon style, animated film, warm morning light`,
  setting: (t) => `cartoon village scene, ${t} character training outside a small house, 2d animation style, green hills, blue sky, cheerful colors`,
  call: (t) => `animated scene, ${t} character receiving a quest from village elder, dramatic cartoon lighting, 2d animation, expressive faces`,
  journey: (t) => `cartoon landscape, ${t} character walking through a magical forest, 2d animation, vibrant colors, tall trees, path winding through woods`,
  friend: (t) => `cute cartoon scene, ${t} character meeting a small squirrel friend, 2d animation, warm friendly colors, forest background`,
  challenge: (t) => `dramatic cartoon scene, ${t} character crossing a rushing river, 2d animation, splashing water, dynamic action pose`,
  villain: (t) => `dark cartoon scene, ${t} character facing a fearsome dragon, 2d animation, dramatic lighting, fiery background, menacing dragon`,
  battle: (t) => `epic cartoon battle scene, ${t} character fighting dragon with squirrel helper, 2d animation, action poses, dynamic effects`,
  victory: (t) => `triumphant cartoon scene, ${t} character standing victorious over defeated dragon, 2d animation, bright hopeful colors`,
  treasure: (t) => `magical cartoon scene, ${t} character discovering a glowing treasure chest, 2d animation, golden light, sparkles, cave background`,
  return: (t) => `joyful cartoon scene, ${t} character returning to village, crowd cheering, 2d animation, warm sunset colors, celebration`,
  outro: (t) => `peaceful cartoon ending scene, ${t} character waving goodbye, 2d animation, beautiful sunset, credits style, warm colors`,
};

const GENERIC_IMAGES: ImageFn[] = [
  (t, s) => `cinematic wide shot, ${t}, dramatic lighting, professional photography, ${s} style, 4k`,
  (t, s) => `medium shot, ${t} detail, shallow depth of field, warm light, ${s} style`,
  (t, s) => `close-up, ${t} texture, macro photography, natural light, ${s} style`,
  (t, s) => `aerial view, ${t} landscape, golden hour, ${s} style`,
  (t, s) => `dynamic angle, ${t} in motion, dramatic perspective, ${s} style`,
  (t, s) => `artistic composition, ${t} abstract, moody lighting, ${s} style`,
  (t, s) => `environmental portrait, ${t} context, soft diffused light, ${s} style`,
  (t, s) => `cinematic finale, ${t} conclusion, sunset, wide, ${s} style`,
];

function getStructure(type: VideoType, count: number): string[] {
  switch (type) {
    case 'cartoon': { const full = ['intro','setting','call','journey','friend','challenge','villain','battle','victory','treasure','return','outro']; return adaptStructure(full, count, ['journey','challenge']); }
    case 'tutorial': { const full = ['intro','hook','overview','step1','step2','step3','step4','tips','mistakes','recap','outro']; return adaptStructure(full, count, ['step1','step2','step3','step4']); }
    case 'story': { const full = ['intro','setting','character','inciting','rising1','rising2','midpoint','complication','climax','falling','resolution','outro']; return adaptStructure(full, count, ['rising1','rising2']); }
    case 'listicle': { const items = Array.from({ length: Math.max(count - 2, 1) }, (_, i) => 'item'); return ['intro', ...items, 'summary', 'outro'].slice(0, count); }
    case 'review': { const full = ['intro','overview','feature1','feature2','feature3','pros','cons','verdict','alternatives','recap','outro']; return adaptStructure(full, count, ['feature1','feature2','feature3']); }
    case 'documentary': { const full = ['intro','scene1','scene2','scene3','scene4','scene5','scene6','scene7','scene8','scene9','scene10','outro']; return adaptStructure(full, count, ['scene3','scene4','scene5','scene6','scene7','scene8']); }
    default: return Array.from({ length: count }, (_, i) => `gen_${i}`);
  }
}

function adaptStructure(full: string[], count: number, expandable: string[]): string[] {
  if (count <= full.length) {
    const result: string[] = [];
    const step = full.length / count;
    for (let i = 0; i < count; i++) result.push(full[Math.floor(i * step)]);
    return result;
  }
  const result = [...full];
  let extra = count - full.length;
  let idx = 0;
  while (extra > 0) {
    const insertAt = result.indexOf(expandable[idx % expandable.length]);
    if (insertAt >= 0) { result.splice(insertAt + 1, 0, expandable[idx % expandable.length]); extra--; }
    idx++;
    if (idx > 200) break;
  }
  return result;
}

function getNarration(type: VideoType, key: string, topic: string, i: number, total: number): string {
  switch (type) {
    case 'cartoon': { const fn = CARTOON_NARRATIONS[key]; return fn ? fn(topic, i, total) : CARTOON_NARRATIONS.journey(topic, i, total); }
    case 'tutorial': { const fn = TUTORIAL_NARRATIONS[key]; return fn ? fn(topic, i, total) : TUTORIAL_NARRATIONS.step3(topic, i, total); }
    case 'story': { const fn = STORY_NARRATIONS[key]; return fn ? fn(topic, i, total) : STORY_NARRATIONS.rising1(topic, i, total); }
    case 'listicle': {
      if (key === 'intro') return LISTICLE_NARRATIONS.intro(topic, i, total);
      if (key === 'summary') return LISTICLE_NARRATIONS.summary(topic, i, total);
      if (key === 'outro') return LISTICLE_NARRATIONS.outro(topic, i, total);
      return LISTICLE_NARRATIONS.item(topic, i, total);
    }
    case 'review': { const fn = REVIEW_NARRATIONS[key]; return fn ? fn(topic, i, total) : REVIEW_NARRATIONS.verdict(topic, i, total); }
    case 'documentary': { const fn = DOCUMENTARY_NARRATIONS[key]; return fn ? fn(topic, i, total) : DOCUMENTARY_NARRATIONS.scene1(topic, i, total); }
    default: { const idx = i % GENERIC_NARRATIONS.length; return GENERIC_NARRATIONS[idx](topic, i, total); }
  }
}

function getImagePrompt(type: VideoType, key: string, topic: string, style: string, i: number, total: number): string {
  switch (type) {
    case 'cartoon': { const fn = CARTOON_IMAGES[key]; return fn ? fn(topic, style, i, total) : CARTOON_IMAGES.journey(topic, style, i, total); }
    case 'tutorial': { const fn = TUTORIAL_IMAGES[key]; return fn ? fn(topic, style, i, total) : TUTORIAL_IMAGES.step3(topic, style, i, total); }
    case 'story': { const fn = STORY_IMAGES[key]; return fn ? fn(topic, style, i, total) : STORY_IMAGES.rising1(topic, style, i, total); }
    case 'listicle': {
      if (key === 'intro') return LISTICLE_IMAGES.intro(topic, style, i, total);
      if (key === 'summary') return LISTICLE_IMAGES.summary(topic, style, i, total);
      if (key === 'outro') return LISTICLE_IMAGES.outro(topic, style, i, total);
      return LISTICLE_IMAGES.item(topic, style, i, total);
    }
    case 'review': { const fn = REVIEW_IMAGES[key]; return fn ? fn(topic, style, i, total) : REVIEW_IMAGES.verdict(topic, style, i, total); }
    case 'documentary': { const fn = DOCUMENTARY_IMAGES[key]; return fn ? fn(topic, style, i, total) : DOCUMENTARY_IMAGES.scene1(topic, style, i, total); }
    default: { const idx = i % GENERIC_IMAGES.length; return GENERIC_IMAGES[idx](topic, style, i, total); }
  }
}

export function generateLocalScript(prompt: string, sceneCount: number, style: string = 'cinematic', targetLang?: 'tr-TR' | 'en-US'): GeneratedScript {
  const topic = extractTopic(prompt);
  const type = detectVideoType(prompt);
  const title = targetLang === 'en-US' ? generateTitleEn(topic, type) : generateTitle(topic, type);
  const structure = getStructure(type, sceneCount);
  const scenes: GeneratedScene[] = structure.map((key, i) => {
    const narration = targetLang === 'en-US' ? getNarrationEn(type, key, topic, i, sceneCount) : getNarration(type, key, topic, i, sceneCount);
    const shotType = pickShotType(i, sceneCount);
    const image_prompt = type === 'cartoon' ? getImagePrompt(type, key, topic, style, i, sceneCount) : buildImagePromptFromNarration(narration, style, shotType);
    return { narration, image_prompt };
  });
  return { title, scenes };
}

export function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(4, Math.ceil((words / 130) * 60));
}

function generateTitleEn(topic: string, type: VideoType): string {
  const titles: Record<VideoType, string[]> = {
    cartoon: [`${topic}: The Animated Adventure`, `${topic} and the Magic Forest`, `${topic}: Hero's Journey`],
    tutorial: [`${topic}: Complete Guide`, `How to ${topic}`, `${topic} Tutorial`],
    story: [`${topic}: A Story`, `${topic}: The Journey`, `${topic}: A Tale`],
    listicle: [`Top Facts About ${topic}`, `${topic}: Things You Didn't Know`, `5 Surprising Facts About ${topic}`],
    review: [`${topic} Review`, `${topic}: Is It Worth It?`, `${topic}: Detailed Review`],
    documentary: [`The Truth About ${topic}`, `${topic}: The Full Story`, `Inside the World of ${topic}`],
    generic: [`${topic}`, `${topic}: A Video`, `All About ${topic}`],
  };
  return pick(titles[type]);
}

function getNarrationEn(type: VideoType, key: string, topic: string, index: number, total: number): string {
  const cartoonArr: Record<string, string> = {
    intro: `Once upon a time, there was a brave hero named ${topic}. Today, I'll tell you their greatest adventure.`,
    setting: `In a small village, ${topic} dreamed of becoming a hero. Every morning, they trained hard.`,
    call: `One day, ${topic} received a quest to save their village from danger. They accepted bravely.`,
    journey: `${topic} set off on a journey through magical forests and tall mountains.`,
    friend: `Along the way, ${topic} met a small squirrel friend who joined the adventure.`,
    challenge: `${topic} faced a rushing river and bravely crossed it, carrying the squirrel on their back.`,
    villain: `A fearsome dragon blocked their path. ${topic} stood tall and ready to fight.`,
    battle: `${topic} and the squirrel battled the dragon together with courage and teamwork.`,
    victory: `Victory! ${topic} defeated the dragon and the path was clear.`,
    treasure: `${topic} found a magical treasure that would save their village.`,
    return: `${topic} returned home to a cheering village. They were a true hero now.`,
    outro: `And so ${topic}'s tale ends with friendship, courage, and adventure. Subscribe for more stories!`,
  };
  if (type === 'cartoon') return cartoonArr[key] ?? `${topic} — a story worth telling.`;
  const templates: Record<string, string[]> = {
    hook: [`What if everything you knew about ${topic} was wrong?`, `Most people have no idea what ${topic} really is. But the truth is shocking.`, `In the next few minutes, you'll discover the hidden story behind ${topic}.`],
    intro: [`${topic} is more complex than it seems. Let's break down what makes it so fascinating.`, `To understand ${topic}, we need to go back to where it all began.`, `There's a reason ${topic} captures everyone's attention. Here's what you need to know.`],
    fact1: [`The first thing to know is that ${topic} has origins dating back further than most realize.`, `Here's a surprising fact: ${topic} affects almost every aspect of modern life.`, `One of the most remarkable details about ${topic} is how it evolved over time.`],
    fact2: [`But that's just the beginning. The deeper you look, the more layers you uncover.`, `What most people miss is the hidden impact ${topic} has had on the world.`, `Another key point: ${topic} is far more influential than you'd expect.`],
    fact3: [`And here's where it gets truly fascinating — the details that change everything.`, `The third critical element of ${topic} reveals a pattern no one talks about.`, `This is the part of the ${topic} story that surprises everyone.`],
    turning: [`But then something changed — a turning point that redefined ${topic} forever.`, `Everything shifted when a single event changed the course of ${topic}.`, `This is the moment ${topic} went from ordinary to extraordinary.`],
    impact: [`The impact of ${topic} extends far beyond what you see on the surface.`, `Today, ${topic} influences millions of people in ways they never notice.`, `The ripple effects of ${topic} continue to shape our world right now.`],
    reveal: [`And here's the most surprising part — the secret that ties it all together.`, `What ${topic} really teaches us is something most people never realize.`, `The truth about ${topic} is simpler — and more profound — than anyone expected.`],
    conclusion: [`So the next time you think about ${topic}, you'll know the real story.`, `${topic} isn't just what it seems. It's a story worth understanding.`, `And that's the untold story of ${topic} — one that changes how you see it.`],
    cta: [`If this changed how you think about ${topic}, subscribe for more stories like this.`, `Want more deep dives like this? Follow and never miss an episode.`, `Subscribe now and discover the stories behind the world's most fascinating topics.`],
  };
  const arr = templates[key];
  if (!arr) return `${topic} — a story worth telling.`;
  return pick(arr);
}
