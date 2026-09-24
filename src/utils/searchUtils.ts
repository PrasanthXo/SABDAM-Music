import { Track } from '../types';

/**
 * Fast Levenshtein distance for typo-tolerant fuzzy matching
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Checks if two words match with typo tolerance
 */
export function isFuzzyWordMatch(inputWord: string, targetWord: string): boolean {
  if (!inputWord || !targetWord) return false;
  if (targetWord.includes(inputWord) || inputWord.includes(targetWord)) return true;

  const maxDist = inputWord.length <= 3 ? 0 : inputWord.length <= 6 ? 1 : 2;
  return levenshteinDistance(inputWord, targetWord) <= maxDist;
}

/**
 * Normalizes text for resilient phonetic & multi-lingual search
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^\w\s\u0B80-\u0BFF\u0D80-\u0DFF]/gi, ' ') // retain letters, numbers, Tamil & Sinhala scripts
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phonetic transliteration reducer (e.g. "kaavaalaa" -> "kavala", "mutta" -> "muta", "baloon" -> "balon")
 */
export function phoneticReduction(text: string): string {
  const norm = normalizeSearchText(text);
  return norm
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/th/g, 't')
    .replace(/zh/g, 'l')
    .replace(/sh/g, 's')
    .replace(/ck/g, 'k')
    .replace(/ph/g, 'f')
    .replace(/dh/g, 'd')
    .replace(/([a-z])\1+/g, '$1') // collapse double letters: "balloon" -> "balon", "kalakki" -> "kalaki"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips generic filler search tokens such as 'song', 'lyrics', 'video', etc.
 */
