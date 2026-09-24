import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Maximize2,
  Loader2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { formatTime } from '../utils/greeting';
import { CoverArtImage } from './CoverArtImage';
import { AnimatedVolumeControl } from './AnimatedVolumeControl';

export const MiniPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    isShuffled,
    repeatMode,
    isLoading,
    likedTrackIds,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    toggleShuffle,
    cycleRepeatMode,
    toggleLike,
    openFullPlayer,
  } = useMusic();

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [mobileVolumeOpen, setMobileVolumeOpen] = useState(false);

  if (!currentTrack) return null;

  const isLiked = likedTrackIds.has(currentTrack.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seekTo(val);
  };

  return (
    <div
      id="mini-player-bar"
      onClick={openFullPlayer}
      className="fixed bottom-[64px] md:bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-[#08120c]/98 via-[#09090b]/98 to-[#081014]/98 backdrop-blur-2xl border-t border-emerald-500/30 select-none cursor-pointer transition-all duration-200 hover:brightness-110 shadow-[0_-12px_45px_rgba(0,0,0,0.95)]"
    >
      {/* Top Border Vivid Gradient Glow with Pulse Animation */}
      <motion.div 
        animate={isPlaying && !isLoading ? { 
          boxShadow: [
            "0 0 14px rgba(29,185,84,0.7)",
            "0 0 25px rgba(29,185,84,0.9)",
            "0 0 14px rgba(29,185,84,0.7)"
          ],
          opacity: [0.8, 1, 0.8]
        } : {}}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-emerald-500 via-[#1db954] to-teal-400 z-10" 
      />

      {/* Top Mobile Progress Indicator Line - Increased Thickness & Color */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-2 bg-zinc-900/90 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#1db954] via-emerald-400 to-teal-300 transition-all duration-150 shadow-[0_0_12px_rgba(29,185,84,0.85)]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        {/* LEFT: Current Track Artwork & Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-initial md:w-1/4">
          <div className="relative w-11 h-11 sm:w-13 sm:h-13 rounded-lg overflow-hidden bg-zinc-900 shrink-0 shadow-lg border border-white/5">
            <CoverArtImage
              track={currentTrack}
              className="w-full h-full object-cover rounded-lg"
            />
            {isLoading && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-xs">
                <Loader2 className="w-4 h-4 text-[#1db954] animate-spin" />
              </div>
            )}
            {/* Live Playing Sound Indicator on Album Art */}
            {isPlaying && !isLoading && (
              <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-[#1db954] shadow-xs shadow-[#1db954] animate-ping pointer-events-none" />
            )}
          </div>

          <div className="min-w-0 pr-1 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs sm:text-sm font-semibold text-white truncate hover:underline hover:text-[#1db954] transition-colors">
                {currentTrack.title}
              </p>
              {/* Beat Visualizer Animation */}
              {isPlaying && !isLoading && (
                <div className="flex items-end gap-0.5 h-3 shrink-0 mb-0.5">
                  {[0.4, 0.7, 0.5, 0.8].map((delay, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        height: ["20%", "100%", "40%", "90%", "30%"]
                      }}
                      transition={{
                        duration: 0.6 + (i * 0.1),
                        repeat: Infinity,
                        repeatType: "mirror",
                        ease: "easeInOut",
                        delay: i * 0.1
                      }}
                      className="w-0.5 bg-[#1db954] rounded-full shadow-[0_0_4px_rgba(29,185,84,0.6)]"
                    />
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-zinc-400 truncate hover:underline flex items-center gap-1.5 mt-0.5">
              <span>{currentTrack.artist}</span>
              {(currentTrack.source === 'youtube' || currentTrack.youtubeVideoId) && (
                <span className="px-1 py-0.2 rounded bg-red-600/90 text-[9px] font-black text-white tracking-wider">
                  YT
                </span>
              )}
            </p>
          </div>

          {/* Like Heart with Bounce Animation */}
          <motion.button
            type="button"
            id="mini-player-like-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleLike(currentTrack);
            }}
            whileHover={{ scale: 1.18 }}
            whileTap={{ scale: 0.85 }}
            className={`p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer shrink-0 ${
              isLiked ? 'text-[#1db954]' : 'text-zinc-500 hover:text-white'
            }`}
            title={isLiked ? 'Liked' : 'Like'}
          >
            <Heart className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isLiked ? 'fill-[#1db954]' : ''}`} />
          </motion.button>
        </div>

        {/* CENTER: Desktop Controls & Scrubber */}
        <div className="hidden md:flex flex-col items-center flex-1 max-w-xl px-4">
          <div className="flex items-center gap-4 sm:gap-5 mb-1">
            {/* Shuffle */}
            <motion.button
              type="button"
              id="desktop-shuffle-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleShuffle();
              }}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              className={`p-1.5 rounded-full transition-colors cursor-pointer hover:bg-white/5 ${
                isShuffled ? 'text-[#1db954]' : 'text-zinc-400 hover:text-white'
              }`}
              title={isShuffled ? 'Shuffle On' : 'Shuffle Off'}
            >
              <Shuffle className="w-4 h-4" />
            </motion.button>

            {/* Previous */}
            <motion.button
              type="button"
              id="desktop-prev-btn"
              onClick={(e) => {
                e.stopPropagation();
                playPrevious();
              }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.88 }}
              className="p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Previous"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </motion.button>

            {/* Play/Pause Button with Animated Scaling */}
            <motion.button
              type="button"
              id="desktop-play-btn"
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="w-9 h-9 rounded-full bg-white hover:bg-neutral-100 text-black flex items-center justify-center shadow-lg shadow-white/10 hover:shadow-[#1db954]/25 transition-all cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-black" />
              ) : (
                <Play className="w-4 h-4 fill-black ml-0.5" />
              )}
            </motion.button>

            {/* Next */}
            <motion.button
              type="button"
              id="desktop-next-btn"
              onClick={(e) => {
                e.stopPropagation();
                playNext();
              }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.88 }}
              className="p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Next"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </motion.button>

            {/* Repeat */}
            <motion.button
              type="button"
              id="desktop-repeat-btn"
              onClick={(e) => {
                e.stopPropagation();
                cycleRepeatMode();
              }}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              className={`p-1.5 rounded-full transition-colors cursor-pointer hover:bg-white/5 ${
                repeatMode !== 'off' ? 'text-[#1db954]' : 'text-zinc-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </motion.button>
          </div>

          {/* Desktop Vivid Color Scrubber Row with Increased Thickness */}
          <div className="w-full flex items-center gap-2.5 text-[11px] text-zinc-300 font-mono">
            <span className="w-9 text-right font-medium text-emerald-400/90">{formatTime(currentTime)}</span>
            <div className="relative flex-1 flex items-center group py-2">
              {/* Custom Thick Scrubber Bar Background with Vivid Color & Inset Shadow */}
              <div className="absolute inset-x-0 h-2.5 sm:h-3 group-hover:h-3.5 bg-zinc-900/95 border border-emerald-500/30 rounded-full overflow-hidden transition-all duration-150 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-[#1db954] to-teal-300 shadow-[0_0_14px_rgba(29,185,84,0.8)] rounded-full transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Native Range Input for precise scrubbing with matching thickness */}
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onClick={(e) => e.stopPropagation()}
                onChange={handleScrubberChange}
                onMouseDown={() => setIsScrubbing(true)}
                onMouseUp={() => setIsScrubbing(false)}
                className="relative w-full h-2.5 sm:h-3 group-hover:h-3.5 opacity-0 cursor-pointer z-10"
              />

              {/* Custom Illuminated Scrubber Thumb Indicator */}
              <div
                className={`absolute pointer-events-none w-4 h-4 rounded-full bg-white border-2 border-[#1db954] shadow-[0_0_12px_rgba(29,185,84,0.9)] ${
                  isScrubbing ? 'opacity-100 scale-125' : 'opacity-85 scale-90 group-hover:opacity-100 group-hover:scale-110'
                } transition-all duration-150`}
                style={{
                  left: `calc(${progressPercent}% - 8px)`,
                }}
              />
            </div>
            <span className="w-9 font-medium text-zinc-400">{formatTime(duration)}</span>
          </div>
        </div>

        {/* RIGHT: Animated Volume & Full Player expand (Desktop) / Mobile Quick Controls */}
        <div className="flex items-center justify-end gap-2 sm:gap-4 md:w-1/4">
          {/* Mobile Quick Play/Pause, Next & Quick Animated Volume Toggle */}
          <div className="md:hidden flex items-center gap-1">
            <motion.button
              type="button"
              id="mobile-mini-vol-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMobileVolumeOpen(!mobileVolumeOpen);
              }}
              whileTap={{ scale: 0.85 }}
              className="p-2 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Volume"
            >
              <Volume2 className="w-4.5 h-4.5" />
            </motion.button>

            <motion.button
              type="button"
              id="mobile-mini-play-btn"
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              whileTap={{ scale: 0.88 }}
              className="p-2 text-white hover:text-[#1db954] transition-colors cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </motion.button>

            <motion.button
              type="button"
              id="mobile-mini-next-btn"
              onClick={(e) => {
                e.stopPropagation();
                playNext();
              }}
              whileTap={{ scale: 0.88 }}
              className="p-2 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </motion.button>
          </div>

          {/* Mobile Animated Volume Popover */}
          <AnimatePresence>
            {mobileVolumeOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
                className="md:hidden absolute bottom-full mb-2 right-4 bg-zinc-900/95 border border-zinc-800 rounded-2xl p-3 shadow-2xl backdrop-blur-xl z-50 flex items-center gap-2"
              >
                <AnimatedVolumeControl variant="compact" showVisualizer={false} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Desktop Animated Volume Control */}
          <div className="hidden md:flex items-center">
            <AnimatedVolumeControl variant="standard" showVisualizer={true} />
          </div>

          {/* Expand Full Player Button */}
          <motion.button
            type="button"
            id="expand-full-player-btn"
            onClick={(e) => {
              e.stopPropagation();
              openFullPlayer();
            }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.88 }}
            className="hidden md:flex p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Open Full Player"
          >
            <Maximize2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};
