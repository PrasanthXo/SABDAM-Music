import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  ListMusic,
  FileText,
  Loader2,
  Share2,
  ArrowUp,
  ArrowDown,
  Trash2,
  Info,
  Film,
  Mic2,
  Music,
  Users,
  Sparkles,
} from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { formatTime } from '../utils/greeting';
import { CoverArtImage } from './CoverArtImage';
import { SongOptionsMenu } from './SongOptionsMenu';
import { AnimatedVolumeControl } from './AnimatedVolumeControl';
import { getEnhancedTrackInfo } from '../utils/songInfo';
import { copyToClipboard } from '../utils/clipboardUtils';

export const FullPlayerModal: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffled,
    repeatMode,
    queue,
    queueIndex,
    isLoading,
    likedTrackIds,
    isFullPlayerOpen,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    setVolumeLevel,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    toggleLike,
    closeFullPlayer,
    playTrack,
    setQueue,
    setQueueIndex,
    addMatchingSongsToQueue,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [isQueueLoading, setIsQueueLoading] = useState(false);

  const handleQueueScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 200) {
      if (!isQueueLoading) {
        setIsQueueLoading(true);
        addMatchingSongsToQueue(20);
        setTimeout(() => setIsQueueLoading(false), 500);
      }
    }
  };
  const [copyNotification, setCopyNotification] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const handleRemoveFromQueue = (indexToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newQueue = [...queue];
    newQueue.splice(indexToRemove, 1);
    setQueue(newQueue);

    if (indexToRemove === queueIndex) {
      if (newQueue.length > 0) {
        const nextIndex = indexToRemove % newQueue.length;
        setQueueIndex(nextIndex);
      }
    } else if (indexToRemove < queueIndex) {
      setQueueIndex(queueIndex - 1);
    }
  };

  const handleMoveInQueue = (indexToMove: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const targetIndex = direction === 'up' ? indexToMove - 1 : indexToMove + 1;
    if (targetIndex < 0 || targetIndex >= queue.length) return;

    const newQueue = [...queue];
    const temp = newQueue[indexToMove];
    newQueue[indexToMove] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;

    setQueue(newQueue);

    if (queueIndex === indexToMove) {
      setQueueIndex(targetIndex);
    } else if (queueIndex === targetIndex) {
      setQueueIndex(indexToMove);
    }
  };

  const handleClearQueue = () => {
    if (!currentTrack) return;
    setQueue([currentTrack]);
    setQueueIndex(0);
  };

  if (!isFullPlayerOpen || !currentTrack) return null;

  const isLiked = likedTrackIds.has(currentTrack.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(parseFloat(e.target.value));
  };

  const handleShare = async () => {
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
        ? 'https://ais-pre-eavywet5zknxtgryw4gwib-602144079882.asia-southeast1.run.app'
        : window.location.origin
      : 'https://ais-pre-eavywet5zknxtgryw4gwib-602144079882.asia-southeast1.run.app';
    const songLink = `${baseUrl}?track=${encodeURIComponent(currentTrack.id)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentTrack.title} - ${currentTrack.artist}`,
          text: `Listen to "${currentTrack.title}" by ${currentTrack.artist} on SABDHAM:`,
          url: songLink,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    const copied = await copyToClipboard(songLink);
    if (copied) {
      setCopyNotification('Song link copied to clipboard!');
      setTimeout(() => setCopyNotification(null), 2500);
    }
  };

  return (
    <div
      id="full-player-modal"
      className="fixed inset-0 z-50 bg-[#121212] flex flex-col justify-between overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Dynamic Ambient Background Glow with Pulse */}
      <motion.div
        animate={isPlaying && !isLoading ? {
          opacity: [0.15, 0.3, 0.15],
          scale: [1, 1.05, 1]
        } : { opacity: 0.2, scale: 1 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 pointer-events-none blur-3xl"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 30%, #1db954 0%, transparent 70%)`,
        }}
      />

      {/* Top Bar */}
      <div className="relative z-10 px-4 sm:px-8 pt-4 pb-2 safe-padding-top flex items-center justify-between">
        <button
          id="close-full-player-btn"
          onClick={closeFullPlayer}
          className="p-2 -ml-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Minimize"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="text-center flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 justify-center">
            <img
              src="/logo.jpg"
              alt="Sabdham Logo"
              className="w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-full object-cover border border-white/20 shadow-md"
              referrerPolicy="no-referrer"
            />
            <span className="font-black tracking-widest text-base sm:text-xl uppercase text-zinc-100">
              SABDHAM
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-neutral-400 capitalize flex items-center justify-center gap-1.5 mt-1.5 max-w-[180px] truncate">
            <span>{currentTrack.movie ? `${currentTrack.movie} Soundtrack` : currentTrack.album || 'Featured Hits'}</span>
            {(currentTrack.source === 'youtube' || currentTrack.youtubeVideoId) && (
              <span className="px-1 py-0.2 rounded bg-red-600/90 text-[8px] font-black tracking-wider uppercase text-white shadow-xs">
                YT
              </span>
            )}
          </p>
        </div>

        <button
          onClick={handleShare}
          className="p-2 -mr-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Share track"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {copyNotification && (
        <div className="relative z-20 mx-auto bg-[#1db954] text-black text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
          {copyNotification}
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 max-w-md w-full mx-auto px-6 py-2 sm:py-4 flex flex-col justify-center">
        {/* Tab Switcher: Now Playing / Lyrics / Queue */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <button
            onClick={() => setActiveTab('player')}
            className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === 'player'
                ? 'bg-white/20 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Now Playing
          </button>
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === 'lyrics'
                ? 'bg-white/20 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Lyrics</span>
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === 'queue'
                ? 'bg-white/20 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Queue ({queue.length})</span>
          </button>
        </div>

        {/* 1. PLAYER VIEW */}
        {activeTab === 'player' && (
          <div className="flex flex-col items-center">
            {/* Large Album Artwork with Beat Pulse */}
            <motion.div 
              animate={isPlaying && !isLoading ? {
                scale: [1, 1.02, 1],
                boxShadow: [
                  "0 20px 40px -12px rgba(0, 0, 0, 0.5)",
                  "0 30px 50px -12px rgba(29, 185, 84, 0.25)",
                  "0 20px 40px -12px rgba(0, 0, 0, 0.5)"
                ]
              } : {}}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
              className="relative aspect-square w-44 xs:w-52 sm:w-64 md:w-72 rounded-2xl overflow-hidden shadow-2xl bg-[#242424] border border-white/10 mb-4"
            >
              <CoverArtImage
                track={currentTrack}
                className="w-full h-full object-cover rounded-2xl"
              />
              {isLoading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#1db954] animate-spin" />
                </div>
              )}
            </motion.div>

            {/* Song Title, Artist & Like Button */}
            <div className="w-full flex items-center justify-between mb-3">
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg sm:text-2xl font-bold text-white truncate">
                    {currentTrack.title}
                  </h2>
                  {/* Expanded Beat Visualizer */}
                  {isPlaying && !isLoading && (
                    <div className="flex items-end gap-0.5 h-4 shrink-0 mb-1">
                      {[0.3, 0.8, 0.4, 0.9, 0.5, 0.7].map((delay, i) => (
                        <motion.div
                          key={i}
                          animate={{
                            height: ["25%", "100%", "35%", "95%", "20%"]
                          }}
                          transition={{
                            duration: 0.5 + (i * 0.12),
                            repeat: Infinity,
                            repeatType: "mirror",
                            ease: "easeInOut",
                            delay: i * 0.08
                          }}
                          className="w-0.5 bg-[#1db954] rounded-full shadow-[0_0_8px_rgba(29,185,84,0.7)]"
                        />
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-neutral-400 truncate mt-0.5">
                  {currentTrack.artist} {currentTrack.year ? `• ${currentTrack.year}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  id="full-player-like-btn"
                  onClick={() => toggleLike(currentTrack)}
                  className={`p-2 rounded-full hover:bg-white/10 transition-transform cursor-pointer ${
                    isLiked ? 'text-[#1db954]' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Heart className={`w-5.5 h-5.5 ${isLiked ? 'fill-[#1db954]' : ''}`} />
                </button>
                <SongOptionsMenu track={currentTrack} iconClassName="w-5.5 h-5.5" />
              </div>
            </div>

            {/* Song Credits & Info: Compact horizontal scrolling metadata pills */}
            {(() => {
              const songInfo = getEnhancedTrackInfo(currentTrack);
              return (
                <div className="w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 mb-3 select-none">
                  <div className="flex items-center gap-1 bg-zinc-900/90 text-[10px] text-zinc-400 px-2 py-0.5 rounded-full border border-white/5 shrink-0">
                    <Info className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Credits:</span>
                  </div>
                  {songInfo.singers && (
                    <div className="flex items-center gap-1 bg-zinc-900/90 text-[10px] text-neutral-300 px-2 py-0.5 rounded-full border border-white/5 shrink-0">
                      <Mic2 className="w-2.5 h-2.5 text-[#1db954]" />
                      <span>Singers: <strong className="text-white">{songInfo.singers}</strong></span>
                    </div>
                  )}
                  {songInfo.musicDirector && (
                    <div className="flex items-center gap-1 bg-zinc-900/90 text-[10px] text-neutral-300 px-2 py-0.5 rounded-full border border-white/5 shrink-0">
                      <Music className="w-2.5 h-2.5 text-emerald-300" />
                      <span>Director: <strong className="text-white">{songInfo.musicDirector}</strong></span>
                    </div>
                  )}
                  {songInfo.movie && (
                    <div className="flex items-center gap-1 bg-zinc-900/90 text-[10px] text-neutral-300 px-2 py-0.5 rounded-full border border-white/5 shrink-0">
                      <Film className="w-2.5 h-2.5 text-[#1db954]" />
                      <span>Movie: <strong className="text-white">{songInfo.movie}</strong></span>
                    </div>
                  )}
                  {songInfo.actors && (
                    <div className="flex items-center gap-1 bg-zinc-900/90 text-[10px] text-neutral-300 px-2 py-0.5 rounded-full border border-white/5 shrink-0">
                      <Users className="w-2.5 h-2.5 text-[#1db954]" />
                      <span>Cast: <strong className="text-white">{songInfo.actors}</strong></span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Vivid Color Scrubber / Seek Bar with Increased Thickness */}
            <div className="w-full space-y-1 mb-3.5">
              <div className="relative group flex items-center py-2">
                {/* Custom Thick Scrubber Track */}
                <div className="absolute inset-x-0 h-2 bg-zinc-900/95 border border-emerald-500/30 rounded-full overflow-hidden transition-all duration-150 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-[#1db954] to-teal-300 shadow-[0_0_12px_rgba(29,185,84,0.85)] rounded-full transition-all duration-150"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Native Range Input for precise interaction */}
                <input
                  id="full-player-seek"
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleScrubberChange}
                  onMouseDown={() => setIsScrubbing(true)}
                  onMouseUp={() => setIsScrubbing(false)}
                  className="relative w-full h-2 opacity-0 cursor-pointer z-10"
                />

                {/* Custom Illuminated Scrubber Thumb */}
                <div
                  className={`absolute pointer-events-none w-4 h-4 rounded-full bg-white border-2 border-[#1db954] shadow-[0_0_10px_rgba(29,185,84,0.9)] ${
                    isScrubbing ? 'opacity-100 scale-125' : 'opacity-90 scale-90 group-hover:opacity-100 group-hover:scale-110'
                  } transition-all duration-150`}
                  style={{
                    left: `calc(${progressPercent}% - 8px)`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-zinc-300 font-mono">
                <span className="text-emerald-400 font-medium">{formatTime(currentTime)}</span>
                <span className="text-zinc-400">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Playback Controls */}
            <div className="w-full flex items-center justify-between px-2 mb-4">
              {/* Shuffle */}
              <motion.button
                type="button"
                id="full-player-shuffle-btn"
                onClick={toggleShuffle}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                className={`p-2 transition-colors cursor-pointer rounded-full hover:bg-white/5 ${
                  isShuffled ? 'text-[#1db954]' : 'text-neutral-400 hover:text-white'
                }`}
                title={isShuffled ? 'Shuffle On' : 'Shuffle Off'}
              >
                <Shuffle className="w-5 h-5" />
              </motion.button>

              {/* Previous */}
              <motion.button
                type="button"
                id="full-player-prev-btn"
                onClick={playPrevious}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.88 }}
                className="p-2 text-white hover:text-neutral-300 transition-colors cursor-pointer rounded-full hover:bg-white/5"
                title="Previous"
              >
                <SkipBack className="w-7 h-7 fill-current" />
              </motion.button>

              {/* Big Circular Play/Pause */}
              <motion.button
                type="button"
                id="full-player-play-btn"
                onClick={togglePlayPause}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="w-14 h-14 rounded-full bg-white hover:bg-neutral-100 text-black flex items-center justify-center shadow-2xl transition-all cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isLoading ? (
                  <Loader2 className="w-7 h-7 animate-spin text-black" />
                ) : isPlaying ? (
                  <Pause className="w-7 h-7 fill-black" />
                ) : (
                  <Play className="w-7 h-7 fill-black ml-0.5" />
                )}
              </motion.button>

              {/* Next */}
              <motion.button
                type="button"
                id="full-player-next-btn"
                onClick={playNext}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.88 }}
                className="p-2 text-white hover:text-neutral-300 transition-colors cursor-pointer rounded-full hover:bg-white/5"
                title="Next"
              >
                <SkipForward className="w-7 h-7 fill-current" />
              </motion.button>

              {/* Repeat */}
              <motion.button
                type="button"
                id="full-player-repeat-btn"
                onClick={cycleRepeatMode}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                className={`p-2 transition-colors cursor-pointer rounded-full hover:bg-white/5 ${
                  repeatMode !== 'off' ? 'text-[#1db954]' : 'text-neutral-400 hover:text-white'
                }`}
                title={`Repeat: ${repeatMode}`}
              >
                {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              </motion.button>
            </div>

            {/* Animated Volume Control */}
            <div className="w-full px-4 py-2 rounded-2xl bg-zinc-900/90 border border-white/10 shadow-lg backdrop-blur-md">
              <AnimatedVolumeControl variant="full" showVisualizer={true} />
            </div>
          </div>
        )}

        {/* 2. LYRICS VIEW */}
        {activeTab === 'lyrics' && (
          <div className="h-96 sm:h-[450px] overflow-y-auto no-scrollbar rounded-xl bg-[#181818] p-6 border border-white/5 space-y-4">
            <h3 className="text-base font-bold text-white mb-2">
              Lyrics • {currentTrack.title}
            </h3>
            {currentTrack.lyrics ? (
              <p className="text-base sm:text-lg leading-relaxed text-neutral-200 whitespace-pre-line font-medium">
                {currentTrack.lyrics}
              </p>
            ) : (
              <div className="text-center py-16 text-neutral-400">
                <p>Instrumental track or lyrics not available</p>
              </div>
            )}
          </div>
        )}

        {/* 3. QUEUE VIEW */}
        {activeTab === 'queue' && (
          <div className="h-96 sm:h-[450px] overflow-y-auto no-scrollbar rounded-xl bg-[#181818] p-4 border border-white/5 flex flex-col space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs uppercase font-bold tracking-wider text-[#1db954]">
                    Now Playing
                  </h3>
                  {currentTrack && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#1db954]/15 text-[#1db954] border border-[#1db954]/20 capitalize">
                      {currentTrack.language} {currentTrack.genre ? `• ${currentTrack.genre}` : ''}
                    </span>
                  )}
                </div>
                {queue.length > 1 && (
                  <button
                    onClick={handleClearQueue}
                    className="text-[11px] font-semibold text-neutral-400 hover:text-red-400 transition-colors cursor-pointer px-2 py-0.5 rounded hover:bg-white/5"
                  >
                    Clear Queue
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#252525] border border-white/5">
                <CoverArtImage
                  track={currentTrack}
                  className="w-11 h-11 rounded-md object-cover shadow-md"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1db954] truncate">{currentTrack.title}</p>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">{currentTrack.artist}</p>
                </div>
                <span className="text-xs font-mono text-[#1db954] animate-pulse">Playing</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs uppercase font-bold tracking-wider text-neutral-400">
                  Up Next ({queue.length - 1 - queueIndex > 0 ? queue.length - 1 - queueIndex : 0})
                </h3>
                {currentTrack && (
                  <button
                    onClick={() => addMatchingSongsToQueue(50)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-full transition-all cursor-pointer"
                    title={`Add 50 more matching songs`}
                  >
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    + 50 More Songs
                  </button>
                )}
              </div>
              
              <div
                className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5"
                onScroll={handleQueueScroll}
              >
                {queue.length - 1 > queueIndex ? (
                  queue.slice(queueIndex + 1).map((track, sliceIdx) => {
                    const actualIdx = queueIndex + 1 + sliceIdx;
                    const isSameLang = currentTrack && track.language === currentTrack.language;
                    return (
                      <div
                        key={`${track.id}-${actualIdx}`}
                        onClick={() => playTrack(track)}
                        className="group flex items-center justify-between p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.02] transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-xs text-neutral-500 w-4 text-center font-mono">
                            {sliceIdx + 1}
                          </span>
                          <CoverArtImage
                            track={track}
                            className="w-10 h-10 rounded object-cover shadow-sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-white truncate group-hover:text-[#1db954] transition-colors">
                                {track.title}
                              </p>
                              {isSameLang && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-neutral-300 font-mono capitalize shrink-0">
                                  {track.language}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                              {track.artist} {track.genre ? `• ${track.genre}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Controls & Duration */}
                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          <span className="text-xs font-mono text-neutral-500 mr-2 group-hover:hidden">
                            {track.durationFormatted}
                          </span>
                          
                          <div className="hidden group-hover:flex items-center gap-1.5">
                            {/* Move Up */}
                            <button
                              onClick={(e) => handleMoveInQueue(actualIdx, 'up', e)}
                              disabled={actualIdx === queueIndex + 1}
                              className={`p-1 rounded bg-white/5 text-neutral-400 hover:text-[#1db954] disabled:opacity-20 disabled:hover:text-neutral-400 cursor-pointer`}
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>

                            {/* Move Down */}
                            <button
                              onClick={(e) => handleMoveInQueue(actualIdx, 'down', e)}
                              disabled={actualIdx === queue.length - 1}
                              className={`p-1 rounded bg-white/5 text-neutral-400 hover:text-[#1db954] disabled:opacity-20 disabled:hover:text-neutral-400 cursor-pointer`}
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Remove */}
                            <button
                              onClick={(e) => handleRemoveFromQueue(actualIdx, e)}
                              className="p-1 rounded bg-white/5 text-neutral-400 hover:text-red-400 cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <SongOptionsMenu track={track} iconClassName="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 rounded-lg border border-dashed border-white/5 bg-white/[0.01]">
                    <p className="text-xs text-neutral-500 font-medium">No upcoming tracks in queue</p>
                    <p className="text-[10px] text-neutral-600 mt-1">Browse and play more songs to expand the session</p>
                  </div>
                )}
                {queue.length > 0 && (
                  <div className="pt-3 pb-2 text-center">
                    <button
                      onClick={() => addMatchingSongsToQueue(50)}
                      className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 font-semibold text-xs border border-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Scroll down or click to auto-load 50 more matching songs
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Spacer to accommodate the fixed BottomNav (approx 64px) */}
      <div className="relative z-10 h-20 w-full shrink-0 pb-safe" />
    </div>
  );
};
