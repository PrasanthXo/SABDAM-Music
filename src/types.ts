export type Language = 'tamil' | 'sinhala' | 'english' | 'hindi' | 'all' | 'recent' | '2026';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarColor?: string;
  avatarUrl?: string;
  provider?: 'email' | 'google' | 'otp';
  bio?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserSettings {
  audioQuality: 'high' | 'medium' | 'low';
  crossfade: boolean;
  equalizerPreset: string;
  offlineMode: boolean;
}

export interface UserData {
  likedTrackIds: string[];
  recentlyPlayed: Track[];
  customPlaylists: Playlist[];
  customSongs: Track[];
  settings?: UserSettings;
}

export interface Track {
  id: string;
  audio_source_id: string; // Unique audio stream identifier (e.g. YouTube stream ID / media URL token)
  title: string;
  artist: string;
  album?: string;
  movie?: string; // Associated movie / motion picture soundtrack title
  singers?: string;
  musicDirector?: string;
  actors?: string;
  duration: number; // in seconds
  durationFormatted: string; // e.g. "3:45"
  coverUrl: string;
  coverArtUrl?: string; // High-resolution cover artwork URL (iTunes -> MusicBrainz -> Sabdham fallback)
  audioUrl: string;
  language: 'tamil' | 'sinhala' | 'english' | 'hindi' | string;
  genre?: string;
  year?: number;
  releaseDate?: string; // Release date ISO e.g. "2026-08-15"
  popularityScore?: number; // 0 - 100 popularity metric
  viewCount?: number; // YouTube / streaming view count
  streamCount?: number; // Total stream listens count
  isTrendingNow?: boolean; // Currently viral or trending hit single
  trendingGrowthRate?: number; // Recent growth / velocity multiplier
  lyrics?: string;
  youtubeVideoId?: string;
  source?: 'catalog' | 'youtube' | 'musicbrainz' | 'user';
  addedByUserId?: string;
}

export interface Artist {
  id: string;
  name: string;
  language: 'tamil' | 'sinhala' | 'english';
  imageUrl: string;
  monthlyListeners: string;
  bio: string;
}

export interface Playlist {
  id: string;
  title: string;
  name?: string;
  description: string;
  coverUrl: string;
  trackIds: string[];
  isCustom?: boolean;
  createdAt?: string;
  userId?: string;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  queue: Track[];
  queueIndex: number;
  isLoading: boolean;
}

export type NavTab =
  | 'home'
  | 'search'
  | 'explore'
  | 'library'
  | 'profile'
  | 'my-songs'
  | 'my-playlists'
  | 'playlists'
  | 'favorites'
  | 'recently-played'
  | 'recent'
  | 'settings'
  | 'privacy'
  | 'delete-account';

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: any) => void;
            error_callback?: (error: any) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

