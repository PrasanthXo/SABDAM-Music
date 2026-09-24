import React from 'react';
import { Home, Search, Library, User } from 'lucide-react';
import { motion } from 'motion/react';
import { NavTab } from '../types';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAndroidModal?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-55 bg-zinc-950/98 backdrop-blur-xl border-t border-white/5 px-3 pt-1.5 pb-4 safe-padding-bottom flex items-center justify-around select-none shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <motion.button
        id="nav-home"
        onClick={() => onSelectTab('home')}
        whileTap={{ scale: 0.9 }}
        className={`flex flex-col items-center gap-0.5 transition-all duration-300 cursor-pointer min-w-[50px] ${
          activeTab === 'home' ? 'text-amber-400' : 'text-zinc-500'
        }`}
      >
        <div className={`p-1 rounded-lg transition-all duration-300 ${activeTab === 'home' ? 'bg-amber-400/10' : ''}`}>
          <Home className={`w-5.5 h-5.5 ${activeTab === 'home' ? 'fill-amber-400/20' : ''}`} />
        </div>
        <span className={`text-[10px] tracking-tight transition-all duration-300 ${activeTab === 'home' ? 'font-black scale-105' : 'font-bold'}`}>Home</span>
      </motion.button>

      <motion.button
        id="nav-search"
        onClick={() => onSelectTab('search')}
        whileTap={{ scale: 0.9 }}
        className={`flex flex-col items-center gap-0.5 transition-all duration-300 cursor-pointer min-w-[50px] ${
          activeTab === 'search' ? 'text-amber-400' : 'text-zinc-500'
        }`}
      >
        <div className={`p-1 rounded-lg transition-all duration-300 ${activeTab === 'search' ? 'bg-amber-400/10' : ''}`}>
          <Search className={`w-5.5 h-5.5 ${activeTab === 'search' ? 'stroke-[2.5]' : ''}`} />
        </div>
        <span className={`text-[10px] tracking-tight transition-all duration-300 ${activeTab === 'search' ? 'font-black scale-105' : 'font-bold'}`}>Search</span>
      </motion.button>

      <motion.button
        id="nav-library"
        onClick={() => onSelectTab('library')}
        whileTap={{ scale: 0.9 }}
        className={`flex flex-col items-center gap-0.5 transition-all duration-300 cursor-pointer min-w-[50px] ${
          activeTab === 'library' ? 'text-amber-400' : 'text-zinc-500'
        }`}
      >
        <div className={`p-1 rounded-lg transition-all duration-300 ${activeTab === 'library' ? 'bg-amber-400/10' : ''}`}>
          <Library className={`w-5.5 h-5.5 ${activeTab === 'library' ? 'fill-amber-400/20' : ''}`} />
        </div>
        <span className={`text-[10px] tracking-tight transition-all duration-300 ${activeTab === 'library' ? 'font-black scale-105' : 'font-bold'}`}>Library</span>
      </motion.button>

      <motion.button
        id="nav-profile"
        onClick={() => onSelectTab('profile')}
        whileTap={{ scale: 0.9 }}
        className={`flex flex-col items-center gap-0.5 transition-all duration-300 cursor-pointer min-w-[50px] ${
          activeTab === 'profile' ? 'text-amber-400' : 'text-zinc-500'
        }`}
      >
        <div className={`p-1 rounded-lg transition-all duration-300 ${activeTab === 'profile' ? 'bg-amber-400/10' : ''}`}>
          <User className={`w-5.5 h-5.5 ${activeTab === 'profile' ? 'fill-amber-400/20' : ''}`} />
        </div>
        <span className={`text-[10px] tracking-tight transition-all duration-300 ${activeTab === 'profile' ? 'font-black scale-105' : 'font-bold'}`}>Profile</span>
      </motion.button>
    </nav>
  );
};
