// Langue de Zara : français ou arabe. Outils pour comprendre l'arabe écrit par le visiteur : lettres
// unifiées, préfixes (ال، ل، ب…), mots de produits, de parents et de villes ramenés à des mots français.
// Aucune dépendance : facile à tester.

export type Lang = 'fr' | 'ar';

export const hasArabic = (text: string) => /[؀-ۿ]/.test(text);

// ٢٠٠٠٠ -> 20000
export function arabicDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

// Unifie les variantes de lettres (أ إ آ -> ا ; ى -> ي ; ة -> ه) et enlève voyelles brèves et allongements.
export function foldArabic(text: string): string {
  // NFC d'abord : « ي » + hamza séparée devient « ئ » (même lettre que celle du clavier) avant qu'on enlève les signes
  return arabicDigits(text.normalize('NFC'))
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

// Le visiteur écrit en arabe : Zara passe à l'arabe. Sinon on ne change rien (null).
export const detectLang = (text: string): Lang | null => (hasArabic(text) ? 'ar' : null);

// ---------------------------------------------------------------------------------------------
// Arabe -> mots français
// ---------------------------------------------------------------------------------------------

const AR_STOP = new Set([
  'اريد', 'ارغب', 'ابحث', 'ابغي', 'عايز', 'بدي', 'عندكم', 'عندك', 'هل', 'لدي', 'لدينا', 'ممكن', 'من', 'عن', 'في', 'على',
  'الى', 'الي', 'عند', 'مع', 'او', 'و', 'ثم', 'انا', 'نحن', 'هذا', 'هذه', 'ذلك', 'ما', 'ماذا', 'كيف', 'كم', 'اين', 'لماذا',
  'هناك', 'يوجد', 'لو', 'سمحت', 'لطفا', 'فضلك', 'شيء', 'شي', 'اي', 'كل', 'بعض', 'هو', 'هي', 'انت', 'انتم', 'ان', 'لا',
  'اعمل', 'اشتري', 'احتاج', 'محتاج', 'ودي', 'اود',
]);

// Clés au format « unifié » (voir foldArabic). Une valeur vide = mot ignoré.
const AR_TO_FR: Record<string, string> = {
  // à qui
  زوجي: 'mari', زوج: 'mari', زوجتي: 'epouse', زوجه: 'epouse',
  ابي: 'papa', ابوي: 'papa', والدي: 'papa', امي: 'maman', والدتي: 'maman', اخي: 'frere', اختي: 'soeur',
  ابني: 'fils', ولدي: 'fils', ابنتي: 'fille', بنتي: 'fille', بنات: 'fille',
  صديقي: 'ami', رفيقي: 'ami', صديقتي: 'amie',
  طفل: 'enfant', اطفال: 'enfant', طفله: 'enfant', صغير: 'enfant', صغاري: 'enfant', رضيع: 'bebe',
  له: 'lui', لها: 'elle',
  رجال: 'homme', رجالي: 'homme', رجل: 'homme', نساء: 'femme', نسائي: 'femme', حريمي: 'femme', امراه: 'femme',
  رجاليه: 'homme', نسائيه: 'femme', اولاد: 'enfant', ولاد: 'enfant', اطفالي: 'enfant',
  // occasions
  هديه: 'cadeau', هدايا: 'cadeau', هديتي: 'cadeau', اهداء: 'cadeau', اهدي: 'cadeau', اهديه: 'cadeau',
  ميلاد: 'anniversaire', زواج: 'mariage', عرس: 'mariage', رمضان: 'ramadan', عيد: 'fete',
  // demande de conseil
  نصيحه: 'conseil', انصحني: 'conseil', انصح: 'conseil', اقتراح: 'conseil', اقترح: 'conseil', ساعدني: 'conseil', مساعده: 'conseil',
  // produits
  حذاء: 'chaussures', احذيه: 'chaussures', جزمه: 'chaussures', صندل: 'sandale', صنادل: 'sandale',
  ساعه: 'montre', ساعات: 'montre',
  عطر: 'parfum', عطور: 'parfum', برفان: 'parfum', بارفان: 'parfum',
  حقيبه: 'sac', حقائب: 'sac', شنطه: 'sac', شنط: 'sac', محفظه: 'portefeuille',
  فستان: 'robe', فساتين: 'robe', عباءه: 'abaya',
  ملابس: 'vetements', لباس: 'vetements', ثوب: 'vetements', قميص: 'chemise', بنطلون: 'pantalon', جاكيت: 'veste', بدله: 'costume',
  نظاره: 'lunettes', نظارات: 'lunettes',
  تجميل: 'cosmetique', كريم: 'creme', مكياج: 'maquillage',
  كهربائي: 'electrique', كهربائيات: 'electrique', كهرباء: 'electrique',
  العاب: 'jouets', لعبه: 'jouet', دراجه: 'velo', دراجات: 'velo',
  اثاث: 'meuble', منزل: 'maison', بيت: 'maison',
  هاتف: 'telephone', جوال: 'telephone', موبايل: 'telephone',
  سياره: 'voiture', سيارات: 'voiture',
  طعام: 'aliment', غذاء: 'aliment', زراعه: 'agriculture', حديقه: 'jardin',
  // couleurs
  اسود: 'noir', ابيض: 'blanc', احمر: 'rouge', ازرق: 'bleu', اخضر: 'vert', ذهبي: 'dore', فضي: 'argent',
};

const AR_PREFIXES = ['وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'ل', 'ب', 'و', 'ف', 'ك'];

function lookupAr(token: string): string | undefined {
  if (token in AR_TO_FR) return AR_TO_FR[token];
  for (const prefix of AR_PREFIXES) {
    if (token.length > prefix.length + 1 && token.startsWith(prefix)) {
      const rest = token.slice(prefix.length);
      if (rest in AR_TO_FR) return AR_TO_FR[rest];
    }
  }
  return undefined;
}

function isArStop(token: string): boolean {
  if (AR_STOP.has(token)) return true;
  for (const prefix of AR_PREFIXES) {
    if (token.length > prefix.length + 1 && token.startsWith(prefix) && AR_STOP.has(token.slice(prefix.length))) return true;
  }
  return false;
}

// « أريد هدية لزوجي » -> « cadeau mari ». Les mots latins et les chiffres restent tels quels,
// les mots arabes inconnus aussi (ils comptent alors comme un mot précis).
export function arabicToFrench(text: string): string {
  const out: string[] = [];
  for (const raw of foldArabic(text).toLowerCase().split(/\s+/)) {
    const token = raw.replace(/[^\p{L}\p{N}]/gu, '');
    if (!token) continue;
    if (!hasArabic(token)) {
      out.push(token);
      continue;
    }
    if (isArStop(token)) continue;
    const fr = lookupAr(token);
    if (fr !== undefined) {
      if (fr) out.push(fr);
      continue;
    }
    out.push(token);
  }
  return out.join(' ');
}

// ---------------------------------------------------------------------------------------------
// Villes écrites en arabe
// ---------------------------------------------------------------------------------------------

const AR_CITIES: Record<string, string> = {
  انجامينا: "N'Djamena", انجمينا: "N'Djamena", نجامينا: "N'Djamena", انجامينه: "N'Djamena",
  موندو: 'Moundou', مندو: 'Moundou', مونذو: 'Moundou',
  سار: 'Sarh',
  ابشي: 'Abéché', ابيشي: 'Abéché', ابشه: 'Abéché',
  كيلو: 'Kélo', كومرا: 'Koumra', بالا: 'Pala', بونغور: 'Bongor', بنغور: 'Bongor', دوبا: 'Doba',
  فايا: 'Faya-Largeau', مونغو: 'Mongo', منغو: 'Mongo', مونقو: 'Mongo', اتي: 'Ati', ماو: 'Mao',
  موسورو: 'Moussoro', بول: 'Bol', ماساكوري: 'Massakory', بلتين: 'Biltine', فادا: 'Fada', ادري: 'Adré', ايريبا: 'Iriba',
  لاي: 'Laï', فيانغا: 'Fianga', ليري: 'Léré', بينوي: 'Benoy', كيابي: 'Kyabé', مويسالا: 'Moïssala', بوسو: 'Bousso',
  ماساغيت: 'Massaguet', ماسنيا: 'Massenya', حراز: 'Haraze', ملفي: 'Melfi',
};

// « التوصيل الى مونذو » -> « Moundou » (nom de la liste des villes), ou null.
export function arabicCityToLatin(text: string): string | null {
  for (const raw of foldArabic(text).split(/\s+/)) {
    const token = raw.replace(/[^\p{L}\p{N}]/gu, '');
    if (!token || !hasArabic(token)) continue;
    if (token in AR_CITIES) return AR_CITIES[token];
    for (const prefix of AR_PREFIXES) {
      if (token.length > prefix.length + 1 && token.startsWith(prefix)) {
        const rest = token.slice(prefix.length);
        if (rest in AR_CITIES) return AR_CITIES[rest];
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Catégories : noms en arabe, mots qui les désignent
// ---------------------------------------------------------------------------------------------

export const CATEGORY_AR: Record<string, string> = {
  'agriculture-jardinage': 'الزراعة والبستنة',
  'bebe-et-maternite': 'الطفل والأمومة',
  chaussures: 'أحذية',
  cosmetique: 'مستحضرات التجميل',
  electrique: 'كهربائيات',
  lunettes: 'نظارات',
  'maison-mobilier': 'المنزل والأثاث',
  montre: 'ساعات',
  parfum: 'عطور',
  'produits-alimentaires': 'منتجات غذائية',
  'sacs-et-bagages': 'حقائب وأمتعة',
  'velos-pour-enfants-jouets-et-jeux': 'دراجات وألعاب الأطفال',
  vetements: 'ملابس',
  'vetements-pour-femmes': 'ملابس نسائية',
  'vitalite-energie-homme': 'حيوية وطاقة للرجال',
  voiture: 'سيارات',
};

export const CATEGORY_EMOJI: Record<string, string> = {
  parfum: '🧴',
  chaussures: '👟',
  montre: '⌚',
  vetements: '👔',
  'vetements-pour-femmes': '👗',
  'sacs-et-bagages': '👜',
  lunettes: '🕶️',
  cosmetique: '💄',
  electrique: '🔌',
  'maison-mobilier': '🛋️',
  'bebe-et-maternite': '🍼',
  'velos-pour-enfants-jouets-et-jeux': '🧸',
};

// Mots français (normalisés, sans pluriel) qui désignent une catégorie.
export const CATEGORY_WORDS: { slug: string; words: string[] }[] = [
  { slug: 'chaussures', words: ['chaussure', 'soulier', 'basket', 'sandale', 'tong', 'botte', 'mocassin', 'talon'] },
  { slug: 'montre', words: ['montre'] },
  { slug: 'parfum', words: ['parfum', 'fragrance'] },
  { slug: 'sacs-et-bagages', words: ['sac', 'bagage', 'valise', 'sacoche', 'cartable', 'portefeuille'] },
  { slug: 'vetements', words: ['vetement', 'habit', 'chemise', 'pantalon', 'veste', 'blouson', 'costume', 'jean', 'tenue', 'pull', 'polo', 'tshirt'] },
  { slug: 'vetements-pour-femmes', words: ['robe', 'jupe', 'abaya', 'boubou', 'pagne', 'tunique', 'legging'] },
  { slug: 'lunettes', words: ['lunette'] },
  { slug: 'cosmetique', words: ['cosmetique', 'creme', 'maquillage', 'vernis', 'soin'] },
  { slug: 'electrique', words: ['electrique', 'electromenager', 'ventilateur', 'climatiseur', 'telephone', 'television', 'frigo', 'mixeur'] },
  { slug: 'maison-mobilier', words: ['maison', 'meuble', 'mobilier', 'canape', 'matelas'] },
  { slug: 'bebe-et-maternite', words: ['bebe', 'maternite', 'poussette', 'biberon', 'couche'] },
  { slug: 'velos-pour-enfants-jouets-et-jeux', words: ['jouet', 'jeu', 'velo', 'poupee'] },
  { slug: 'vitalite-energie-homme', words: ['vitalite', 'energie'] },
  { slug: 'agriculture-jardinage', words: ['agriculture', 'jardin', 'jardinage', 'semence'] },
  { slug: 'voiture', words: ['voiture', 'auto', 'vehicule'] },
  { slug: 'produits-alimentaires', words: ['aliment', 'alimentaire', 'riz', 'huile'] },
];

// Catégories où l'on demande « pour qui ? » (homme, femme, enfant).
export const GENDERED_SLUGS = ['parfum', 'chaussures', 'montre', 'vetements', 'lunettes'];

export type Who = 'elle' | 'lui' | 'enfant';

// Mots (normalisés) qui disent à qui s'adresse l'achat.
export const WHO_WORDS: Record<Who, string[]> = {
  // « marie » : faute fréquente pour « mari » (« mon marie »)
  lui: ['lui', 'homme', 'mari', 'marie', 'epoux', 'papa', 'pere', 'frere', 'ami', 'copain', 'fiance', 'cheri', 'monsieur', 'oncle', 'patron'],
  elle: ['elle', 'femme', 'epouse', 'maman', 'mere', 'soeur', 'amie', 'copine', 'fiancee', 'cherie', 'madame', 'dame', 'tante'],
  enfant: ['enfant', 'bebe', 'fils', 'fille', 'garcon', 'neveu', 'niece', 'gamin', 'gamine'],
};
