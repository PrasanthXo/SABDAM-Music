import { Track } from '../types';

/**
 * Normalizes title string for duplicate detection (removes punctuation, noise, and whitespace)
 */
export function normalizeSongTitle(title?: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/\(from.*?\)|\[.*?\]|\(official.*?\)|official music video|official video|video song|lyrical video|full video song|hd song|full song/gi, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if candidate track is already present in a set of tracks or keys
 */
export function isSongAlreadyInQueue(track: Track, existingSet: Set<string>): boolean {
  if (!track) return true;
  if (track.id && existingSet.has(track.id)) return true;
  if (track.youtubeVideoId && existingSet.has(track.youtubeVideoId)) return true;
  if (track.audio_source_id && existingSet.has(track.audio_source_id)) return true;
  const normTitle = normalizeSongTitle(track.title);
  if (normTitle && existingSet.has(normTitle)) return true;
  return false;
}

/**
 * Records track identifiers into the uniqueness set
 */
export function recordTrackKeys(track: Track, existingSet: Set<string>): void {
  if (!track) return;
  if (track.id) existingSet.add(track.id);
  if (track.youtubeVideoId) existingSet.add(track.youtubeVideoId);
  if (track.audio_source_id) existingSet.add(track.audio_source_id);
  const normTitle = normalizeSongTitle(track.title);
  if (normTitle) existingSet.add(normTitle);
}

/**
 * Calculates a match score between a reference track and a candidate track.
 * Higher score = closer match in language, genre, artist, and acoustic style.
 */
export function getGenreAndLanguageMatchScore(reference: Track, candidate: Track): number {
  if (!reference || !candidate) return -1;
  if (reference.id === candidate.id) return -1; // Ignore self
  if (normalizeSongTitle(reference.title) === normalizeSongTitle(candidate.title)) return -1; // Ignore same title

  let score = 0;

  // 1. Language Match (Strict priority: +100)
  if (reference.language && candidate.language && reference.language === candidate.language) {
    score += 100;
  } else if (reference.language && candidate.language) {
    score -= 50;
  }

  // 2. Genre & Style Matching (+80 for exact, +40 for fuzzy genre overlap)
  if (reference.genre && candidate.genre) {
    const refGenre = reference.genre.toLowerCase();
    const candGenre = candidate.genre.toLowerCase();

    if (refGenre === candGenre) {
      score += 80;
    } else {
      const keywords = ['pop', 'melody', 'dance', 'beat', 'rock', 'anirudh', 'edm', 'ballad', 'mass', 'folk', 'hip hop', 'rap', 'classical', 'item', 'single', 'anthem', 'film'];
      for (const kw of keywords) {
        if (refGenre.includes(kw) && candGenre.includes(kw)) {
          score += 40;
          break;
        }
      }
    }
  }

  // 3. Artist match (+60)
  if (reference.artist && candidate.artist) {
    const refArtist = reference.artist.toLowerCase();
    const candArtist = candidate.artist.toLowerCase();
    if (refArtist === candArtist || refArtist.includes(candArtist) || candArtist.includes(refArtist)) {
      score += 60;
    }
  }

  // 4. Popularity / Quality boost (+0-30)
  if (candidate.popularityScore) {
    score += Math.min(30, candidate.popularityScore * 0.3);
  }

  // 5. Trending bonus (+20)
  if (candidate.isTrendingNow) {
    score += 20;
  }

  return score;
}

/**
 * Generates an expanded queue containing unique tracks strictly matching the reference track's genre & language.
 * Guarantees NO duplicate songs are inserted.
 */
export function buildMatchingGenreLanguageQueue(
  referenceTrack: Track,
  existingQueue: Track[] = [],
  catalog: Track[],
  targetCount: number = 30
): Track[] {
  if (!referenceTrack) return existingQueue || [];

  const resultQueue: Track[] = [];
  const existingKeys = new Set<string>();

  // Add existing queue items if unique
  if (existingQueue && existingQueue.length > 0) {
    for (const t of existingQueue) {
      if (t && !isSongAlreadyInQueue(t, existingKeys)) {
        resultQueue.push(t);
        recordTrackKeys(t, existingKeys);
      }
    }
  }

  // Ensure reference track is first if not already recorded
  if (!isSongAlreadyInQueue(referenceTrack, existingKeys)) {
    resultQueue.unshift(referenceTrack);
    recordTrackKeys(referenceTrack, existingKeys);
  }

  const targetLang = referenceTrack.language;

  // Score candidate tracks from catalog strictly matching same language & uniqueness
  const candidateScores = catalog
    .filter((t) => t && !isSongAlreadyInQueue(t, existingKeys) && (!targetLang || t.language === targetLang))
    .map((candidate) => ({
      track: candidate,
      score: getGenreAndLanguageMatchScore(referenceTrack, candidate),
    }))
    .filter((item) => item.score > 0);

  candidateScores.sort((a, b) => b.score - a.score);

  for (const item of candidateScores) {
    if (resultQueue.length >= targetCount) break;
    if (!isSongAlreadyInQueue(item.track, existingKeys)) {
      resultQueue.push(item.track);
      recordTrackKeys(item.track, existingKeys);
    }
  }

  // Fallback to any remaining same-language catalog tracks without duplicates
  if (resultQueue.length < targetCount) {
    const sameLangFallback = catalog.filter(
      (t) => t && !isSongAlreadyInQueue(t, existingKeys) && (!targetLang || t.language === targetLang)
    );
    for (const t of sameLangFallback) {
      if (resultQueue.length >= targetCount) break;
      resultQueue.push(t);
      recordTrackKeys(t, existingKeys);
    }
  }

  return resultQueue;
}

/**
 * Appends strictly unique matching tracks to an existing queue of the same language & genre.
 */
export function appendMatchingGenreLanguageTracks(
  currentTrack: Track,
  currentQueue: Track[],
  catalog: Track[],
  countToAppend: number = 20
): Track[] {
  if (!currentTrack) return currentQueue;

  const existingKeys = new Set<string>();
  for (const t of currentQueue) {
    recordTrackKeys(t, existingKeys);
  }

  const targetLang = currentTrack.language;

  const candidateScores = catalog
    .filter((t) => t && !isSongAlreadyInQueue(t, existingKeys) && (!targetLang || t.language === targetLang))
    .map((candidate) => ({
      track: candidate,
      score: getGenreAndLanguageMatchScore(currentTrack, candidate),
    }))
    .filter((item) => item.score > 0);

  candidateScores.sort((a, b) => b.score - a.score);

  const newUniqueAppends: Track[] = [];

  for (const item of candidateScores) {
    if (newUniqueAppends.length >= countToAppend) break;
    if (!isSongAlreadyInQueue(item.track, existingKeys)) {
      newUniqueAppends.push(item.track);
      recordTrackKeys(item.track, existingKeys);
    }
  }

  // If more needed, pull remaining same language songs from catalog without repeating
  if (newUniqueAppends.length < countToAppend) {
    const sameLang = catalog.filter(
      (t) => t && !isSongAlreadyInQueue(t, existingKeys) && (!targetLang || t.language === targetLang)
    );
    for (const t of sameLang) {
      if (newUniqueAppends.length >= countToAppend) break;
      newUniqueAppends.push(t);
      recordTrackKeys(t, existingKeys);
    }
  }

  return [...currentQueue, ...newUniqueAppends];
}

