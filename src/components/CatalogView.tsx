import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, Loader2, Play, Pause } from 'lucide-react';
import { Track } from '../types';
import { SongCard } from './SongCard';
import { ALL_TRACKS, MODERN_TRACKS_POOL, deduplicateTracks } from '../data/musicCatalog';
import { useMusic } from '../context/MusicContext';
import { getSessionLoadedTrackIds, markTracksAsLoaded } from '../utils/sessionTracker';

interface CatalogViewProps {
  title: string;
  subtitle?: string;
  tracks: Track[];
  onBack: () => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({ title, subtitle, tracks: initialTracks, onBack }) => {
  const { playTrack, isPlaying, currentTrack, togglePlayPause, recentlyPlayed } = useMusic();

  const [displayedTracks, setDisplayedTracks] = useState<Track[]>(() => {
    let base = deduplicateTracks([...initialTracks]);
    const sessionLoaded = getSessionLoadedTrackIds();
    const recentsSet = new Set(recentlyPlayed.map((t) => t.id));

    if (base.length < 50) {
      const existingIds = new Set([...base.map((t) => t.id), ...sessionLoaded, ...recentsSet]);
      const existingTitles = new Set(
        base.map((t) =>
          (t.title || '').toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim()
        )
      );
      const sampleTrack = base[0];

      // Determine language
      let targetLanguage = sampleTrack?.language;
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('tamil')) targetLanguage = 'tamil';
      else if (lowerTitle.includes('sinhala')) targetLanguage = 'sinhala';
      else if (lowerTitle.includes('english')) targetLanguage = 'english';

      // Determine source pool: only use full catalog for classics/retro, otherwise prefer modern pool (2024+)
      const isClassicCategory = lowerTitle.includes('retro') || lowerTitle.includes('classic') || lowerTitle.includes('80s') || lowerTitle.includes('90s') || lowerTitle.includes('legend');
      const basePool = isClassicCategory ? ALL_TRACKS : MODERN_TRACKS_POOL;

      // Filter pool strictly by language and exclude already loaded/played songs and duplicate titles
      let pool = basePool.filter((t) => {
        if (existingIds.has(t.id)) return false;
        const normTitle = (t.title || '').toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
        if (normTitle && existingTitles.has(normTitle)) return false;
        return true;
      });
      if (targetLanguage) {
        pool = pool.filter((t) => t.language === targetLanguage);
      }

      // Add up to 50 unique tracks if available
      const needed = 50 - base.length;
      const moreTracks = deduplicateTracks([...pool].sort(() => 0.5 - Math.random())).slice(0, needed);
      base = deduplicateTracks([...base, ...moreTracks]);
    }
    markTracksAsLoaded(base.map((t) => t.id));
    return base;
  });

  const isCurrentCatalogLoaded = currentTrack && displayedTracks.some(t => t.id === currentTrack.id);
  const isCurrentCatalogPlaying = isPlaying && isCurrentCatalogLoaded;
  
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingRef = useRef(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  const hasMoreRef = useRef(true);

  // Sync state if parent overrides initialTracks
  useEffect(() => {
    hasMoreRef.current = true;
    setDisplayedTracks((prev) => {
      let base = [...initialTracks];
      const sessionLoaded = getSessionLoadedTrackIds();
      const recentsSet = new Set(recentlyPlayed.map((t) => t.id));

      if (base.length < 50) {
        const existingIds = new Set([...base.map((t) => t.id), ...sessionLoaded, ...recentsSet]);
        const sampleTrack = base[0];
        let targetLanguage = sampleTrack?.language;
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('tamil')) targetLanguage = 'tamil';
        else if (lowerTitle.includes('sinhala')) targetLanguage = 'sinhala';
        else if (lowerTitle.includes('english')) targetLanguage = 'english';
        
        const isClassicCategory = lowerTitle.includes('retro') || lowerTitle.includes('classic') || lowerTitle.includes('80s') || lowerTitle.includes('90s') || lowerTitle.includes('legend');
        const basePool = isClassicCategory ? ALL_TRACKS : MODERN_TRACKS_POOL;
        
        let pool = basePool.filter((t) => !existingIds.has(t.id));
        if (targetLanguage) {
          pool = pool.filter((t) => t.language === targetLanguage);
        }
        
        const needed = 50 - base.length;
        const moreTracks = [...pool].sort(() => 0.5 - Math.random()).slice(0, needed);
        base = [...base, ...moreTracks];
      }

      markTracksAsLoaded(base.map((t) => t.id));

      if (prev.length <= base.length) return base;
      
      const hasSharedTracks = base.some(newTrack => 
        prev.some(oldTrack => oldTrack.id === newTrack.id)
      );

      if (!hasSharedTracks) return base;
      return prev;
    });
  }, [initialTracks, title, recentlyPlayed]);

