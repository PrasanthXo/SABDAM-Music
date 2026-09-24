import { playerService } from '../services/playerService';
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Track, Playlist, RepeatMode, Language } from '../types';
import { useAuth } from './AuthContext';
import { saveUserDataCookie, getCookieConsent } from '../utils/cookieUtils';
import {
  ALL_TRACKS,
  TRACK_CATALOG_MAP,
  getTrackById,
  resolveStrictTrackMetadata,
  isAuthenticYouTubeVideoId,
} from '../data/musicCatalog';
import { ensureValidCoverUrl } from '../utils/imageUtils';
import {
  buildMatchingGenreLanguageQueue,
  appendMatchingGenreLanguageTracks,
  isSongAlreadyInQueue,
  recordTrackKeys,
  normalizeSongTitle,
} from '../utils/queueMatching';

interface MusicContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  queue: Track[];
  queueIndex: number;
  isLoading: boolean;
  likedTrackIds: Set<string>;
  recentlyPlayed: Track[];
  customPlaylists: Playlist[];
  customSongs: Track[];
  isFullPlayerOpen: boolean;
  isYouTubeReady: boolean;
  crossfade: number;
  gaplessPlayback: boolean;
  notificationsEnabled: boolean;
  notificationPermission: NotificationPermission | 'unsupported';
  requestNotificationPermission: () => Promise<boolean>;
  toggleNotifications: () => Promise<void>;
  setCrossfade: (seconds: number) => void;
  toggleGaplessPlayback: () => void;
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (seconds: number) => void;
  setVolumeLevel: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  toggleLike: (trackOrId: string | Track) => void;
  createCustomPlaylist: (name: string, description?: string) => Playlist;
  deleteCustomPlaylist: (playlistId: string) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  addCustomSong: (song: Omit<Track, 'id'>) => Track;
  deleteCustomSong: (songId: string) => void;
  clearRecentlyPlayed: () => void;
  openFullPlayer: () => void;
  closeFullPlayer: () => void;
  addToQueue: (track: Track) => void;
  setQueue: (newQueue: Track[]) => void;
  setQueueIndex: (index: number) => void;
  addMatchingSongsToQueue: (count?: number) => void;
  playbackQuality: 'auto' | 'low' | 'medium' | 'high';
  setPlaybackQuality: (q: 'auto' | 'low' | 'medium' | 'high') => void;
  autoplay: boolean;
  setAutoplay: (val: boolean) => void;
  volumeNormalization: boolean;
  setVolumeNormalization: (val: boolean) => void;
  wifiOnlyDownloads: boolean;
  setWifiOnlyDownloads: (val: boolean) => void;
  useMobileData: boolean;
  setUseMobileData: (val: boolean) => void;
  eqEnabled: boolean;
  setEqEnabled: (val: boolean) => void;
  eqPreset: string;
  setEqPreset: (preset: string) => void;
  eqBands: number[];
  setEqBands: (bands: number[]) => void;
  theme: 'system' | 'light' | 'dark';
  setTheme: (t: 'system' | 'light' | 'dark') => void;
  clearCache: () => void;
  clearSearchHistory: () => void;
  clearPersonalData: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

// Explicit serialization helpers: only encode pure primitives (strings, numbers, booleans)
function serializeLikedIds(likedSet: Set<string>): string {
  try {
    const list: string[] = [];
    likedSet.forEach((id) => {
      if (typeof id === 'string' && id.trim().length > 0) {
        list.push(id.trim());
      }
    });
    return JSON.stringify(list);
  } catch (e) {
    return '[]';
  }
}

