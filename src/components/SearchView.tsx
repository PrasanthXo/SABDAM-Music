import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Play, Music, Mic2, Disc3, Sparkles, Loader2, Globe, Youtube, EyeOff, TrendingUp, ArrowUpLeft } from 'lucide-react';
import { ALL_TRACKS, ARTISTS } from '../data/musicCatalog';
import { Track, Artist } from '../types';
import { useMusic } from '../context/MusicContext';
import { CoverArtImage } from './CoverArtImage';
import { computeTrackSearchScore, trackMatchesQuery, normalizeSearchText } from '../utils/searchUtils';
import { searchYouTubeSongs } from '../services/youtubeService';
import { SongOptionsMenu } from './SongOptionsMenu';

interface SearchViewProps {
  onSelectArtist?: (artist: Artist) => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  onSelectArtist,
  searchQuery = '',
  onSearchChange,
}) => {
  const [internalQuery, setInternalQuery] = useState(searchQuery);
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<'all' | 'tamil' | 'sinhala' | 'english'>('all');
  const [youtubeResults, setYoutubeResults] = useState<Track[]>([]);
  const [isSearchingYouTube, setIsSearchingYouTube] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'youtube' | 'catalog' | 'artists'>('all');
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = useMusic();

  useEffect(() => {
    setInternalQuery(searchQuery);
  }, [searchQuery]);

  const query = internalQuery || searchQuery;

  const handleQueryChange = (val: string) => {
    setInternalQuery(val);
    if (onSearchChange) {
      onSearchChange(val);
    }
  };

  const handlePlayTrack = (track: Track, contextQueue?: Track[]) => {
    const isSame =
      currentTrack?.id === track.id ||
      (currentTrack?.youtubeVideoId && track.youtubeVideoId && currentTrack.youtubeVideoId === track.youtubeVideoId);
    if (isSame) {
      togglePlayPause();
    } else {
      playTrack(track, contextQueue);
    }
  };

  // Live YouTube songs search effect
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setYoutubeResults([]);
      setIsSearchingYouTube(false);
      return;
    }

    let isMounted = true;
    setIsSearchingYouTube(true);

    const timer = setTimeout(() => {
      searchYouTubeSongs(trimmed, selectedLanguageFilter, 15)
        .then((tracks) => {
          if (!isMounted) return;
          setIsSearchingYouTube(false);
          setYoutubeResults(tracks || []);
        })
        .catch(() => {
          if (!isMounted) return;
          setIsSearchingYouTube(false);
          setYoutubeResults([]);
        });
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query, selectedLanguageFilter]);

  // Search tracks matching query
  const searchResults = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    let filtered = ALL_TRACKS.filter((t) => {
      const langMatch = selectedLanguageFilter === 'all' || t.language === selectedLanguageFilter;
      if (!langMatch) return false;

      const score = computeTrackSearchScore(t, trimmed);
      const matches = trackMatchesQuery(t, trimmed);
      return matches || score > 0;
    });

    return filtered
      .map((track) => ({ track, score: computeTrackSearchScore(track, trimmed) }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.track);
  }, [query, selectedLanguageFilter]);

  // Search artists matching query
  const artistResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    const normQ = normalizeSearchText(trimmed);

    return ARTISTS.filter((a) => {
      const normName = normalizeSearchText(a.name);
      return normName.includes(normQ) || normQ.includes(normName);
    });
  }, [query]);

  // Quick song-related search queries
  const quickSongSearches = [
    'Manja Balloon',
    'Kaavaalaa',
    'Hukum',
    'Chuttamalle',
    'Katchi Sera',
    'Aasa Kooda',
    'Golden Sparrow',
    'Manike Mage Hithe',
    'Tauba Tauba',
    'Rowdy Baby',
    'Vaathi Coming',
    'Espresso',
  ];

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 space-y-6">
      {/* Search Bar Input */}
      <div className="relative max-w-2xl mx-auto w-full">
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-5 h-5 text-amber-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search song titles, lyrics, artists, Tamil, Sinhala & English songs..."
            autoFocus
            className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-zinc-900/90 text-white placeholder-zinc-500 text-sm sm:text-base border border-amber-500/20 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all shadow-xl"
          />
          {query && (
            <button
              onClick={() => handleQueryChange('')}
              className="absolute right-3 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Language Filters */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: 'All Languages' },
            { id: 'tamil', label: 'தமிழ் (Tamil)' },
            { id: 'sinhala', label: 'සිංහල (Sinhala)' },
            { id: 'english', label: 'English' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedLanguageFilter(item.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedLanguageFilter === item.id
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-white border border-zinc-700/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {!query.trim() ? (
        /* Default Empty State: Category Cards & Trending Songs */
        <div className="space-y-6 pt-2">
          {/* Quick Song Searches Tags */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Trending Song Searches</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {quickSongSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => handleQueryChange(term)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-xs sm:text-sm text-zinc-300 hover:text-amber-400 transition cursor-pointer group"
                >
                  <Music className="w-3.5 h-3.5 text-amber-400/70 group-hover:text-amber-400" />
                  <span>{term}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Featured Categories Grid */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">Browse Music Categories</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { title: 'Tamil Cinema Songs', query: 'Kaavaalaa', bg: 'from-amber-900/80 to-zinc-900', border: 'border-amber-500/30' },
                { title: 'Sinhala Song Hits', query: 'Manike Mage Hithe', bg: 'from-teal-900/80 to-zinc-900', border: 'border-teal-500/30' },
                { title: 'English Pop Songs', query: 'Espresso', bg: 'from-indigo-900/80 to-zinc-900', border: 'border-indigo-500/30' },
                { title: 'Top Movie Tracks', query: 'Hukum', bg: 'from-orange-900/80 to-zinc-900', border: 'border-orange-500/30' },
              ].map((cat) => (
                <button
                  key={cat.title}
                  onClick={() => handleQueryChange(cat.query)}
                  className={`p-4 rounded-2xl bg-gradient-to-br ${cat.bg} border ${cat.border} text-left hover:scale-[1.02] transition cursor-pointer shadow-lg`}
                >
                  <Disc3 className="w-6 h-6 text-amber-400 mb-2" />
                  <span className="font-bold text-sm text-white block">{cat.title}</span>
                  <span className="text-[11px] text-zinc-400">Explore collection</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Active Search Results */
        <div className="space-y-6">
          {/* Quick Result Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-white/5'
              }`}
            >
              All Results
            </button>
            <button
              onClick={() => setActiveTab('youtube')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'youtube'
                  ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-white/5'
              }`}
            >
              <Youtube className="w-3.5 h-3.5 text-red-400 fill-current" />
              <span>Results</span>
              {youtubeResults.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-black/30 font-mono">
                  {youtubeResults.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'catalog'
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-white/5'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Catalog Songs</span>
              {searchResults.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-black/20 font-mono">
                  {searchResults.length}
                </span>
              )}
            </button>
            {artistResults.length > 0 && (
              <button
                onClick={() => setActiveTab('artists')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'artists'
                    ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                    : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-white/5'
                }`}
              >
                <Mic2 className="w-3.5 h-3.5" />
                <span>Artists</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-black/20 font-mono">
                  {artistResults.length}
                </span>
              </button>
            )}
          </div>

          {/* 1. Search Results - PROMINENT AT TOP */}
          {(activeTab === 'all' || activeTab === 'youtube') && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-500" />
                  <span>Results</span>
                  {youtubeResults.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30">
                      {youtubeResults.length} tracks
                    </span>
                  )}
                </h3>
                {isSearchingYouTube && (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />
                    <span>Fetching results...</span>
                  </div>
                )}
              </div>

              {youtubeResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {youtubeResults.map((track) => {
                    const isCurrent =
                      currentTrack?.id === track.id ||
                      (currentTrack?.youtubeVideoId && track.youtubeVideoId && currentTrack.youtubeVideoId === track.youtubeVideoId);
                    const isTrackPlaying = isCurrent && isPlaying;

                    return (
                      <div
                        key={track.id}
                        onClick={() => handlePlayTrack(track, youtubeResults)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 group ${
                          isCurrent
                            ? 'bg-red-950/50 border-red-500/60 shadow-lg shadow-red-950/40'
                            : 'bg-zinc-900/80 hover:bg-zinc-800/90 border-zinc-800/80 hover:border-red-500/30'
                        }`}
                      >
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 shadow-md">
                          <CoverArtImage track={track} alt={track.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <div
                            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg">
                              <Play className={`w-4 h-4 ${isTrackPlaying ? 'animate-pulse' : 'ml-0.5'}`} />
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className={`text-sm font-bold truncate ${isCurrent ? 'text-red-400' : 'text-white'}`}>
                            {track.title}
                          </h4>
                          <p className="text-xs text-zinc-400 truncate mt-0.5">{track.artist}</p>
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] px-2 py-0.5 rounded-md bg-red-500/15 text-red-300 border border-red-500/25">
                            <Youtube className="w-3 h-3 text-red-500 flex-shrink-0" /> Result
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-zinc-500 font-mono">
                            {track.durationFormatted || '3:30'}
                          </span>
                          <SongOptionsMenu track={track} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : isSearchingYouTube ? (
                <div className="p-8 text-center bg-zinc-900/50 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                  <p className="text-zinc-300 text-sm">Searching for "{query}"...</p>
                </div>
              ) : activeTab === 'youtube' || searchResults.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/50 rounded-2xl border border-zinc-800">
                  <p className="text-zinc-400 text-sm">No results found for "{query}"</p>
                  <p className="text-zinc-500 text-xs mt-1">Try searching by song title, artist name, or film soundtrack.</p>
                </div>
              ) : null}
            </div>
          )}

          {/* 2. Songs Results from Local Catalog */}
          {(activeTab === 'all' || activeTab === 'catalog') && searchResults.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Music className="w-4 h-4 text-amber-400" />
                <span>Catalog Songs ({searchResults.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {searchResults.map((track) => {
                  const isCurrent =
                    currentTrack?.id === track.id ||
                    (currentTrack?.youtubeVideoId && track.youtubeVideoId && currentTrack.youtubeVideoId === track.youtubeVideoId);
                  const isTrackPlaying = isCurrent && isPlaying;

                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(track, searchResults)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 group ${
                        isCurrent
                          ? 'bg-amber-950/40 border-amber-500/50 shadow-lg shadow-amber-950/30'
                          : 'bg-zinc-900/80 hover:bg-zinc-800/90 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                        <CoverArtImage track={track} alt={track.title} className="w-full h-full object-cover" />
                        <div
                          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                            isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-md">
                            <Play className={`w-4 h-4 ${isTrackPlaying ? 'animate-pulse' : 'ml-0.5'}`} />
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className={`text-sm font-bold truncate ${isCurrent ? 'text-amber-400' : 'text-white'}`}>
                          {track.title}
                        </h4>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{track.artist}</p>
                        {track.movie && (
                          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/50 truncate">
                            🎬 {track.movie}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-zinc-500 font-mono">
                          {track.durationFormatted || '3:45'}
                        </span>
                        <SongOptionsMenu track={track} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Artists Match */}
          {(activeTab === 'all' || activeTab === 'artists') && artistResults.length > 0 && (
            <div className="pt-2">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Mic2 className="w-4 h-4 text-amber-400" />
                <span>Artists</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {artistResults.map((artist) => (
                  <button
                    key={artist.id}
                    onClick={() => onSelectArtist?.(artist)}
                    className="p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 flex items-center gap-3 transition cursor-pointer text-left group"
                  >
                    <img
                      src={artist.imageUrl}
                      alt={artist.name}
                      className="w-12 h-12 rounded-full object-cover border border-amber-500/30 group-hover:scale-105 transition"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-sm text-white block truncate">{artist.name}</span>
                      <span className="text-[11px] text-amber-400 font-medium capitalize">{artist.language} Artist</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

