import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { Artist, Track } from '../types';
import { useMusic } from '../context/MusicContext';
import { ALL_TRACKS } from '../data/musicCatalog';
import { ArtistProfileImage } from './ArtistProfileImage';

interface PopularArtistsRowProps {
  artists: Artist[];
  onSelectArtist: (artist: Artist) => void;
  onSeeAll?: () => void;
}

export const PopularArtistsRow: React.FC<PopularArtistsRowProps> = ({ artists, onSelectArtist, onSeeAll }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { playTrack, isPlaying, currentTrack, togglePlayPause } = useMusic();

  const allArtistTracks = artists.flatMap(artist => 
    ALL_TRACKS.filter(t => t.artist.toLowerCase().includes(artist.name.toLowerCase())).slice(0, 5)
  );
  
  const isCurrentMixLoaded = currentTrack && allArtistTracks.some(t => t.id === currentTrack.id);
  const isCurrentMixPlaying = isPlaying && isCurrentMixLoaded;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleQuickPlayArtist = (e: React.MouseEvent, artist: Artist) => {
    e.stopPropagation();
    const artistTracks = ALL_TRACKS.filter((t) =>
      t.artist.toLowerCase().includes(artist.name.toLowerCase())
    );
    if (artistTracks.length > 0) {
      playTrack(artistTracks[0], artistTracks);
    }
  };

  return (
    <section className="py-0.5 sm:py-1">
      <div className="mb-2 px-4 sm:px-8">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-1.5 h-6 bg-[#1db954] rounded-full shadow-[0_0_10px_rgba(29,185,84,0.3)] shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-black text-white hover:underline cursor-pointer truncate tracking-tight">
                Popular Artists
              </h2>
            </div>
          </div>

          {/* Scroll Arrows on the right */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => scroll('left')}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/5"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/5"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Buttons Row - Below Title */}
        <div className="flex items-center gap-3 ml-4.5">
          <button
            onClick={() => {
              if (isCurrentMixLoaded) {
                togglePlayPause();
              } else if (allArtistTracks.length > 0) {
                playTrack(allArtistTracks[0], allArtistTracks);
              }
            }}
            className="h-9 sm:h-10 px-5 sm:px-6 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg group"
            title={isCurrentMixPlaying ? "Pause Artist Mix" : "Play Artist Mix"}
          >
            {isCurrentMixPlaying ? (
              <Pause className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-black text-black" />
            ) : (
              <Play className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-black text-black ml-0.5" />
            )}
            <span className="text-xs sm:text-[13px] font-black uppercase tracking-widest">
              {isCurrentMixPlaying ? 'Pause' : 'Play Now'}
            </span>
          </button>

          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="h-9 sm:h-10 px-5 sm:px-6 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-[13px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg backdrop-blur-sm border border-white/10 flex items-center shrink-0"
            >
              Show all
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto no-scrollbar px-4 sm:px-8 scroll-smooth pb-1"
      >
        {artists.map((artist) => (
          <div
            key={artist.id}
            id={`artist-card-${artist.id}`}
            onClick={() => onSelectArtist(artist)}
            className="group relative flex flex-col p-3 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all duration-200 cursor-pointer w-36 sm:w-44 shrink-0 select-none border border-transparent hover:border-white/5"
          >
            {/* Circular Artist Photo */}
            <div className="relative aspect-square w-full mb-3 rounded-full overflow-hidden bg-[#282828] shadow-md">
              <ArtistProfileImage
                artist={artist}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />

              {/* Play Button */}
              <div className="absolute bottom-1 right-1 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 shadow-lg">
                <button
                  id={`play-artist-${artist.id}`}
                  onClick={(e) => handleQuickPlayArtist(e, artist)}
                  className="w-10 h-10 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-lg transition-transform hover:scale-108 cursor-pointer"
                  title={`Play ${artist.name}`}
                >
                  <Play className="w-5 h-5 fill-black text-black ml-0.5" />
                </button>
              </div>
            </div>

            {/* Artist Info */}
            <h3 className="text-sm font-semibold text-white truncate text-center group-hover:underline">
              {artist.name}
            </h3>
            <p className="text-xs text-neutral-400 capitalize text-center mt-0.5">
              Artist
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
