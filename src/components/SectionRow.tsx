import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Play, Pause } from 'lucide-react';
import { Track } from '../types';
import { SongCard } from './SongCard';
import { ALL_TRACKS, deduplicateTracks } from '../data/musicCatalog';
import { useMusic } from '../context/MusicContext';
import { getSessionLoadedTrackIds, markTracksAsLoaded } from '../utils/sessionTracker';

interface SectionRowProps {
  title: string;
  subtitle?: string;
  tracks: Track[];
  onSeeAll?: () => void;
}

export const SectionRow: React.FC<SectionRowProps> = ({ title, subtitle, tracks: initialTracks, onSeeAll }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tracks, setTracks] = useState<Track[]>(() => {
    const cleanInitial = deduplicateTracks(initialTracks);
    markTracksAsLoaded(cleanInitial.map((t) => t.id));
    return cleanInitial;
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { playTrack, isPlaying, currentTrack, togglePlayPause, recentlyPlayed } = useMusic();

  const isCurrentCatalogLoaded = currentTrack && tracks.some(t => t.id === currentTrack.id);
  const isCurrentCatalogPlaying = isPlaying && isCurrentCatalogLoaded;

  const hasMoreRef = useRef(true);

  React.useEffect(() => {
    hasMoreRef.current = true;
    setTracks((prev) => {
      const cleanInitial = deduplicateTracks(initialTracks);
      markTracksAsLoaded(cleanInitial.map((t) => t.id));
      // Always update if we haven't loaded extra tracks yet
      if (prev.length === 0 || prev.length <= cleanInitial.length) {
        return cleanInitial;
      }
      
      // If user HAS loaded more tracks (scrolled right), 
      // we only want to override their session if the new tracks are fundamentally different (e.g. YouTube fetch finished).
      // If it's just a 30s rotation of the same catalog, don't interrupt their scrolling.
      const hasSharedTracks = cleanInitial.some(newTrack => 
        prev.some(oldTrack => oldTrack.id === newTrack.id)
      );

      if (!hasSharedTracks) {
        return cleanInitial;
      }

      return deduplicateTracks(prev);
    });
  }, [initialTracks]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -360 : 360;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });

      // If scrolling right and approaching the end, load more tracks dynamically
      if (direction === 'right') {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        if (scrollLeft + scrollAmount >= scrollWidth - clientWidth - 300 && !isLoadingMore && hasMoreRef.current) {
          loadMoreTracks();
        }
      }
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // When user scrolls towards the right end (sliding right to left)
    if (target.scrollLeft + target.clientWidth >= target.scrollWidth - 300 && !isLoadingMore && hasMoreRef.current) {
      loadMoreTracks();
    }
  };

  const loadMoreTracks = () => {
    if (isLoadingMore || !hasMoreRef.current) return;
    setIsLoadingMore(true);

    setTimeout(() => {
      const sessionLoaded = getSessionLoadedTrackIds();
      const recentsSet = new Set(recentlyPlayed.map((t) => t.id));
      const existingIds = new Set([...tracks.map((t) => t.id), ...sessionLoaded, ...recentsSet]);
      const existingTitles = new Set(
        tracks.map((t) =>
          (t.title || '').toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim()
        )
      );
      const sampleTrack = tracks[0];

      // Determine required language strictly from section title or sample track
      let targetLanguage = sampleTrack?.language;
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('tamil')) targetLanguage = 'tamil';
      else if (lowerTitle.includes('sinhala')) targetLanguage = 'sinhala';
      else if (lowerTitle.includes('english')) targetLanguage = 'english';

      // Filter pool strictly by language and exclude previously loaded/played songs or duplicate titles
      let pool = ALL_TRACKS.filter((t) => {
        if (existingIds.has(t.id)) return false;
        const normTitle = (t.title || '').toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
        if (normTitle && existingTitles.has(normTitle)) return false;
        return true;
      });
      if (targetLanguage) {
        pool = pool.filter((t) => t.language === targetLanguage);
      }

      // Shuffle and pick 10 more tracks
      const moreTracks = deduplicateTracks([...pool].sort(() => 0.5 - Math.random())).slice(0, 10);

      // If catalog exhausted for this language, stop loading
      if (moreTracks.length === 0) {
        hasMoreRef.current = false;
        setIsLoadingMore(false);
        return;
      }
      
      if (moreTracks.length < 10) {
        hasMoreRef.current = false;
      }

      markTracksAsLoaded(moreTracks.map((t) => t.id));
      setTracks((prev) => [...prev, ...moreTracks]);
      setIsLoadingMore(false);
    }, 400);
  };

  if (tracks.length === 0) return null;

  return (
    <section className="py-0.5 sm:py-1">
      {/* Section Header */}
      <div className="mb-2 px-4 sm:px-8">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-1.5 h-6 bg-[#1db954] rounded-full shadow-[0_0_10px_rgba(29,185,84,0.3)] shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-black text-white hover:underline cursor-pointer truncate tracking-tight">
                {title}
              </h2>
            </div>
          </div>

          {/* Scroll Arrows only on the right */}
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
              if (isCurrentCatalogLoaded) {
                togglePlayPause();
              } else if (tracks.length > 0) {
                playTrack(tracks[0], tracks);
              }
            }}
            className="h-9 sm:h-10 px-5 sm:px-6 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg group"
            title={isCurrentCatalogPlaying ? `Pause ${title}` : `Play ${title}`}
          >
            {isCurrentCatalogPlaying ? (
              <Pause className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-black text-black" />
            ) : (
              <Play className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-black text-black ml-0.5" />
            )}
            <span className="text-xs sm:text-[13px] font-black uppercase tracking-widest">
              {isCurrentCatalogPlaying ? 'Pause' : 'Play Now'}
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

      {/* Horizontal Carousel */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-5 overflow-x-auto no-scrollbar px-4 sm:px-8 scroll-smooth pb-1 items-center"
      >
        {tracks.map((track, idx) => (
          <SongCard key={`${track.id}-${idx}`} track={track} playlistContext={tracks} />
        ))}
        {isLoadingMore && (
          <div className="flex items-center justify-center min-w-[120px] h-48 bg-white/5 rounded-xl border border-white/5 animate-pulse">
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          </div>
        )}
      </div>
    </section>
  );
};
