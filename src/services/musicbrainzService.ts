import { Track } from '../types';

export interface MusicBrainzSearchResponse {
  tracks: Track[];
  source: 'musicbrainz';
  total: number;
  query: string;
}

export interface ResolvedYouTubeVideo {
  youtubeVideoId: string;
  audioUrl: string;
  title: string;
  artist?: string;
  duration?: number;
  durationFormatted?: string;
}

/**
 * Search the global MusicBrainz music database for song titles, artists, and release artwork.
 */
export async function searchMusicBrainz(
  query: string,
  limit: number = 20,
  signal?: AbortSignal
): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const params = new URLSearchParams({
      q: trimmed,
      limit: limit.toString(),
    });

    const res = await fetch(`/api/musicbrainz/search?${params.toString()}`, {
      signal,
    });
    if (!res.ok) {
      return [];
    }

    const data: MusicBrainzSearchResponse = await res.json();
    return data.tracks || [];
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      // User typed next character or component unmounted; cleanly ignored
      return [];
    }
    return [];
  }
}

/**
 * Dynamically resolves a song (Title + Artist) from MusicBrainz into an active, full-length YouTube video stream.
 */
export async function resolveYouTubeTrack(title: string, artist: string): Promise<ResolvedYouTubeVideo | null> {
  if (!title) return null;

  try {
    const params = new URLSearchParams({
      title: title.trim(),
      artist: (artist || '').trim(),
    });

    const res = await fetch(`/api/youtube/resolve-track?${params.toString()}`);
    if (!res.ok) {
      console.warn('[MusicBrainz -> YouTube] Resolution API failed:', res.status);
      return null;
    }

    const data = await res.json();
    if (data.youtubeVideoId) {
      return {
        youtubeVideoId: data.youtubeVideoId,
        audioUrl: data.audioUrl || `yt:${data.youtubeVideoId}`,
        title: data.title || title,
        artist: data.artist || artist,
        duration: data.duration,
        durationFormatted: data.durationFormatted,
      };
    }
    return null;
  } catch (err) {
    console.error('[MusicBrainz -> YouTube] Error resolving track to YouTube video:', err);
    return null;
  }
}
