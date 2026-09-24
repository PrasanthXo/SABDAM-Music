import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useMusic } from '../context/MusicContext';

interface AnimatedVolumeControlProps {
  variant?: 'compact' | 'standard' | 'full';
  className?: string;
  showVisualizer?: boolean;
}

export const AnimatedVolumeControl: React.FC<AnimatedVolumeControlProps> = ({
  variant = 'standard',
  className = '',
  showVisualizer = true,
}) => {
  const { volume, isMuted, setVolumeLevel, toggleMute, isPlaying } = useMusic();
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);

  const effectiveVolume = isMuted ? 0 : volume;
  const volumePercent = Math.round(effectiveVolume * 100);

  // Pick animated icon based on volume level
  const renderVolumeIcon = () => {
    if (isMuted || effectiveVolume === 0) {
      return (
        <motion.div
          key="muted"
          initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.6, rotate: 20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <VolumeX className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-red-400 group-hover:text-red-300 transition-colors" />
        </motion.div>
      );
    }
    if (effectiveVolume < 0.35) {
      return (
        <motion.div
          key="low"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <Volume className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-neutral-300 group-hover:text-white transition-colors" />
        </motion.div>
      );
    }
    if (effectiveVolume < 0.7) {
      return (
        <motion.div
          key="medium"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <Volume1 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-neutral-200 group-hover:text-[#1db954] transition-colors" />
        </motion.div>
      );
    }
    return (
      <motion.div
        key="high"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <Volume2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white group-hover:text-[#1db954] transition-colors" />
      </motion.div>
    );
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolumeLevel(val);
  };

  return (
    <div
      className={`relative flex items-center gap-2 select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsDragging(false);
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Floating Animated Percentage Tooltip */}
      <AnimatePresence>
        {(isHovered || isDragging) && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: -24, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-30 px-2 py-0.5 rounded-full bg-zinc-900/95 text-white border border-white/10 text-[10px] font-mono font-bold shadow-xl backdrop-blur-md pointer-events-none whitespace-nowrap flex items-center gap-1"
          >
            {isMuted || effectiveVolume === 0 ? (
              <span className="text-red-400">Muted</span>
            ) : (
              <>
                <span className="text-amber-400">VOL</span>
                <span>{volumePercent}%</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Volume Button with Sound Wave Pulse */}
      <motion.button
        type="button"
        id="animated-volume-toggle-btn"
        onClick={(e) => {
          e.stopPropagation();
          toggleMute();
        }}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.88 }}
        className="relative group p-1.5 rounded-full hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer flex items-center justify-center shrink-0 focus:outline-none"
        title={isMuted ? 'Click to Unmute' : 'Click to Mute'}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {/* Subtle glowing ring pulse when sound is actively playing */}
        {isPlaying && !isMuted && effectiveVolume > 0 && (
          <motion.span
            className="absolute inset-0 rounded-full bg-[#1db954]/20 pointer-events-none"
            animate={{
              scale: [1, 1.35, 1],
              opacity: [0.3, 0, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        <AnimatePresence mode="wait">
          {renderVolumeIcon()}
        </AnimatePresence>
      </motion.button>

      {/* Mini Animated Equalizer Visualizer Bars */}
      {showVisualizer && variant !== 'compact' && (
        <div className="flex items-end gap-0.5 h-3 px-0.5 shrink-0" title="Audio Level">
          {[0.4, 0.8, 0.6].map((multiplier, idx) => (
            <motion.span
              key={idx}
              className={`w-0.5 rounded-full transition-colors ${
                isMuted || effectiveVolume === 0
                  ? 'bg-zinc-700 h-1'
                  : 'bg-gradient-to-t from-[#1db954] to-emerald-300'
              }`}
              animate={
                isPlaying && !isMuted && effectiveVolume > 0
                  ? {
                      height: [
                        `${Math.max(2, 4 * multiplier)}px`,
                        `${Math.max(3, 12 * multiplier * effectiveVolume)}px`,
                        `${Math.max(2, 3 * multiplier)}px`,
                      ],
                    }
                  : { height: '3px' }
              }
              transition={{
                duration: 0.6 + idx * 0.15,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Slider Track with Custom Progress Fill & Glow */}
      <div
        className={`relative flex items-center group ${
          variant === 'full'
            ? 'flex-1'
            : variant === 'compact'
            ? 'w-16 sm:w-20'
            : 'w-20 sm:w-28'
        }`}
      >
        {/* Background Track */}
        <div className="absolute inset-x-0 h-1.5 bg-zinc-800 rounded-full overflow-hidden shadow-inner border border-white/5">
          {/* Animated Active Progress Fill */}
          <motion.div
            className={`h-full rounded-full transition-colors ${
              isMuted || effectiveVolume === 0
                ? 'bg-zinc-600'
                : 'bg-gradient-to-r from-emerald-500 via-[#1db954] to-amber-400 group-hover:brightness-110 shadow-sm shadow-[#1db954]/40'
            }`}
            style={{ width: `${effectiveVolume * 100}%` }}
            transition={{ duration: 0.05 }}
          />
        </div>

        {/* Real Range Input */}
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={effectiveVolume}
          onChange={handleSliderChange}
          onMouseDown={() => setIsDragging(true)}
          onTouchStart={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchEnd={() => setIsDragging(false)}
          className="relative w-full h-1.5 opacity-0 cursor-pointer z-10"
          aria-label="Volume Slider"
        />

        {/* Custom Animated Thumb */}
        <motion.div
          className={`absolute pointer-events-none w-3 h-3 rounded-full bg-white shadow-md border border-black/20 ${
            isHovered || isDragging ? 'opacity-100 scale-110' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
          } transition-all duration-150`}
          style={{
            left: `calc(${effectiveVolume * 100}% - 6px)`,
          }}
        />
      </div>
    </div>
  );
};
