import React from 'react';
import { Sun, Sunset, Moon, Menu, Search, X } from 'lucide-react';
import { getGreeting } from '../utils/greeting';
import { Language, NavTab, Artist } from '../types';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  selectedLanguage: Language;
  onSelectLanguage: (lang: Language) => void;
  activeTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  onOpenDrawer?: () => void;
  onOpenProfile?: () => void;
  onOpenAndroidModal?: () => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onSelectArtist?: (artist: Artist | null) => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedLanguage,
  onSelectLanguage,
  activeTab = 'home',
  onSelectTab,
  onOpenDrawer,
  searchQuery,
  onSearchChange,
}) => {
  const { user } = useAuth();
  const greeting = getGreeting();

  const getGreetingIcon = () => {
    switch (greeting) {
      case 'Good morning':
        return <Sun className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 animate-pulse" />;
      case 'Good afternoon':
        return <Sunset className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />;
      case 'Good night':
        return <Moon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-300" />;
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#121212]/95 backdrop-blur-md px-3 sm:px-8 pt-3 sm:pt-4 pb-2.5 border-b border-[#222222] safe-padding-top">
      {/* Top Row: Greeting & Profile */}
      <div className="flex items-center justify-between gap-4">
        {/* Left Side: Hamburger Menu Button + Time-Based Greeting */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <button
            onClick={onOpenDrawer}
            aria-label="Open slide menu"
            id="header-hamburger-menu-button"
            className="md:hidden p-2 sm:p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/10 hover:border-amber-500/40 transition cursor-pointer flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="p-2 rounded-full bg-[#1e1e1e] border border-white/5 flex-shrink-0">
            {getGreetingIcon()}
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{greeting}</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-neutral-400 font-medium hidden xs:block">
              SABDHAM • Pure Audio Streaming
            </p>
          </div>
        </div>

        {/* Center: Sleek Search Bar for Tablet & Desktop View */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4 relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-400 group-focus-within:text-amber-400 transition-colors pointer-events-none" />
          <input
            type="text"
            value={searchQuery || ''}
            onChange={(e) => {
              if (onSearchChange) {
                onSearchChange(e.target.value);
              }
              if (onSelectTab && activeTab !== 'search') {
                onSelectTab('search');
              }
            }}
            placeholder="Search tracks, artists, or soundtracks..."
            className="w-full pl-10 pr-10 py-2 rounded-full bg-zinc-900 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all shadow-inner font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => {
                if (onSearchChange) onSearchChange('');
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right Side: PWA Install Button + Logo */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <PWAInstallButton />
          </div>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
            <img 
              src="/logo.jpg" 
              alt="Sabdham Logo" 
              onClick={() => {
                if (onSelectTab && activeTab !== 'home') {
                  onSelectTab('home');
                }
              }}
              className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover border border-white/10 shadow-xl transition-transform hover:scale-105 cursor-pointer"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>

      {/* Category / Language Chips section */}
      <div className="flex items-center gap-2 mt-2.5 sm:mt-3 overflow-x-auto no-scrollbar pb-1">
        {(['all', 'recent', 'tamil', 'sinhala', 'english'] as Language[]).map((lang) => {
          const isActive = activeTab === 'home' && selectedLanguage === lang && lang !== 'all' ? true : (lang === 'all' && selectedLanguage === 'all' && activeTab === 'home');
          const labels: Record<Language, string> = {
            all: 'All Singles',
            recent: '🔥 Recent Hits',
            '2026': '🔥 2026 Releases',
            tamil: 'தமிழ் (Tamil)',
            sinhala: 'සිංහල (Sinhala)',
            english: 'English',
            hindi: 'हिंदी (Hindi)',
          };
          return (
            <button
              key={lang}
              id={`filter-chip-${lang}`}
              onClick={() => {
                if (onSelectTab && activeTab !== 'home') {
                  onSelectTab('home');
                }
                onSelectLanguage(lang);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-150 whitespace-nowrap cursor-pointer ${
                isActive
                  ? lang === 'recent'
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-black font-bold shadow-md shadow-emerald-900/30'
                    : 'bg-white text-black font-semibold shadow-sm'
                  : lang === 'recent'
                  ? 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 hover:text-emerald-200 border border-emerald-500/30'
                  : 'bg-[#232323] text-neutral-300 hover:bg-[#2e2e2e] hover:text-white border border-white/5'
              }`}
            >
              {labels[lang]}
            </button>
          );
        })}
      </div>
    </header>
  );
};

