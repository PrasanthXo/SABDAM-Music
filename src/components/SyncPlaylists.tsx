import React, { useState, useEffect } from 'react';
import { Youtube, Music, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, ChevronRight, ListMusic, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { Track } from '../types';

interface ExternalPlaylist {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  trackCount: number;
  source: 'youtube' | 'spotify';
}

export const SyncPlaylists: React.FC = () => {
  const { user, token } = useAuth();
  const { createCustomPlaylist, addCustomSong, addTrackToPlaylist } = useMusic();
  
  const [isYouTubeSyncing, setIsYouTubeSyncing] = useState(false);
  const [isSpotifySyncing, setIsSpotifySyncing] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [youtubePlaylists, setYoutubePlaylists] = useState<ExternalPlaylist[]>([]);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<ExternalPlaylist[]>([]);
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [syncingPlaylistId, setSyncingPlaylistId] = useState<string | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [spotifyRedirectUri, setSpotifyRedirectUri] = useState<string>('');
  const [spotifyClientId, setSpotifyClientId] = useState<string>('');

  // Load Spotify configuration in background for OAuth handling
  useEffect(() => {
    async function loadSpotifyConfig() {
      try {
        const currentOrigin = window.location.origin;
        const res = await fetch(`/api/spotify/config?origin=${encodeURIComponent(currentOrigin)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.clientId) setSpotifyClientId(data.clientId);
          if (data.redirectUri) setSpotifyRedirectUri(data.redirectUri);
        }
      } catch (e) {
        // Silently handled
      }
    }
    loadSpotifyConfig();
  }, []);

  // 1. YouTube Auth & Fetch
  const handleSyncYouTube = async () => {
    if (!window.google) {
      setStatus({ message: 'Google Identity Services not loaded. Please refresh.', type: 'error' });
      return;
    }

    setIsYouTubeSyncing(true);
    setStatus({ message: 'Authorizing with Google...', type: 'info' });

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        scope: 'https://www.googleapis.com/auth/youtube.readonly',
        callback: async (response: any) => {
          if (response.error) {
            setIsYouTubeSyncing(false);
            setStatus({ message: 'Google authorization failed.', type: 'error' });
            return;
          }
          
          setGoogleAccessToken(response.access_token);
          setStatus({ message: 'Fetching YouTube playlists...', type: 'info' });
          const res = await fetch('/api/youtube/playlists', {
            headers: { 'Authorization': `Bearer ${response.access_token}` }
          });
          
          if (!res.ok) {
            throw new Error('Failed to fetch YouTube playlists');
          }
          const data = await res.json();
          
          setYoutubePlaylists(data.map((pl: any) => ({
            id: pl.id,
            title: pl.snippet.title,
            description: pl.snippet.description,
            coverUrl: pl.snippet.thumbnails?.high?.url || pl.snippet.thumbnails?.default?.url,
            trackCount: pl.contentDetails?.itemCount || 0,
            source: 'youtube'
          })));
          
          setIsYouTubeSyncing(false);
          setStatus({ message: `Found ${data.length} YouTube playlists!`, type: 'success' });
        }
      });

      client.requestAccessToken();
    } catch (err: any) {
      setIsYouTubeSyncing(false);
      setStatus({ message: 'Could not fetch YouTube playlists.', type: 'error' });
    }
  };

  // 2. Spotify Auth & Fetch
  const handleSyncSpotify = async () => {
    setIsSpotifySyncing(true);
    setStatus({ message: 'Connecting to Spotify...', type: 'info' });

    try {
      const currentOrigin = window.location.origin;
      const configRes = await fetch(`/api/spotify/config?origin=${encodeURIComponent(currentOrigin)}`);
      const { clientId, redirectUri: serverRedirectUri } = await configRes.json();
      
      const effectiveClientId = spotifyClientId || clientId;
      const effectiveRedirectUri = spotifyRedirectUri || serverRedirectUri;

      if (!effectiveClientId) throw new Error('Spotify is not configured.');

      const scope = 'playlist-read-private playlist-read-collaborative user-read-private';
      const authUrl = `https://accounts.spotify.com/authorize?client_id=${effectiveClientId}&response_type=code&redirect_uri=${encodeURIComponent(effectiveRedirectUri)}&scope=${encodeURIComponent(scope)}`;
      
      const width = 450, height = 730;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(authUrl, 'spotify-auth', `width=${width},height=${height},left=${left},top=${top}`);

      const handleMessage = async (event: MessageEvent) => {
        if (!event.data || (event.data.type !== 'SPOTIFY_AUTH_CODE' && event.data.type !== 'SPOTIFY_AUTH_ERROR')) return;
        
        if (event.data.type === 'SPOTIFY_AUTH_CODE') {
          window.removeEventListener('message', handleMessage);
          const code = event.data.code;
          
          setStatus({ message: 'Connecting to Spotify...', type: 'info' });
          const tokenRes = await fetch('/api/spotify/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirectUri: effectiveRedirectUri })
          });
          
          const tokens = await tokenRes.json();
          if (!tokenRes.ok) throw new Error('Spotify login failed.');

          setStatus({ message: 'Loading Spotify playlists...', type: 'info' });
          const plRes = await fetch('/api/spotify/playlists', {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
          });
          
          const data = await plRes.json().catch(() => ({}));

          if (data && (data.premiumRequired || data.forbidden || data.error)) {
            setSpotifyPlaylists([]);
            setIsSpotifySyncing(false);
            setStatus({
              message: 'Spotify sync unavailable. Use link import below.',
              type: 'info'
            });
            sessionStorage.setItem('spotify_access_token', tokens.access_token);
            return;
          }

          const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);

          if (items.length === 0) {
            setSpotifyPlaylists([]);
            setIsSpotifySyncing(false);
            setStatus({ message: 'No playlists found. Use link import below.', type: 'info' });
            sessionStorage.setItem('spotify_access_token', tokens.access_token);
            return;
          }

          setSpotifyPlaylists(items.map((pl: any) => ({
            id: pl.id,
            title: pl.name || 'Untitled Playlist',
            description: pl.description || '',
            coverUrl: pl.images?.[0]?.url || '',
            trackCount: pl.tracks?.total || pl.items?.total || 0,
            source: 'spotify'
          })));
          
          setIsSpotifySyncing(false);
          setStatus({ message: `Found ${items.length} Spotify playlist${items.length === 1 ? '' : 's'}!`, type: 'success' });
          sessionStorage.setItem('spotify_access_token', tokens.access_token);
        } else if (event.data.type === 'SPOTIFY_AUTH_ERROR') {
          window.removeEventListener('message', handleMessage);
          setIsSpotifySyncing(false);
          setStatus({ message: 'Spotify login canceled.', type: 'info' });
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (err: any) {
      setIsSpotifySyncing(false);
      setStatus({
        message: 'Could not sync Spotify. Use link import below.',
        type: 'info'
      });
    }
  };

  const logSpotifyImportDiagnostics = (playlistTitle: string, requestedCount: number, processedCount: number) => {
    const mismatch = Math.max(0, requestedCount - processedCount);
    const diagnosticRecord = {
      timestamp: new Date().toISOString(),
      playlistTitle,
      requestedCount,
      processedCount,
      mismatch,
    };
    console.info('[SpotifyImportDiagnostics]', diagnosticRecord);
    try {
      const existingLogs = JSON.parse(sessionStorage.getItem('spotify_import_diagnostics') || '[]');
      existingLogs.unshift(diagnosticRecord);
      sessionStorage.setItem('spotify_import_diagnostics', JSON.stringify(existingLogs.slice(0, 20)));
    } catch {}
    return diagnosticRecord;
  };

  const importPlaylist = async (pl: ExternalPlaylist) => {
    setSyncingPlaylistId(pl.id);
    setStatus({ message: `Importing "${pl.title}"...`, type: 'info' });

    try {
      let tracks: any[] = [];
      
      if (pl.source === 'youtube') {
        const ytToken = googleAccessToken;
        if (!ytToken) throw new Error('YouTube session expired. Please sync again.');
        const res = await fetch(`/api/youtube/playlist-items?playlistId=${pl.id}`, {
          headers: { 'Authorization': `Bearer ${ytToken}` }
        });
        if (!res.ok) {
          throw new Error('Failed to fetch YouTube items');
        }
        tracks = await res.json();
      } else {
        const spotifyToken = sessionStorage.getItem('spotify_access_token');
        const headers: Record<string, string> = {};
        if (spotifyToken) {
          headers['Authorization'] = `Bearer ${spotifyToken}`;
        }
        
        const res = await fetch(`/api/spotify/playlist-tracks?playlistId=${pl.id}`, {
          headers
        });
        if (!res.ok) {
          throw new Error('Failed to fetch Spotify tracks');
        }
        tracks = await res.json();
      }

      if (tracks.length === 0) {
        setStatus({ message: 'Playlist is empty.', type: 'error' });
        setSyncingPlaylistId(null);
        return;
      }

      const requestedCount = pl.source === 'spotify' ? Math.max(pl.trackCount || 0, tracks.length) : tracks.length;
      let processedCount = 0;

      // Create local playlist
      const localPl = createCustomPlaylist(pl.title, `Imported from ${pl.source === 'youtube' ? 'YouTube' : 'Spotify'}: ${pl.description}`);
      
      // Map and add tracks
      for (const item of tracks) {
        let trackData: any;
        if (pl.source === 'youtube') {
          const s = item.snippet;
          if (!s) continue;
          trackData = {
            title: s.title,
            artist: 'YouTube Import',
            album: pl.title,
            duration: 180,
            durationFormatted: '3:00',
            coverUrl: s.thumbnails?.high?.url || s.thumbnails?.default?.url,
            youtubeVideoId: s.resourceId?.videoId,
            audio_source_id: s.resourceId?.videoId,
            source: 'youtube'
          };
        } else {
          const t = item.track;
          if (!t || !t.name) continue;
          trackData = {
            title: t.name,
            artist: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
            album: t.album?.name || pl.title,
            duration: Math.floor((t.duration_ms || 180000) / 1000),
            durationFormatted: `${Math.floor((t.duration_ms || 180000) / 60000)}:${String(Math.floor(((t.duration_ms || 180000) % 60000) / 1000)).padStart(2, '0')}`,
            coverUrl: t.album?.images?.[0]?.url || pl.coverUrl || '',
            source: 'youtube'
          };
        }
        
        const newTrack = addCustomSong(trackData);
        addTrackToPlaylist(localPl.id, newTrack.id);
        processedCount++;
      }

      const diag = logSpotifyImportDiagnostics(pl.title, requestedCount, processedCount);

      if (diag.mismatch > 0 && pl.source === 'spotify') {
        setStatus({ 
          message: `Warning: Imported ${processedCount} of ${requestedCount} tracks (${diag.mismatch} skipped due to missing/preview data). Playlist created successfully!`, 
          type: 'error' 
        });
      } else {
        setStatus({ message: `Successfully imported "${pl.title}" with ${processedCount} tracks!`, type: 'success' });
      }
    } catch (err: any) {
      setStatus({ message: 'Could not import playlist. Please try another.', type: 'error' });
    } finally {
      setSyncingPlaylistId(null);
    }
  };

  const handleManualImport = async (overrideUrl?: string) => {
    const urlToUse = (overrideUrl || manualUrl).trim();
    if (!urlToUse) return;
    
    setIsResolvingUrl(true);
    setStatus({ message: 'Resolving playlist...', type: 'info' });

    try {
      const res = await fetch(`/api/spotify/playlist-resolve?url=${encodeURIComponent(urlToUse)}`);
      if (!res.ok) {
        throw new Error('Failed to resolve playlist');
      }
      
      const pl: ExternalPlaylist = await res.json();
      
      // If we already have this playlist in the list, just highlight it
      if (!spotifyPlaylists.some(p => p.id === pl.id)) {
        setSpotifyPlaylists(prev => [pl, ...prev]);
      }
      
      setStatus({ message: `Loaded: "${pl.title}" (${pl.trackCount} tracks). Click arrow to import!`, type: 'success' });
      setManualUrl('');
    } catch (err: any) {
      setStatus({ message: 'Could not load playlist. Check link and try again.', type: 'error' });
    } finally {
      setIsResolvingUrl(false);
    }
  };

  if (!user) return null;

  const allPlaylists = [...youtubePlaylists, ...spotifyPlaylists];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* YouTube Sync Card */}
        <button
          onClick={handleSyncYouTube}
          disabled={isYouTubeSyncing}
          className="flex items-center justify-between p-5 rounded-2xl bg-[#ff0000]/10 border border-[#ff0000]/20 hover:bg-[#ff0000]/20 transition-all group relative overflow-hidden"
        >
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-[#ff0000] flex items-center justify-center text-white shadow-lg">
              <Youtube className="w-6 h-6 fill-white" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-white">YouTube Playlists</h3>
              <p className="text-xs text-neutral-400">Sync your YouTube library</p>
            </div>
          </div>
          {isYouTubeSyncing ? (
            <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
          ) : (
            <RefreshCw className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
          )}
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#ff0000]/5 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-[#ff0000]/10 transition-colors"></div>
        </button>

        {/* Spotify Sync Card */}
        <button
          onClick={handleSyncSpotify}
          disabled={isSpotifySyncing}
          className="flex items-center justify-between p-5 rounded-2xl bg-[#1db954]/10 border border-[#1db954]/20 hover:bg-[#1db954]/20 transition-all group relative overflow-hidden"
        >
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-[#1db954] flex items-center justify-center text-black shadow-lg">
              <Music className="w-6 h-6 fill-current" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-white">Spotify Playlists</h3>
              <p className="text-xs text-neutral-400">Sync your Spotify account</p>
            </div>
          </div>
          {isSpotifySyncing ? (
            <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
          ) : (
            <RefreshCw className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
          )}
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#1db954]/5 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-[#1db954]/10 transition-colors"></div>
        </button>
      </div>

      {/* Manual Import Section */}
      <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
              <ExternalLink className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">Import via Link</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                  Instant • No Login Required
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Paste any public Spotify playlist URL or URI to load songs directly</p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="https://open.spotify.com/playlist/... or spotify:playlist:..."
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            onKeyDown={(e) => e.key === 'Enter' && handleManualImport()}
          />
          <button
            onClick={() => handleManualImport()}
            disabled={isResolvingUrl || !manualUrl.trim()}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            {isResolvingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resolve'}
          </button>
        </div>

        {/* Quick Presets */}
        <div className="pt-1">
          <p className="text-[11px] text-neutral-400 mb-2 font-medium">Quick load popular playlists:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { name: "Today's Top Hits", url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' },
              { name: 'Calming Acoustic', url: 'https://open.spotify.com/playlist/37i9dQZF1DXaImRpG7HXqp' },
              { name: 'Chill Hits', url: 'https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6' },
              { name: 'Peaceful Piano', url: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO' },
              { name: 'Morning Retrowave', url: 'https://open.spotify.com/playlist/37i9dQZF1DXdLEN7aqioXM' },
            ].map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setManualUrl(preset.url);
                  handleManualImport(preset.url);
                }}
                disabled={isResolvingUrl}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white text-neutral-300 border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Music className="w-3 h-3 text-[#1db954]" />
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {status && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border ${
          status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
          status.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
          'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> :
           status.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> :
           <RefreshCw className="w-5 h-5 shrink-0 animate-spin" />}
          <p className="text-sm font-medium">{status.message}</p>
        </div>
      )}

      {allPlaylists.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-[#1db954]" />
              Found Playlists
            </h4>
            <span className="text-xs text-neutral-500">{allPlaylists.length} total</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allPlaylists.map((pl) => (
              <div key={pl.id} className="p-3 rounded-xl bg-neutral-900/50 border border-white/5 flex items-center gap-3 group hover:border-[#1db954]/30 transition-all">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-lg">
                  {pl.coverUrl ? (
                    <img src={pl.coverUrl} alt={pl.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-neutral-500">
                      <Music className="w-5 h-5" />
                    </div>
                  )}
                  <div className="absolute top-0 right-0 p-0.5 bg-black/60 rounded-bl-lg">
                    {pl.source === 'youtube' ? 
                      <Youtube className="w-2.5 h-2.5 text-[#ff0000] fill-current" /> : 
                      <Music className="w-2.5 h-2.5 text-[#1db954] fill-current" />
                    }
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h5 className="text-sm font-bold text-white truncate">{pl.title}</h5>
                  <p className="text-[10px] text-neutral-500 font-medium uppercase tracking-wide">
                    {pl.trackCount} Tracks
                  </p>
                </div>
                <button
                  onClick={() => importPlaylist(pl)}
                  disabled={syncingPlaylistId === pl.id}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#1db954] text-neutral-400 hover:text-black flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                >
                  {syncingPlaylistId === pl.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
