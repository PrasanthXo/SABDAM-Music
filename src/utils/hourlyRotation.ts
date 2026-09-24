import { Track } from '../types';

/**
 * Calculates a unique integer representing the current hour window (UTC timestamp / 1 hour).
 */
export function getCurrentHourIndex(): number {
  return Math.floor(Date.now() / (1000 * 60 * 60));
}

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic pseudo-random number generator seeded by (hourIndex + catalogKeyHash).
 */
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Rotates and selects 15 to 25 songs for a specific catalog for a given hour.
 * Avoids repeating songs from the previous hour's visible window (hourIndex - 1).
 */
export function getHourlyRotatedCatalog(
  pool: Track[],
  catalogKey: string,
  hourIndex: number = getCurrentHourIndex(),
  targetCount: number = 18
): Track[] {
  if (!pool || pool.length === 0) return [];

  // Deduplicate input pool by ID
  const uniquePool: Track[] = [];
  const seen = new Set<string>();
  for (const t of pool) {
    if (t && t.id && !seen.has(t.id)) {
      seen.add(t.id);
      uniquePool.push(t);
    }
  }

  const n = uniquePool.length;
  if (n === 0) return [];
  if (n <= targetCount) {
    return uniquePool;
  }

  const desiredCount = Math.min(targetCount, n);

  // Determine which songs were shown in the previous hour
  const prevHourIndex = hourIndex - 1;
  const prevSeed = prevHourIndex * 1000003 + stringHash(catalogKey);
  const prevRng = seededRandom(prevSeed);

  const prevIndices = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(prevRng() * (i + 1));
    [prevIndices[i], prevIndices[j]] = [prevIndices[j], prevIndices[i]];
  }
  const prevVisibleSet = new Set(prevIndices.slice(0, desiredCount));

  // Partition current pool into [unseenInPrevHour, seenInPrevHour]
  const unseenTracks: Track[] = [];
  const seenTracks: Track[] = [];

  for (let i = 0; i < n; i++) {
    if (prevVisibleSet.has(i)) {
      seenTracks.push(uniquePool[i]);
    } else {
      unseenTracks.push(uniquePool[i]);
    }
  }

  // Shuffle unseen and seen groups using current hour's seed
  const currentSeed = hourIndex * 1000003 + stringHash(catalogKey);
  const currentRng = seededRandom(currentSeed);

  const shuffleArray = <T>(arr: T[]): T[] => {
    const res = [...arr];
    for (let i = res.length - 1; i > 0; i--) {
      const j = Math.floor(currentRng() * (i + 1));
      [res[i], res[j]] = [res[j], res[i]];
    }
    return res;
  };

  const shuffledUnseen = shuffleArray(unseenTracks);
  const shuffledSeen = shuffleArray(seenTracks);

  return [...shuffledUnseen, ...shuffledSeen].slice(0, desiredCount);
}
