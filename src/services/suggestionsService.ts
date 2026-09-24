import { Track, Artist } from '../types';
import { ALL_TRACKS, ARTISTS } from '../data/musicCatalog';
import { computeTrackSearchScore, trackMatchesQuery, normalizeSearchText, phoneticReduction } from '../utils/searchUtils';

export interface SearchSuggestionArtist {
  name: string;
  trackCount: number;
  avatarUrl?: string;
  genre?: string;
  language?: string;
  artistObj?: Artist;
}

export interface SearchSuggestionMovie {
  name: string;
  songCount: number;
  language?: string;
  coverUrl?: string;
}

export interface SearchSuggestionsResult {
  query: string;
  suggestions: string[];
  tracks: Track[];
  artists: SearchSuggestionArtist[];
  movies: SearchSuggestionMovie[];
}

// In-memory cache for fast repeat keystrokes
const suggestionsCache = new Map<string, SearchSuggestionsResult>();

/**
 * Filter to verify that a suggestion string is strictly song-related.
 */
export function isSongRelatedSuggestion(suggestion: string): boolean {
  if (!suggestion || !suggestion.trim()) return false;
  const lower = suggestion.toLowerCase().trim();

  // Filter out non-song video/movie noise
  const nonSongKeywords = [
    'trailer', 'teaser', 'full movie', 'movie review', 'interview', 'scene', 'scenes',
    'comedy', 'box office', 'status', 'reaction', 'vlog', 'gameplay', 'live stream',
    'press meet', 'speech', 'leaked', 'episode', 'cast', 'public review', 'unboxing',
    'dialogue', 'action scene', 'fight scene', 'press conference', 'public response'
  ];

  if (nonSongKeywords.some((kw) => lower.includes(kw))) {
    return false;
  }

  return true;
}

/**
 * Get instant client-side song-related suggestions from curated catalog (0ms latency).
 */
export function getLocalSuggestions(query: string): SearchSuggestionsResult {
  const q = query.trim();
  const normQ = normalizeSearchText(q);
  const phonQ = phoneticReduction(q);

  // Helper to extract unique movies matching query
  const seenMovies = new Set<string>();
  const matchingMovies: SearchSuggestionMovie[] = [];
  for (const t of ALL_TRACKS) {
    const movieName = t.movie || t.album;
    if (movieName && movieName !== 'Single' && !seenMovies.has(movieName.toLowerCase())) {
      const normM = normalizeSearchText(movieName);
      const phonM = phoneticReduction(movieName);
      if (!normQ || normM.includes(normQ) || normQ.includes(normM) || phonM.includes(phonQ)) {
        seenMovies.add(movieName.toLowerCase());
        const count = ALL_TRACKS.filter((x) => (x.movie || x.album)?.toLowerCase() === movieName.toLowerCase()).length;
        matchingMovies.push({
          name: movieName,
          songCount: count,
          language: t.language,
          coverUrl: t.coverUrl,
        });
        if (matchingMovies.length >= 4) break;
      }
    }
  }

  if (!q) {
    const popularSongSearches = [
      'Manja Balloon (Mutta Kalakki)',
      'Kaavaalaa (Jailer Song)',
      'Hukum (Jailer Song)',
      'Chuttamalle (Devara Song)',
      'Katchi Sera',
      'Aasa Kooda',
      'Golden Sparrow',
      'Manike Mage Hithe',
      'Tauba Tauba',
      'Rowdy Baby',
      'Vaathi Coming',
      'Espresso',
    ];

    const sampleTracks = ALL_TRACKS.slice(0, 4);
    const sampleArtists: SearchSuggestionArtist[] = ARTISTS.slice(0, 4).map((a) => ({
      name: a.name,
      trackCount: ALL_TRACKS.filter((t) => t.artist.toLowerCase().includes(a.name.toLowerCase())).length || 3,
      avatarUrl: a.imageUrl,
      genre: `${a.language} • ${a.monthlyListeners}`,
      language: a.language,
      artistObj: a,
    }));

    return {
      query: '',
      suggestions: popularSongSearches,
      tracks: sampleTracks,
      artists: sampleArtists,
      movies: matchingMovies,
    };
  }

  // Matching track titles, artists, & movies
  const matchingTracks = ALL_TRACKS.filter((t) => trackMatchesQuery(t, q))
    .sort((a, b) => computeTrackSearchScore(b, q) - computeTrackSearchScore(a, q))
    .slice(0, 8);

  // If matching tracks have movies, add them to matchingMovies
  for (const t of matchingTracks) {
    const movieName = t.movie || (t.album && t.album.toLowerCase() !== 'single' ? t.album : undefined);
    if (movieName && !seenMovies.has(movieName.toLowerCase())) {
      seenMovies.add(movieName.toLowerCase());
      const count = ALL_TRACKS.filter((x) => (x.movie || x.album)?.toLowerCase() === movieName.toLowerCase()).length;
      matchingMovies.push({
        name: movieName,
        songCount: count,
        language: t.language,
        coverUrl: t.coverUrl,
      });
      if (matchingMovies.length >= 4) break;
    }
  }

  // Matching artists
  const matchingArtists: SearchSuggestionArtist[] = ARTISTS.filter((a) => {
    const normA = normalizeSearchText(a.name);
    const phonA = phoneticReduction(a.name);
    const normB = normalizeSearchText(a.bio || '');
    return normA.includes(normQ) || normQ.includes(normA) || phonA.includes(phonQ) || normB.includes(normQ);
  }).slice(0, 3).map((a) => ({
    name: a.name,
    trackCount: ALL_TRACKS.filter((t) => t.artist.toLowerCase().includes(a.name.toLowerCase())).length || 3,
    avatarUrl: a.imageUrl,
    genre: `${a.language} • ${a.monthlyListeners}`,
    language: a.language,
    artistObj: a,
  }));

  // Build text suggestion phrases STRICTLY SONG RELATED
  const suggestionSet = new Set<string>();

  // 1. Exact matching track titles and title variations
  for (const t of matchingTracks) {
    suggestionSet.add(t.title);

    // If title has parentheses (e.g. "Mutta Kalakki (Manja Balloon)"), add parenthesized song name too
    const parenMatch = t.title.match(/\((.*?)\)/);
    if (parenMatch && parenMatch[1]) {
      const parenthesized = parenMatch[1].trim();
      if (parenthesized.length > 2) {
        suggestionSet.add(parenthesized);
      }
    }

    if (t.movie && t.movie !== 'Single') {
      suggestionSet.add(`${t.title} (${t.movie})`);
    }

    if (suggestionSet.size < 6) {
      suggestionSet.add(`${t.title} - ${t.artist}`);
    }
  }

  // 2. If query matches a movie, add song titles for that movie
  for (const m of matchingMovies) {
    suggestionSet.add(`${m.name} Movie Songs`);
    const movieTracks = ALL_TRACKS.filter((x) => (x.movie || x.album)?.toLowerCase() === m.name.toLowerCase());
    for (const mt of movieTracks) {
      suggestionSet.add(mt.title);
    }
  }

  // 3. If query matches an artist, add song titles by that artist (not bare artist name)
  for (const a of matchingArtists) {
    const artistTracks = ALL_TRACKS.filter((t) => t.artist.toLowerCase().includes(a.name.toLowerCase()));
    for (const at of artistTracks) {
      suggestionSet.add(at.title);
      if (suggestionSet.size < 8) {
        suggestionSet.add(`${at.title} - ${a.name}`);
      }
    }
  }

  // Filter out any non-song strings
  const songOnlySuggestions = Array.from(suggestionSet)
    .filter(isSongRelatedSuggestion)
    .slice(0, 8);

  // Guarantee at least 5 suggestions are returned when typing
  const finalSuggestions = [...songOnlySuggestions];
  if (finalSuggestions.length < 5 && q.length > 0) {
    const allWords = new Set<string>();
    for (const t of ALL_TRACKS) {
      if (t.title) allWords.add(t.title);
      if (t.artist) allWords.add(t.artist);
      if (t.movie && t.movie !== 'Single') allWords.add(t.movie);
      
      const parts = `${t.title} ${t.artist} ${t.movie || ''}`
        .split(/[\s(),\-:._+]+/g)
        .map(w => w.trim())
        .filter(w => w.length > 2);
      for (const p of parts) {
        allWords.add(p);
      }
    }
    const wordList = Array.from(allWords);
    
    // Prefix matches
    for (const w of wordList) {
      if (finalSuggestions.length >= 5) break;
      if (w.toLowerCase().startsWith(normQ) && !finalSuggestions.some(s => s.toLowerCase() === w.toLowerCase())) {
        finalSuggestions.push(w);
      }
    }
    // Substring matches
    for (const w of wordList) {
      if (finalSuggestions.length >= 5) break;
      if (w.toLowerCase().includes(normQ) && !finalSuggestions.some(s => s.toLowerCase() === w.toLowerCase())) {
        finalSuggestions.push(w);
      }
    }
    // Default popular
    const defaults = ['Manja Balloon', 'Kaavaalaa', 'Hukum', 'Chuttamalle', 'Katchi Sera'];
    for (const d of defaults) {
      if (finalSuggestions.length >= 5) break;
      if (!finalSuggestions.some(s => s.toLowerCase() === d.toLowerCase())) {
        finalSuggestions.push(d);
      }
    }
  }

  return {
    query,
    suggestions: finalSuggestions,
    tracks: matchingTracks,
    artists: matchingArtists,
    movies: matchingMovies,
  };
}