function serializeRecents(tracks: Track[]): string {
  try {
    if (!Array.isArray(tracks)) return '[]';
    const cleanList = tracks
      .map((t) => {
        if (!t || typeof t !== 'object' || !t.id) return null;
        const audioSourceId = String(
          t.audio_source_id ||
          t.youtubeVideoId ||
          (typeof t.audioUrl === 'string' && t.audioUrl.startsWith('yt:') ? t.audioUrl.replace('yt:', '') : '') ||
          t.id
        );
        const ytId = t.youtubeVideoId || audioSourceId;
        return {
          id: String(t.id),
          audio_source_id: audioSourceId,
          title: String(t.title || 'Untitled'),
          artist: String(t.artist || 'Unknown Artist'),
          album: t.album ? String(t.album) : 'Single',
          duration: typeof t.duration === 'number' ? t.duration : 180,
          durationFormatted: String(t.durationFormatted || '3:00'),
          coverUrl: ensureValidCoverUrl(t.coverUrl, ytId),
          audioUrl: String(t.audioUrl || ''),
          language: (['tamil', 'sinhala', 'english'].includes(String(t.language)) ? t.language : 'all') as Language,
          genre: t.genre ? String(t.genre) : undefined,
          year: typeof t.year === 'number' ? t.year : undefined,
          lyrics: t.lyrics ? String(t.lyrics) : undefined,
          youtubeVideoId: t.youtubeVideoId ? String(t.youtubeVideoId) : undefined,
          source: t.source === 'youtube' ? 'youtube' : 'curated',
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);

    return JSON.stringify(cleanList);
  } catch (e) {
    return '[]';
  }
}

function serializePlaylists(playlists: Playlist[]): string {
  try {
    if (!Array.isArray(playlists)) return '[]';
    const cleanList = playlists
      .map((p) => {
        if (!p || typeof p !== 'object' || !p.id) return null;
        return {
          id: String(p.id),
          name: String(p.name || p.title || 'Playlist'),
          title: String(p.title || p.name || 'Playlist'),
          description: typeof p.description === 'string' ? p.description : '',
          coverUrl: typeof p.coverUrl === 'string' ? p.coverUrl : '',
          trackIds: Array.isArray(p.trackIds)
            ? p.trackIds.filter((tid): tid is string => typeof tid === 'string' && tid.length > 0)
            : [],
          createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
          isCustom: true,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return JSON.stringify(cleanList);
  } catch (e) {
    return '[]';
  }
}

function sanitizeTrack(t: any): Track | null {
  if (!t || typeof t !== 'object' || !t.id) return null;
  const audioSourceId = String(
    t.audio_source_id ||
    t.youtubeVideoId ||
    (typeof t.audioUrl === 'string' && t.audioUrl.startsWith('yt:') ? t.audioUrl.replace('yt:', '') : '') ||
    t.id
  );
  const ytId = t.youtubeVideoId || audioSourceId;
  const cover = ensureValidCoverUrl(t.coverUrl, ytId);

  return {
    id: String(t.id),
    audio_source_id: audioSourceId,
    title: String(t.title || 'Untitled'),
    artist: String(t.artist || 'Unknown Artist'),
    album: t.album ? String(t.album) : 'Single',
    duration: typeof t.duration === 'number' && !isNaN(t.duration) ? t.duration : 180,
    durationFormatted: String(t.durationFormatted || '3:00'),
    coverUrl: cover,
    audioUrl: String(t.audioUrl || ''),
    language: t.language === 'tamil' || t.language === 'sinhala' ? t.language : 'english',
    genre: t.genre ? String(t.genre) : undefined,
    year: typeof t.year === 'number' ? t.year : undefined,
    lyrics: t.lyrics ? String(t.lyrics) : undefined,
    youtubeVideoId: t.youtubeVideoId ? String(t.youtubeVideoId) : (audioSourceId ? audioSourceId : undefined),
    source: t.source,
  };
}

function sanitizePlaylist(pl: any): Playlist | null {
  if (!pl || typeof pl !== 'object' || !pl.id) return null;
  const id = String(pl.id);
  const name = String(pl.name || pl.title || 'Playlist');
  const title = String(pl.title || name);
  const description = typeof pl.description === 'string' ? pl.description : '';
  const coverUrl = typeof pl.coverUrl === 'string' ? pl.coverUrl : '';
  const trackIds = Array.isArray(pl.trackIds)
    ? pl.trackIds.filter((t: any) => typeof t === 'string')
    : [];
  const createdAt = typeof pl.createdAt === 'string' ? pl.createdAt : new Date().toISOString();
  const isCustom = Boolean(pl.isCustom);

  return {
    id,
    name,
    title,
    description,
    coverUrl,
    trackIds,
    createdAt,
    isCustom,
  };
}

// Helper to determine if a track is a YouTube stream vs direct audio file
function isYouTubeTrack(track?: Track | null): boolean {
  if (!track) return false;
  if (track.audioUrl && track.audioUrl.startsWith('http') && !track.audioUrl.includes('youtube.com') && !track.audioUrl.includes('youtu.be') && !track.audioUrl.includes('/api/youtube/stream')) {
    return false;
  }
  if (track.source === 'youtube') return true;
  if (track.youtubeVideoId && track.youtubeVideoId.length > 0) return true;
  if (track.audio_source_id && !track.audio_source_id.startsWith('catalog-') && !track.audio_source_id.startsWith('local-') && track.audio_source_id.length >= 8) return true;
  if (track.id && track.id.startsWith('yt-')) return true;
  if (track.audioUrl && (track.audioUrl.startsWith('yt:') || track.audioUrl.includes('/api/youtube/stream') || track.audioUrl.includes('/api/youtube/mp3') || track.audioUrl.includes('youtube.com') || track.audioUrl.includes('youtu.be'))) return true;
  return false;
}

function getYouTubeVideoId(track?: Track | null): string | null {
  if (!track) return null;
  if (isAuthenticYouTubeVideoId(track.youtubeVideoId)) {
    return track.youtubeVideoId!.replace(/^yt:/, '').replace(/^yt-/, '').trim();
  }
  if (track.audio_source_id && !track.audio_source_id.startsWith('catalog-') && !track.audio_source_id.startsWith('local-')) {
    if (isAuthenticYouTubeVideoId(track.audio_source_id)) return track.audio_source_id;
  }
  if (track.id && track.id.startsWith('yt-')) {
    const candidate = track.id.replace('yt-', '');
    if (isAuthenticYouTubeVideoId(candidate)) return candidate;
  }
  if (track.audioUrl) {
    if (track.audioUrl.startsWith('yt:')) {
      const candidate = track.audioUrl.replace('yt:', '');
      if (isAuthenticYouTubeVideoId(candidate)) return candidate;
    }
    const match = track.audioUrl.match(/[?&]id=([^&]+)/);
    if (match && isAuthenticYouTubeVideoId(match[1])) return match[1];
    const matchYt = track.audioUrl.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/);
    if (matchYt && matchYt[1] && isAuthenticYouTubeVideoId(matchYt[1])) return matchYt[1];
  }
  return null;
}

export const MusicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const userNamespace = user ? `user_${user.id}` : 'guest';

  // Force reset all settings to default OFF once for clean migration
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem('sabdham_defaults_v4_reset') !== 'true') {
        localStorage.setItem('sabdham_crossfade', '0');
        localStorage.setItem('sabdham_gapless', 'false');
        localStorage.setItem('sabdham_autoplay', 'false');
        localStorage.setItem('sabdham_volume_normalization', 'false');
        localStorage.setItem('sabdham_wifi_downloads', 'false');
        localStorage.setItem('sabdham_mobile_data', 'false');
        localStorage.setItem('sabdham_eq_enabled', 'false');
        localStorage.setItem('sabdham_notifications_enabled', 'false');
        localStorage.setItem('sabdham_defaults_v4_reset', 'true');
      }
    } catch {}
  }

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(180);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [queue, setQueue] = useState<Track[]>(ALL_TRACKS);
  const [queueIndex, setQueueIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // User-isolated state
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [customPlaylists, setCustomPlaylists] = useState<Playlist[]>([]);
  const [customSongs, setCustomSongs] = useState<Track[]>([]);

  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState<boolean>(false);
  const [isYouTubeReady, setIsYouTubeReady] = useState<boolean>(false);
  const [crossfade, setCrossfadeState] = useState<number>(() => {
    try {
      const val = localStorage.getItem('sabdham_crossfade');
      return val !== null ? parseInt(val, 10) : 0;
    } catch {
      return 0;
    }
  });

  const setCrossfade = useCallback((seconds: number) => {
    setCrossfadeState(seconds);
    try {
      localStorage.setItem('sabdham_crossfade', String(seconds));
    } catch {}
  }, []);

  const [gaplessPlayback, setGaplessPlaybackState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sabdham_gapless') === 'true';
    } catch {
      return false;
    }
  });

  const toggleGaplessPlayback = useCallback(() => {
    setGaplessPlaybackState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sabdham_gapless', String(next));
      } catch {}
      return next;
    });
  }, []);

  const [playbackQuality, setPlaybackQualityState] = useState<'auto' | 'low' | 'medium' | 'high'>(() => {
    try {
      return (localStorage.getItem('sabdham_quality') as any) || 'auto';
    } catch {
      return 'auto';
    }
  });

  const setPlaybackQuality = useCallback((q: 'auto' | 'low' | 'medium' | 'high') => {
    setPlaybackQualityState(q);
    try {
      localStorage.setItem('sabdham_quality', q);
    } catch {}
  }, []);

  const [autoplay, setAutoplayState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sabdham_autoplay') === 'true';
    } catch {
      return false;
    }
  });

  const setAutoplay = useCallback((val: boolean) => {
    setAutoplayState(val);
    try {
      localStorage.setItem('sabdham_autoplay', String(val));
    } catch {}
  }, []);

  const [volumeNormalization, setVolumeNormalizationState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sabdham_volume_normalization') === 'true';
    } catch {
      return false;
    }
  });

  const setVolumeNormalization = useCallback((val: boolean) => {
    setVolumeNormalizationState(val);
    try {
      localStorage.setItem('sabdham_volume_normalization', String(val));
    } catch {}
  }, []);

  const [wifiOnlyDownloads, setWifiOnlyDownloadsState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sabdham_wifi_downloads') === 'true';
    } catch {
      return false;
    }
  });

  const setWifiOnlyDownloads = useCallback((val: boolean) => {
    setWifiOnlyDownloadsState(val);
    try {
      localStorage.setItem('sabdham_wifi_downloads', String(val));
    } catch {}
  }, []);

  const [useMobileData, setUseMobileDataState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sabdham_mobile_data') === 'true';
    } catch {
      return false;
    }
  });

  const setUseMobileData = useCallback((val: boolean) => {
    setUseMobileDataState(val);
    try {
      localStorage.setItem('sabdham_mobile_data', String(val));
    } catch {}
  }, []);

  // Equalizer states (default OFF)
  const [eqEnabled, setEqEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sabdham_eq_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const setEqEnabled = useCallback((val: boolean) => {
    setEqEnabledState(val);
    try {
      localStorage.setItem('sabdham_eq_enabled', String(val));
    } catch {}
  }, []);

  const [eqPreset, setEqPresetState] = useState<string>(() => {
    try {
      return localStorage.getItem('sabdham_eq_preset') || 'Flat';
    } catch {
      return 'Flat';
    }
  });

  const [eqBands, setEqBandsState] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem('sabdham_eq_bands');
      return stored ? JSON.parse(stored) : [0, 0, 0, 0, 0];
    } catch {
      return [0, 0, 0, 0, 0];
    }
  });

  const setEqBands = useCallback((bands: number[]) => {
    setEqBandsState(bands);
    try {
      localStorage.setItem('sabdham_eq_bands', JSON.stringify(bands));
    } catch {}
  }, []);

  const setEqPreset = useCallback((preset: string) => {
    setEqPresetState(preset);
    try {
      localStorage.setItem('sabdham_eq_preset', preset);
    } catch {}

    const PRESET_BANDS: Record<string, number[]> = {
      'Flat': [0, 0, 0, 0, 0],
      'Bass Boost': [8, 6, 0, 1, 2],
      'Acoustic': [4, 2, 1, 3, 6],
      'Electronic': [6, 4, -1, 2, 5],
      'Rock': [5, 3, -1, 3, 5],
      'Pop': [-1, 2, 5, 3, -1],
    };
    if (PRESET_BANDS[preset]) {
      setEqBands(PRESET_BANDS[preset]);
    }
  }, [setEqBands]);

  const [theme, setThemeState] = useState<'system' | 'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('sabdham_theme') as any) || 'dark';
    } catch {
      return 'dark';
    }
  });

  const setTheme = useCallback((t: 'system' | 'light' | 'dark') => {
    setThemeState(t);
    try {
      localStorage.setItem('sabdham_theme', t);
    } catch {}
    if (typeof document !== 'undefined') {
      const isDark =
        t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const isDark =
        theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
    }
  }, [theme]);

  const clearCache = useCallback(() => {
    setRecentlyPlayed([]);
    try {
      localStorage.removeItem(`morning_music_${userNamespace}_recents`);
      localStorage.removeItem('sabdham_audio_cache');
    } catch {}
  }, [userNamespace]);

  const clearSearchHistory = useCallback(() => {
    try {
      localStorage.removeItem('sabdham_search_history');
      localStorage.removeItem('morning_music_search_history');
    } catch {}
  }, []);

  const clearPersonalData = useCallback(() => {
    setLikedTrackIds(new Set());
    setRecentlyPlayed([]);
    setCustomPlaylists([]);
    setCustomSongs([]);
    try {
      localStorage.removeItem(`morning_music_${userNamespace}_likes`);
      localStorage.removeItem(`morning_music_${userNamespace}_recents`);
      localStorage.removeItem(`morning_music_${userNamespace}_playlists`);
      localStorage.removeItem(`morning_music_${userNamespace}_custom_songs`);
    } catch {}
  }, [userNamespace]);

  // Notification State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sabdham_notifications_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === 'undefined') return false;
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('sabdham_notifications_enabled', 'true');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const toggleNotifications = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') {
      await requestNotificationPermission();
    } else {
      setNotificationsEnabled((prev) => {
        const next = !prev;
        localStorage.setItem('sabdham_notifications_enabled', String(next));
        return next;
      });
    }
  }, [requestNotificationPermission]);

  // Audio refs & background playback tracking
  // const audioRef = useRef<HTMLAudioElement | null>(null); // Replaced by playerService.activeAudio
  // const preloadedAudioRef = useRef<HTMLAudioElement | null>(null); // Replaced by playerService.preloadAudio
  const audioRef = { current: playerService.activeAudio };
  const preloadedAudioRef = { current: playerService.preloadAudio };
  const silentKeeperRef = useRef<HTMLAudioElement | null>(null);
  const isUserInitiatedPauseRef = useRef<boolean>(false);
  const currentPlaybackTypeRef = useRef<'audio' | 'youtube'>('audio');
  const ytPlayerRef = useRef<any>(null);
  const pendingTrackRef = useRef<Track | null>(null);
  const consecutiveErrorCountRef = useRef<number>(0);
  const trackFailedVideoIdsRef = useRef<Map<string, Set<string>>>(new Map());
  const trackRetryAttemptsRef = useRef<Map<string, number>>(new Map());
  const handleSongEndedRef = useRef<() => void>(() => {});
  const handlePlaybackErrorRef = useRef<(failedVideoId?: string) => void>(() => {});
  const prefetchNextTrackRef = useRef<() => void>(() => {});
  const playNextRef = useRef<() => void>(() => {});
  const playPreviousRef = useRef<() => void>(() => {});
  const togglePlayPauseRef = useRef<() => void>(() => {});
  const syncTimerRef = useRef<any>(null);
  const isInitialLoadRef = useRef<boolean>(true);
  const loadedNamespaceRef = useRef<string | null>(null);
  const isYouTubeReadyRef = useRef<boolean>(false);
  const volumeRef = useRef<number>(0.8);
  const currentTrackRef = useRef<Track | null>(null);
  const queueRef = useRef<Track[]>(ALL_TRACKS);
  const queueIndexRef = useRef<number>(0);
  const repeatModeRef = useRef<RepeatMode>('off');
  const isShuffledRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);

  const gaplessTriggeredRef = useRef<boolean>(false);

  // Settings refs for live audio engine processing
  const crossfadeRef = useRef<number>(0);
  const gaplessPlaybackRef = useRef<boolean>(false);
  const autoplayRef = useRef<boolean>(false);
  const volumeNormalizationRef = useRef<boolean>(false);
  const eqEnabledRef = useRef<boolean>(false);
  const eqPresetRef = useRef<string>('Flat');
  const eqBandsRef = useRef<number[]>([0, 0, 0, 0, 0]);

  // Keep refs synced with state
  useEffect(() => { crossfadeRef.current = crossfade; }, [crossfade]);
  useEffect(() => { gaplessPlaybackRef.current = gaplessPlayback; }, [gaplessPlayback]);
  useEffect(() => { autoplayRef.current = autoplay; }, [autoplay]);
  useEffect(() => { volumeNormalizationRef.current = volumeNormalization; }, [volumeNormalization]);
  useEffect(() => { eqEnabledRef.current = eqEnabled; }, [eqEnabled]);
  useEffect(() => { eqPresetRef.current = eqPreset; }, [eqPreset]);
  useEffect(() => { eqBandsRef.current = eqBands; }, [eqBands]);

  // Web Audio API DSP Nodes for EQ & Volume Normalization
  const audioCtxRef = useRef<AudioContext | null>(null);
  const eqFilterNodesRef = useRef<BiquadFilterNode[]>([]);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);

  const applyAudioDspSettings = useCallback(() => {
    if (!audioCtxRef.current) return;
    try {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }

      // 1. Equalizer Filter Gains
      if (eqFilterNodesRef.current.length === 5) {
        const bands = eqEnabledRef.current ? eqBandsRef.current : [0, 0, 0, 0, 0];
        bands.forEach((dB, i) => {
          if (eqFilterNodesRef.current[i]) {
            eqFilterNodesRef.current[i].gain.setTargetAtTime(dB, audioCtxRef.current!.currentTime, 0.05);
          }
        });
      }

      // 2. Volume Normalization Dynamics Compressor
      if (compressorNodeRef.current) {
        if (volumeNormalizationRef.current) {
          compressorNodeRef.current.threshold.setTargetAtTime(-24, audioCtxRef.current.currentTime, 0.05);
          compressorNodeRef.current.ratio.setTargetAtTime(12, audioCtxRef.current.currentTime, 0.05);
        } else {
          compressorNodeRef.current.threshold.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
          compressorNodeRef.current.ratio.setTargetAtTime(1, audioCtxRef.current.currentTime, 0.05);
        }
      }
    } catch (e) {
      console.warn('[Audio Engine] DSP apply caught:', e);
    }
  }, []);

  useEffect(() => {
    applyAudioDspSettings();
  }, [eqEnabled, eqBands, volumeNormalization, applyAudioDspSettings]);

  // Sync DSP and audio effects to native Android ExoPlayer bridge if running in Android app
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).AndroidBridge) {
      try {
        const bridge = (window as any).AndroidBridge;
        if (typeof bridge.setEqualizer === 'function') {
          bridge.setEqualizer(eqEnabled, eqPreset, JSON.stringify(eqBands));
        }
        if (typeof bridge.setVolumeNormalization === 'function') {
          bridge.setVolumeNormalization(volumeNormalization);
        }
        if (typeof bridge.setCrossfade === 'function') {
          bridge.setCrossfade(crossfade);
        }
      } catch (err) {
        console.warn('[AndroidBridge] Failed to sync audio settings:', err);
      }
    }
  }, [eqEnabled, eqPreset, eqBands, volumeNormalization, crossfade]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    isShuffledRef.current = isShuffled;
  }, [isShuffled]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    playerService.setCallbacks(
      () => {
        if (queueRef.current.length === 0) return null;
        const nextIndex = queueIndexRef.current + 1;
        if (nextIndex >= queueRef.current.length) return null;
        return queueRef.current[nextIndex];
      },
      () => {
        if (playNextRef.current) playNextRef.current();
      },
      () => {
        // Media session is kept in sync via active track state
      },
      async () => {
        if (playNextRef.current) await playNextRef.current();
      }
    );
  }, []); // Run once to setup callbacks

  // Initialize silent keeper audio element to retain OS background audio session
  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    try {
      // Programmatically generate a robust, standards-compliant 1-second silent WAV file
      // to keep mobile device hardware decoders and Safari awake in background
      const createSilentWavDataUri = () => {
        const numFrames = 8000; // 1 second @ 8kHz
        const numChannels = 1;
        const bytesPerSample = 1; // 8-bit unsigned
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = 8000 * blockAlign;
        const dataSize = numFrames * blockAlign;
        const chunkSize = 36 + dataSize;

        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        view.setUint32(0, 0x52494646, false); // "RIFF"
        view.setUint32(4, chunkSize, true);
        view.setUint32(8, 0x57415645, false); // "WAVE"
        view.setUint32(12, 0x666d7420, false); // "fmt "
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, 8000, true); // Sample rate
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 8, true); // 8-bit
        view.setUint32(36, 0x64617461, false); // "data"
        view.setUint32(40, dataSize, true);

        for (let i = 0; i < dataSize; i++) {
          view.setUint8(44 + i, 128); // 128 is the mid-point (silence) for 8-bit PCM
        }

        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return 'data:audio/wav;base64,' + btoa(binary);
      };

      const silentWav = createSilentWavDataUri();
      const keeper = new Audio(silentWav);
      keeper.loop = true;
      keeper.volume = 0.001; // inaudible but keeps hardware decoder awake
      keeper.setAttribute('playsinline', 'true');
      keeper.setAttribute('webkit-playsinline', 'true');
      keeper.preload = 'auto';
      silentKeeperRef.current = keeper;
    } catch (e) {
      console.warn('[Audio Engine] Silent keeper init caught:', e);
    }
    return () => {
      if (silentKeeperRef.current) {
        silentKeeperRef.current.pause();
        silentKeeperRef.current.removeAttribute('src');
      }
    };
  }, []);

  // Unified YouTube player initialization helper
  const initYT = useCallback(() => {
    if (typeof document === 'undefined') return;

    // Ensure YouTube player host container exists inside viewport for reliable background audio
    let container = document.getElementById('morning-music-yt-player-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'morning-music-yt-player-container';
      container.setAttribute('aria-hidden', 'true');
      Object.assign(container.style, {
        position: 'fixed',
        top: '0px',
        left: '0px',
        width: '200px',
        height: '200px',
        opacity: '0.001',
        pointerEvents: 'none',
        zIndex: '-999',
      });
      document.body.appendChild(container);
    }

    let iframeDiv = document.getElementById('morning-music-yt-player-iframe');
    if (!iframeDiv) {
      iframeDiv = document.createElement('div');
      iframeDiv.id = 'morning-music-yt-player-iframe';
      container.appendChild(iframeDiv);
    }

    // Check if player is already instantiated to avoid duplicate players
    if (ytPlayerRef.current) {
      return;
    }

    if (window.YT && window.YT.Player) {
      try {
        console.log('[YouTube Player] Instantiating new YT.Player...');
        ytPlayerRef.current = new window.YT.Player('morning-music-yt-player-iframe', {
          height: '200',
          width: '200',
          playerVars: {
            autoplay: 1,
            enablejsapi: 1,
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
          },
          events: {
            onReady: () => {
              console.log('[YouTube Player] Player onReady fired.');
              isYouTubeReadyRef.current = true;
              setIsYouTubeReady(true);
              if (pendingTrackRef.current) {
                const trackToPlay = pendingTrackRef.current;
                pendingTrackRef.current = null;
                const vidId = getYouTubeVideoId(trackToPlay);
                if (vidId && ytPlayerRef.current?.loadVideoById) {
                  try {
                    console.log('[YouTube Player] Playing pending track onReady:', trackToPlay.title, vidId);
                    currentPlaybackTypeRef.current = 'youtube';
                    ytPlayerRef.current.loadVideoById({ videoId: vidId, startSeconds: 0 });
                    ytPlayerRef.current.setVolume(isMutedRef.current ? 0 : volumeRef.current * 100);
                    ytPlayerRef.current.playVideo();
                    setIsPlaying(true);
                    isPlayingRef.current = true;
                    setIsLoading(false);
                    consecutiveErrorCountRef.current = 0;
                  } catch (err) {
                    console.warn('[YouTube Player] Failed to load video onReady:', err);
                  }
                }
              }
            },
            onStateChange: (event: any) => {
              // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
              if (event.data === 1) {
                currentPlaybackTypeRef.current = 'youtube';
                isUserInitiatedPauseRef.current = false;
                if (silentKeeperRef.current) {
                  silentKeeperRef.current.play().catch(() => {});
                }
                setIsPlaying(true);
                isPlayingRef.current = true;
                setIsLoading(false);
                consecutiveErrorCountRef.current = 0;
                const dur = ytPlayerRef.current?.getDuration();
                if (dur && dur > 0) setDuration(dur);
              } else if (event.data === 2) {
                if (isUserInitiatedPauseRef.current) {
                  if (silentKeeperRef.current) {
                    silentKeeperRef.current.pause();
                  }
                  setIsPlaying(false);
                  isPlayingRef.current = false;
                } else {
                  // Background/OS auto-pause! Do NOT pause silent keeper. Keep it playing
                  // to keep the overall audio context active and allow user control on lock screen.
                  if (silentKeeperRef.current && silentKeeperRef.current.paused) {
                    silentKeeperRef.current.play().catch(() => {});
                  }
                  // Keep isPlaying true to maintain lock screen control center activity.
                  // Try to immediately and safely re-trigger playback (supported by some browsers when silent stream is playing)
                  setTimeout(() => {
                    if (isPlayingRef.current && currentPlaybackTypeRef.current === 'youtube' && !isUserInitiatedPauseRef.current && ytPlayerRef.current) {
                      if (typeof ytPlayerRef.current.playVideo === 'function') {
                        try {
                          ytPlayerRef.current.playVideo();
                        } catch (e) {}
                      }
                    }
                  }, 500);
                }
              } else if (event.data === 3) {
                setIsLoading(true);
              } else if (event.data === 0) {
                isUserInitiatedPauseRef.current = false;
                if (silentKeeperRef.current) {
                  silentKeeperRef.current.pause();
                }
                setIsPlaying(false);
                isPlayingRef.current = false;
                handleSongEndedRef.current();
              }
            },
            onError: (err: any) => {
              const errCode = err?.data || err;
              console.warn('[YouTube Player] Error received from YouTube widget:', errCode);
              setIsLoading(false);
              const track = currentTrackRef.current;
              const vid = getYouTubeVideoId(track) || undefined;
              handlePlaybackErrorRef.current(vid);
            },
          },
        });
      } catch (e) {
        console.error('[YouTube Player] Failed to create YouTube player instance:', e);
      }
    }
  }, []);

  // Load isolated data whenever authenticated user changes
  useEffect(() => {
    let isMounted = true;
    isInitialLoadRef.current = true;
    loadedNamespaceRef.current = null;

    const loadData = async () => {
      // 1. Read local storage for this user namespace
      try {
        const savedLikes = localStorage.getItem(`morning_music_${userNamespace}_likes`);
        if (savedLikes) {
          const parsed = JSON.parse(savedLikes);
          if (Array.isArray(parsed)) {
            setLikedTrackIds(new Set(parsed.filter((id) => typeof id === 'string' && id.length > 0)));
          }
        } else {
          setLikedTrackIds(new Set());
        }

        const savedRecents = localStorage.getItem(`morning_music_${userNamespace}_recents`);
        if (savedRecents) {
          const parsed = JSON.parse(savedRecents);
          if (Array.isArray(parsed)) {
            setRecentlyPlayed(parsed.map(sanitizeTrack).filter((t): t is Track => t !== null));
          }
        } else {
          setRecentlyPlayed([]);
        }

        const savedPlaylists = localStorage.getItem(`morning_music_${userNamespace}_playlists`);
        if (savedPlaylists) {
          const parsed = JSON.parse(savedPlaylists);
          if (Array.isArray(parsed)) {
            setCustomPlaylists(parsed.map(sanitizePlaylist).filter((p): p is Playlist => p !== null));
          }
        } else {
          setCustomPlaylists([]);
        }

        const savedSongs = localStorage.getItem(`morning_music_${userNamespace}_custom_songs`);
        if (savedSongs) {
          const parsed = JSON.parse(savedSongs);
          if (Array.isArray(parsed)) {
            setCustomSongs(parsed.map(sanitizeTrack).filter((t): t is Track => t !== null));
          }
        } else {
          setCustomSongs([]);
        }
      } catch (e) {
        console.warn('Failed to load user local data:', e);
      }

      // 2. If authenticated user with token, sync & merge from remote database without losing local data
      if (user && token) {
        try {
          const res = await fetch('/api/user/data', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok && isMounted) {
            const json = await res.json();
            if (json.data) {
              setLikedTrackIds((prevLocalLikes) => {
                const serverLikes = Array.isArray(json.data.likedTrackIds) ? json.data.likedTrackIds : [];
                const mergedLikes = Array.from(new Set([...prevLocalLikes, ...serverLikes]));
                localStorage.setItem(`morning_music_${userNamespace}_likes`, JSON.stringify(mergedLikes));
                return new Set(mergedLikes);
              });

              setRecentlyPlayed((prevLocalRecents) => {
                const serverRecents = Array.isArray(json.data.recentlyPlayed)
                  ? json.data.recentlyPlayed.map(sanitizeTrack).filter((t: any): t is Track => t !== null)
                  : [];
                const map = new Map<string, Track>();
                [...serverRecents, ...prevLocalRecents].forEach((t) => {
                  if (t && (t.id || t.audio_source_id)) {
                    map.set(t.id || t.audio_source_id, t);
                  }
                });
                const mergedRecents = Array.from(map.values()).slice(0, 50);
                localStorage.setItem(`morning_music_${userNamespace}_recents`, JSON.stringify(mergedRecents));
                return mergedRecents;
              });

              setCustomPlaylists((prevLocalPlaylists) => {
                const serverPlaylists = Array.isArray(json.data.customPlaylists)
                  ? json.data.customPlaylists.map(sanitizePlaylist).filter((p: any): p is Playlist => p !== null)
                  : [];
                const playlistMap = new Map<string, Playlist>();
                [...serverPlaylists, ...prevLocalPlaylists].forEach((pl) => {
                  if (pl && pl.id) {
                    playlistMap.set(pl.id, pl);
                  }
                });
                const mergedPlaylists = Array.from(playlistMap.values());
                localStorage.setItem(`morning_music_${userNamespace}_playlists`, JSON.stringify(mergedPlaylists));
                return mergedPlaylists;
              });

              setCustomSongs((prevLocalSongs) => {
                const serverSongs = Array.isArray(json.data.customSongs)
                  ? json.data.customSongs.map(sanitizeTrack).filter((t: any): t is Track => t !== null)
                  : [];
                const songMap = new Map<string, Track>();
                [...serverSongs, ...prevLocalSongs].forEach((s) => {
                  if (s && s.id) {
                    songMap.set(s.id, s);
                  }
                });
                const mergedSongs = Array.from(songMap.values());
                localStorage.setItem(`morning_music_${userNamespace}_custom_songs`, JSON.stringify(mergedSongs));
                return mergedSongs;
              });
            }
          }
        } catch (err) {
          console.warn('Failed to sync user data from server:', err);
        }
      }

      if (isMounted) {
        loadedNamespaceRef.current = userNamespace;
        setTimeout(() => {
          if (isMounted) isInitialLoadRef.current = false;
        }, 100);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [userNamespace, user?.id, token]);

  // Save changes to localStorage, 7-day browser cookies & sync to server
  useEffect(() => {
    if (isInitialLoadRef.current || loadedNamespaceRef.current !== userNamespace) return;
    try {
      localStorage.setItem(`morning_music_${userNamespace}_likes`, serializeLikedIds(likedTrackIds));
      localStorage.setItem(`morning_music_${userNamespace}_recents`, serializeRecents(recentlyPlayed));
      localStorage.setItem(`morning_music_${userNamespace}_playlists`, serializePlaylists(customPlaylists));
      localStorage.setItem(`morning_music_${userNamespace}_custom_songs`, serializeRecents(customSongs));

      if (getCookieConsent() !== false) {
        saveUserDataCookie({
          likedTrackIds: Array.from(likedTrackIds),
          playlistCount: customPlaylists.length,
          userNamespace,
          updatedAt: new Date().toISOString(),
        }, 7);
      }
    } catch (e) {
      console.warn('Failed to save to local cache:', e);
    }

    if (user && token) {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        if (loadedNamespaceRef.current !== userNamespace) return;
        fetch('/api/user/data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            likedTrackIds: Array.from(likedTrackIds),
            recentlyPlayed: recentlyPlayed.slice(0, 40),
            customPlaylists,
            customSongs,
          }),
        }).catch((e) => console.warn('Failed to sync user data to backend:', e));
      }, 700);
    }
  }, [userNamespace, likedTrackIds, recentlyPlayed, customPlaylists, customSongs, user, token]);

  // Register Android Bridge Global Callback Listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    (window as any).onAndroidPlaybackStateChanged = (isPlaying: boolean, positionMs: number, durationMs: number) => {
      setIsPlaying(isPlaying);
      isPlayingRef.current = isPlaying;
      if (positionMs >= 0) {
        setCurrentTime(positionMs / 1000);
      }
      if (durationMs > 0) {
        setDuration(durationMs / 1000);
      }
    };

    (window as any).onAndroidTrackTransition = (trackId: string) => {
      const matching = queueRef.current.find((t) => t.id === trackId);
      if (matching) {
        setCurrentTrack(matching);
        currentTrackRef.current = matching;
        const index = queueRef.current.findIndex((t) => t.id === trackId);
        if (index !== -1) {
          setQueueIndex(index);
          queueIndexRef.current = index;
        }
      }
    };

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).onAndroidPlaybackStateChanged;
        delete (window as any).onAndroidTrackTransition;
      }
    };
  }, []);

  // Unified HTML5 Audio Engine with continuous background playback & OS MediaSession integration
  useEffect(() => {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audioRef.current = audio;
    }

    let preloadedAudio = preloadedAudioRef.current;
    if (!preloadedAudio) {
      preloadedAudio = new Audio();
      preloadedAudio.preload = 'auto';
      preloadedAudio.setAttribute('playsinline', 'true');
      preloadedAudio.setAttribute('webkit-playsinline', 'true');
      preloadedAudioRef.current = preloadedAudio;
    }

    const handleLoadedMetadata = (e: Event) => {
      const activeAudio = e.currentTarget as HTMLAudioElement;
      if (activeAudio !== audioRef.current) return;
      if (activeAudio.duration && !isNaN(activeAudio.duration) && activeAudio.duration !== Infinity) {
        setDuration(activeAudio.duration);
      }
      setIsLoading(false);
    };

    const handleTimeUpdate = (e: Event) => {
      const activeAudio = e.currentTarget as HTMLAudioElement;
      if (activeAudio !== audioRef.current) return;
      if (!isNaN(activeAudio.currentTime)) {
        setCurrentTime(activeAudio.currentTime);

        // Dynamic Crossfade Volume Control
        const targetVol = isMutedRef.current ? 0 : volumeRef.current;
        if (crossfadeRef.current > 0 && activeAudio.duration && activeAudio.duration > crossfadeRef.current) {
          const rem = activeAudio.duration - activeAudio.currentTime;
          if (rem <= crossfadeRef.current && rem > 0) {
            const fade = rem / crossfadeRef.current;
            activeAudio.volume = Math.max(0, Math.min(1, targetVol * fade));
          } else if (activeAudio.currentTime < crossfadeRef.current) {
            const fade = activeAudio.currentTime / crossfadeRef.current;
            activeAudio.volume = Math.max(0, Math.min(1, targetVol * fade));
          } else {
            activeAudio.volume = targetVol;
          }
        } else {
          activeAudio.volume = targetVol;
        }

        // If gapless playback is enabled, trigger immediate transition 6 seconds before track end
        if (gaplessPlaybackRef.current && activeAudio.duration && (activeAudio.duration - activeAudio.currentTime <= 6.0) && !gaplessTriggeredRef.current) {
          gaplessTriggeredRef.current = true;
          handleSongEndedRef.current();
        }

        // If there are less than 35 seconds left in the song, ensure the next track is prefetched
        if (activeAudio.duration && activeAudio.duration - activeAudio.currentTime < 35) {
          prefetchNextTrackRef.current();
        }
      }
    };

    const handleWaiting = (e: Event) => {
      if (e.currentTarget !== audioRef.current) return;
      setIsLoading(true);
    };

    const handleCanPlay = (e: Event) => {
      if (e.currentTarget !== audioRef.current) return;
      setIsLoading(false);
    };

    const handleAudioPlaying = (e: Event) => {
      const activeAudio = e.currentTarget as HTMLAudioElement;
      if (activeAudio !== audioRef.current) return;
      consecutiveErrorCountRef.current = 0;
      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsLoading(false);

      // Lazy-init Web Audio Context for Equalizer and Normalization
      if (!audioCtxRef.current && typeof window !== 'undefined') {
        try {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtxClass && activeAudio) {
            const ctx = new AudioCtxClass();
            audioCtxRef.current = ctx;

            const freqs = [60, 230, 910, 4000, 14000];
            const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
            const filters = freqs.map((freq, idx) => {
              const f = ctx.createBiquadFilter();
              f.type = types[idx];
              f.frequency.value = freq;
              f.gain.value = 0;
              if (types[idx] === 'peaking') f.Q.value = 1.0;
              return f;
            });
            eqFilterNodesRef.current = filters;

            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = volumeNormalizationRef.current ? -24 : 0;
            comp.ratio.value = volumeNormalizationRef.current ? 12 : 1;
            compressorNodeRef.current = comp;

            activeAudio.crossOrigin = 'anonymous';
            const source = ctx.createMediaElementSource(activeAudio);

            let lastNode: AudioNode = source;
            filters.forEach((f) => {
              lastNode.connect(f);
              lastNode = f;
            });
            lastNode.connect(comp);
            comp.connect(ctx.destination);
          }
        } catch (err) {
          console.warn('[Audio Engine] Web Audio init skipped:', err);
        }
      }
      applyAudioDspSettings();

      if (silentKeeperRef.current) {
        silentKeeperRef.current.play().catch(() => {});
      }
      // Prefetch the next track immediately when playing starts
      prefetchNextTrackRef.current();
    };

    const handleAudioPause = (e: Event) => {
      const activeAudio = e.currentTarget as HTMLAudioElement;
      if (activeAudio !== audioRef.current) return;
      if (isUserInitiatedPauseRef.current) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        if (silentKeeperRef.current) {
          silentKeeperRef.current.pause();
        }
      } else {
        // Throttled or auto-paused by the browser/OS in background. Keep silent keeper playing
        // so that the browser tab keeps its active audio session and lock screen controls stay active.
        if (silentKeeperRef.current && silentKeeperRef.current.paused) {
          silentKeeperRef.current.play().catch(() => {});
        }
        // Attempt to resume audio playback if hidden/backgrounded
        setTimeout(() => {
          if (isPlayingRef.current && currentPlaybackTypeRef.current === 'audio' && !isUserInitiatedPauseRef.current && activeAudio) {
            if (activeAudio.paused) {
              activeAudio.play().catch(() => {});
            }
          }
        }, 500);
      }
    };

    const handleAudioEnded = (e: Event) => {
      const activeAudio = e.currentTarget as HTMLAudioElement;
      if (activeAudio !== audioRef.current) return;
      // Guard against false/premature ends (e.g. 0-second aborts or broken streams)
      if (activeAudio && (activeAudio.currentTime < 5 || (activeAudio.duration && activeAudio.duration < 10))) {
        console.warn('[Audio Engine] Ignoring premature ended event (currentTime < 5s):', activeAudio.currentTime);
        return;
      }
      console.log('[Audio Engine] Native HTML5 ended event fired. Advancing track in background...');
      handleSongEndedRef.current();
    };

    const handleAudioError = (e: Event) => {
      const activeAudio = e.currentTarget as HTMLAudioElement;
      if (activeAudio !== audioRef.current) return;
      if (currentPlaybackTypeRef.current !== 'audio') return;
      console.warn('[Audio Engine] HTML5 Audio error:', e);
      const track = currentTrackRef.current;
      const ytId = getYouTubeVideoId(track);
      if (ytId && ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
        console.log('[Audio Engine] HTML5 Audio failed, seamlessly switching to YouTube player for same track:', track?.title);
        currentPlaybackTypeRef.current = 'youtube';
        try {
          ytPlayerRef.current.loadVideoById({ videoId: ytId, startSeconds: 0 });
          ytPlayerRef.current.setVolume(isMutedRef.current ? 0 : volumeRef.current * 100);
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
          isPlayingRef.current = true;
          setIsLoading(false);
          return;
        } catch (err) {}
      }
      handlePlaybackErrorRef.current();
    };

    const attachListeners = (el: HTMLAudioElement) => {
      el.addEventListener('loadedmetadata', handleLoadedMetadata);
      el.addEventListener('timeupdate', handleTimeUpdate);
      el.addEventListener('waiting', handleWaiting);
      el.addEventListener('canplay', handleCanPlay);
      el.addEventListener('playing', handleAudioPlaying);
      el.addEventListener('pause', handleAudioPause);
      el.addEventListener('ended', handleAudioEnded);
      el.addEventListener('error', handleAudioError);
    };

    const detachListeners = (el: HTMLAudioElement) => {
      el.removeEventListener('loadedmetadata', handleLoadedMetadata);
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('waiting', handleWaiting);
      el.removeEventListener('canplay', handleCanPlay);
      el.removeEventListener('playing', handleAudioPlaying);
      el.removeEventListener('pause', handleAudioPause);
      el.removeEventListener('ended', handleAudioEnded);
      el.removeEventListener('error', handleAudioError);
    };

    attachListeners(audio);
    attachListeners(preloadedAudio);

    // Sync state when user returns to active browser tab without pausing background audio
    const handleVisibilityChange = () => {
      const activeAudio = audioRef.current;
      if (document.visibilityState === 'visible') {
        // Self-heal and restore playback if the tab was suspended by browser throttling
        if (isPlayingRef.current) {
          if (currentPlaybackTypeRef.current === 'audio' && activeAudio && activeAudio.paused) {
            console.log('[Audio Engine] Tab reactivated. Restoring throttled direct audio playback...');
            activeAudio.play().catch((err) => console.warn('[Audio Engine] Self-heal play failed:', err));
          }
          if (silentKeeperRef.current && silentKeeperRef.current.paused) {
            silentKeeperRef.current.play().catch(() => {});
          }
        }

        if (currentPlaybackTypeRef.current === 'audio' && activeAudio) {
          if (!activeAudio.paused && !isPlayingRef.current) {
            setIsPlaying(true);
            isPlayingRef.current = true;
          } else if (activeAudio.paused && isPlayingRef.current) {
            setIsPlaying(false);
            isPlayingRef.current = false;
          }
          if (!isNaN(activeAudio.currentTime)) {
            setCurrentTime(activeAudio.currentTime);
          }
        } else if (currentPlaybackTypeRef.current === 'youtube' && ytPlayerRef.current) {
          try {
            const state = ytPlayerRef.current.getPlayerState?.();
            if (state === 1 && !isPlayingRef.current) {
              setIsPlaying(true);
              isPlayingRef.current = true;
            } else if ((state === 2 || state === 0) && isPlayingRef.current) {
              // YouTube player was paused in background. Attempt to resume.
              ytPlayerRef.current.playVideo();
            }
            const curr = ytPlayerRef.current.getCurrentTime?.();
            if (typeof curr === 'number' && !isNaN(curr)) {
              setCurrentTime(curr);
            }
          } catch (e) {}
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      detachListeners(audio);
      detachListeners(preloadedAudio);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      audio.pause();
      preloadedAudio.pause();
    };
  }, []);

  // Initialize YouTube IFrame API script tag defensively and instantiate player when ready
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const checkAndInit = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        setIsYouTubeReady(true);
        isYouTubeReadyRef.current = true;
        initYT();
      }
    };

    if ((window as any).YT && (window as any).YT.Player) {
      checkAndInit();
    } else {
      const prevCallback = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') prevCallback();
        checkAndInit();
      };
      const existingScript = document.getElementById('youtube-iframe-api-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'youtube-iframe-api-script';
        script.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(script);
      }
      const interval = setInterval(() => {
        if ((window as any).YT && (window as any).YT.Player) {
          clearInterval(interval);
          checkAndInit();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [initYT]);

  // Sync progress for YouTube playback
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        if (currentPlaybackTypeRef.current === 'youtube' && ytPlayerRef.current) {
          try {
            if (typeof ytPlayerRef.current.getCurrentTime === 'function') {
              const curr = ytPlayerRef.current.getCurrentTime();
              if (typeof curr === 'number' && !isNaN(curr) && curr >= 0) {
                setCurrentTime(curr);
              }
            }
            if (typeof ytPlayerRef.current.getDuration === 'function') {
              const dur = ytPlayerRef.current.getDuration();
              if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
                setDuration(dur);
              }
            }
          } catch (e) {}
        }
      }, 400);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying]);

  // Record into recently played with strict metadata
  const addToRecent = useCallback((track: Track) => {
    const canonical = resolveStrictTrackMetadata(track);
    const clean = sanitizeTrack(canonical);
    if (!clean) return;
    setRecentlyPlayed((prev) => {
      const filtered = prev.filter((t) => t.id !== clean.id);
      return [clean, ...filtered].slice(0, 20);
    });
  }, []);

  // Prefetch stream URL of next track in queue to make track transition synchronous in background/screen-off
  const prefetchNextTrack = useCallback(() => {
    try {
      const currentQueue = queueRef.current;
      const currentIdx = queueIndexRef.current;
      if (!currentQueue || currentQueue.length === 0) return;

      // Prefetch up to the next 3 tracks to build a highly-resilient background stream buffer
      for (let offset = 1; offset <= 3; offset++) {
        let nextIndex = currentIdx + offset;
        if (isShuffledRef.current) {
          nextIndex = (currentIdx + offset) % currentQueue.length;
        } else if (nextIndex >= currentQueue.length) {
          if (repeatModeRef.current === 'all') {
            nextIndex = nextIndex % currentQueue.length;
          } else {
            continue;
          }
        }

        const nextTrack = currentQueue[nextIndex];
        if (!nextTrack) continue;

        const hasUrl = nextTrack.audioUrl && (nextTrack.audioUrl.startsWith('/') || nextTrack.audioUrl.startsWith('http'));

        // If it is the immediate next track (offset 1), buffer it onto our secondary preloadedAudioRef
        if (offset === 1 && hasUrl && typeof Audio !== 'undefined') {
          if (!preloadedAudioRef.current) {
            preloadedAudioRef.current = new Audio();
            preloadedAudioRef.current.preload = 'auto';
            preloadedAudioRef.current.setAttribute('playsinline', 'true');
            preloadedAudioRef.current.setAttribute('webkit-playsinline', 'true');
          }
          if (preloadedAudioRef.current.src !== nextTrack.audioUrl) {
            console.log('[Gapless Engine] Preloading next track stream in background:', nextTrack.title);
            preloadedAudioRef.current.src = nextTrack.audioUrl!;
            preloadedAudioRef.current.load();
          }
        }

        if (hasUrl) {
          continue;
        }

        console.log(`[Audio Prefetcher] Prefetching direct stream URL for track offset +${offset}:`, nextTrack.title);
        const ytId = getYouTubeVideoId(nextTrack) || '';
        fetch(
          `/api/stream/resolve?id=${encodeURIComponent(ytId)}&title=${encodeURIComponent(nextTrack.title)}&artist=${encodeURIComponent(nextTrack.artist)}`
        )
          .then((res) => (res.ok ? res.json() : null))
          .then((streamInfo) => {
            if (streamInfo && streamInfo.url) {
              nextTrack.audioUrl = streamInfo.url;
              console.log(`[Audio Prefetcher] Track +${offset} ("${nextTrack.title}") successfully prefetched and cached.`);

              // Buffer the newly resolved URL onto our secondary preloadedAudioRef if it is the immediate next track
              if (offset === 1 && typeof Audio !== 'undefined') {
                if (!preloadedAudioRef.current) {
                  preloadedAudioRef.current = new Audio();
                  preloadedAudioRef.current.preload = 'auto';
                  preloadedAudioRef.current.setAttribute('playsinline', 'true');
                  preloadedAudioRef.current.setAttribute('webkit-playsinline', 'true');
                }
                if (preloadedAudioRef.current.src !== streamInfo.url) {
                  console.log('[Gapless Engine] Preloading newly resolved next track stream:', nextTrack.title);
                  preloadedAudioRef.current.src = streamInfo.url;
                  preloadedAudioRef.current.load();
                }
              }
            }
          })
          .catch((err) => {
            console.warn(`[Audio Prefetcher] Failed to prefetch track +${offset}:`, err);
          });
      }
    } catch (e) {
      console.warn('[Audio Prefetcher] Error in prefetching:', e);
    }
  }, []);

  // Play a specific track (Auto-plays verified direct audio or authentic YouTube video)
  const playTrack = useCallback(
    (track: Track, newQueue?: Track[]) => {
      const strictlyResolvedTrack = resolveStrictTrackMetadata(track);
      isUserInitiatedPauseRef.current = false;

      setCurrentTrack(strictlyResolvedTrack);
      currentTrackRef.current = strictlyResolvedTrack;
      setIsLoading(true);
      setCurrentTime(0);
      gaplessTriggeredRef.current = false;

      // Update browser tab title
      if (typeof document !== 'undefined') {
        document.title = `${strictlyResolvedTrack.title} • ${strictlyResolvedTrack.artist} | Sabdham`;
      }

      if (newQueue) {
        const strictlyResolvedQueue = newQueue.map((t) => resolveStrictTrackMetadata(t));
        const expandedQueue = buildMatchingGenreLanguageQueue(
          strictlyResolvedTrack,
          strictlyResolvedQueue,
          ALL_TRACKS,
          50
        );
        setQueue(expandedQueue);
        queueRef.current = expandedQueue;
        const index = expandedQueue.findIndex((t) => t.id === strictlyResolvedTrack.id);
        const activeIdx = index !== -1 ? index : 0;
        setQueueIndex(activeIdx);
        queueIndexRef.current = activeIdx;
      } else {
        const currentQ = queueRef.current;
        const index = currentQ.findIndex((t) => t.id === strictlyResolvedTrack.id);
        if (index !== -1) {
          const remainingInQueue = currentQ.length - 1 - index;
          if (remainingInQueue < 15) {
            const enriched = appendMatchingGenreLanguageTracks(strictlyResolvedTrack, currentQ, ALL_TRACKS, 50);
            setQueue(enriched);
            queueRef.current = enriched;
          }
          setQueueIndex(index);
          queueIndexRef.current = index;
        } else {
          const autoMatchedQueue = buildMatchingGenreLanguageQueue(
            strictlyResolvedTrack,
            [strictlyResolvedTrack],
            ALL_TRACKS,
            50
          );
          setQueue(autoMatchedQueue);
          queueRef.current = autoMatchedQueue;
          setQueueIndex(0);
          queueIndexRef.current = 0;
        }
      }

      addToRecent(strictlyResolvedTrack);
      setDuration(strictlyResolvedTrack.duration || 180);

      const ytId = getYouTubeVideoId(strictlyResolvedTrack);

      // Start authentic YouTube stream via YouTube Player
      const startYouTubePlayback = (videoId: string) => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
        }
        currentPlaybackTypeRef.current = 'youtube';
        if (silentKeeperRef.current) {
          silentKeeperRef.current.play().catch(() => {});
        }

        if (ytPlayerRef.current && isYouTubeReadyRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
          try {
            console.log('[Audio Engine] Playing authentic track via YouTube player:', strictlyResolvedTrack.title, videoId);
            ytPlayerRef.current.loadVideoById({ videoId, startSeconds: 0 });
            ytPlayerRef.current.setVolume(isMutedRef.current ? 0 : volumeRef.current * 100);
            ytPlayerRef.current.playVideo();
            setIsPlaying(true);
            isPlayingRef.current = true;
            setIsLoading(false);
            consecutiveErrorCountRef.current = 0;
          } catch (err) {
            console.warn('[Audio Engine] YouTube playback error:', err);
          }
        } else {
          console.log('[Audio Engine] YouTube player not yet ready, queueing pending track:', strictlyResolvedTrack.title);
          pendingTrackRef.current = strictlyResolvedTrack;
          initYT();
        }
      };

      // Start direct audio stream via Native HTML5 Audio
      const startAudioPlayback = (url: string) => {
        if (typeof window !== 'undefined' && (window as any).AndroidBridge) {
          try {
            console.log('[AndroidBridge] Syncing play queue and index natively:', strictlyResolvedTrack.title);
            const currentQ = queueRef.current;
            const activeIdx = queueIndexRef.current;
            const serialized = currentQ.map((t) => ({
              id: t.id,
              title: t.title,
              artist: t.artist,
              coverUrl: t.coverUrl,
              audioUrl: t.audioUrl || ""
            }));
            (window as any).AndroidBridge.setQueue(JSON.stringify(serialized), activeIdx);
            setIsPlaying(true);
            isPlayingRef.current = true;
            setIsLoading(false);
            return;
          } catch (err) {
            console.warn('[AndroidBridge] Native setQueue failed, falling back to local playback:', err);
          }
        }

        if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
          try {
            ytPlayerRef.current.pauseVideo();
          } catch (e) {}
        }
        if (silentKeeperRef.current) {
          silentKeeperRef.current.play().catch(() => {});
        }
        currentPlaybackTypeRef.current = 'audio';

        const audio = audioRef.current;
        if (audio) {
          try {
            console.log('[Audio Engine] Playing verified direct audio track:', strictlyResolvedTrack.title);
            if (audio.src !== url) {
              audio.src = url;
            }
            audio.currentTime = 0;
            audio.volume = isMutedRef.current ? 0 : volumeRef.current;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  setIsPlaying(true);
                  isPlayingRef.current = true;
                  setIsLoading(false);
                  consecutiveErrorCountRef.current = 0;
                })
                .catch((err) => {
                  if (err.name === 'AbortError') return;
                  if (err.name === 'NotAllowedError') {
                    console.warn('[Audio Engine] Autoplay paused by browser policy.');
                    setIsPlaying(false);
                    isPlayingRef.current = false;
                    setIsLoading(false);
                    return;
                  }
                  console.warn('[Audio Engine] HTML5 Audio error, trying YouTube fallback:', err);
                  if (ytId) startYouTubePlayback(ytId);
                });
            }
          } catch (err) {
            console.warn('[Audio Engine] Native audio setup error:', err);
            if (ytId) startYouTubePlayback(ytId);
          }
        }
      };

      // 1. If track already has a direct valid audio URL (e.g. high-res MP3/AAC or proxy):
      if (
        strictlyResolvedTrack.audioUrl &&
        (strictlyResolvedTrack.audioUrl.startsWith('/') ||
          (strictlyResolvedTrack.audioUrl.startsWith('http') &&
            !strictlyResolvedTrack.audioUrl.includes('youtube.com') &&
            !strictlyResolvedTrack.audioUrl.includes('youtu.be')))
      ) {
        startAudioPlayback(strictlyResolvedTrack.audioUrl);
        return;
      }

      // 2. Keep the HTML5 audio session active and warm in the background by playing a short silence before the fetch.
      // This prevents mobile browsers (iOS/Android) from suspending the tab or blocking subsequent play() calls
      // because the playback is treated as a continuous continuation of the active audio session.
      if (silentKeeperRef.current) {
        silentKeeperRef.current.play().catch(() => {});
      }
      const audio = audioRef.current;
      if (audio) {
        try {
          const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFlm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
          audio.src = silentWav;
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } catch (e) {
          console.warn('[Audio Engine] Failed to warm up audio session:', e);
        }
      }

      // 3. Query /api/stream/resolve for strictly verified authentic audio/video:
      fetch(
        `/api/stream/resolve?id=${encodeURIComponent(ytId || '')}&title=${encodeURIComponent(strictlyResolvedTrack.title)}&artist=${encodeURIComponent(strictlyResolvedTrack.artist)}`
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((streamInfo) => {
          if (currentTrackRef.current?.id !== strictlyResolvedTrack.id) return;

          if (streamInfo && streamInfo.url) {
            strictlyResolvedTrack.audioUrl = streamInfo.url;
            startAudioPlayback(streamInfo.url);
          } else if (streamInfo?.videoId && isAuthenticYouTubeVideoId(streamInfo.videoId)) {
            strictlyResolvedTrack.youtubeVideoId = streamInfo.videoId;
            startYouTubePlayback(streamInfo.videoId);
          } else if (ytId) {
            startYouTubePlayback(ytId);
          } else {
            fetch(
              `/api/youtube/resolve-track?title=${encodeURIComponent(strictlyResolvedTrack.title)}&artist=${encodeURIComponent(strictlyResolvedTrack.artist)}`
            )
              .then((r) => (r.ok ? r.json() : null))
              .then((resolved) => {
                if (currentTrackRef.current?.id !== strictlyResolvedTrack.id) return;
                if (resolved?.youtubeVideoId && isAuthenticYouTubeVideoId(resolved.youtubeVideoId)) {
                  strictlyResolvedTrack.youtubeVideoId = resolved.youtubeVideoId;
                  startYouTubePlayback(resolved.youtubeVideoId);
                } else {
                  handlePlaybackErrorRef.current();
                }
              })
              .catch(() => {
                handlePlaybackErrorRef.current();
              });
          }
        })
        .catch((err) => {
          console.warn('[Audio Engine] Stream resolution failed:', err);
          if (currentTrackRef.current?.id === strictlyResolvedTrack.id && ytId) {
            startYouTubePlayback(ytId);
          } else {
            handlePlaybackErrorRef.current();
          }
        });
    },
    [addToRecent, initYT]
  );

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).AndroidBridge) {
      if (isPlayingRef.current) {
        (window as any).AndroidBridge.pauseTrack();
      } else {
        (window as any).AndroidBridge.resumeTrack();
      }
      return;
    }

    if (currentPlaybackTypeRef.current === 'youtube') {
      if (!ytPlayerRef.current) return;
      if (isPlayingRef.current) {
        isUserInitiatedPauseRef.current = true;
        if (typeof ytPlayerRef.current.pauseVideo === 'function') {
          ytPlayerRef.current.pauseVideo();
        }
        if (silentKeeperRef.current) {
          silentKeeperRef.current.pause();
        }
        setIsPlaying(false);
        isPlayingRef.current = false;
      } else {
        isUserInitiatedPauseRef.current = false;
        if (typeof ytPlayerRef.current.playVideo === 'function') {
          ytPlayerRef.current.playVideo();
        }
        if (silentKeeperRef.current) {
          silentKeeperRef.current.play().catch(() => {});
        }
        setIsPlaying(true);
        isPlayingRef.current = true;
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlayingRef.current) {
      isUserInitiatedPauseRef.current = true;
      audio.pause();
      if (silentKeeperRef.current) {
        silentKeeperRef.current.pause();
      }
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else {
      isUserInitiatedPauseRef.current = false;
      if (!currentTrackRef.current && queueRef.current.length > 0) {
        playTrack(queueRef.current[0]);
        return;
      }
      if (!audio.src || audio.src === '') {
        if (currentTrackRef.current) {
          playTrack(currentTrackRef.current);
        }
        return;
      }
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          isPlayingRef.current = true;
          if (silentKeeperRef.current) {
            silentKeeperRef.current.play().catch(() => {});
          }
          consecutiveErrorCountRef.current = 0;
        })
        .catch((err) => {
          if (err.name === 'AbortError' || err.name === 'NotAllowedError') return;
          console.warn('[Audio Engine] Play error:', err);
        });
    }
  }, [playTrack]);

  // Fetch fresh matching tracks from YouTube API by genre and language (ensures zero duplicate songs in queue)
  const fetchYouTubeMatchingSongs = useCallback(
    async (referenceTrack: Track, countToFetch: number = 15): Promise<Track[]> => {
      if (!referenceTrack) return [];
      try {
        const existingKeys = new Set<string>();
        // Exclude all tracks currently in queue, recently played, or playing
        queueRef.current.forEach((t) => recordTrackKeys(t, existingKeys));
        recentlyPlayed.forEach((t) => recordTrackKeys(t, existingKeys));
        if (currentTrackRef.current) {
          recordTrackKeys(currentTrackRef.current, existingKeys);
        }

        const excludeIdsParam = Array.from(existingKeys)
          .filter((k) => k.length === 11 || k.startsWith('yt-'))
          .slice(0, 30)
          .join(',');

        const params = new URLSearchParams({
          title: referenceTrack.title || '',
          artist: referenceTrack.artist || '',
          genre: referenceTrack.genre || '',
          language: referenceTrack.language || 'english',
          count: String(countToFetch),
          excludeIds: excludeIdsParam,
        });

        const res = await fetch(`/api/youtube/recommendations?${params.toString()}`);
        if (!res.ok) return [];
        const data = await res.json();
        const rawTracks = Array.isArray(data.tracks) ? data.tracks : [];

        const validNewTracks: Track[] = [];
        for (const raw of rawTracks) {
          const sanitized = sanitizeTrack(raw);
          if (sanitized && !isSongAlreadyInQueue(sanitized, existingKeys)) {
            validNewTracks.push(sanitized);
            recordTrackKeys(sanitized, existingKeys);
          }
        }

        return validNewTracks;
      } catch (err) {
        console.warn('[Queue Engine] Failed to fetch YouTube matching tracks:', err);
        return [];
      }
    },
    [recentlyPlayed]
  );

  // Play next track (Auto-plays automatically even in background tabs, guarantees zero repeating songs)
  const playNext = useCallback(() => {
    const currentQueue = queueRef.current;
    const currentIdx = queueIndexRef.current;
    const currTrack = currentTrackRef.current;

    if (currentQueue.length === 0) return;

    let activeQueue = currentQueue;
    // When nearing the end of the queue, if autoplay is ON, fetch catalog matching tracks and fresh YouTube recommendations
    if (autoplayRef.current && currTrack && currentQueue.length - currentIdx <= 8) {
      activeQueue = appendMatchingGenreLanguageTracks(currTrack, currentQueue, ALL_TRACKS, 20);
      if (activeQueue.length > currentQueue.length) {
        setQueue(activeQueue);
        queueRef.current = activeQueue;
      }

      // Proactively fetch fresh new songs from YouTube with same genre and language
      fetchYouTubeMatchingSongs(currTrack, 15).then((freshYtTracks) => {
        if (freshYtTracks.length > 0) {
          setQueue((prevQ) => {
            const existingKeys = new Set<string>();
            prevQ.forEach((t) => recordTrackKeys(t, existingKeys));
            const uniqueYtTracks = freshYtTracks.filter((t) => !isSongAlreadyInQueue(t, existingKeys));
            if (uniqueYtTracks.length === 0) return prevQ;
            const updated = [...prevQ, ...uniqueYtTracks];
            queueRef.current = updated;
            return updated;
          });
        }
      });
    }

    let nextIndex = currentIdx + 1;

    if (isShuffledRef.current) {
      nextIndex = Math.floor(Math.random() * activeQueue.length);
      if (nextIndex === currentIdx && activeQueue.length > 1) {
        nextIndex = (currentIdx + 1) % activeQueue.length;
      }
    } else if (nextIndex >= activeQueue.length) {
      if (repeatModeRef.current === 'all') {
        nextIndex = 0;
      } else {
        if (autoplayRef.current && currTrack) {
          // If queue ended and autoplay is enabled, try to resolve fresh new tracks
          fetchYouTubeMatchingSongs(currTrack, 15).then((freshYtTracks) => {
            if (freshYtTracks.length > 0) {
              setQueue((prevQ) => {
                const existingKeys = new Set<string>();
                prevQ.forEach((t) => recordTrackKeys(t, existingKeys));
                const uniqueYtTracks = freshYtTracks.filter((t) => !isSongAlreadyInQueue(t, existingKeys));
                const updated = [...prevQ, ...uniqueYtTracks];
                queueRef.current = updated;
                return updated;
              });
              const nextTrack = freshYtTracks[0];
              if (nextTrack) {
                playTrack(nextTrack);
              }
            } else {
              const appendedQueue = appendMatchingGenreLanguageTracks(currTrack, activeQueue, ALL_TRACKS, 20);
              if (appendedQueue.length > activeQueue.length) {
                setQueue(appendedQueue);
                queueRef.current = appendedQueue;
                setQueueIndex(currentIdx + 1);
                queueIndexRef.current = currentIdx + 1;
                const nextTrack = appendedQueue[currentIdx + 1];
                if (nextTrack) {
                  playTrack(nextTrack, appendedQueue);
                }
              } else {
                setIsPlaying(false);
                isPlayingRef.current = false;
              }
            }
          });
          return;
        }
        // Autoplay is OFF: Stop playback at end of queue
        setIsPlaying(false);
        isPlayingRef.current = false;
        return;
      }
    }

    setQueueIndex(nextIndex);
    queueIndexRef.current = nextIndex;
    const nextTrack = activeQueue[nextIndex];
    if (nextTrack) {
      playTrack(nextTrack, activeQueue);
    }
  }, [playTrack, fetchYouTubeMatchingSongs]);

  // Add single track to queue (inserts immediately after current playing song so it plays next)
  const addToQueue = useCallback(
    (track: Track) => {
      if (!track || (!track.id && !track.youtubeVideoId)) return;

      const currentTrack = currentTrackRef.current;

      if (!currentTrack) {
        // If nothing is currently playing, start playing this track immediately
        playTrack(track);
        return;
      }

      setQueue((prevQueue) => {
        const normTitle = normalizeSongTitle(track.title);
        // Filter out existing instances of this track to avoid duplicate positions
        const cleanQueue = prevQueue.filter(
          (t) =>
            !(
              (track.id && t.id === track.id) ||
              (track.youtubeVideoId && t.youtubeVideoId && t.youtubeVideoId === track.youtubeVideoId) ||
              (normTitle && normalizeSongTitle(t.title) === normTitle)
            )
        );

        // Find index of currently playing track in cleanQueue
        let currentIdx = cleanQueue.findIndex(
          (t) =>
            (currentTrack.id && t.id === currentTrack.id) ||
            (currentTrack.youtubeVideoId && t.youtubeVideoId && t.youtubeVideoId === currentTrack.youtubeVideoId)
        );

        if (currentIdx === -1) {
          currentIdx = Math.min(queueIndexRef.current, Math.max(0, cleanQueue.length - 1));
        }

        const insertIndex = currentIdx >= 0 ? currentIdx + 1 : 0;

        const updatedQueue = [
          ...cleanQueue.slice(0, insertIndex),
          track,
          ...cleanQueue.slice(insertIndex),
        ];

        queueRef.current = updatedQueue;

        // Keep queueIndex pointing to the currentTrack in updatedQueue
        const updatedCurrentIdx = updatedQueue.findIndex(
          (t) =>
            (currentTrack.id && t.id === currentTrack.id) ||
            (currentTrack.youtubeVideoId && t.youtubeVideoId && t.youtubeVideoId === currentTrack.youtubeVideoId)
        );

        if (updatedCurrentIdx !== -1) {
          setQueueIndex(updatedCurrentIdx);
          queueIndexRef.current = updatedCurrentIdx;
        }

        return updatedQueue;
      });
    },
    [playTrack]
  );

  // Add more songs matching playing track's genre and language from catalog & YouTube
  const addMatchingSongsToQueue = useCallback(
    async (count: number = 10) => {
      if (!currentTrackRef.current) return;
      const refTrack = currentTrackRef.current;

      // 1. First add matching from local catalog
      setQueue((prevQueue) => {
        const expanded = appendMatchingGenreLanguageTracks(refTrack, prevQueue, ALL_TRACKS, count);
        queueRef.current = expanded;
        return expanded;
      });

      // 2. Fetch fresh tracks from YouTube with same genre & language
      const freshYt = await fetchYouTubeMatchingSongs(refTrack, count);
      if (freshYt.length > 0) {
        setQueue((prevQueue) => {
          const existingKeys = new Set<string>();
          prevQueue.forEach((t) => recordTrackKeys(t, existingKeys));
          const uniqueYt = freshYt.filter((t) => !isSongAlreadyInQueue(t, existingKeys));
          if (uniqueYt.length === 0) return prevQueue;
          const updated = [...prevQueue, ...uniqueYt];
          queueRef.current = updated;
          return updated;
        });
      }
    },
    [fetchYouTubeMatchingSongs]
  );

  // Play previous track
  const playPrevious = useCallback(() => {
    if (currentPlaybackTypeRef.current === 'youtube') {
      const curr = ytPlayerRef.current?.getCurrentTime ? ytPlayerRef.current.getCurrentTime() : currentTime;
      if (curr > 3) {
        if (ytPlayerRef.current?.seekTo) {
          ytPlayerRef.current.seekTo(0, true);
        }
        setCurrentTime(0);
        return;
      }
    } else {
      const audio = audioRef.current;
      if (audio && audio.currentTime > 3) {
        audio.currentTime = 0;
        setCurrentTime(0);
        return;
      }
    }

    const currentQueue = queueRef.current;
    const currentIdx = queueIndexRef.current;
    if (currentQueue.length === 0) return;

    let prevIndex = currentIdx - 1;
    if (prevIndex < 0) {
      prevIndex = currentQueue.length - 1;
    }

    setQueueIndex(prevIndex);
    queueIndexRef.current = prevIndex;
    const prevTrack = currentQueue[prevIndex];
    if (prevTrack) {
      playTrack(prevTrack, currentQueue);
    }
  }, [currentTime, playTrack]);

  // Handle song ended (called reliably by native HTML5 onended in foreground or background)
  const handleEnded = useCallback(() => {
    console.log('[Audio Engine] handleEnded triggered, repeatMode:', repeatModeRef.current);
    if (repeatModeRef.current === 'one') {
      if (currentPlaybackTypeRef.current === 'youtube') {
        if (ytPlayerRef.current?.seekTo && ytPlayerRef.current?.playVideo) {
          ytPlayerRef.current.seekTo(0, true);
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
          isPlayingRef.current = true;
        }
      } else {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch((e) => console.warn('[Audio Engine] Loop play caught:', e));
          setIsPlaying(true);
          isPlayingRef.current = true;
        }
      }
    } else {
      playNext();
    }
  }, [playNext]);

  useEffect(() => {
    handleSongEndedRef.current = handleEnded;
  }, [handleEnded]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  useEffect(() => {
    playPreviousRef.current = playPrevious;
  }, [playPrevious]);

  useEffect(() => {
    togglePlayPauseRef.current = togglePlayPause;
  }, [togglePlayPause]);

  useEffect(() => {
    prefetchNextTrackRef.current = prefetchNextTrack;
  }, [prefetchNextTrack]);

  useEffect(() => {
    handlePlaybackErrorRef.current = async (failedVideoId?: string) => {
      const track = currentTrackRef.current;
      if (!track) {
        setIsLoading(false);
        setIsPlaying(false);
        isPlayingRef.current = false;
        return;
      }

      console.warn('[Audio Engine] Playback issue intercepted for track:', track.title, failedVideoId || '');
      const trackKey = track.id || `${track.title}_${track.artist}`;
      const attempts = (trackRetryAttemptsRef.current.get(trackKey) || 0) + 1;
      trackRetryAttemptsRef.current.set(trackKey, attempts);

      const currentVid = failedVideoId || getYouTubeVideoId(track);
      if (currentVid) {
        if (!trackFailedVideoIdsRef.current.has(trackKey)) {
          trackFailedVideoIdsRef.current.set(trackKey, new Set());
        }
        trackFailedVideoIdsRef.current.get(trackKey)!.add(currentVid);
      }

      // Self-healing attempt: Try resolving alternative stream/video if under retry limit
      if (attempts <= 2) {
        console.log(`[Audio Engine] Auto-recovering stream for "${track.title}" (attempt ${attempts}/2)...`);
        setIsLoading(true);

        try {
          const failedIds = Array.from(trackFailedVideoIdsRef.current.get(trackKey) || []);
          const res = await fetch(
            `/api/youtube/resolve-track?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}&excludeId=${encodeURIComponent(failedIds.join(','))}`
          );
          if (res.ok) {
            const resolved = await res.json();
            if (
              resolved?.youtubeVideoId &&
              isAuthenticYouTubeVideoId(resolved.youtubeVideoId) &&
              !failedIds.includes(resolved.youtubeVideoId)
            ) {
              console.log(`[Audio Engine] Self-healing resolved working video for "${track.title}":`, resolved.youtubeVideoId);
              track.youtubeVideoId = resolved.youtubeVideoId;
              track.audioUrl = `yt:${resolved.youtubeVideoId}`;
              currentPlaybackTypeRef.current = 'youtube';
              if (silentKeeperRef.current) {
                silentKeeperRef.current.play().catch(() => {});
              }
              if (ytPlayerRef.current && isYouTubeReadyRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
                ytPlayerRef.current.loadVideoById({ videoId: resolved.youtubeVideoId, startSeconds: 0 });
                ytPlayerRef.current.setVolume(isMutedRef.current ? 0 : volumeRef.current * 100);
                ytPlayerRef.current.playVideo();
                setIsPlaying(true);
                isPlayingRef.current = true;
                setIsLoading(false);
                consecutiveErrorCountRef.current = 0;
                return;
              }
            }
          }
        } catch (e) {
          console.warn('[Audio Engine] Self-healing resolution request failed:', e);
        }
      }

      // If self-healing attempts exhausted for this song, advance to next track in queue
      console.warn(`[Audio Engine] Playback recovery exhausted for "${track.title}". Advancing to next track...`);
      consecutiveErrorCountRef.current += 1;
      if (consecutiveErrorCountRef.current <= 3) {
        setTimeout(() => {
          playNextRef.current();
        }, 800);
      } else {
        console.warn('[Audio Engine] Consecutive recovery limit reached. Pausing safely.');
        setIsLoading(false);
        setIsPlaying(false);
        isPlayingRef.current = false;
      }
    };
  }, []);

  // Defensive watchdog: automatically rescue stuck buffering/loading states
  useEffect(() => {
    let timeoutId: any = null;
    if (isLoading) {
      timeoutId = setTimeout(() => {
        console.warn('[Audio Watchdog] Media loading/buffering has been stuck for over 8s. Rescuing playback...');
        handlePlaybackErrorRef.current();
      }, 8000);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading]);

  // Seek
  const seekTo = useCallback((seconds: number) => {
    setCurrentTime(seconds);
    if (typeof window !== 'undefined' && (window as any).AndroidBridge) {
      (window as any).AndroidBridge.seekTrack(Math.round(seconds * 1000));
      return;
    }

    if (currentPlaybackTypeRef.current === 'youtube') {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
        ytPlayerRef.current.seekTo(seconds, true);
      }
    } else {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = seconds;
      }
    }
  }, []);

  // Volume control
  const setVolumeLevel = useCallback(
    (vol: number) => {
      const clamped = Math.max(0, Math.min(1, vol));
      setVolume(clamped);
      volumeRef.current = clamped;
      if (isMuted && clamped > 0) {
        setIsMuted(false);
        isMutedRef.current = false;
      }
      if (audioRef.current) {
        audioRef.current.volume = isMutedRef.current ? 0 : clamped;
      }
      if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
        ytPlayerRef.current.setVolume(isMutedRef.current ? 0 : clamped * 100);
      }
    },
    [isMuted]
  );

  // Toggle Mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      if (audioRef.current) {
        audioRef.current.volume = next ? 0 : volumeRef.current;
      }
      if (ytPlayerRef.current) {
        if (next && typeof ytPlayerRef.current.mute === 'function') {
          ytPlayerRef.current.mute();
        } else if (!next && typeof ytPlayerRef.current.unMute === 'function') {
          ytPlayerRef.current.unMute();
        }
      }
      return next;
    });
  }, []);

  // Toggle Shuffle
  const toggleShuffle = useCallback(() => {
    setIsShuffled((prev) => !prev);
  }, []);

  // Cycle Repeat Mode
  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  // Toggle Like
  const toggleLike = useCallback((trackOrId: string | Track) => {
    if (!trackOrId) return;
    const trackId = typeof trackOrId === 'string' ? trackOrId : trackOrId.id;
    let trackObj = typeof trackOrId === 'string' ? null : trackOrId;

    if (typeof trackId !== 'string' || !trackId) return;

    // Try to resolve trackObj if we only got an ID
    if (!trackObj) {
      if (currentTrack?.id === trackId) {
        trackObj = currentTrack;
      } else {
        const foundRecent = recentlyPlayed.find((t) => t.id === trackId);
        if (foundRecent) {
          trackObj = foundRecent;
        } else {
          const foundCatalog = getTrackById(trackId);
          if (foundCatalog) {
            trackObj = foundCatalog;
          }
        }
      }
    }

    // If it's a dynamic track (like YouTube or custom song) not in native catalog, make sure it is stored in customSongs!
    if (trackObj && !getTrackById(trackId)) {
      setCustomSongs((prev) => {
        if (prev.some((s) => s.id === trackId)) return prev;
        return [trackObj!, ...prev];
      });
    }

    setLikedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }, [currentTrack, recentlyPlayed]);

  // Playlists management
  const createCustomPlaylist = useCallback(
    (name: string, description: string = ''): Playlist => {
      const cleanName = typeof name === 'string' && name.trim() ? name.trim() : 'My Playlist';
      const cleanDesc = typeof description === 'string' ? description : '';
      const newPlaylist: Playlist = {
        id: `playlist-${Date.now()}`,
        title: cleanName,
        name: cleanName,
        description: cleanDesc,
        coverUrl:
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
        trackIds: [],
        createdAt: new Date().toISOString(),
        isCustom: true,
      };
      setCustomPlaylists((prev) => [newPlaylist, ...prev]);
      return newPlaylist;
    },
    []
  );

  const deleteCustomPlaylist = useCallback(async (playlistId: string) => {
    if (!playlistId) return;
    setCustomPlaylists((prev) => {
      const updated = prev.filter((p) => p.id !== playlistId);
      try {
        // Immediately persist to localStorage for all potential namespaces
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('_playlists')) {
            localStorage.setItem(key, JSON.stringify(updated));
          }
        }
        localStorage.setItem(`morning_music_${userNamespace}_playlists`, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to update localStorage on playlist delete:', e);
      }
      return updated;
    });

    if (user && token) {
      try {
        await fetch(`/api/db/playlists/${playlistId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (e) {
        console.warn('Failed to delete playlist on server:', e);
      }
    }
  }, [userNamespace, user, token]);

  const addTrackToPlaylist = useCallback((playlistId: string, trackId: string) => {
    if (typeof playlistId !== 'string' || typeof trackId !== 'string' || !playlistId || !trackId) return;
    setCustomPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id === playlistId) {
          if (!pl.trackIds.includes(trackId)) {
            return { ...pl, trackIds: [...pl.trackIds, trackId] };
          }
        }
        return pl;
      })
    );
  }, []);

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    if (typeof playlistId !== 'string' || typeof trackId !== 'string' || !playlistId || !trackId) return;
    setCustomPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id === playlistId) {
          return { ...pl, trackIds: pl.trackIds.filter((id) => id !== trackId) };
        }
        return pl;
      })
    );
  }, []);

  // Custom songs management
  const addCustomSong = useCallback((songData: Omit<Track, 'id'>): Track => {
    const ytId = songData.youtubeVideoId || songData.audio_source_id;
    const cover = ensureValidCoverUrl(songData.coverUrl, ytId);
    const newSong: Track = {
      ...songData,
      coverUrl: cover,
      id: `custom-song-${Date.now()}`,
      audio_source_id: songData.audio_source_id || songData.youtubeVideoId || `custom-${Date.now()}`,
      source: songData.source || 'youtube',
    };
    setCustomSongs((prev) => [newSong, ...prev]);
    return newSong;
  }, []);

  const deleteCustomSong = useCallback((songId: string) => {
    if (!songId) return;
    setCustomSongs((prev) => prev.filter((s) => s.id !== songId));
  }, []);

  const clearRecentlyPlayed = useCallback(() => {
    setRecentlyPlayed([]);
  }, []);

  const openFullPlayer = useCallback(() => setIsFullPlayerOpen(true), []);
  const closeFullPlayer = useCallback(() => setIsFullPlayerOpen(false), []);

  // Dispatch background system notification when track changes while app is in background
  useEffect(() => {
    if (!currentTrack || typeof Notification === 'undefined') return;
    if (notificationsEnabled && Notification.permission === 'granted' && document.hidden) {
      try {
        const cover = currentTrack.coverUrl || '/pwa-512x512.png';
        const fullCoverUrl =
          typeof window !== 'undefined' && cover.startsWith('/')
            ? `${window.location.origin}${cover}`
            : cover;

        const notif = new Notification(currentTrack.title, {
          body: `${currentTrack.artist}${currentTrack.album ? ` • ${currentTrack.album}` : ''}`,
          icon: fullCoverUrl,
          badge: '/pwa-192x192.png',
          tag: 'sabdham-now-playing',
          silent: true,
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (e) {
        // Ignored in sandboxed iframes
      }
    }
  }, [currentTrack, notificationsEnabled]);

  // Update MediaSession API for lock screen and background OS media controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    try {
      const cover = currentTrack.coverUrl || '/pwa-512x512.png';
      const fullCoverUrl =
        typeof window !== 'undefined' && cover.startsWith('/')
          ? `${window.location.origin}${cover}`
          : cover;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || currentTrack.movie || 'SABDHAM',
        artwork: [
          { src: fullCoverUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: fullCoverUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: fullCoverUrl, sizes: '192x192', type: 'image/png' },
          { src: fullCoverUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: fullCoverUrl, sizes: '384x384', type: 'image/png' },
          { src: fullCoverUrl, sizes: '512x512', type: 'image/png' },
        ],
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => {
        togglePlayPauseRef.current();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        togglePlayPauseRef.current();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPreviousRef.current();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNextRef.current();
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        if (isPlayingRef.current) {
          togglePlayPauseRef.current();
        }
      });

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        const target = Math.max(0, currentTime - offset);
        seekTo(target);
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        const target = Math.min(duration, currentTime + offset);
        seekTo(target);
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          seekTo(details.seekTime);
        }
      });

      if ('setPositionState' in navigator.mediaSession && duration > 0 && !isNaN(currentTime)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(duration, 1),
            playbackRate: isPlaying ? 1 : 0,
            position: Math.min(Math.max(currentTime, 0), duration),
          });
        } catch (e) {}
      }
    } catch (err) {
      console.warn('[MediaSession] Error setting mediaSession metadata:', err);
    }
  }, [currentTrack, isPlaying, duration, currentTime, seekTo]);

  return (
    <MusicContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isShuffled,
        repeatMode,
        queue,
        queueIndex,
        isLoading,
        likedTrackIds,
        recentlyPlayed,
        customPlaylists,
        customSongs,
        isFullPlayerOpen,
        isYouTubeReady,
        crossfade,
        gaplessPlayback,
        notificationsEnabled,
        notificationPermission,
        requestNotificationPermission,
        toggleNotifications,
        setCrossfade,
        toggleGaplessPlayback,
        playTrack,
        togglePlayPause,
        playNext,
        playPrevious,
        seekTo,
        setVolumeLevel,
        toggleMute,
        toggleShuffle,
        cycleRepeatMode,
        toggleLike,
        createCustomPlaylist,
        deleteCustomPlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        addCustomSong,
        deleteCustomSong,
        clearRecentlyPlayed,
        openFullPlayer,
        closeFullPlayer,
        addToQueue,
        setQueue,
        setQueueIndex,
        addMatchingSongsToQueue,
        playbackQuality,
        setPlaybackQuality,
        autoplay,
        setAutoplay,
        volumeNormalization,
        setVolumeNormalization,
        wifiOnlyDownloads,
        setWifiOnlyDownloads,
        useMobileData,
        setUseMobileData,
        eqEnabled,
        setEqEnabled,
        eqPreset,
        setEqPreset,
        eqBands,
        setEqBands,
        theme,
        setTheme,
        clearCache,
        clearSearchHistory,
        clearPersonalData,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
}
