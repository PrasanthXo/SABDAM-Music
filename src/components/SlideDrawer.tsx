import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  Search,
  Music,
  ListMusic,
  Heart,
  History,
  Settings,
  LogOut,
  LogIn,
  Sun,
  Radio,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Disc3,
  Palette,
  Wifi,
  Bell,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { NavTab } from '../types';

interface SlideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onSelectSettingsSection?: (section: string) => void;
}

export const SlideDrawer: React.FC<SlideDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  onSelectSettingsSection,
}) => {
  const { user, openLoginModal, logout } = useAuth();
  const { likedTrackIds, recentlyPlayed, customPlaylists, customSongs } = useMusic();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  // Listen to Android / browser back button (history popstate) and Escape key
  useEffect(() => {
    if (!isOpen) return;

    // Push dummy history state for Android back button trap
    window.history.pushState({ drawerOpen: true }, '');

    const handlePopState = () => {
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleItemClick = (tab: NavTab) => {
    onSelectTab(tab);
    onClose();
  };

  const handleLoginClick = () => {
    onClose();
    openLoginModal();
  };

  const handleLogoutClick = async () => {
    onClose();
    await logout();
    onSelectTab('home');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            id="drawer-backdrop"
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="absolute inset-y-0 left-0 w-full max-w-[310px] sm:max-w-xs bg-zinc-950 border-r border-white/10 shadow-2xl flex flex-col z-10"
            id="slide-navigation-drawer"
          >
            {/* Drawer Header */}
            <div className="p-5 pt-7 safe-padding-top border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-zinc-950 shadow-md shadow-amber-500/20">
                  <Sun className="w-5 h-5 fill-zinc-950" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white tracking-widest">SABDHAM</h3>
                  <span className="text-[11px] text-amber-400/90 font-medium">Daily Serenity</span>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close menu"
                id="drawer-close-button"
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile / Login Card */}
            <div className="p-4 border-b border-white/5">
              {user ? (
                <div
                  onClick={() => handleItemClick('profile')}
                  className="group flex items-center space-x-3 p-3 rounded-2xl bg-zinc-900/80 border border-white/10 hover:border-amber-500/40 hover:bg-zinc-850 transition cursor-pointer"
                  id="drawer-user-profile-badge"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold text-zinc-950 shadow-md flex-shrink-0"
                    style={{ backgroundColor: user.avatarColor || '#f59e0b' }}
                  >
                    {user.name ? user.name.slice(0, 1).toUpperCase() : user.email.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-sm font-semibold text-white truncate group-hover:text-amber-400 transition">
                        {user.name || 'Morning Listener'}
                      </span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    </div>
                    <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition" />
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/20 text-center">
                  <p className="text-xs text-zinc-300 mb-3">
                    Sign in or sign up with email to save your playlists, favorites & personal songs.
                  </p>
                  <button
                    onClick={handleLoginClick}
                    id="drawer-login-cta-button"
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign in or sign up with email</span>
                  </button>
                </div>
              )}
            </div>

            {/* Navigation Menu Items */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
              <div className="px-3 pb-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Browse & Discover
              </div>

              <motion.button
                onClick={() => handleItemClick('home')}
                id="drawer-nav-home"
                whileTap={{ scale: 0.95 }}
                className={`w-full flex items-center space-x-4 px-4 py-3.5 rounded-2xl text-[15px] font-extrabold transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                  activeTab === 'home'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/5'
                    : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {activeTab === 'home' && (
                  <motion.div
                    layoutId="drawerActiveTab"
                    className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                )}
                <Disc3 className={`w-5 h-5 transition-transform duration-300 ${activeTab === 'home' ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="relative z-10">Home</span>
              </motion.button>

              <button
                onClick={() => handleItemClick('search')}
                id="drawer-nav-search"
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  activeTab === 'search'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>

              {user ? (
                <>
                  <div className="pt-4 px-3 pb-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    My Collection
                  </div>

                  <button
                    onClick={() => handleItemClick('my-songs')}
                    id="drawer-nav-my-songs"
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                      activeTab === 'my-songs'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Music className="w-4 h-4" />
                      <span>My Songs</span>
                    </div>
                    {customSongs.length > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                        {customSongs.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleItemClick('playlists')}
                    id="drawer-nav-playlists"
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                      activeTab === 'playlists'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <ListMusic className="w-4 h-4" />
                      <span>My Playlists</span>
                    </div>
                    {customPlaylists.length > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                        {customPlaylists.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleItemClick('favorites')}
                    id="drawer-nav-favorites"
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                      activeTab === 'favorites'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Heart className="w-4 h-4" />
                      <span>Favorites</span>
                    </div>
                    {likedTrackIds.size > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono">
                        {likedTrackIds.size}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleItemClick('recently-played')}
                    id="drawer-nav-recently-played"
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                      activeTab === 'recently-played'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <History className="w-4 h-4" />
                      <span>Recently Played</span>
                    </div>
                    {recentlyPlayed.length > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                        {recentlyPlayed.length}
                      </span>
                    )}
                  </button>

                  <div className="pt-4 px-3 pb-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Account
                  </div>

                  <button
                    onClick={() => handleItemClick('profile')}
                    id="drawer-nav-profile"
                    className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                      activeTab === 'profile'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>

                  <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    id="drawer-nav-settings-menu"
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                      isSettingsOpen || activeTab === 'settings'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${isSettingsOpen ? 'rotate-90' : ''}`} />
                  </button>

                  {isSettingsOpen && (
                    <div className="pl-6 space-y-1 mt-1 border-l border-zinc-800 ml-3">
                      <button onClick={() => { handleItemClick('settings'); onSelectSettingsSection?.('settings-account'); }} className="w-full flex items-center space-x-3 px-3.5 py-2 text-sm text-zinc-200 hover:text-white transition">
                        <User className="w-3.5 h-3.5" />
                        <span>Account</span>
                      </button>
                      <button onClick={() => { handleItemClick('settings'); onSelectSettingsSection?.('settings-playback'); }} className="w-full flex items-center space-x-3 px-3.5 py-2 text-sm text-zinc-200 hover:text-white transition">
                        <Music className="w-3.5 h-3.5" />
                        <span>Audio & Playback</span>
                      </button>
                      <button onClick={() => { handleItemClick('settings'); onSelectSettingsSection?.('settings-appearance'); }} className="w-full flex items-center space-x-3 px-3.5 py-2 text-sm text-zinc-200 hover:text-white transition">
                        <Palette className="w-3.5 h-3.5" />
                        <span>Appearance</span>
                      </button>
                      <button onClick={() => { handleItemClick('settings'); onSelectSettingsSection?.('settings-storage'); }} className="w-full flex items-center space-x-3 px-3.5 py-2 text-sm text-zinc-200 hover:text-white transition">
                        <Wifi className="w-3.5 h-3.5" />
                        <span>Data & Storage</span>
                      </button>
                      <button onClick={() => { handleItemClick('settings'); onSelectSettingsSection?.('settings-notifications'); }} className="w-full flex items-center space-x-3 px-3.5 py-2 text-sm text-zinc-200 hover:text-white transition">
                        <Bell className="w-3.5 h-3.5" />
                        <span>Notifications</span>
                      </button>
                      <button onClick={() => { handleItemClick('settings'); onSelectSettingsSection?.('settings-about'); }} className="w-full flex items-center space-x-3 px-3.5 py-2 text-sm text-zinc-200 hover:text-white transition">
                        <Info className="w-3.5 h-3.5" />
                        <span>About</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="pt-4 px-3">
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 text-xs text-zinc-400">
                    <p className="font-semibold text-zinc-300 mb-1 flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Guest Mode</span>
                    </p>
                    <span>Log in anytime to isolate and sync your personal listening cloud data across devices.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Logout */}
            {user && (
              <div className="p-4 border-t border-white/10 bg-zinc-900/40">
                <button
                  onClick={handleLogoutClick}
                  id="drawer-logout-button"
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
