import React from 'react';
import { X, Play, Heart, Disc3 } from 'lucide-react';
import { Artist } from '../types';
import { ALL_TRACKS } from '../data/musicCatalog';
import { useMusic } from '../context/MusicContext';
import { CoverArtImage } from './CoverArtImage';
import { SongOptionsMenu } from './SongOptionsMenu';
import { ArtistProfileImage } from './ArtistProfileImage';

interface ArtistDetailModalProps {
  artist: Artist | null;
  onClose: () => void;
}

export const ArtistDetailModal: React.FC<ArtistDetailModalProps> = ({ artist, onClose }) => {
  const { playTrack, currentTrack, isPlaying, togglePlayPause, likedTrackIds, toggleLike } = useMusic();

  if (!artist) return null;

  const artistTracks = ALL_TRACKS.filter(
    (t) =>
      t.artist.toLowerCase().includes(artist.name.toLowerCase()) ||
      (artist.name.includes('Rahman') && t.artist.includes('Rahman')) ||
      (artist.name.includes('Ilaiyaraaja') && t.artist.includes('Ilaiyaraaja')) ||
      (artist.name.includes('Amaradeva') && t.artist.includes('Amaradeva')) ||
      (artist.name.includes('Jothipala') && t.artist.includes('Jothipala'))
  );

  const handlePlayAll = () => {
    if (artistTracks.length > 0) {
      playTrack(artistTracks[0], artistTracks);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-[#181818] rounded-2xl overflow-hidden border border-white/10 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Banner */}
        <div className="relative h-56 sm:h-64 bg-[#282828] shrink-0">
          <ArtistProfileImage
            artist={artist}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-black/40 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6">
            <span className="text-xs uppercase tracking-widest font-bold text-[#1db954]">
              Verified Artist
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-1 drop-shadow-md">
              {artist.name}
            </h2>
            <p className="text-xs text-neutral-300 mt-1">
              {artist.monthlyListeners} monthly listeners
            </p>
          </div>
        </div>

        {/* Content & Tracks */}
        <div className="p-6 overflow-y-auto no-scrollbar space-y-6 flex-1">
          {/* Action Row */}
          <div className="flex items-center gap-4">
            <button
              onClick={handlePlayAll}
              disabled={artistTracks.length === 0}
              className="px-6 py-2.5 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black font-bold text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition-transform cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>Play All</span>
            </button>
            <p className="text-xs text-neutral-400">
              {artistTracks.length} song{artistTracks.length === 1 ? '' : 's'} available
            </p>
          </div>

          {/* Bio */}
          <div>
            <h3 className="text-xs uppercase font-bold text-neutral-400 tracking-wider mb-1.5">About</h3>
            <p className="text-sm text-neutral-300 leading-relaxed">{artist.bio}</p>
          </div>

          {/* Popular Tracks */}
          <div>
            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <Disc3 className="w-4 h-4 text-[#1db954]" />
              <span>Popular Tracks</span>
            </h3>

            {artistTracks.length === 0 ? (
              <p className="text-xs text-neutral-400">No tracks found for this artist.</p>
            ) : (
              <div className="space-y-1">
                {artistTracks.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isLiked = likedTrackIds.has(track.id);

                  return (
                    <div
                      key={track.id}
                      onClick={() => playTrack(track, artistTracks)}
                      className={`flex items-center justify-between p-2 rounded-md hover:bg-[#252525] transition-colors cursor-pointer ${
                        isCurrent ? 'bg-[#222222]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-neutral-400 w-5 text-center">
                          {isCurrent && isPlaying ? <span className="text-[#1db954]">▶</span> : idx + 1}
                        </span>
                        <CoverArtImage
                          track={track}
                          className="w-10 h-10 rounded object-cover"
                        />
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-[#1db954]' : 'text-white'}`}>
                            {track.title}
                          </p>
                          <p className="text-xs text-neutral-400 truncate">{track.album || artist.name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(track);
                          }}
                          className={`p-1 ${isLiked ? 'text-[#1db954]' : 'text-neutral-500 hover:text-white'}`}
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
        </div>
      </div>
    </div>
  );
};
