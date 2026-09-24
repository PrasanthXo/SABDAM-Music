import React from 'react';
import { Heart, Play, Music, Sparkles } from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { useAuth } from '../context/AuthContext';
import { getTrackById } from '../data/musicCatalog';
import { Track } from '../types';
import { handleImageError, ensureValidCoverUrl } from '../utils/imageUtils';
import { CoverArtImage } from './CoverArtImage';
import { SongOptionsMenu } from './SongOptionsMenu';

export const FavoritesView: React.FC = () => {
  const { user, openLoginModal } = useAuth();
  const { likedTrackIds, toggleLike, playTrack, currentTrack, isPlaying, customSongs } = useMusic();

  const favoriteTracks: Track[] = Array.from(likedTrackIds as Set<string>)
    .map((id: string) => {
      // Look in catalog or custom songs
      const catalogTrack = getTrackById(id, customSongs);
      if (catalogTrack) return catalogTrack;
      return customSongs.find((s) => s.id === id) || null;
    })
    .filter((t): t is Track => t != null);

  if (!user) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-4">
          <Heart className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Favorites</h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
          Sign in or sign up with email to preserve your favorite tracks across sessions and devices.
        </p>
        <button
          onClick={openLoginModal}
          id="favorites-login-button"
          className="py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 cursor-pointer"
        >
          Sign in or sign up with email
        </button>
      </div>
    );
  }

  const handlePlayAll = () => {
    if (favoriteTracks.length > 0) {
      playTrack(favoriteTracks[0], favoriteTracks);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6" id="favorites-view">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-zinc-950 shadow-lg shadow-rose-500/20">
            <Heart className="w-6 h-6 fill-zinc-950" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Favorites</h1>
            <p className="text-xs text-zinc-400">
              {favoriteTracks.length} {favoriteTracks.length === 1 ? 'liked track' : 'liked tracks'} saved for {user.email}
            </p>
          </div>
        </div>

        {favoriteTracks.length > 0 && (
          <button
            onClick={handlePlayAll}
            id="play-all-favorites-button"
            className="py-2.5 px-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center space-x-2 transition shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-zinc-950" />
            <span>Play Favorites</span>
          </button>
        )}
      </div>

      {/* Tracks List */}
      {favoriteTracks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-white/5 space-y-3">
          <Heart className="w-10 h-10 text-zinc-600 mx-auto" />
          <p className="text-zinc-300 font-medium text-sm">No favorite songs yet.</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Tap the heart icon on any song while listening to add it to your personal favorites collection.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {favoriteTracks.map((track, idx) => {
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
                  onClick={() => playTrack(track, favoriteTracks)}
                  className="flex items-center space-x-3.5 flex-1 min-w-0 cursor-pointer"
                >
                  <span className="w-5 text-center text-xs font-mono text-zinc-500 group-hover:text-amber-400">
                    {idx + 1}
                  </span>
                  <CoverArtImage
                    track={track}
                    className="w-11 h-11 rounded-lg object-cover bg-zinc-800 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold truncate group-hover:text-amber-400 transition">
                      {track.title}
                    </h4>
                    <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <span className="text-xs font-mono text-zinc-500 hidden sm:inline-block pr-2">
                    {track.durationFormatted || '3:00'}
                  </span>
                  <button
                    onClick={() => playTrack(track, favoriteTracks)}
                    aria-label="Play song"
                    className="p-2 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-white/5 transition cursor-pointer"
                  >
                    <Play className={`w-4 h-4 ${isCurrent && isPlaying ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </button>
                  <SongOptionsMenu track={track} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
