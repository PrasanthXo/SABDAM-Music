import { Track } from '../types';

const STORAGE_PREFIX = 'sabdham.catalog.rotation.v2';

type CatalogHistory = {
  seenIds: string[];
  lastDayIndex: number;
};

/**
 * Returns an integer for the device's current LOCAL calendar day.
 * This changes once at local midnight instead of on a UTC/hour boundary.
 */
export function getCurrentDayIndex(now: Date = new Date()): number {
  return Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / (24 * 60 * 60 * 1000)
  );
}

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const result = [...items];
  const rng = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function readHistory(catalogKey: string): CatalogHistory {
  if (typeof window === 'undefined') {
    return { seenIds: [], lastDayIndex: -1 };
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}.${catalogKey}`);
    if (!raw) return { seenIds: [], lastDayIndex: -1 };

    const parsed = JSON.parse(raw) as Partial<CatalogHistory>;
    return {
      seenIds: Array.isArray(parsed.seenIds)
        ? parsed.seenIds.filter((id): id is string => typeof id === 'string')
        : [],
      lastDayIndex:
        typeof parsed.lastDayIndex === 'number' ? parsed.lastDayIndex : -1,
    };
  } catch {
    return { seenIds: [], lastDayIndex: -1 };
  }
}

function writeHistory(catalogKey: string, history: CatalogHistory): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}.${catalogKey}`,
      JSON.stringify(history)
    );
  } catch {
    // Storage may be unavailable in private/restricted browser modes.
  }
}

/**
 * Daily catalogue rotation.
 *
 * Rules:
 * - Changes once per LOCAL calendar day.
 * - Liked songs are protected from the seen-history filter.
 * - Songs not shown before are placed first.
 * - Previously shown songs are only used as fallback and are placed after new songs.
 * - History persists across app/browser restarts via localStorage.
 * - Newly added catalogue IDs are automatically treated as unseen.
 */
export function getDailyRotatedCatalog(
  pool: Track[],
  catalogKey: string,
  dayIndex: number = getCurrentDayIndex(),
  targetCount: number = 18,
  likedTrackIds: ReadonlySet<string> = new Set<string>()
): Track[] {
  if (!pool || pool.length === 0) return [];

  const uniquePool: Track[] = [];
  const dedupe = new Set<string>();
  for (const track of pool) {
    if (track?.id && !dedupe.has(track.id)) {
      dedupe.add(track.id);
      uniquePool.push(track);
    }
  }

  if (uniquePool.length === 0) return [];

  const desiredCount = Math.min(Math.max(targetCount, 1), uniquePool.length);
  const history = readHistory(catalogKey);
  const seen = new Set(history.seenIds);

  const liked = uniquePool.filter((track) => likedTrackIds.has(track.id));
  const unliked = uniquePool.filter((track) => !likedTrackIds.has(track.id));

  const unseenUnliked = unliked.filter((track) => !seen.has(track.id));
  const previouslySeenUnliked = unliked.filter((track) => seen.has(track.id));

  const baseSeed = dayIndex * 1000003 + stringHash(catalogKey);
  const shuffledLiked = shuffleWithSeed(liked, baseSeed + 11);
  const shuffledUnseen = shuffleWithSeed(unseenUnliked, baseSeed + 23);
  const shuffledOld = shuffleWithSeed(previouslySeenUnliked, baseSeed + 37);

  // Liked songs stay eligible every day. Fresh/unseen songs follow them.
  // Old catalogue songs are pushed to the back and only fill remaining space.
  const selected: Track[] = [];
  const addUntilFull = (tracks: Track[]) => {
    for (const track of tracks) {
      if (selected.length >= desiredCount) break;
      selected.push(track);
    }
  };

  addUntilFull(shuffledLiked);
  addUntilFull(shuffledUnseen);
  addUntilFull(shuffledOld);

  // Persist only unliked songs as seen. Liked songs never become rotation-excluded.
  const nextSeen = new Set(seen);
  for (const track of selected) {
    if (!likedTrackIds.has(track.id)) {
      nextSeen.add(track.id);
    }
  }

  // Keep only IDs still present in this catalogue to avoid unlimited stale history.
  const validIds = new Set(uniquePool.map((track) => track.id));
  const prunedSeen = Array.from(nextSeen).filter((id) => validIds.has(id));

  writeHistory(catalogKey, {
    seenIds: prunedSeen,
    lastDayIndex: dayIndex,
  });

  return selected;
}