  const loadMoreTracks = () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setIsLoadingMore(true);

    setTimeout(() => {
      setDisplayedTracks((prev) => {
        const sessionLoaded = getSessionLoadedTrackIds();
        const recentsSet = new Set(recentlyPlayed.map((t) => t.id));
        const existingIds = new Set([...prev.map((t) => t.id), ...sessionLoaded, ...recentsSet]);
        const sampleTrack = prev[0];

        // Determine language
        let targetLanguage = sampleTrack?.language;
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('tamil')) targetLanguage = 'tamil';
        else if (lowerTitle.includes('sinhala')) targetLanguage = 'sinhala';
        else if (lowerTitle.includes('english')) targetLanguage = 'english';

        // Determine source pool
        const isClassicCategory = lowerTitle.includes('retro') || lowerTitle.includes('classic') || lowerTitle.includes('80s') || lowerTitle.includes('90s') || lowerTitle.includes('legend');
        const basePool = isClassicCategory ? ALL_TRACKS : MODERN_TRACKS_POOL;

        // Filter pool strictly by language and exclude previously loaded/played songs
        let pool = basePool.filter((t) => !existingIds.has(t.id));
        if (targetLanguage) {
          pool = pool.filter((t) => t.language === targetLanguage);
        }

        // Shuffle and pick 18 more tracks
        const moreTracks = [...pool].sort(() => 0.5 - Math.random()).slice(0, 18);

        // Stop loading if exhausted
        if (moreTracks.length === 0) {
          hasMoreRef.current = false;
          setIsLoadingMore(false);
          loadingRef.current = false;
          return prev;
        }

        if (moreTracks.length < 18) {
          hasMoreRef.current = false;
        }

        markTracksAsLoaded(moreTracks.map((t) => t.id));
        setIsLoadingMore(false);
        loadingRef.current = false;
        return [...prev, ...moreTracks];
      });
    }, 600);
  };

  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container');
    
    const handleScroll = () => {
      if (!scrollContainer) return;
      
      const { scrollHeight, scrollTop, clientHeight } = scrollContainer;
      
      // If we are within 500px of the bottom
      if (scrollHeight - scrollTop <= clientHeight + 500) {
        if (!loadingRef.current && hasMoreRef.current) {
          loadMoreTracks();
        }
      }
    };

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      // Trigger once on mount in case it's already short enough to need more
      handleScroll();
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current && hasMoreRef.current) {
          loadMoreTracks();
        }
      },
      { 
        root: scrollContainer,
        threshold: 0.1,
        rootMargin: '400px'
      } 
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
      observer.disconnect();
    };
  }, [loadMoreTracks]);

  return (
    <div className="pb-28 bg-[#121212]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#121212]/95 backdrop-blur-md px-4 sm:px-8 py-4 sm:py-6 flex items-center gap-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-[#181818] hover:bg-[#282828] text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/5"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (isCurrentCatalogLoaded) {
                togglePlayPause();
              } else if (displayedTracks.length > 0) {
                playTrack(displayedTracks[0], displayedTracks);
              }
            }}
            className="h-8 sm:h-10 px-4 sm:px-6 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg group flex-shrink-0"
            title={isCurrentCatalogPlaying ? `Pause ${title}` : `Play ${title}`}
          >
            {isCurrentCatalogPlaying ? (
              <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black text-black" />
            ) : (
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black text-black ml-0.5" />
            )}
            <span className="text-xs sm:text-sm font-bold uppercase tracking-tight">
              {isCurrentCatalogPlaying ? 'Pause' : 'Play Now'}
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate leading-tight">{title}</h1>
            {subtitle && <p className="text-sm sm:text-base text-neutral-400 mt-1 truncate font-medium">{subtitle}</p>}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 sm:p-8">
        {displayedTracks.length === 0 ? (
          <div className="text-center py-20 text-neutral-400">
            <p>No tracks found in this category.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {displayedTracks.map((track, idx) => (
                <SongCard key={`${track.id}-${idx}`} track={track} playlistContext={displayedTracks} />
              ))}
            </div>
            
            {/* Observer Target & Loading State */}
            <div ref={observerTarget} className="mt-8 flex items-center justify-center h-20 w-full">
              {isLoadingMore && <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
