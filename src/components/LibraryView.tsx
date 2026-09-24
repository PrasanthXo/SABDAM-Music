import React, { useState } from 'react';
import { Heart, Play, Pause, Clock, Music, Disc3, Radio, ListMusic, Plus, Trash2, FolderPlus, Music2, RefreshCw } from 'lucide-react';
import { Track, Playlist } from '../types';
import { ALL_TRACKS, getTrackById } from '../data/musicCatalog';
import { useMusic } from '../context/MusicContext';
import { useAuth } from '../context/AuthContext';
import { handleImageError, ensureValidCoverUrl } from '../utils/imageUtils';
import { CoverArtImage } from './CoverArtImage';
import { SongOptionsMenu } from './SongOptionsMenu';

import { SyncPlaylists } from './SyncPlaylists';

export const LibraryView: React.FC = () => {
  const { user, openLoginModal } = useAuth();
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    likedTrackIds,
    toggleLike,
    recentlyPlayed,
    customPlaylists,
    createCustomPlaylist,
    deleteCustomPlaylist,
    removeTrackFromPlaylist,
    customSongs,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<'liked' | 'recent' | 'all-singles' | 'playlists' | 'sync'>('all-singles');
  const [selectedLanguage, setSelectedLanguage] = useState<'all' | 'tamil' | 'sinhala' | 'english'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Liked single tracks (resolves both catalog and dynamic/YouTube/custom tracks)
  const likedTracks = Array.from(likedTrackIds as Set<string>)
    .map((id: string) => {
      const catalogTrack = getTrackById(id, customSongs);
      if (catalogTrack) return catalogTrack;
      return customSongs.find((s) => s.id === id) || null;
    })
    .filter((t): t is Track => t != null);

  // Filtered singles
  const filteredSingles = selectedLanguage === 'all'
    ? ALL_TRACKS
    : ALL_TRACKS.filter((t) => t.language === selectedLanguage);

  const handlePlayCollection = (tracks: Track[]) => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) return;
    const pl = createCustomPlaylist(playlistName.trim(), playlistDesc.trim());
    setPlaylistName('');
    setPlaylistDesc('');
    setIsCreateOpen(false);
    setSelectedPlaylistId(pl.id);
  };

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

  if (!user) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto text-center py-20 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-4">
          <ListMusic className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">My Library</h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
          Sign in or sign up with email to view your personalized library, custom playlists, liked songs, listening history, and synced tracks.
        </p>
        <button
          onClick={openLoginModal}
          id="library-login-button"
          className="py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-300"
        >
          Sign in or sign up with email
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-4 space-y-6 pb-16">
      {/* Library Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            id="tab-all-singles"
            onClick={() => setActiveTab('all-singles')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'all-singles'
                ? 'bg-white text-black'
                : 'bg-[#242424] text-neutral-300 hover:bg-[#303030] hover:text-white'
            }`}
          >
            <Disc3 className="w-4 h-4" />
            <span>Popular Artist Singles ({ALL_TRACKS.length})</span>
          </button>

          <button
            id="tab-playlists"
            onClick={() => setActiveTab('playlists')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'playlists'
                ? 'bg-white text-black'
                : 'bg-[#242424] text-neutral-300 hover:bg-[#303030] hover:text-white'
            }`}
          >
            <ListMusic className="w-4 h-4" />
            <span>My Playlists ({customPlaylists.length})</span>
          </button>

          <button
            id="tab-liked-songs"
            onClick={() => setActiveTab('liked')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'liked'
                ? 'bg-white text-black'
                : 'bg-[#242424] text-neutral-300 hover:bg-[#303030] hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4 fill-current" />
            <span>Liked Singles ({likedTracks.length})</span>
          </button>

          <button
            id="tab-recently-played"
            onClick={() => setActiveTab('recent')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'recent'
                ? 'bg-white text-black'
                : 'bg-[#242424] text-neutral-300 hover:bg-[#303030] hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Recently Played</span>
          </button>

          {user && (
            <button
              id="tab-sync-playlists"
              onClick={() => setActiveTab('sync')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'sync'
                  ? 'bg-white text-black'
                  : 'bg-[#242424] text-[#1db954] hover:bg-[#1db954]/10'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sync External</span>
            </button>
          )}
        </div>

        <button
          onClick={() => {
            setActiveTab('playlists');
            setIsCreateOpen(true);
            setSelectedPlaylistId(null);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black text-xs sm:text-sm font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg ml-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span className="hidden xs:inline">Create Playlist</span>
        </button>
      </div>

      {/* 1. ALL POPULAR SINGLES VIEW */}
      {activeTab === 'all-singles' && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-5 p-5 sm:p-6 rounded-xl bg-gradient-to-br from-[#1db954]/25 via-emerald-950/60 to-neutral-900 border border-[#1db954]/20 shadow-lg">
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-lg bg-[#1db954] flex items-center justify-center shadow-xl shrink-0 text-black">
              <Disc3 className="w-10 h-10 sm:w-14 sm:h-14 stroke-[2.2]" />
            </div>
            <div className="space-y-1 sm:space-y-2">
              <span className="inline-block px-2 py-0.5 rounded bg-[#1db954]/20 text-[#1db954] text-[10px] uppercase font-bold tracking-wider">
                Artist Singles Only • No Playlists
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Popular Artist Singles</h1>
              <p className="text-xs sm:text-sm text-neutral-300">
                Direct popular artist single tracks in Tamil, Sinhala, and English.
              </p>
            </div>
            {filteredSingles.length > 0 && (
              <button
                onClick={() => handlePlayCollection(filteredSingles)}
                className="sm:ml-auto w-12 h-12 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-xl hover:scale-105 transition-transform cursor-pointer"
                title="Play All Singles"
              >
                <Play className="w-6 h-6 fill-black ml-0.5" />
              </button>
            )}
          </div>

          {/* Language filter pills */}
          <div className="flex items-center gap-2 pt-1">
            {(['all', 'tamil', 'sinhala', 'english'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  selectedLanguage === lang
                    ? 'bg-[#1db954] text-black'
                    : 'bg-[#242424] text-neutral-400 hover:text-white hover:bg-[#303030]'
                }`}
              >
                {lang === 'all' ? 'All Languages' : `${lang} Singles`}
              </button>
            ))}
          </div>

          {/* Singles Track List */}
          <div className="space-y-1 mt-3">
            {filteredSingles.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              const isPlayingThis = isCurrent && isPlaying;
              const isLiked = likedTrackIds.has(track.id);

              return (
                <div
                  key={track.id}
                  onClick={() => (isCurrent ? togglePlayPause() : playTrack(track, filteredSingles))}
                  className={`group flex items-center justify-between p-2.5 rounded-md hover:bg-[#282828] transition-colors cursor-pointer ${
                    isCurrent ? 'bg-[#222222]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-center text-xs text-neutral-400 group-hover:hidden">
                      {isCurrent ? <span className="text-[#1db954] font-bold">▶</span> : idx + 1}
                    </span>
                    <button
                      className="w-6 hidden group-hover:flex items-center justify-center text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCurrent) togglePlayPause();
                        else playTrack(track, filteredSingles);
                      }}
                    >
                      {isPlayingThis ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                    </button>
                    <CoverArtImage
                      track={track}
                      className="w-10 h-10 rounded object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-[#1db954]' : 'text-white'}`}>
                          {track.title}
                        </p>
                        <span className="px-1.5 py-0.5 rounded bg-black/50 text-[9px] text-[#1db954] font-bold uppercase tracking-wider shrink-0 border border-[#1db954]/30">
                          Single
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 truncate">
                        {track.artist}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(track.id);
                      }}
                      className={`p-1 rounded-full ${
                        isLiked ? 'text-[#1db954]' : 'text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-white'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#1db954]' : ''}`} />
                    </button>
                    <SongOptionsMenu track={track} />
                    <span className="text-xs text-neutral-400 w-10 text-right">
                      {track.durationFormatted}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. LIKED SINGLES VIEW */}
      {activeTab === 'liked' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-5 p-5 sm:p-6 rounded-xl bg-gradient-to-br from-purple-800 to-indigo-950 shadow-lg mb-6">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shrink-0">
              <Heart className="w-12 h-12 text-white fill-white" />
            </div>
            <div className="space-y-1 sm:space-y-2">
              <span className="text-xs uppercase font-bold tracking-wider text-purple-200">
                Single Songs Collection
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white">Liked Singles</h1>
              <p className="text-xs sm:text-sm text-purple-200">
                {likedTracks.length} single track{likedTracks.length === 1 ? '' : 's'} • Saved in your library
              </p>
            </div>
            {likedTracks.length > 0 && (
              <button
                onClick={() => handlePlayCollection(likedTracks)}
                className="sm:ml-auto w-12 h-12 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-xl hover:scale-105 transition-transform cursor-pointer"
                title="Play Liked Singles"
              >
                <Play className="w-6 h-6 fill-black ml-0.5" />
              </button>
            )}
          </div>

          {likedTracks.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Heart className="w-12 h-12 mx-auto text-neutral-600" />
              <p className="text-base font-semibold text-white">Single songs you like will appear here</p>
              <p className="text-xs text-neutral-400">Save singles by tapping the heart icon on any track.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {likedTracks.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                const isPlayingThis = isCurrent && isPlaying;
                return (
                  <div
                    key={track.id}
                    onClick={() => (isCurrent ? togglePlayPause() : playTrack(track, likedTracks))}
                    className={`group flex items-center justify-between p-2.5 rounded-md hover:bg-[#282828] transition-colors cursor-pointer ${
                      isCurrent ? 'bg-[#222222]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-5 text-center text-xs text-neutral-400 group-hover:hidden">
                        {isCurrent ? <span className="text-[#1db954] font-bold">▶</span> : idx + 1}
                      </span>
                      <button
                        className="w-5 hidden group-hover:flex items-center justify-center text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCurrent) togglePlayPause();
                          else playTrack(track, likedTracks);
                        }}
                      >
                        {isPlayingThis ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                      </button>
                      <CoverArtImage
                        track={track}
                        className="w-10 h-10 rounded object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-[#1db954]' : 'text-white'}`}>
                            {track.title}
                          </p>
                          <span className="px-1.5 py-0.5 rounded bg-black/50 text-[9px] text-[#1db954] font-bold uppercase tracking-wider shrink-0 border border-[#1db954]/30">
                            Single
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 truncate">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(track);
                        }}
                        className="p-1 rounded-full text-[#1db954]"
                      >
                        <Heart className="w-4 h-4 fill-[#1db954]" />
                      </button>
                      <SongOptionsMenu track={track} />
                      <span className="text-xs text-neutral-400 w-10 text-right">
                        {track.durationFormatted}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. RECENTLY PLAYED SINGLES VIEW */}
      {activeTab === 'recent' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-5 p-5 sm:p-6 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 shadow-lg mb-6">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg bg-neutral-700 flex items-center justify-center shadow-2xl shrink-0">
              <Clock className="w-12 h-12 text-white" />
            </div>
            <div className="space-y-1 sm:space-y-2">
              <span className="text-xs uppercase font-bold tracking-wider text-neutral-400">
                Listening History
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white">Recently Played Singles</h1>
              <p className="text-xs sm:text-sm text-neutral-400">
                Single songs you recently listened to.
              </p>
            </div>
            {recentlyPlayed.length > 0 && (
              <button
                onClick={() => handlePlayCollection(recentlyPlayed)}
                className="sm:ml-auto w-12 h-12 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-xl hover:scale-105 transition-transform cursor-pointer"
                title="Play Recent Singles"
              >
                <Play className="w-6 h-6 fill-black ml-0.5" />
              </button>
            )}
          </div>

          {recentlyPlayed.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Music className="w-12 h-12 mx-auto text-neutral-600" />
              <p className="text-base font-semibold text-white">No recently played singles</p>
              <p className="text-xs text-neutral-400">Start playing popular artist singles to build your history.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentlyPlayed.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                const isPlayingThis = isCurrent && isPlaying;
                const isLiked = likedTrackIds.has(track.id);

                return (
                  <div
                    key={`${track.id}-${idx}`}
                    onClick={() => (isCurrent ? togglePlayPause() : playTrack(track, recentlyPlayed))}
                    className={`group flex items-center justify-between p-2.5 rounded-md hover:bg-[#282828] transition-colors cursor-pointer ${
                      isCurrent ? 'bg-[#222222]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-5 text-center text-xs text-neutral-400 group-hover:hidden">
                        {isCurrent ? <span className="text-[#1db954] font-bold">▶</span> : idx + 1}
                      </span>
                      <button
                        className="w-5 hidden group-hover:flex items-center justify-center text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCurrent) togglePlayPause();
                          else playTrack(track, recentlyPlayed);
                        }}
                      >
                        {isPlayingThis ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                      </button>
                      <CoverArtImage
                        track={track}
                        className="w-10 h-10 rounded object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-[#1db954]' : 'text-white'}`}>
                            {track.title}
                          </p>
                          <span className="px-1.5 py-0.5 rounded bg-black/50 text-[9px] text-[#1db954] font-bold uppercase tracking-wider shrink-0 border border-[#1db954]/30">
                            Single
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 truncate">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(track);
                        }}
                        className={`p-1 rounded-full ${
                          isLiked ? 'text-[#1db954]' : 'text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-white'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#1db954]' : ''}`} />
                      </button>
                      <SongOptionsMenu track={track} />
                      <span className="text-xs text-neutral-400 w-10 text-right">
                        {track.durationFormatted}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. MY PLAYLISTS VIEW */}
      {activeTab === 'playlists' && (
        <div className="space-y-6">
          {!user ? (
            <div className="p-10 text-center py-16 bg-zinc-900/40 rounded-2xl border border-white/5">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-4">
                <ListMusic className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Sync Your Playlists</h2>
              <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
                Sign in or sign up with email to create, save, and sync your personal playlists across all your devices.
              </p>
              <button
                onClick={openLoginModal}
                className="py-2.5 px-6 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-sm transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Sign in or sign up with email
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Playlists Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#1db954] flex items-center justify-center text-black shadow-lg">
                    <ListMusic className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">My Playlists</h1>
                    <p className="text-xs text-zinc-400">
                      {customPlaylists.length} personal collection{customPlaylists.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsCreateOpen(!isCreateOpen)}
                  className="py-2 px-4 bg-[#1db954] hover:bg-[#1ed760] text-black font-bold rounded-full text-xs flex items-center gap-2 transition hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Create Playlist</span>
                </button>
              </div>

              {/* Create Playlist Form */}
              {isCreateOpen && (
                <div className="p-5 rounded-xl bg-[#282828] border border-[#1db954]/30 shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FolderPlus className="w-4 h-4 text-[#1db954]" />
                    New Playlist Details
                  </h3>
                  <form onSubmit={handleCreatePlaylist} className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1.5 ml-1">Name</label>
                      <input
                        type="text"
                        required
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        placeholder="My Awesome Playlist"
                        className="w-full bg-[#3e3e3e] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-[#1db954] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1.5 ml-1">Description (Optional)</label>
                      <input
                        type="text"
                        value={playlistDesc}
                        onChange={(e) => setPlaylistDesc(e.target.value)}
                        placeholder="What's this collection about?"
                        className="w-full bg-[#3e3e3e] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:border-[#1db954] focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsCreateOpen(false)}
                        className="py-2 px-4 rounded-full text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="py-2 px-6 bg-white text-black font-bold rounded-full text-xs transition hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Playlists Content */}
              {selectedPlaylist ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <button
                    onClick={() => setSelectedPlaylistId(null)}
                    className="text-xs text-[#1db954] hover:underline flex items-center gap-1.5 font-bold cursor-pointer transition-all"
                  >
                    <span>← Back to all playlists</span>
                  </button>

                  <div className="p-6 rounded-2xl bg-gradient-to-br from-[#282828] to-black border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br from-[#1db954]/20 to-emerald-950/40 border border-[#1db954]/30 flex items-center justify-center text-[#1db954] shrink-0 shadow-2xl">
                        <ListMusic className="w-10 h-10" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xl sm:text-2xl font-black text-white truncate">{selectedPlaylist.title || selectedPlaylist.name}</h2>
                        <p className="text-sm text-zinc-400 line-clamp-1">{selectedPlaylist.description || 'Custom curated collection'}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[11px] font-bold text-[#1db954] uppercase tracking-widest bg-[#1db954]/10 px-2 py-0.5 rounded">
                            {playlistTracks.length} Track{playlistTracks.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {playlistTracks.length > 0 && (
                        <button
                          onClick={() => handlePlayEntirePlaylist(selectedPlaylist)}
                          className="h-10 px-6 bg-[#1db954] hover:bg-[#1ed760] text-black font-extrabold rounded-full text-xs flex items-center gap-2 shadow-xl hover:scale-105 transition-all cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-black" />
                          <span>Play Playlist</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          deleteCustomPlaylist(selectedPlaylist.id);
                          setSelectedPlaylistId(null);
                        }}
                        className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-rose-500 rounded-full hover:bg-rose-500/10 transition-all cursor-pointer border border-transparent hover:border-rose-500/20"
                        title="Delete playlist"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {playlistTracks.length === 0 ? (
                    <div className="p-16 text-center rounded-2xl bg-zinc-900/40 border border-white/5 space-y-3">
                      <Music2 className="w-10 h-10 text-zinc-700 mx-auto" />
                      <p className="text-white font-bold">This playlist is empty</p>
                      <p className="text-xs text-zinc-500 max-w-xs mx-auto">Add tracks from Singles or Search to start building your collection.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {playlistTracks.map((track, idx) => {
                        const isCurrent = currentTrack?.id === track.id;
                        return (
                          <div
                            key={track.id}
                            className={`group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer ${
                              isCurrent ? 'bg-white/10' : ''
                            }`}
                          >
                            <div
                              onClick={() => playTrack(track, playlistTracks)}
                              className="flex items-center gap-4 flex-1 min-w-0"
                            >
                              <span className="w-6 text-center text-[11px] font-bold text-zinc-500 group-hover:hidden">
                                {isCurrent ? <span className="text-[#1db954]">▶</span> : idx + 1}
                              </span>
                              <button className="w-6 hidden group-hover:flex items-center justify-center text-white">
                                <Play className="w-4 h-4 fill-white" />
                              </button>
                              <CoverArtImage
                                track={track}
                                className="w-10 h-10 rounded object-cover shrink-0 shadow-lg"
                              />
                              <div className="min-w-0">
                                <h4 className={`text-sm font-bold truncate ${isCurrent ? 'text-[#1db954]' : 'text-white'}`}>
                                  {track.title}
                                </h4>
                                <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <SongOptionsMenu track={track} currentPlaylistId={selectedPlaylist.id} />
                              <span className="text-[11px] font-mono text-zinc-500 w-10 text-right">
                                {track.durationFormatted}
                              </span>
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
                    <div className="p-16 text-center rounded-2xl bg-zinc-900/40 border border-white/5 space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto text-zinc-600">
                        <Disc3 className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-white font-bold">No playlists yet</p>
                        <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-1">Curate your perfect morning listening experience with custom playlists.</p>
                      </div>
                      <button
                        onClick={() => setIsCreateOpen(true)}
                        className="py-2 px-6 bg-white text-black font-bold rounded-full text-xs transition hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        Create Your First Playlist
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {customPlaylists.map((pl) => (
                        <div
                          key={pl.id}
                          onClick={() => setSelectedPlaylistId(pl.id)}
                          className="group p-4 rounded-2xl bg-[#181818] border border-white/5 hover:border-[#1db954]/30 hover:bg-[#282828] transition-all cursor-pointer relative overflow-hidden"
                        >
                          <div className="aspect-square w-full rounded-xl bg-gradient-to-br from-[#1db954]/20 to-black border border-white/5 flex items-center justify-center text-[#1db954] mb-4 shadow-2xl transition-transform duration-500 group-hover:scale-105">
                            <ListMusic className="w-12 h-12" />
                          </div>
                          <div>
                            <h3 className="font-black text-white text-base truncate group-hover:text-[#1db954] transition-colors">
                              {pl.title || pl.name}
                            </h3>
                            <p className="text-xs text-zinc-500 truncate mt-1">
                              {pl.description || `${pl.trackIds.length} tracks in this collection`}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-600">
                            <span>{pl.trackIds.length} Song{pl.trackIds.length === 1 ? '' : 's'}</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteCustomPlaylist(pl.id);
                                  if (selectedPlaylistId === pl.id) setSelectedPlaylistId(null);
                                }}
                                className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
                                title="Delete playlist"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-[#1db954] opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. SYNC EXTERNAL VIEW */}
      {activeTab === 'sync' && user && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5 p-5 sm:p-6 rounded-xl bg-gradient-to-br from-[#1db954]/20 via-black to-black border border-[#1db954]/20 shadow-lg mb-6">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg bg-gradient-to-br from-[#1db954] to-emerald-900 flex items-center justify-center shadow-2xl shrink-0">
              <RefreshCw className="w-12 h-12 text-black" />
            </div>
            <div className="space-y-1 sm:space-y-2">
              <span className="text-xs uppercase font-bold tracking-wider text-[#1db954]">
                External Integration
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white">Sync Playlists</h1>
              <p className="text-xs sm:text-sm text-neutral-400">
                Import your music library from YouTube and Spotify directly into Sabdham.
              </p>
            </div>
          </div>

          <SyncPlaylists />
        </div>
      )}
    </div>
  );
};
