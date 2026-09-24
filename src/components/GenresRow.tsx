import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Disc3, Play, Pause } from 'lucide-react';
import { GenreItem, ALL_TRACKS, GENRES } from '../data/musicCatalog';
import { Track } from '../types';
import { useMusic } from '../context/MusicContext';

interface GenresRowProps {
  genres?: GenreItem[];
  onSelectGenre: (genre: GenreItem) => void;
}

export const GenresRow: React.FC<GenresRowProps> = ({ genres = GENRES, onSelectGenre }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { playTrack, isPlaying, currentTrack, togglePlayPause } = useMusic();

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const getGenreTracks = (genre: GenreItem): Track[] => {
    const norm = genre.name.toLowerCase();
    return ALL_TRACKS.filter((t) => {
      if (genre.language !== 'all' && t.language !== genre.language) return false;
      const tGenre = (t.genre || '').toLowerCase();
      if (norm.includes('kuthu')) return tGenre.includes('kuthu') || tGenre.includes('dance');
      if (norm.includes('romance') || norm.includes('love')) return tGenre.includes('romance') || tGenre.includes('melody');
      if (norm.includes('classic')) return (t.year && t.year < 2010) || tGenre.includes('classic');
      if (norm.includes('synthwave') || norm.includes('r&b')) return tGenre.includes('synthwave') || tGenre.includes('r&b') || tGenre.includes('pop');
      if (norm.includes('acoustic') || norm.includes('unplugged')) return tGenre.includes('acoustic') || tGenre.includes('unplugged') || tGenre.includes('melody');
      if (norm.includes('chill') || norm.includes('midnight')) return tGenre.includes('chill') || tGenre.includes('midnight') || tGenre.includes('afrobeat');
      return true;
    });
  };

  const handlePlayGenre = (e: React.MouseEvent, genre: GenreItem) => {
    e.stopPropagation();
    const tracks = getGenreTracks(genre);
    if (tracks.length > 0) {
      if (currentTrack && tracks.some((t) => t.id === currentTrack.id)) {
        togglePlayPause();
      } else {
        playTrack(tracks[0], tracks);
      }
    }
  };

  return (
    <section className="py-2">
      <div className="mb-2 px-4 sm:px-8">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-1.5 h-6 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.4)] shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-black text-white hover:underline cursor-pointer truncate tracking-tight flex items-center gap-2">
                <Disc3 className="w-5 h-5 text-purple-400 animate-spin-slow" />
                Browse Genres & Categories
              </h2>
              <p className="text-xs text-neutral-400 font-medium truncate mt-0.5">
                Explore regional and international music styles
              </p>
            </div>
          </div>

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
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-none px-4 sm:px-8 pb-3 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {(genres || GENRES).map((genre) => {
          const tracks = getGenreTracks(genre);
          const isPlayingThisGenre =
            isPlaying && currentTrack && tracks.some((t) => t.id === currentTrack.id);

          return (
            <div
              key={genre.id}
              onClick={() => onSelectGenre(genre)}
              className="flex-none w-52 sm:w-60 group relative rounded-2xl overflow-hidden cursor-pointer bg-neutral-900 border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_12px_24px_rgba(0,0,0,0.6)] snap-start"
            >
              {/* Background Cover Image with Gradient Overlay */}
              <div className="h-28 sm:h-32 relative overflow-hidden">
                <img
                  src={genre.coverUrl}
                  alt={genre.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent`}
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-r ${genre.gradient} opacity-40 mix-blend-overlay group-hover:opacity-60 transition-opacity`}
                />

                {/* Quick Play Button */}
                <button
                  onClick={(e) => handlePlayGenre(e, genre)}
                  className={`absolute bottom-2 right-2 w-10 h-10 rounded-full bg-purple-500 hover:bg-purple-400 text-black flex items-center justify-center shadow-lg transition-all duration-300 transform ${
                    isPlayingThisGenre
                      ? 'scale-100 opacity-100'
                      : 'scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100'
                  }`}
                  aria-label={`Play ${genre.name}`}
                >
                  {isPlayingThisGenre ? (
                    <Pause className="w-5 h-5 fill-black text-black" />
                  ) : (
                    <Play className="w-5 h-5 fill-black text-black ml-0.5" />
                  )}
                </button>
              </div>

              {/* Genre Info */}
              <div className="p-3 bg-neutral-900/90 border-t border-white/5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-white text-sm sm:text-base group-hover:text-purple-300 transition-colors truncate">
                    {genre.name}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 uppercase shrink-0">
                    {tracks.length} songs
                  </span>
                </div>
                <p className="text-xs text-neutral-400 line-clamp-1 mt-1 font-normal">
                  {genre.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
