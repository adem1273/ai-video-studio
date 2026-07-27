const STOPWORDS_EN = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','must','can','that','this','these','those','with','from','into','onto','about','than','then','they','them','their','there','here','where','when','what','which','who','whom','whose','why','how','all','each','every','both','few','more','most','other','some','such','only','own','same','too','very','just','now','also','well','back','down','out','off','over','under','again','further','once','and','but','or','nor','not','no','yes','if','so','as','at','by','for','in','of','on','to','up','we','you','he','she','it','its','our','your','his','her','my','me','us','like','get','got','make','made','go','going','one','two','three','first','second','third','last','next','new','old','good','bad','big','small','really','much','many','thing','things','way','ways','time','times','day','days','year','years','people','person','man','woman','world','know','think','said','say','see','seen','look','looked','want','wanted','need','needed','let','lets','still']);

const STOPWORDS_TR = new Set(['ve','veya','ile','için','göre','kadar','daha','en','çok','az','bir','iki','üç','bu','şu','o','şey','sey','ne','nasil','neden','niçin','niye','hangi','kim','kime','nerede','nereden','nereye','her','tüm','butun','bazi','biraz','birçok','pek','hem','ya','de','da','ki','mi','mı','mu','mü','ise','idi','olur','olmus','olan','olarak','bize','size','ona','buna','suna','ben','sen','biz','siz','onlar','benim','senin','bizim','sizin','onlarin','onun','bunun','sunun','var','yok','iyi','kötü','büyük','küçük','yeni','eski','uzun','kisa','yüksek','alçak','derin','genis','dar','kalın','ince','zaman','yil','gün','saat','dakika','saniye','defa','kez','sira','sonra','önce','şimdi','son','ilk','gibi','herhangi','yani','iste','cünkü','madem','eger','yapmak','yapti','yapiyor','olmak','oldu','oluyor','gelmek','geldi','geliyor','gitmek','gitti','gidiyor','görmek','gördü','bilmek','bildi','demek','dedi','vermek','verdi','almak','aldi','koymak','koydu','söylemek','söyledi','anlatmak','anlatti']);

const VISUAL_KEYWORDS = new Set(['mountain','ocean','sea','river','forest','tree','sky','cloud','sun','moon','star','fire','water','snow','rain','storm','city','building','street','road','bridge','tower','castle','house','home','room','office','studio','lab','factory','car','truck','train','plane','ship','boat','bike','phone','computer','screen','camera','book','desk','table','chair','window','door','clock','map','key','tool','machine','money','coin','gold','diamond','crystal','glass','metal','stone','rock','sand','dust','ice','steam','light','shadow','flower','garden','field','farm','animal','bird','fish','horse','dog','cat','lion','tiger','bear','wolf','eagle','snake','butterfly','bee','leaf','grass','mushroom','person','man','woman','child','baby','people','crowd','soldier','warrior','king','queen','knight','farmer','scientist','doctor','teacher','artist','musician','dancer','astronaut','pilot','driver','worker','chef','hunter','face','hand','eye','heart','brain','battle','war','fight','race','game','sport','dance','music','concert','festival','wedding','funeral','party','meeting','speech','lecture','experiment','discovery','journey','adventure','exploration','escape','arrival','sunrise','sunset','night','dawn','dusk','twilight','winter','summer','spring','autumn','desert','jungle','space','galaxy','planet','earth','mars','dag','deniz','nehir','orman','ağaç','gökyüzü','bulut','güneş','ay','yildiz','ateş','su','kar','yağmur','firtina','şehir','bina','sokak','yol','köprü','kule','saray','ev','oda','ofis','araba','tren','uçak','gemil','tekne','telefon','bilgisayar','ekran','kamera','kitap','masa','para','altin','çiçek','bahçe','tarla','hayvan','kuş','balik','at','köpek','kedi','aslan','kaplan','ayi','yüz','el','göz','kalp','savas','mücadele','yaris','oyun','spor','müzik','konser','festival','dügün','gece','sabah','akşam','kis','yaz','ilkbahar','sonbahar','çöl','uzay','gezegen','dünya']);

function normalize(text: string): string {
  return text.replace(/[üÜ]/g,'u').replace(/[ıİ]/g,'i').replace(/[öÖ]/g,'o').replace(/[çÇ]/g,'c').replace(/[şŞ]/g,'s').replace(/[ğĞ]/g,'g').replace(/[âÂ]/g,'a').replace(/[îÎ]/g,'i').replace(/[ûÛ]/g,'u').toLowerCase();
}

