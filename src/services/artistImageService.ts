import { Artist } from '../types';

export const DEFAULT_ARTIST_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <defs>
    <linearGradient id="artistBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="50%" stop-color="#27272a"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="artistAccent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="500" height="500" fill="url(#artistBg)"/>
  <circle cx="250" cy="250" r="230" fill="none" stroke="url(#artistAccent)" stroke-width="3" stroke-opacity="0.4"/>
  <circle cx="250" cy="190" r="75" fill="#3f3f46"/>
  <path d="M 120 400 C 120 310, 380 310, 380 400 Z" fill="#3f3f46"/>
  <circle cx="250" cy="250" r="220" fill="none" stroke="#27272a" stroke-width="8"/>
</svg>
`)}`;

const ARTIST_IMAGE_CACHE_KEY = 'sabdham_artist_image_cache_v3';

// In-memory runtime cache keyed by artist.id and normalized artist.name
const inMemoryCache = new Map<string, string>();

function normalizeKey(str: string): string {
  return (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Load persisted artist image cache from localStorage into in-memory store.
 */
function loadCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ARTIST_IMAGE_CACHE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[ArtistImageService] Failed to load cache from localStorage:', err);
  }
  return {};
}

/**
 * Save artist image cache to localStorage.
 */
function saveCache(cacheObj: Record<string, string>) {
  try {
    localStorage.setItem(ARTIST_IMAGE_CACHE_KEY, JSON.stringify(cacheObj));
  } catch (err) {
    console.warn('[ArtistImageService] Failed to save cache to localStorage:', err);
  }
}

/**
 * Checks if an image URL is a valid artist profile photo.
 * Strictly rejects YouTube thumbnails (hq720.jpg), song/album covers, and Unsplash stock photos.
 */
export function isValidArtistProfileImage(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  if (!clean || clean === 'null' || clean === 'undefined') return false;

  // Filter out YouTube video covers / song covers
  if (
    clean.includes('i.ytimg.com') ||
    clean.includes('ytimg.com') ||
    clean.includes('hqdefault') ||
    clean.includes('hq720') ||
    clean.includes('maxresdefault')
  ) {
    return false;
  }

  // Filter out Unsplash stock photos
  if (clean.includes('images.unsplash.com')) {
    return false;
  }

  const isUrlFormat =
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('/') ||
    clean.startsWith('data:image/');

  return isUrlFormat;
}

/**
 * Get artist image from cache by artist.id or artist.name.
 */
export function getCachedArtistImage(artistId: string, artistName?: string): string | null {
  if (inMemoryCache.has(artistId)) {
    const cached = inMemoryCache.get(artistId)!;
    if (isValidArtistProfileImage(cached) || cached === DEFAULT_ARTIST_PLACEHOLDER) {
      return cached;
    }
  }

  if (artistName) {
    const nameKey = `name_${normalizeKey(artistName)}`;
    if (inMemoryCache.has(nameKey)) {
      const cached = inMemoryCache.get(nameKey)!;
      if (isValidArtistProfileImage(cached) || cached === DEFAULT_ARTIST_PLACEHOLDER) {
        return cached;
      }
    }
  }

  // Try loading from localStorage
  const diskCache = loadCache();
  if (diskCache[artistId]) {
    const val = diskCache[artistId];
    if (isValidArtistProfileImage(val) || val === DEFAULT_ARTIST_PLACEHOLDER) {
      inMemoryCache.set(artistId, val);
      return val;
    }
  }

  if (artistName) {
    const nameKey = `name_${normalizeKey(artistName)}`;
    if (diskCache[nameKey]) {
      const val = diskCache[nameKey];
      if (isValidArtistProfileImage(val) || val === DEFAULT_ARTIST_PLACEHOLDER) {
        inMemoryCache.set(nameKey, val);
        return val;
      }
    }
  }

  return null;
}

/**
 * Save artist image to cache keyed by artist.id and artist.name.
 */
