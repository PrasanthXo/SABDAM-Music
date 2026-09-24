import React, { useState } from 'react';
import { ListMusic, Plus, Play, Trash2, Music2, FolderPlus, Disc3 } from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { useAuth } from '../context/AuthContext';
import { getTrackById, ALL_TRACKS } from '../data/musicCatalog';
import { Playlist, Track } from '../types';
import { handleImageError, ensureValidCoverUrl } from '../utils/imageUtils';
import { SongOptionsMenu } from './SongOptionsMenu';

export const PlaylistsView: React.FC = () => {
  const { user, openLoginModal } = useAuth();
  const {
    customPlaylists,
    createCustomPlaylist,
    deleteCustomPlaylist,
    removeTrackFromPlaylist,
    playTrack,
    currentTrack,
    isPlaying,
    customSongs,
  } = useMusic();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) return;
    const pl = createCustomPlaylist(playlistName.trim(), playlistDesc.trim());
    setPlaylistName('');
    setPlaylistDesc('');
    setIsCreateOpen(false);
    setSelectedPlaylistId(pl.id);
  };

  if (!user) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-4">
          <ListMusic className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">My Playlists</h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
          Sign in or sign up with email to create personalized playlists synced directly to your account.
        </p>
        <button
          onClick={openLoginModal}
          id="playlists-login-button"
          className="py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 cursor-pointer"
        >
          Sign in or sign up with email
        </button>
      </div>
    );
  }

  const selectedPlaylist = customPlaylists.find((p) => p.id === selectedPlaylistId);
  const playlistTracks: Track[] = selectedPlaylist
    ? selectedPlaylist.trackIds.map((id) => getTrackById(id, customSongs)).filter((t): t is Track => t != null)
    : [];

  const handlePlayEntirePlaylist = (pl: Playlist) => {
    const tracks = pl.trackIds.map((id) => getTrackById(id, customSongs)).filter((t): t is Track => t != null);
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6" id="playlists-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-zinc-950 shadow-lg shadow-amber-500/20">
            <ListMusic className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">My Playlists</h1>
            <p className="text-xs text-zinc-400">
              {customPlaylists.length} playlists saved for {user.email}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreateOpen(!isCreateOpen)}
          id="create-new-playlist-button"
          className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-xl text-xs flex items-center space-x-2 transition shadow-md shadow-amber-500/20 cursor-pointer"
        >
          <FolderPlus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Create Playlist Form */}
      {isCreateOpen && (
        <div className="p-5 rounded-2xl bg-zinc-900 border border-amber-500/30 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white">Create New Playlist</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Playlist Name *</label>
              <input
                type="text"
                required
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="e.g. Peaceful Morning Vibes"
                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Description (Optional)</label>
              <input
                type="text"
                value={playlistDesc}
                onChange={(e) => setPlaylistDesc(e.target.value)}
                placeholder="e.g. Best tracks for mindful sunrise coffee"
                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="py-2 px-4 rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2 px-5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Create Playlist
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content: Playlists Grid or Selected Playlist Detail */}
      {selectedPlaylist ? (
        <div className="space-y-4">
          {/* Back button and playlist banner */}
          <button
            onClick={() => setSelectedPlaylistId(null)}
            className="text-xs text-amber-400 hover:underline flex items-center space-x-1 mb-2 cursor-pointer"
          >
            <span>← Back to all playlists</span>
          </button>

          <div className="p-6 rounded-2xl bg-zinc-900 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                <ListMusic className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{selectedPlaylist.title || selectedPlaylist.name}</h2>
                <p className="text-xs text-zinc-400">{selectedPlaylist.description || 'Custom user playlist'}</p>
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  {playlistTracks.length} {playlistTracks.length === 1 ? 'track' : 'tracks'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {playlistTracks.length > 0 && (
                <button
                  onClick={() => handlePlayEntirePlaylist(selectedPlaylist)}
                  className="py-2.5 px-5 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-bold rounded-xl text-xs flex items-center space-x-2 shadow-md hover:from-amber-400 hover:to-orange-400 transition cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-zinc-950" />
                  <span>Play All</span>
                </button>
              )}
              <button
                onClick={() => {
                  deleteCustomPlaylist(selectedPlaylist.id);
                  setSelectedPlaylistId(null);
                }}
                className="p-2.5 text-zinc-500 hover:text-red-400 rounded-xl hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition cursor-pointer"
                title="Delete playlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tracks inside selected playlist */}
          {playlistTracks.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-zinc-900/40 border border-white/5 space-y-2">
              <Music2 className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm text-zinc-300 font-medium">This playlist is empty.</p>
              <p className="text-xs text-zinc-500">Add songs from the Home, Explore, or Favorites view!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {playlistTracks.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    className={`group flex items-center justify-between p-3 rounded-xl border transition ${
                      isCurrent
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-zinc-900/60 border-white/5 hover:border-white/20 hover:bg-zinc-850 text-white'
                    }`}
                  >
                    <div
                      onClick={() => playTrack(track, playlistTracks)}
                      className="flex items-center space-x-3.5 flex-1 min-w-0 cursor-pointer"
                    >
                      <span className="w-5 text-center text-xs font-mono text-zinc-500 group-hover:text-amber-400">
                        {idx + 1}
                      </span>
                      <img
                        src={ensureValidCoverUrl(track.coverUrl, track.youtubeVideoId || track.audio_source_id)}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, track.youtubeVideoId || track.audio_source_id)}
                        className="w-10 h-10 rounded-lg object-cover bg-zinc-800 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate group-hover:text-amber-400 transition">
                          {track.title}
                        </h4>
                        <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => playTrack(track, playlistTracks)}
                        aria-label="Play song"
                        className="p-2 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-white/5 transition cursor-pointer"
                      >
                        <Play className={`w-4 h-4 ${isCurrent && isPlaying ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                      <SongOptionsMenu track={track} currentPlaylistId={selectedPlaylist.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Playlists Grid */
        <div>
          {customPlaylists.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-white/5 space-y-3">
              <Disc3 className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-zinc-300 font-medium text-sm">No playlists created yet.</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Create custom playlists to curate your morning soundscape and favorite melodies.
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-2 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl text-xs border border-white/10 transition cursor-pointer"
              >
                Create First Playlist
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {customPlaylists.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => setSelectedPlaylistId(pl.id)}
                  className="group p-4 rounded-2xl bg-zinc-900/80 border border-white/10 hover:border-amber-500/40 hover:bg-zinc-850 transition cursor-pointer space-y-3"
                >
                  <div className="aspect-video w-full rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-white/5 flex items-center justify-center text-amber-400 group-hover:scale-[1.02] transition">
                    <ListMusic className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm truncate group-hover:text-amber-400 transition">
                      {pl.title || pl.name}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {pl.description || `${pl.trackIds.length} tracks`}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-zinc-500">
                    <span>{pl.trackIds.length} tracks</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomPlaylist(pl.id);
                          if (selectedPlaylistId === pl.id) setSelectedPlaylistId(null);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
                        title="Delete playlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-amber-400 group-hover:underline">View Playlist →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