export function cleanSearchQuery(query: string): string {
  const norm = normalizeSearchText(query);
  const cleaned = norm
    .replace(/\b(songs?|singing|music|mp3|video|audio|track|tracks|lyrics?|full|official|hd|4k|status|bgm|remix|lofi|movie|movies|film|original|single|singles|hit|hits|paatu|paattu|sindu|sindhu|geetha)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || norm;
}

/**
 * Detects if the search query contains explicit language hints
 */
export function detectQueryLanguage(query: string): 'tamil' | 'sinhala' | 'english' | 'hindi' | null {
  const q = normalizeSearchText(query);
  if (/\b(tamil|tamizh|thamizh|kollywood)\b/i.test(q) || /[\u0B80-\u0BFF]/.test(query)) {
    return 'tamil';
  }
  if (/\b(sinhala|sinhalese|sri lanka|lankan)\b/i.test(q) || /[\u0D80-\u0DFF]/.test(query)) {
    return 'sinhala';
  }
  if (/\b(english|hollywood|western|global)\b/i.test(q)) {
    return 'english';
  }
  if (/\b(hindi|bollywood|punjabi)\b/i.test(q)) {
    return 'hindi';
  }
  return null;
}

/**
 * Expands known abbreviations and aliases (e.g. "arr" -> "a.r. rahman", "ani" -> "anirudh")
 */
export function expandSearchAliases(query: string): string[] {
  const q = normalizeSearchText(query);
  const aliases: string[] = [q];

  if (q.includes('kalayani')) {
    aliases.push(q.replace(/kalayani/g, 'kalyani'));
  }
  if (q.includes('kalyani')) {
    aliases.push(q.replace(/kalyani/g, 'kalayani'));
  }
  if (q === 'arr' || q.includes('arr ')) {
    aliases.push(q.replace(/\barr\b/g, 'rahman'));
    aliases.push(q.replace(/\barr\b/g, 'a r rahman'));
  }
  if (q === 'ani' || q.includes('ani ')) {
    aliases.push(q.replace(/\bani\b/g, 'anirudh'));
  }
  if (q === 'gvp' || q.includes('gvp ')) {
    aliases.push(q.replace(/\bgvp\b/g, 'gv prakash'));
  }
  if (q === 'u1' || q.includes('u1 ')) {
    aliases.push(q.replace(/\bu1\b/g, 'yuvan'));
  }

  return aliases;
}

/**
 * Calculates a comprehensive search relevance score for a track given a search query
 */
export function computeTrackSearchScore(track: Track, rawQuery: string): number {
  if (!rawQuery || !rawQuery.trim()) return 0;

  const rawNorm = normalizeSearchText(rawQuery);
  const cleanQ = cleanSearchQuery(rawQuery);
  const phonQ = phoneticReduction(cleanQ);

  const titleNorm = normalizeSearchText(track.title);
  const artistNorm = normalizeSearchText(track.artist);
  const movieNorm = normalizeSearchText(track.movie || '');
  const albumNorm = normalizeSearchText(track.album || '');
  const genreNorm = normalizeSearchText(track.genre || '');
  const lyricsNorm = normalizeSearchText(track.lyrics || '');
  const langNorm = normalizeSearchText(track.language || '');

  const titlePhon = phoneticReduction(track.title);
  const artistPhon = phoneticReduction(track.artist);
  const moviePhon = phoneticReduction(track.movie || '');
  const lyricsPhon = phoneticReduction(track.lyrics || '');

  let score = 0;

  // 1. Explicit query language match bonus
  const detectedLang = detectQueryLanguage(rawQuery);
  if (detectedLang && track.language === detectedLang) {
    score += 500;
  }

  // 2. Exact matches
  if (titleNorm === cleanQ || titleNorm === rawNorm) score += 2000;
  if (movieNorm === cleanQ || movieNorm === rawNorm) score += 1600;
  if (artistNorm === cleanQ || artistNorm === rawNorm) score += 1200;
  if (albumNorm === cleanQ) score += 800;

  // 3. Phonetic exact match (e.g. "kavala" matches "kaavaalaa", "manja balloon" matches lyrics)
  if (titlePhon === phonQ) score += 1800;
  if (moviePhon === phonQ) score += 1500;
  if (artistPhon === phonQ) score += 1100;

  // 4. Starts-with & substring matching
  if (titleNorm.startsWith(cleanQ)) score += 1000;
  else if (titleNorm.includes(cleanQ)) score += 700;

  if (titlePhon.includes(phonQ)) score += 600;

  if (movieNorm.startsWith(cleanQ)) score += 800;
  else if (movieNorm.includes(cleanQ)) score += 500;

  if (artistNorm.startsWith(cleanQ)) score += 700;
  else if (artistNorm.includes(cleanQ)) score += 400;

  // 5. Lyrics match (e.g. user searching for chorus or hook lines like "manja balloon", "halamithi habibo")
  if (lyricsNorm.includes(cleanQ)) score += 950;
  if (lyricsPhon.includes(phonQ)) score += 800;

  // 6. Token-based multi-word query matching
  const tokens = cleanQ.split(/\s+/).filter((t) => t.length > 0);
  let matchedTokens = 0;

  const targetWords = [
    ...titleNorm.split(/\s+/),
    ...artistNorm.split(/\s+/),
    ...movieNorm.split(/\s+/),
    ...albumNorm.split(/\s+/),
    ...lyricsNorm.split(/\s+/),
  ].filter(Boolean);

  for (const token of tokens) {
    const tPhon = phoneticReduction(token);
    const inTitle = titleNorm.includes(token) || titlePhon.includes(tPhon);
    const inArtist = artistNorm.includes(token) || artistPhon.includes(tPhon);
    const inMovie = movieNorm.includes(token) || moviePhon.includes(tPhon);
    const inAlbum = albumNorm.includes(token);
    const inGenre = genreNorm.includes(token);
    const inLang = langNorm.includes(token) || (detectedLang === track.language && token === detectedLang);
    const inLyrics = lyricsNorm.includes(token) || lyricsPhon.includes(tPhon);

    // Fuzzy word match with typo tolerance
    const fuzzyInWords = targetWords.some((w) => isFuzzyWordMatch(token, w));

    if (inTitle || inArtist || inMovie || inAlbum || inGenre || inLang || inLyrics || fuzzyInWords) {
      matchedTokens++;
      score += inTitle ? 300 : inMovie ? 260 : inArtist ? 220 : inLyrics ? 240 : fuzzyInWords ? 180 : 120;
    }
  }

  // Multi-token bonus if all or most tokens in query were found across track metadata
  if (tokens.length > 1 && matchedTokens === tokens.length) {
    score += 800;
  } else if (tokens.length > 1 && matchedTokens >= tokens.length - 1) {
    score += 300;
  }

  return score;
}

/**
 * Determines whether a track matches a search query using fuzzy and token comparison
 */
export function trackMatchesQuery(track: Track, rawQuery: string): boolean {
  if (!rawQuery || !rawQuery.trim()) return true;

  const rawNorm = normalizeSearchText(rawQuery);
  const cleanQ = cleanSearchQuery(rawQuery);
  const phonQ = phoneticReduction(cleanQ);

  const titleNorm = normalizeSearchText(track.title);
  const artistNorm = normalizeSearchText(track.artist);
  const movieNorm = normalizeSearchText(track.movie || '');
  const albumNorm = normalizeSearchText(track.album || '');
  const genreNorm = normalizeSearchText(track.genre || '');
  const lyricsNorm = normalizeSearchText(track.lyrics || '');
  const langNorm = normalizeSearchText(track.language || '');

  const titlePhon = phoneticReduction(track.title);
  const artistPhon = phoneticReduction(track.artist);
  const moviePhon = phoneticReduction(track.movie || '');
  const lyricsPhon = phoneticReduction(track.lyrics || '');

  // Substring or phonetic match
  if (
    titleNorm.includes(cleanQ) ||
    cleanQ.includes(titleNorm) ||
    titleNorm.includes(rawNorm) ||
    artistNorm.includes(cleanQ) ||
    cleanQ.includes(artistNorm) ||
    movieNorm.includes(cleanQ) ||
    cleanQ.includes(movieNorm) ||
    albumNorm.includes(cleanQ) ||
    genreNorm.includes(cleanQ) ||
    langNorm.includes(cleanQ) ||
    lyricsNorm.includes(cleanQ) ||
    titlePhon.includes(phonQ) ||
    phonQ.includes(titlePhon) ||
    artistPhon.includes(phonQ) ||
    moviePhon.includes(phonQ) ||
    lyricsPhon.includes(phonQ)
  ) {
    return true;
  }

  // Target word list for typo tolerance
  const targetWords = [
    ...titleNorm.split(/\s+/),
    ...artistNorm.split(/\s+/),
    ...movieNorm.split(/\s+/),
    ...albumNorm.split(/\s+/),
    ...lyricsNorm.split(/\s+/),
  ].filter(Boolean);

  // Token-by-token check
  const tokens = cleanQ.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length > 0) {
    const allTokensMatch = tokens.every((token) => {
      const tPhon = phoneticReduction(token);
      return (
        titleNorm.includes(token) ||
        artistNorm.includes(token) ||
        movieNorm.includes(token) ||
        albumNorm.includes(token) ||
        genreNorm.includes(token) ||
        langNorm.includes(token) ||
        lyricsNorm.includes(token) ||
        titlePhon.includes(tPhon) ||
        artistPhon.includes(tPhon) ||
        moviePhon.includes(tPhon) ||
        lyricsPhon.includes(tPhon) ||
        targetWords.some((w) => isFuzzyWordMatch(token, w))
      );
    });
    if (allTokensMatch) return true;
  }

  return false;
}

