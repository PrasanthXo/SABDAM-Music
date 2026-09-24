import React, { useState } from 'react';
import { Music, Plus, Play, Trash2, ExternalLink, Disc, Sparkles } from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { useAuth } from '../context/AuthContext';
import { Track } from '../types';
import { handleImageError, ensureValidCoverUrl } from '../utils/imageUtils';
import { CoverArtImage } from './CoverArtImage';
import { SongOptionsMenu } from './SongOptionsMenu';

export const MySongsView: React.FC = () => {
  const { user, openLoginModal } = useAuth();
  const { customSongs, addCustomSong, deleteCustomSong, playTrack, currentTrack, isPlaying } = useMusic();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [youtubeOrAudioUrl, setYoutubeOrAudioUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [language, setLanguage] = useState<'english' | 'tamil' | 'sinhala'>('english');

  const handleAddSong = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !youtubeOrAudioUrl.trim()) return;

    let ytId: string | undefined;
    let audioUrl = youtubeOrAudioUrl.trim();

    // Check if it's a YouTube link
    const ytMatch = audioUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      ytId = ytMatch[1];
    } else if (audioUrl.length === 11 && !audioUrl.includes('/') && !audioUrl.includes('.')) {
      ytId = audioUrl;
    }

    const newSong = addCustomSong({
      title: title.trim(),
      artist: artist.trim() || (user?.name ? user.name : 'Unknown Artist'),
      album: 'My Uploads',
      duration: 180,
      durationFormatted: '3:00',
      coverUrl: coverUrl.trim() || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
      audioUrl: ytId ? `yt:${ytId}` : audioUrl,
      youtubeVideoId: ytId,
      language,
      source: ytId ? 'youtube' : 'curated',
      audio_source_id: ytId || `custom-${Date.now()}`,
    });

    setTitle('');
    setArtist('');
    setYoutubeOrAudioUrl('');
    setCoverUrl('');
    setIsAddOpen(false);

    // Play right away
    playTrack(newSong);
  };

  if (!user) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-4">
          <Music className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">My Songs</h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
          Sign in or sign up with email to save and access your personal songs and custom audio streams.
        </p>
        <button
          onClick={openLoginModal}
          id="my-songs-login-button"
          className="py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 cursor-pointer"
        >
          Sign in or sign up with email
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6" id="my-songs-view">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-zinc-950 shadow-lg shadow-amber-500/20">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">My Songs</h1>
            <p className="text-xs text-zinc-400">
              {customSongs.length} {customSongs.length === 1 ? 'song' : 'songs'} saved to your account ({user.email})
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddOpen(!isAddOpen)}
          id="add-custom-song-button"
          className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-xl text-xs flex items-center space-x-2 transition shadow-md shadow-amber-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Song</span>
        </button>
      </div>

      {/* Add Song Form Modal / Collapsible */}
      {isAddOpen && (
        <div className="p-5 rounded-2xl bg-zinc-900 border border-amber-500/30 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Add Song or YouTube Stream to Your Collection</span>
            </h3>
            <button
              onClick={() => setIsAddOpen(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleAddSong} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Song Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Morning Peace Melody"
                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Artist Name</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g. Anirudh Ravichander or Your Name"
                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">YouTube URL / Video ID or Audio URL *</label>
              <input
                type="text"
                required
                value={youtubeOrAudioUrl}
                onChange={(e) => setYoutubeOrAudioUrl(e.target.value)}
                placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Cover Image URL (Optional)</label>
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 flex items-center justify-end space-x-3 pt-2">
              <button
                type="submit"
                id="submit-new-song-button"
                className="py-2.5 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-bold rounded-xl text-xs shadow-md hover:from-amber-400 hover:to-orange-400 transition cursor-pointer"
              >
                Save & Play Song
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Song List */}
      {customSongs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-white/5 space-y-3">
          <Disc className="w-10 h-10 text-zinc-600 mx-auto animate-spin-slow" />
          <p className="text-zinc-300 font-medium text-sm">No custom songs added yet.</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Add your own songs, ambient recordings, or YouTube audio streams to your private library.
          </p>
          <button
            onClick={() => setIsAddOpen(true)}
            className="mt-2 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl text-xs border border-white/10 transition cursor-pointer"
          >
            Add Your First Song
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {customSongs.map((track, idx) => {
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
                  onClick={() => playTrack(track, customSongs)}
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
                  <button
                    onClick={() => playTrack(track, customSongs)}
                    aria-label="Play song"
                    className="p-2 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-white/5 transition cursor-pointer"
                  >
                    <Play className={`w-4 h-4 ${isCurrent && isPlaying ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </button>

                  <SongOptionsMenu track={track} />

                  <button
                    onClick={() => deleteCustomSong(track.id)}
                    aria-label="Delete song"
                    className="p-2 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
