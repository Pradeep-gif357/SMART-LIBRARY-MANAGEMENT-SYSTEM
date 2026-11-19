// Lightweight, fully offline text-embedding model (no downloads, no API keys).
//
// How it works ("hashed bag-of-words + concept lexicon"):
//   1. text -> lowercase tokens -> stop-word removal -> light stemming
//   2. every token and every neighbouring word pair (bigram) is hashed into one of
//      256 slots (feature hashing, FNV-1a) with a +/- sign so collisions cancel out
//   3. words that belong to a topic group (e.g. "neural", "learning" -> concept:ai_ml)
//      also add a shared "concept" feature, so books about the same topic land close
//      together even when they use different words
//   4. sub-linear term weighting (1 + ln(count)) and L2 normalisation
//
// The output is a 256-dimension unit vector stored in PostgreSQL (pgvector) and
// compared with cosine distance. To upgrade later, replace embedQuery/embedDocument
// with a transformer model (e.g. all-MiniLM) and change vector(256) to its size.

export const DIM = 256;

const STOP = new Set(
  (
    'a an the and or but of in on at to for from by with about as is are was were be been being it its this ' +
    'that these those i me my we our you your they their he she his her what which who whom how why when where ' +
    'do does did can could should would will shall may might must have has had not no yes so if then than too ' +
    'very just book books read reading reader want wants need looking look find recommend recommendation ' +
    'recommendations suggest suggestion something anything good great best some any please give show tell like ' +
    'similar related more new interesting topic topics available'
  ).split(/\s+/)
);

// topic groups: every word listed here also activates the shared concept feature
const CONCEPTS = {
  programming: 'code coding program programming software developer python javascript java algorithm algorithms debugging refactoring craftsmanship engineer engineering',
  ai_ml: 'artificial intelligence machine learning neural deep model models statistics probabilistic reasoning agent',
  data_db: 'database databases sql data storage query queries transaction distributed scalability reliability',
  space_physics: 'universe cosmos space physics cosmology astronomy astrophysics black hole star stars galaxy quantum relativity planet planets',
  biology: 'gene genes genetic genetics dna evolution biology cell cells organism species heredity',
  history: 'history historical civilization civilizations empire war independence nation ancient society cultures freedom',
  india: 'india indian gandhi nehru kalam tagore delhi',
  dystopia: 'dystopian totalitarian surveillance government politics power propaganda',
  fantasy: 'fantasy magic wizard wizards dragon dragons quest adventure kingdom hobbit hogwarts',
  scifi: 'sci-fi scifi science fiction future robot robots galactic desert interstellar',
  self_improvement: 'habit habits productivity focus discipline success mindset improve personal growth routine',
  business: 'business startup startups entrepreneur entrepreneurs company innovation money finance wealth investing',
  psychology: 'psychology mind thinking decision decisions bias behavior behaviour cognitive',
  romance_classic: 'romance love marriage manners class classic novel',
  math: 'mathematics math algebra linear calculus matrix matrices proof probability theorem vectors',
  biography: 'biography autobiography memoir inspiring life story',
  systems: 'network networking internet protocol protocols operating kernel computer computers architecture',
  poetry: 'poetry poem poems verse spiritual song songs',
};

function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 5 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}

export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

const WORD_TO_CONCEPTS = new Map();
for (const [concept, words] of Object.entries(CONCEPTS)) {
  for (const w of words.split(/\s+/)) {
    const key = stem(w);
    if (!WORD_TO_CONCEPTS.has(key)) WORD_TO_CONCEPTS.set(key, []);
    if (!WORD_TO_CONCEPTS.get(key).includes(concept)) WORD_TO_CONCEPTS.get(key).push(concept);
  }
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function normalize(v) {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum);
  if (norm === 0) return v.slice();
  return v.map((x) => Math.round((x / norm) * 100000) / 100000);
}

export function isZero(v) {
  return !v || v.every((x) => x === 0);
}

function rawEmbed(text) {
  const tokens = tokenize(text);
  const counts = new Map();
  const bump = (key, w) => counts.set(key, (counts.get(key) || 0) + w);
  tokens.forEach((t, i) => {
    bump(t, 1);
    if (i > 0) bump(tokens[i - 1] + '_' + t, 0.5);
    const concepts = WORD_TO_CONCEPTS.get(t);
    if (concepts) for (const c of concepts) bump('concept:' + c, 1.5);
  });
  const v = new Array(DIM).fill(0);
  for (const [key, c] of counts) {
    const weight = 1 + Math.log(c);
    const idx = fnv1a(key) % DIM;
    const sign = fnv1a(key + '#') & 1 ? 1 : -1;
    v[idx] += sign * weight;
  }
  return normalize(v);
}

/** Embedding for a search phrase. Returns null when the phrase has no meaningful words. */
export function embedQuery(text) {
  const v = rawEmbed(text);
  return isZero(v) ? null : v;
}

/** Embedding for a book. Never returns a zero vector (pgvector cosine indexes dislike them). */
export function embedDocument(text) {
  const v = rawEmbed(text);
  if (isZero(v)) v[0] = 1;
  return v;
}

/** Text that represents a book. Title and category are repeated to give them more weight. */
export function bookText({ title, authors, category, description }) {
  return `${title} ${title} ${category} ${category} ${authors || ''} ${description || ''}`;
}

export const toVectorLiteral = (v) => '[' + v.join(',') + ']';

export function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** weighted sum of vectors, normalised. items = [{ vector, weight }] */
export function weightedMean(items) {
  const acc = new Array(DIM).fill(0);
  let any = false;
  for (const { vector, weight } of items) {
    if (!vector) continue;
    any = true;
    for (let i = 0; i < DIM; i++) acc[i] += vector[i] * weight;
  }
  return any ? normalize(acc) : null;
}
