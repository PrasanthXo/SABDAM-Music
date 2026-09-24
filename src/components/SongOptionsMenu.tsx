import React, { useState } from 'react';
import {
  MoreVertical,
  MoreHorizontal,
  ListPlus,
  FolderPlus,
  Heart,
  Plus,
  Check,
  X,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { Track } from '../types';
import { useMusic } from '../context/MusicContext';
import { CoverArtImage } from './CoverArtImage';

interface SongOptionsMenuProps {
  track: Track;
  currentPlaylistId?: string;
  horizontal?: boolean;
  className?: string;
  iconClassName?: string;
}

export const SongOptionsMenu: React.FC<SongOptionsMenuProps> = ({
  track,
  currentPlaylistId,
  horizontal = false,
  className = '',
  iconClassName = 'w-4 h-4',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const {
    addToQueue,
    customPlaylists,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    createCustomPlaylist,
    likedTrackIds,
    toggleLike,
  } = useMusic();

  const isLiked = likedTrackIds.has(track.id);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleOpenMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(true);
    setShowPlaylistPicker(false);
    setIsCreatingPlaylist(false);
  };

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsOpen(false);
    setShowPlaylistPicker(false);
    setIsCreatingPlaylist(false);
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    addToQueue(track);
    showToast('Added to play next');
    setIsOpen(false);
  };

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleLike(track);
    showToast(isLiked ? 'Removed from Liked Songs' : 'Saved to Liked Songs');
    setIsOpen(false);
  };

  const handleSelectPlaylist = (e: React.MouseEvent, playlistId: string, playlistName: string) => {
    e.stopPropagation();
    e.preventDefault();
    addTrackToPlaylist(playlistId, track.id);
    showToast(`Added to ${playlistName}`);
    setIsOpen(false);
  };

  const handleCreatePlaylistAndAdd = (e: React.FormEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;
    const newPl = createCustomPlaylist(trimmed);
    addTrackToPlaylist(newPl.id, track.id);
    showToast(`Created & added to ${trimmed}`);
    setNewPlaylistName('');
    setIsCreatingPlaylist(false);
    setIsOpen(false);
  };

  const handleRemoveFromPlaylist = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (currentPlaylistId) {
      removeTrackFromPlaylist(currentPlaylistId, track.id);
      showToast('Removed from playlist');
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* 3 Dot Button */}
      <button
        type="button"
        id={`song-options-btn-${track.id}`}
        onClick={handleOpenMenu}
        className={`p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer ${className}`}
        title="More options"
        aria-label="More options"
      >
        {horizontal ? (
          <MoreHorizontal className={iconClassName} />
        ) : (
          <MoreVertical className={iconClassName} />
        )}
      </button>

      {/* Options Modal / Dialog Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-4 text-white space-y-3 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Track Details */}
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800 border border-white/10">
                <CoverArtImage track={track} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold truncate text-white">{track.title}</h4>
                <p className="text-xs text-zinc-400 truncate mt-0.5">{track.artist}</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Menu Items */}
            {!showPlaylistPicker ? (
              <div className="space-y-1 pt-1">
                {/* Add to Queue */}
                <button
                  type="button"
                  onClick={handleAddToQueue}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-zinc-800/90 text-sm font-semibold text-zinc-200 hover:text-amber-400 transition cursor-pointer group"
                >
                  <ListPlus className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span>Add to Queue</span>
                </button>

                {/* Add to Playlist */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowPlaylistPicker(true);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-zinc-800/90 text-sm font-semibold text-zinc-200 hover:text-amber-400 transition cursor-pointer group"
                >
                  <FolderPlus className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span>Add to Playlist</span>
                </button>

                {/* Favorite / Like */}
                <button
                  type="button"
                  onClick={handleToggleLike}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-zinc-800/90 text-sm font-semibold text-zinc-200 hover:text-amber-400 transition cursor-pointer group"
                >
                  <Heart
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isLiked ? 'text-red-500 fill-red-500' : 'text-zinc-400'
                    }`}
                  />
                  <span>{isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}</span>
                </button>

                {/* Remove from Playlist (if inside playlist view) */}
                {currentPlaylistId && (
                  <button
                    type="button"
                    onClick={handleRemoveFromPlaylist}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-red-500/10 text-sm font-semibold text-red-400 hover:text-red-300 transition cursor-pointer group"
                  >
                    <Trash2 className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
                    <span>Remove from Playlist</span>
                  </button>
                )}
              </div>
            ) : (
              /* Playlist Selection Sub-view */
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-400">
                  <span>Select Playlist</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPlaylistPicker(false);
                    }}
                    className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                  >
                    Back
                  </button>
                </div>

                {/* List of Custom Playlists */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {customPlaylists.length === 0 ? (
                    <p className="text-xs text-zinc-400 p-2 text-center bg-zinc-800/50 rounded-xl">
                      No custom playlists created yet.
                    </p>
                  ) : (
                    customPlaylists.map((pl) => {
                      const containsTrack = pl.trackIds.includes(track.id);
                      return (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={(e) => handleSelectPlaylist(e, pl.id, pl.name)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-zinc-800 text-left text-xs font-semibold text-zinc-200 hover:text-white transition cursor-pointer"
                        >
                          <span className="truncate">{pl.name}</span>
                          {containsTrack && <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Create New Playlist Option */}
                {!isCreatingPlaylist ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreatingPlaylist(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition cursor-pointer mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New Playlist</span>
                  </button>
                ) : (
                  <form onSubmit={handleCreatePlaylistAndAdd} className="space-y-2 pt-1">
                    <input
                      type="text"
                      autoFocus
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      placeholder="Playlist name..."
                      className="w-full px-3 py-2 bg-zinc-800 border border-amber-500/40 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={!newPlaylistName.trim()}
                        className="flex-1 py-1.5 rounded-xl bg-amber-400 text-black text-xs font-bold hover:bg-amber-300 disabled:opacity-50 transition cursor-pointer"
                      >
                        Create & Add
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCreatingPlaylist(false);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-semibold hover:text-white transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[1000] px-4 py-2.5 rounded-full bg-zinc-900 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
};
