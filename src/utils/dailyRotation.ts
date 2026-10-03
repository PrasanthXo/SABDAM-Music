import { Track } from '../types';

const STORAGE_PREFIX = 'sabdham.catalog.rotation.v3';

type CatalogHistory = {
  seenIds: string[];
  todayIds: string[];
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
    return { seenIds: [], todayIds: [], lastDayIndex: -1 };
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}.${catalogKey}`);
    if (!raw) return { seenIds: [], todayIds: [], lastDayIndex: -1 };

    const parsed = JSON.parse(raw) as Partial<CatalogHistory>;
    return {
      seenIds: Array.isArray(parsed.seenIds)
        ? parsed.seenIds.filter((id): id is string => typeof id === 'string')
        : [],
      todayIds: Array.isArray(parsed.todayIds)
        ? parsed.todayIds.filter((id): id is string => typeof id === 'string')
        : [],
      lastDayIndex:
        typeof parsed.lastDayIndex === 'number' ? parsed.lastDayIndex : -1,
    };
  } catch {
    return { seenIds: [], todayIds: [], lastDayIndex: -1 };
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
 * - Previously shown unliked songs do not return while unseen songs remain.
 * - A new cycle starts only after every unliked song in that catalogue has been seen.
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
  const byId = new Map(uniquePool.map((track) => [track.id, track] as const));

  // Same local day = same catalogue window, even after refresh/re-render.
  if (history.lastDayIndex === dayIndex && history.todayIds.length > 0) {
    const sameDay = history.todayIds
      .map((id) => byId.get(id))
      .filter((track): track is Track => track != null);

    if (sameDay.length > 0) {
      return sameDay.slice(0, desiredCount);
    }
  }

  const liked = uniquePool.filter((track) => likedTrackIds.has(track.id));
  const unliked = uniquePool.filter((track) => !likedTrackIds.has(track.id));
  const unseenUnliked = unliked.filter((track) => !seen.has(track.id));

  // Never use previously seen tracks as same-cycle filler.
  // Reset only after every unliked track in the catalogue has been shown.
  const cycleReset = unliked.length > 0 && unseenUnliked.length === 0;
  const eligibleUnliked = cycleReset ? unliked : unseenUnliked;

  const baseSeed = dayIndex * 1000003 + stringHash(catalogKey);
  const shuffledLiked = shuffleWithSeed(liked, baseSeed + 11);
  const shuffledEligible = shuffleWithSeed(eligibleUnliked, baseSeed + 23);

  const selected: Track[] = [];
  const addUntilFull = (tracks: Track[]) => {
    for (const track of tracks) {
      if (selected.length >= desiredCount) break;
      selected.push(track);
    }
  };

  addUntilFull(shuffledLiked);
  addUntilFull(shuffledEligible);

  const nextSeen = cycleReset ? new Set<string>() : new Set(seen);
  for (const track of selected) {
    if (!likedTrackIds.has(track.id)) {
      nextSeen.add(track.id);
    }
  }

  const validIds = new Set(uniquePool.map((track) => track.id));
  const prunedSeen = Array.from(nextSeen).filter((id) => validIds.has(id));

  writeHistory(catalogKey, {
    seenIds: prunedSeen,
    todayIds: selected.map((track) => track.id),
    lastDayIndex: dayIndex,
  });

  return selected;
}
