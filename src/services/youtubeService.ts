import { Track, Language } from '../types';

export interface YouTubeSearchResult {
  tracks: Track[];
  error?: string;
}

export async function searchYouTubeSongs(
  query: string,
  language: Language = 'all',
  maxResults: number = 20
): Promise<Track[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      language,
      maxResults: maxResults.toString(),
    });

    const res = await fetch(`/api/youtube/search?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('YouTube search returned error:', err);
      const tracks: Track[] = [];
      (tracks as any).warning = 'YouTube API error';
      (tracks as any).errorType = 'api_error';
      return tracks;
    }

    const data = await res.json();
    const tracks: Track[] = data.tracks || [];
    if (data.warning) {
      (tracks as any).warning = data.warning;
    }
    if (data.errorType) {
      (tracks as any).errorType = data.errorType;
    }
    return tracks;
  } catch (err) {
    console.error('Failed to query YouTube API:', err);
    return [];
  }
}

export async function getYouTubeTrendingSongs(language: Language = 'all'): Promise<Track[]> {
  try {
    const res = await fetch(`/api/youtube/trending?language=${encodeURIComponent(language)}`);
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    const tracks: Track[] = data.tracks || [];
    if (data.warning) {
      (tracks as any).warning = data.warning;
    }
    if (data.errorType) {
      (tracks as any).errorType = data.errorType;
    }
    return tracks;
  } catch (err) {
    console.error('Failed to get YouTube trending songs:', err);
    return [];
  }
}

export async function checkYouTubeApiStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/youtube/status');
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.configured;
  } catch {
    return false;
  }
}