export function cacheArtistImage(artistId: string, artistName: string, imageUrl: string) {
  if (!artistId || !imageUrl) return;

  inMemoryCache.set(artistId, imageUrl);
  if (artistName) {
    inMemoryCache.set(`name_${normalizeKey(artistName)}`, imageUrl);
  }

  const diskCache = loadCache();
  diskCache[artistId] = imageUrl;
  if (artistName) {
    diskCache[`name_${normalizeKey(artistName)}`] = imageUrl;
  }
  saveCache(diskCache);
}

/**
 * Primary method: Resolve artist profile photo following strict hierarchy:
 * 1. Cache lookup (by artist.id)
 * 2. Pre-verified artist profile URL (if valid and not song cover/stock photo)
 * 3. TheAudioDB API (matched by exact artist name)
 * 4. Wikidata / Wikimedia Commons / Wikipedia PageImages
 * 5. Default Artist Placeholder
 */
export async function resolveArtistImage(artist: { id: string; name: string; imageUrl?: string }): Promise<string> {
  const { id: artistId, name: artistName, imageUrl: currentImageUrl } = artist;

  // 1. Cache lookup by artist ID
  const cached = getCachedArtistImage(artistId, artistName);
  if (cached) {
    return cached;
  }

  // 2. Pre-verified valid profile image provided in catalog
  if (currentImageUrl && isValidArtistProfileImage(currentImageUrl)) {
    cacheArtistImage(artistId, artistName, currentImageUrl);
    return currentImageUrl;
  }

  // 3. Try Server API Proxy or TheAudioDB directly
  try {
    const proxyRes = await fetch(`/api/artist/image?name=${encodeURIComponent(artistName)}&id=${encodeURIComponent(artistId)}`);
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.imageUrl && (isValidArtistProfileImage(data.imageUrl) || data.imageUrl === DEFAULT_ARTIST_PLACEHOLDER)) {
        cacheArtistImage(artistId, artistName, data.imageUrl);
        return data.imageUrl;
      }
    }
  } catch (err) {
    console.warn(`[ArtistImageService] Server proxy call failed for ${artistName}:`, err);
  }

  // Fallback direct TheAudioDB query
  try {
    const audiodbRes = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artistName)}`);
    if (audiodbRes.ok) {
      const data = await audiodbRes.json();
      if (data.artists && Array.isArray(data.artists) && data.artists.length > 0) {
        const matched = data.artists.find(
          (a: any) => a.strArtist && a.strArtist.toLowerCase() === artistName.toLowerCase()
        ) || data.artists[0];

        const thumb = matched?.strArtistThumb || matched?.strArtistFanart;
        if (thumb && isValidArtistProfileImage(thumb)) {
          cacheArtistImage(artistId, artistName, thumb);
          return thumb;
        }
      }
    }
  } catch (err) {
    console.warn(`[ArtistImageService] TheAudioDB direct fetch failed for ${artistName}:`, err);
  }

  // 4. Wikidata / Wikimedia Commons / Wikipedia PageImages
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(artistName)}&prop=pageimages&pithumbsize=600&pilicense=any&format=json&origin=*`;
    const wikiRes = await fetch(wikiUrl);
    if (wikiRes.ok) {
      const data = await wikiRes.json();
      if (data.query && data.query.pages) {
        const pages = Object.values(data.query.pages) as any[];
        for (const page of pages) {
          if (page.thumbnail && page.thumbnail.source) {
            const wikiImg = page.thumbnail.source;
            if (isValidArtistProfileImage(wikiImg)) {
              cacheArtistImage(artistId, artistName, wikiImg);
              return wikiImg;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[ArtistImageService] Wikimedia fetch failed for ${artistName}:`, err);
  }

  // 5. Default Artist Placeholder
  cacheArtistImage(artistId, artistName, DEFAULT_ARTIST_PLACEHOLDER);
  return DEFAULT_ARTIST_PLACEHOLDER;
}
