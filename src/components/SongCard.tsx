import React from 'react';
import { Play, Pause, Heart, Clock } from 'lucide-react';
import { Track } from '../types';
import { useMusic } from '../context/MusicContext';
import { CoverArtImage } from './CoverArtImage';
import { SongOptionsMenu } from './SongOptionsMenu';

interface SongCardProps {
  track: Track;
  playlistContext?: Track[];
}

export const SongCard: React.FC<SongCardProps> = ({ track, playlistContext }) => {
  const { currentTrack, isPlaying, playTrack, togglePlayPause, likedTrackIds, toggleLike } = useMusic();

  const isCurrentTrack = currentTrack?.id === track.id;
  const isCurrentlyPlaying = isCurrentTrack && isPlaying;
  const isLiked = likedTrackIds.has(track.id);

  const handleCardClick = () => {
    if (isCurrentTrack) {
      togglePlayPause();
    } else {
      playTrack(track, playlistContext);
    }
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike(track);
  };

  return (
    <div
      id={`song-card-${track.id}`}
      onClick={handleCardClick}
      className="group relative flex flex-col p-1.5 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all duration-200 cursor-pointer w-32 sm:w-40 shrink-0 select-none border border-transparent hover:border-white/5 shadow-sm"
    >
      {/* Artwork Container */}
      <div className="relative aspect-square w-full mb-2 rounded-md overflow-hidden bg-[#242424] shadow-md">
        <CoverArtImage
          track={track}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 rounded-md"
        />

        {/* Single Song Tag */}
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[9px] text-[#1db954] font-bold tracking-wider uppercase border border-[#1db954]/30 shadow-xs">
          Single
        </div>

        {/* Real Duration Tag Overlay */}
        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[10px] text-neutral-200 font-medium">
          <Clock className="w-2.5 h-2.5 text-neutral-400" />
          <span>{track.durationFormatted}</span>
        </div>

        {/* Spotify Green Play Button (Appears on hover or when playing) */}
        <div
          className={`absolute bottom-2 right-2 transition-all duration-200 transform ${
            isCurrentlyPlaying
              ? 'opacity-100 translate-y-0 shadow-lg'
              : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 shadow-lg'
          }`}
        >
          <button
            id={`play-btn-${track.id}`}
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            className="w-10 h-10 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-lg transition-transform hover:scale-108 cursor-pointer"
            aria-label={isCurrentlyPlaying ? 'Pause' : 'Play'}
          >
            {isCurrentlyPlaying ? (
              <Pause className="w-5 h-5 fill-black text-black" />
            ) : (
              <Play className="w-5 h-5 fill-black text-black ml-0.5" />
            )}
          </button>
        </div>

        {/* Playing Waveform Badge */}
        {isCurrentlyPlaying && (
          <div className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#1db954] text-black text-[10px] font-bold">
            <span className="w-1 h-2 bg-black animate-pulse rounded-full" />
            <span className="w-1 h-3 bg-black animate-pulse rounded-full delay-75" />
            <span className="w-1 h-2 bg-black animate-pulse rounded-full delay-150" />
          </div>
        )}
      </div>

      {/* Song Info */}
      <div className="flex items-start justify-between gap-1 min-h-[34px] mt-1.5">
        <div className="flex-1 min-w-0">
          <h3
            className={`text-[13px] font-black truncate leading-tight transition-colors ${
              isCurrentTrack ? 'text-[#1db954]' : 'text-white group-hover:text-white'
            }`}
            title={track.title}
          >
            {track.title}
          </h3>
          <p className="text-[13px] font-bold text-neutral-400 truncate mt-1.5 hover:underline leading-tight" title={track.artist}>
            {track.artist}
          </p>
        </div>

        {/* Actions: Like Heart & 3 Dot Menu */}
        <div className="flex items-center shrink-0">
          <button
            id={`like-btn-${track.id}`}
            onClick={handleLikeClick}
            className={`p-1 rounded-full hover:bg-white/10 transition-colors ${
              isLiked ? 'text-[#1db954]' : 'text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-white'
            }`}
            title={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          >
            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-[#1db954]' : ''}`} />
          </button>
          <SongOptionsMenu track={track} iconClassName="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Single Song badge */}
      <div className="mt-0.5 flex items-center justify-between text-[9px] text-neutral-400 uppercase tracking-wider font-semibold">
        <span className="text-[#1db954]">{track.album || 'Single'}</span>
        {track.year && <span className="text-neutral-500 font-medium">{track.year}</span>}
      </div>
    </div>
  );
};
