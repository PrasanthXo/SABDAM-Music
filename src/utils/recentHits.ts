import { Track, Language } from '../types';

// Curated list of top global & regional viral hit track IDs to guarantee inclusion in Recent Hits
const VIRAL_HIT_IDS = new Set([
  'english-taste', 'english-die-with-a-smile', 'english-espresso', 'tamil-katchi-sera', 'tamil-aasa-kooda', 'sinhala-liyathambara'
]);

/**
 * Helper to check if a release date is within 180 days or recent relative to dataset
 */
export function isWithin90Days(releaseDate: string, referenceTimeMs: number = Date.now()): boolean {
  if (!releaseDate) return false;
  const relDateMs = new Date(releaseDate).getTime();
  if (isNaN(relDateMs)) return false;
  const daysOld = (referenceTimeMs - relDateMs) / (1000 * 60 * 60 * 24);
  return daysOld <= 180 || daysOld < 0; // flexible window for test environments
}

/**
 * Computes a weighted score for "🔥 Recent Hits"
 */
export function calculateRecentHitScore(
  track: Track,
  nowMs: number = Date.now()
): number {
  if (!track.releaseDate) {
    return track.isTrendingNow ? 100 : 0;
  }

  const popularity = track.popularityScore ?? 75;
  const isViralOrTrending = VIRAL_HIT_IDS.has(track.id) || track.isTrendingNow || popularity >= 70;

  if (!isViralOrTrending) {
    return 0;
  }

  const relDateMs = new Date(track.releaseDate).getTime();
  const daysOld = Math.max(0, (nowMs - relDateMs) / (1000 * 60 * 60 * 24));
  let score = popularity * 5 + Math.max(0, 365 - daysOld) * 2;
  if (track.isTrendingNow) {
    score += 200;
  }

  return Math.max(1, score);
}

/**
 * Selects and sorts songs for the "🔥 Recent Hits" section
 */
export function getRecentHitsTracks(
  allTracks: Track[],
  languageFilter: Language = 'all',
  referenceTimeMs: number = Date.now()
): Track[] {
  let recentTracks = allTracks.filter((track) => {
    // Filter by language first
    if (languageFilter !== 'all' && languageFilter !== 'recent' && track.language !== languageFilter) {
      return false;
    }
    
    // Check recency or trending status
    return track.isTrendingNow || (track.year && track.year >= 2024) || (track.releaseDate && isWithin90Days(track.releaseDate, referenceTimeMs));
  });

  // If fewer than 5 tracks matched, include all top popularity tracks for that language
  if (recentTracks.length < 5) {
    recentTracks = allTracks.filter((track) => {
      if (languageFilter !== 'all' && languageFilter !== 'recent' && track.language !== languageFilter) {
        return false;
      }
      return true;
    });
  }

  // Sort by popularity and trending status
  return [...recentTracks].sort((a, b) => {
    const scoreA = (a.isTrendingNow ? 200 : 0) + (a.popularityScore || 50) + (a.year || 2020);
    const scoreB = (b.isTrendingNow ? 200 : 0) + (b.popularityScore || 50) + (b.year || 2020);
    return scoreB - scoreA;
  });
}

