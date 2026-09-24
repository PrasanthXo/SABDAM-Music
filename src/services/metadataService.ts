import { 
  ensureValidCoverUrl, 
  generateGradientCoverPlaceholder, 
  SABDHAM_DEFAULT_ARTWORK, 
  DARK_GREY_VINYL_PLACEHOLDER,
  getYouTubeThumbnail 
} from '../utils/imageUtils';

export interface FreeTrackMetadata {
  title?: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  coverArtUrl?: string;
  releaseDate?: string;
  genre?: string;
  previewUrl?: string;
  source?: 'itunes' | 'musicbrainz' | 'sabdham';
}

const CACHE_KEY = 'sabdham_cover_art_cache_v2';

// In-memory cache map for instantaneous synchronous lookups
const inMemoryCoverCache = new Map<string, string>();

// Initialize in-memory cache from localStorage
try {
  const stored = localStorage.getItem(CACHE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    Object.entries(parsed).forEach(([k, v]) => {
      if (typeof v === 'string') {
        inMemoryCoverCache.set(k, v);
      }
    });
  }
} catch {
  // ignore storage access errors
}

function saveToCache(key: string, url: string) {
  if (!key || !url) return;
  inMemoryCoverCache.set(key, url);
  try {
    const obj: Record<string, string> = {};
    inMemoryCoverCache.forEach((v, k) => {
      obj[k] = v;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota/storage errors
  }
}

/**
 * Normalizes string for metadata lookups.
 * Strips bracketed descriptors, YouTube channel suffixes, punctuation, and extra whitespace.
 */
export function normalizeString(str?: string): string {
  if (!str) return '';
  return str
    .replace(/VEVO\b|- Topic\b|Official Channel\b/gi, '')
    .replace(/\(.*?\)|\[.*?\]/g, '') // remove brackets & parentheses e.g. (Official Video), [4K]
    .replace(/\b(official|video|audio|lyric|lyrical|hd|4k|full song|movie|soundtrack|remix|single|feat|ft|music video|visualizer|audio song)\b/gi, '')
    .replace(/[^\w\s]/gi, ' ') // replace punctuation/dashes with space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes track title specifically by extracting primary title before separators.
 */
export function normalizeTitle(title?: string): string {
  if (!title) return '';
  return normalizeString(title);
}

/**
 * Normalizes artist name specifically by stripping channel keywords.
 */
export function normalizeArtist(artist?: string): string {
  if (!artist) return '';
  return normalizeString(artist)
    .replace(/\b(topic|vevo|official|channel|records|music)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates a unique normalized cache key for a song title and artist pair.
 */
export function getTrackCacheKey(title?: string, artist?: string): string {
  const normTitle = normalizeTitle(title).toLowerCase();
  const normArtist = normalizeArtist(artist).toLowerCase();
  return `${normTitle}:::${normArtist}`;
}

/**
 * Primary Artwork Resolver — iTunes Search API with title/artist normalization
 * and multi-stage fallback queries for maximum accuracy.
 */
export async function fetchiTunesArtwork(
  title: string,
  artist?: string
): Promise<FreeTrackMetadata | null> {
  const cleanTitle = normalizeTitle(title) || normalizeString(title);
  const cleanArtist = normalizeArtist(artist);
  if (!cleanTitle) return null;

  // Multi-stage search query list:
  // 1. Normalized Title + Normalized Artist
  // 2. Normalized Title alone (if artist was noisy or long)
  // 3. Raw Title if normalized title was too short
  const queriesToTry: string[] = [];
  
  if (cleanTitle && cleanArtist) {
    queriesToTry.push(`${cleanTitle} ${cleanArtist}`);
  }
  if (cleanTitle) {
    queriesToTry.push(cleanTitle);
  }
  if (title && title !== cleanTitle && title.length > 2) {
    queriesToTry.push(normalizeString(title));
  }

  for (const query of queriesToTry) {
    try {
      // 1. Try backend proxy endpoint first
      const proxyUrl = `/api/music/free-metadata?q=${encodeURIComponent(query)}`;
      const response = await fetch(proxyUrl);

      if (response.ok) {
        const data = await response.json();
        if (data && (data.coverArtUrl || data.coverUrl)) {
          return {
            title: data.title || title,
            artist: data.artist || artist,
            album: data.album,
            coverUrl: data.coverArtUrl || data.coverUrl,
            coverArtUrl: data.coverArtUrl || data.coverUrl,
            source: 'itunes',
          };
        }
      }

      // 2. Direct iTunes API fallback endpoint
      const directUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`;
      const directRes = await fetch(directUrl);
      if (directRes.ok) {
        const directData = await directRes.json();
        if (directData.results && directData.results.length > 0) {
          const normTargetTitle = cleanTitle.toLowerCase();
          const normTargetArtist = cleanArtist.toLowerCase();

          // Find best matching item with valid artwork
          const match = directData.results.find((item: any) => {
            const itemTitle = normalizeString(item.trackName).toLowerCase();
            const itemArtist = normalizeString(item.artistName).toLowerCase();
            return (
              item.artworkUrl100 &&
              (itemTitle.includes(normTargetTitle) || normTargetTitle.includes(itemTitle)) &&
              (!normTargetArtist || itemArtist.includes(normTargetArtist) || normTargetArtist.includes(itemArtist))
            );
          }) || directData.results.find((item: any) => item.artworkUrl100) || directData.results[0];

          const rawArtwork = match.artworkUrl100 || match.artworkUrl60;
          if (rawArtwork) {
            const highResArtwork = rawArtwork.replace(/100x100bb|60x60bb/, '1000x1000bb');
            return {
              title: match.trackName,
              artist: match.artistName,
              album: match.collectionName,
              coverUrl: highResArtwork,
              coverArtUrl: highResArtwork,
              source: 'itunes',
            };
          }
        }
      }
    } catch (err) {
      console.warn('[MetadataService] iTunes query attempt failed:', err);
    }
  }

  return null;
}

/**
 * Secondary Fallback Artwork Resolver — MusicBrainz + Cover Art Archive
 */
export async function fetchMusicBrainzArtwork(
  title: string,
  artist?: string
): Promise<FreeTrackMetadata | null> {
  const cleanTitle = normalizeString(title);
  const cleanArtist = normalizeString(artist);
  if (!cleanTitle) return null;

  try {
    // Try backend MusicBrainz proxy first
    const proxyUrl = `/api/music/musicbrainz-metadata?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`;
    const response = await fetch(proxyUrl);

    if (response.ok) {
      const data = await response.json();
      if (data && (data.coverArtUrl || data.coverUrl)) {
        return {
          title: data.title || title,
          artist: data.artist || artist,
          album: data.album,
          coverUrl: data.coverArtUrl || data.coverUrl,
          coverArtUrl: data.coverArtUrl || data.coverUrl,
          source: 'musicbrainz',
        };
      }
    }

    // Direct MusicBrainz API query fallback
    const mbQuery = cleanArtist
      ? `recording:"${cleanTitle}" AND artist:"${cleanArtist}"`
      : `recording:"${cleanTitle}"`;

    const mbUrl = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(mbQuery)}&fmt=json&limit=3`;
    const mbRes = await fetch(mbUrl, {
      headers: {
        'User-Agent': 'SabdhamMusicApp/1.0.0 (contact@sabdham.app)',
        'Accept': 'application/json',
      },
    });

    if (!mbRes.ok) return null;

    const mbData = await mbRes.json();
    if (!mbData.recordings || mbData.recordings.length === 0) return null;

    for (const rec of mbData.recordings) {
      const releases = rec.releases || [];
      for (const rel of releases) {
        if (!rel.id) continue;
        try {
          const caaUrl = `https://coverartarchive.org/release/${rel.id}`;
          const caaRes = await fetch(caaUrl);
          if (caaRes.ok) {
            const caaData = await caaRes.json();
            if (caaData.images && caaData.images.length > 0) {
              const front = caaData.images.find((i: any) => i.front) || caaData.images[0];
              const artworkUrl = front.image || front.thumbnails?.large || front.thumbnails?.['500'];
              if (artworkUrl) {
                return {
                  title: rec.title,
                  artist: rec['artist-credit']?.[0]?.name || artist,
                  album: rel.title,
                  coverUrl: artworkUrl,
                  coverArtUrl: artworkUrl,
                  source: 'musicbrainz',
                };
              }
            }
          }
        } catch {
          // ignore individual CAA lookup error
        }
      }
    }
  } catch (err) {
    console.warn('[MetadataService] MusicBrainz lookup failed:', err);
  }

  return null;
}

/**
 * Main Asynchronous Cover Art Resolution Pipeline with strict fallback order:
 * 1. iTunes Search API (primary)
 * 2. MusicBrainz + Cover Art Archive (secondary)
 * 3. Sabdham Default Artwork or Gradient Silhouette (final fallback)
 */
export async function resolveTrackCoverArt(
  title: string,
  artist?: string
): Promise<string> {
  const cacheKey = getTrackCacheKey(title, artist);

  // 1. Check in-memory & localStorage cache
  if (inMemoryCoverCache.has(cacheKey)) {
    const cachedUrl = inMemoryCoverCache.get(cacheKey)!;
    if (cachedUrl && !cachedUrl.includes('ytimg.com')) return cachedUrl;
  }

  // 2. Primary Source: iTunes Search API
  const itunesResult = await fetchiTunesArtwork(title, artist);
  if (itunesResult?.coverArtUrl) {
    saveToCache(cacheKey, itunesResult.coverArtUrl);
    return itunesResult.coverArtUrl;
  }

  // 3. Secondary Source: MusicBrainz + Cover Art Archive
  const mbResult = await fetchMusicBrainzArtwork(title, artist);
  if (mbResult?.coverArtUrl) {
    saveToCache(cacheKey, mbResult.coverArtUrl);
    return mbResult.coverArtUrl;
  }

  // 4. Final Fallback: Sabdham Default Artwork or Gradient Silhouette (No YouTube Cover Art)
  const defaultArtwork = generateGradientCoverPlaceholder(title, artist) || SABDHAM_DEFAULT_ARTWORK;
  saveToCache(cacheKey, defaultArtwork);
  return defaultArtwork;
}

/**
 * Synchronously retrieves cover art for a track.
 * Returns valid existing artwork immediately, or checks cache, or generates gradient placeholder.
 * Does NOT block execution or throw errors.
 */
export function getOrGenerateTrackCover(
  coverUrl: string | undefined | null,
  title?: string,
  artist?: string,
  youtubeVideoId?: string | null
): string {
  const isYouTubeCover = coverUrl && (coverUrl.includes('i.ytimg.com') || coverUrl.includes('ytimg.com'));
  if (coverUrl && coverUrl.trim() && !isYouTubeCover && !coverUrl.includes('DARK_GREY_VINYL_PLACEHOLDER') && coverUrl !== SABDHAM_DEFAULT_ARTWORK) {
    return coverUrl.trim();
  }

  const cacheKey = getTrackCacheKey(title, artist);
  if (inMemoryCoverCache.has(cacheKey)) {
    const cached = inMemoryCoverCache.get(cacheKey)!;
    if (cached && !cached.includes('ytimg.com')) {
      return cached;
    }
  }

  return ensureValidCoverUrl(coverUrl, youtubeVideoId, title, artist) || SABDHAM_DEFAULT_ARTWORK;
}
