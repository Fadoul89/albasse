// « Vouliez-vous dire… ? » : un mot mal écrit (« parfun », « chausure », « montre nawiforce ») est remplacé par le mot le plus proche
// parmi les mots des articles de la boutique (noms, catégories, couleurs). Des fonctions simples, sans réseau : testées dans tests/zara/spell-suggest.test.ts.

export type Vocabulary = Map<string, number>; // mot -> nombre d'articles où il apparaît

const MIN_LENGTH = 4; // en dessous, trop de mots se ressemblent : on ne propose rien

// les mots de la boutique (déjà passés par tokenize : sans accents, en minuscules, sans mots vides)
export function buildVocabulary(words: string[]): Vocabulary {
  const vocab: Vocabulary = new Map();
  for (const w of words) {
    if (w.length < 3 || /\d/.test(w)) continue;
    vocab.set(w, (vocab.get(w) ?? 0) + 1);
  }
  return vocab;
}

// Distance entre deux mots : nombre de lettres à ajouter, enlever, changer, ou de paires de lettres à inverser (« parfmu » -> « parfum » = 1).
// S'arrête dès que l'écart dépasse `max` (renvoie alors max + 1).
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      row.push(d);
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length] > max ? max + 1 : prev[b.length];
}

// le mot est connu tel quel (ou au pluriel / singulier, ou c'est le début d'un mot connu : le client est en train d'écrire)
function isKnown(word: string, vocab: Vocabulary): boolean {
  if (vocab.has(word) || vocab.has(`${word}s`) || vocab.has(word.replace(/s$/, ''))) return true;
  if (word.length >= 3) for (const w of vocab.keys()) if (w.startsWith(word)) return true;
  return false;
}

// Le mot de la boutique le plus proche, ou null. 4 à 5 lettres : une seule faute permise ; 6 lettres et plus : deux. Une première lettre
// différente compte comme une faute et demie (on se trompe rarement sur la première lettre) : « dress » ne devient jamais « tress ».
export function closestWord(word: string, vocab: Vocabulary): string | null {
  if (word.length < MIN_LENGTH || /\d/.test(word) || isKnown(word, vocab)) return null;
  const max = word.length <= 5 ? 1 : 2;
  let best: string | null = null;
  let bestScore = Infinity;
  let bestCount = 0;
  for (const [candidate, count] of vocab) {
    const d = editDistance(word, candidate, max);
    if (d > max) continue;
    const score = d + (candidate[0] === word[0] ? 0 : 0.5);
    if (score > max) continue;
    if (score < bestScore || (score === bestScore && count > bestCount)) {
      best = candidate;
      bestScore = score;
      bestCount = count;
    }
  }
  return best;
}

// Les mots de la recherche, corrigés un par un. null si rien n'est à corriger (tout est connu, ou aucun mot proche).
export function suggestWords(words: string[], vocab: Vocabulary): string[] | null {
  let changed = false;
  const fixed = words.map((w) => {
    const c = closestWord(w, vocab);
    if (!c) return w;
    changed = true;
    return c;
  });
  return changed ? fixed : null;
}