const TR_TO_EN: Record<string, string> = {
  dag:'mountain',deniz:'sea',nehir:'river',orman:'forest',agac:'tree',gokyuzu:'sky',bulut:'cloud',gunes:'sun',ay:'moon',yildiz:'star',ates:'fire',su:'water',kar:'snow',yagmur:'rain',firtina:'storm',sehir:'city',bina:'building',sokak:'street',yol:'road',kopru:'bridge',kule:'tower',saray:'castle',ev:'house',oda:'room',ofis:'office',araba:'car',tren:'train',ucak:'plane',gemi:'ship',tekne:'boat',telefon:'phone',bilgisayar:'computer',ekran:'screen',kamera:'camera',kitap:'book',masa:'desk',para:'money',altin:'gold',cicek:'flower',bahce:'garden',tarla:'field',hayvan:'animal',kus:'bird',balik:'fish',at:'horse',kopek:'dog',kedi:'cat',aslan:'lion',kaplan:'tiger',ayi:'bear',yuz:'face',el:'hand',goz:'eye',kalp:'heart',savas:'war',mucadele:'struggle',yaris:'race',oyun:'game',spor:'sport',muzik:'music',konser:'concert',festival:'festival',dugun:'wedding',gece:'night',sabah:'morning',aksam:'evening',kis:'winter',yaz:'summer',ilkbahar:'spring',sonbahar:'autumn',col:'desert',uzay:'space',gezegen:'planet',dunya:'earth',ask:'love',gul:'rose',tapinak:'temple',kilise:'church',cami:'mosque',heykel:'statue',anit:'monument',mezar:'tomb',kral:'king',kralice:'queen',asker:'soldier',savasci:'warrior',bilim:'science',biliminsani:'scientist',kesif:'discovery',icat:'invention',devrim:'revolution',imparator:'emperor',imparatorluk:'empire',uygarlik:'civilization',
};

function tokenize(text: string): string[] {
  return normalize(text).replace(/[^\w\s]/g,' ').split(/\s+/).filter((w) => w.length > 2);
}

export function extractVisualKeywords(narration: string, maxKeywords: number = 5): string[] {
  const tokens = tokenize(narration);
  const scored: { word: string; score: number }[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const word = TR_TO_EN[token] ?? token;
    if (seen.has(word)) continue;
    seen.add(word);
    let score = 0;
    if (VISUAL_KEYWORDS.has(word)) score += 10;
    if (!STOPWORDS_EN.has(word) && !STOPWORDS_TR.has(token)) score += 3;
    if (word.length > 5) score += 2;
    if (word.length > 7) score += 1;
    if (score > 0) scored.push({ word, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxKeywords).map((s) => s.word);
}

export function buildImagePromptFromNarration(narration: string, style: string, shotType?: string): string {
  const keywords = extractVisualKeywords(narration, 5);
  const shot = shotType ?? 'cinematic shot';
  if (keywords.length === 0) return `${shot}, ${style} style, dramatic lighting, ultra detailed, 4k`;
  return `${shot}, ${keywords.join(', ')}, ${style} style, dramatic lighting, ultra detailed, 4k`;
}

export function extractSearchQuery(imagePrompt: string): string {
  const STRIP_WORDS = new Set(['cinematic','establishing','shot','wide','angle','close-up','closeup','medium','macro','aerial','view','scene','photorealistic','photoreal','ultra','detailed','4k','8k','hd','style','lighting','dramatic','moody','atmospheric','shallow','depth','field','blurred','background','natural','light','golden','hour','sunset','sunrise','rim','side','soft','diffused','warm','cool','studio','professional','clean','modern','aesthetic','vibrant','high','contrast','low','angle','dynamic','epic','landscape','portrait','documentary','footage','recreation','historical','concept','conceptual','abstract','artistic','composition','texture','pattern','mood','tone','color','colors','beautiful','stunning','amazing','breathtaking','focal','point','sharp','focus','crisp','quality','render','3d','digital','painting','illustration','art','photo','photography','image','picture','visual','theme','subject','object','overhead','flat','lay','telephoto','compression','panoramic','scale','selective','split','backlight','backlit','silhouette','dust','particles','fog','misty','glowing','edges','futuristic','museum','gallery','display','showcase','hero','revelation','discovery','moment','incredible','surprising','unexpected','rare','capture','jaw-dropping','spectacle','eye-catching','opening','engaging','farewell','conclusion','ending','complete','balanced','lineup','collage','highlights','layout','montage','sequence']);
  const words = imagePrompt.toLowerCase().replace(/[^\w\s,]/g,' ').split(/[\s,]+/).filter((w) => w.length > 2 && !STRIP_WORDS.has(w));
  const seen = new Set<string>();
  const unique = words.filter((w) => { if (seen.has(w)) return false; seen.add(w); return true; });
  const query = unique.slice(0, 6).join(' ');
  if (query.length > 60) return query.slice(0, 57) + '...';
  return query || imagePrompt.slice(0, 50);
}

export function buildSearchQueryFromNarration(narration: string): string {
  const keywords = extractVisualKeywords(narration, 4);
  const query = keywords.join(' ');
  if (query.length > 60) return query.slice(0, 57) + '...';
  return query || narration.slice(0, 50);
}

export function pickShotType(index: number, total: number): string {
  const shots = ['cinematic establishing shot','dramatic close-up','wide aerial view','medium shot','macro detail shot','moody atmospheric scene','documentary style footage','dynamic action shot','artistic composition','epic wide landscape'];
  if (index === 0) return 'cinematic establishing shot';
  if (index === total - 1) return 'epic wide landscape';
  return shots[index % shots.length];
}