/**
 * Fetch search suggestions combining local catalog and real-time backend autocomplete.
 */
export async function fetchSearchSuggestions(query: string): Promise<SearchSuggestionsResult> {
  const trimmed = query.trim();
  const cacheKey = trimmed.toLowerCase();

  // Check cache
  if (suggestionsCache.has(cacheKey)) {
    return suggestionsCache.get(cacheKey)!;
  }

  // Start with instant local suggestions
  const local = getLocalSuggestions(trimmed);

  try {
    const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(trimmed)}`, {
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      const serverSuggestions: string[] = Array.isArray(data.suggestions) ? data.suggestions : [];
      const serverTracks: Track[] = Array.isArray(data.tracks) ? data.tracks : [];

      // Combine suggestion strings deduplicating case-insensitively and filtering strictly song-related
      const combinedSuggestions = [...local.suggestions];
      const lowerSet = new Set(combinedSuggestions.map((s) => s.toLowerCase()));

      for (const s of serverSuggestions) {
        if (isSongRelatedSuggestion(s) && !lowerSet.has(s.toLowerCase())) {
          combinedSuggestions.push(s);
          lowerSet.add(s.toLowerCase());
        }
      }

      // Merge tracks preferring local tracks with full metadata
      const trackIdSet = new Set(local.tracks.map((t) => t.id));
      const combinedTracks = [...local.tracks];

      for (const st of serverTracks) {
        if (!trackIdSet.has(st.id) && combinedTracks.length < 6) {
          combinedTracks.push(st);
          trackIdSet.add(st.id);
        }
      }

      const result: SearchSuggestionsResult = {
        query: trimmed,
        suggestions: combinedSuggestions.slice(0, 8),
        tracks: combinedTracks,
        artists: local.artists,
        movies: local.movies,
      };

      suggestionsCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    // Network or timeout failure: return local suggestions gracefully
  }

  suggestionsCache.set(cacheKey, local);
  return local;
}

