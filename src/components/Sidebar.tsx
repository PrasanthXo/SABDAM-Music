import React from 'react';
import {
  Home,
  Search,
  Compass,
  Music,
  ListMusic,
  Heart,
  History,
  Settings,
  User,
  LogIn,
  LogOut,
  Sun,
  ShieldCheck,
  Library,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NavTab } from '../types';
import { useMusic } from '../context/MusicContext';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAndroidModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const { user, openLoginModal, logout } = useAuth();
  const { likedTrackIds, customPlaylists, customSongs, recentlyPlayed } = useMusic();

  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 bg-zinc-950 p-4 gap-4 h-screen sticky top-0 border-r border-white/5 select-none transition-all duration-300 ease-in-out relative ${
        isCollapsed ? 'w-20' : 'w-60 lg:w-64'
      }`}
      id="desktop-sidebar"
    >
      {/* Collapse/Expand Slide Button */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-800 border-2 border-amber-500 hover:border-amber-400 flex items-center justify-center text-amber-400 hover:text-white transition-all duration-200 z-50 cursor-pointer shadow-xl shadow-amber-500/30 ring-4 ring-zinc-950"
        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {isCollapsed ? <ChevronRight className="w-5 h-5 text-amber-400" /> : <ChevronLeft className="w-5 h-5 text-amber-400" />}
      </button>

      {/* App Brand */}
      <div className={`flex items-center gap-3 py-4 border-b border-white/5 ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-zinc-950 font-extrabold shadow-md shadow-amber-500/20 flex-shrink-0">
          <Sun className="w-5.5 h-5.5 fill-zinc-950" />
        </div>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col"
          >
            <span className="text-base font-extrabold tracking-widest text-white block leading-tight">
              SABDHAM
            </span>
            <span className="text-[10px] text-amber-400/90 font-medium uppercase tracking-tighter">Daily Serenity</span>
          </motion.div>
        )}
      </div>

      {/* User Status Card */}
      {user ? (
        <div
          onClick={() => onSelectTab('profile')}
          className={`p-3 rounded-2xl bg-zinc-900/80 border border-white/10 hover:border-amber-500/40 hover:bg-zinc-850 transition cursor-pointer flex items-center ${
            isCollapsed ? 'justify-center space-x-0' : 'space-x-3'
          }`}
          title={isCollapsed ? user.name || user.email : undefined}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-zinc-950 shadow-md flex-shrink-0"
            style={{ backgroundColor: user.avatarColor || '#f59e0b' }}
          >
            {user.name ? user.name.slice(0, 1).toUpperCase() : user.email.slice(0, 1).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1">
                <span className="text-xs font-semibold text-white truncate">
                  {user.name || 'Listener'}
                </span>
                <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              </div>
              <p className="text-[11px] text-zinc-400 truncate">{user.email}</p>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={openLoginModal}
          className={`p-3 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 transition cursor-pointer ${
            isCollapsed ? 'flex justify-center w-full' : 'text-left'
          }`}
          title={isCollapsed ? "Sign in or sign up with email" : undefined}
        >
          {isCollapsed ? (
            <LogIn className="w-5 h-5 text-amber-400" />
          ) : (
            <>
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs mb-1">
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in or sign up with email</span>
              </div>
              <p className="text-[11px] text-zinc-400">Save personal playlists & isolate user cloud data</p>
            </>
          )}
        </button>
      )}

      {/* Main Nav */}
      <nav className="space-y-1.5 px-1">
        <motion.button
          id="sidebar-nav-home"
          onClick={() => onSelectTab('home')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full flex items-center rounded-xl text-[15px] font-extrabold transition-all duration-200 cursor-pointer relative overflow-hidden group ${
            isCollapsed ? 'justify-center p-3' : 'gap-4 px-4 py-3.5'
          } ${
            activeTab === 'home'
              ? 'text-amber-400 bg-amber-500/20 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
              : 'text-zinc-300 hover:text-white hover:bg-white/5'
          }`}
          title={isCollapsed ? "Home" : undefined}
        >
          {activeTab === 'home' && (
            <motion.div
              layoutId="activeTabGlow"
              className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
          <Home className={`w-6 h-6 transition-transform duration-300 ${activeTab === 'home' ? 'scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'group-hover:scale-110'}`} />
          {!isCollapsed && <span className="relative z-10 tracking-tight">Home</span>}
          {activeTab === 'home' && !isCollapsed && (
            <motion.div
              className="absolute right-3 w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
          )}
        </motion.button>

        <motion.button
          id="sidebar-nav-search"
          onClick={() => onSelectTab('search')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full flex items-center rounded-xl text-[15px] font-extrabold transition-all duration-200 cursor-pointer relative overflow-hidden group ${
            isCollapsed ? 'justify-center p-3' : 'gap-4 px-4 py-3.5'
          } ${
            activeTab === 'search'
              ? 'text-amber-400 bg-amber-500/20 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
              : 'text-zinc-300 hover:text-white hover:bg-white/5'
          }`}
          title={isCollapsed ? "Search" : undefined}
        >
          {activeTab === 'search' && (
            <motion.div
              layoutId="activeTabGlowSearch"
              className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
          <Search className={`w-6 h-6 transition-transform duration-300 ${activeTab === 'search' ? 'scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'group-hover:scale-110'}`} />
          {!isCollapsed && <span className="relative z-10 tracking-tight">Search</span>}
        </motion.button>

        <motion.button
          id="sidebar-nav-library"
          onClick={() => onSelectTab('library')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full flex items-center rounded-xl text-[15px] font-extrabold transition-all duration-200 cursor-pointer relative overflow-hidden group ${
            isCollapsed ? 'justify-center p-3' : 'gap-4 px-4 py-3.5'
          } ${
            activeTab === 'library'
              ? 'text-amber-400 bg-amber-500/20 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
              : 'text-zinc-300 hover:text-white hover:bg-white/5'
          }`}
          title={isCollapsed ? "Library" : undefined}
        >
          {activeTab === 'library' && (
            <motion.div
              layoutId="activeTabGlowLibrary"
              className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
          <Library className={`w-6 h-6 transition-transform duration-300 ${activeTab === 'library' ? 'scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'group-hover:scale-110'}`} />
          {!isCollapsed && <span className="relative z-10 tracking-tight">Library</span>}
        </motion.button>

        <motion.button
          id="sidebar-nav-profile"
          onClick={() => onSelectTab('profile')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full flex items-center rounded-xl text-[15px] font-extrabold transition-all duration-200 cursor-pointer relative overflow-hidden group ${
            isCollapsed ? 'justify-center p-3' : 'gap-4 px-4 py-3.5'
          } ${
            activeTab === 'profile'
              ? 'text-amber-400 bg-amber-500/20 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
              : 'text-zinc-300 hover:text-white hover:bg-white/5'
          }`}
          title={isCollapsed ? "Profile" : undefined}
        >
          {activeTab === 'profile' && (
            <motion.div
              layoutId="activeTabGlowProfile"
              className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
          <User className={`w-6 h-6 transition-transform duration-300 ${activeTab === 'profile' ? 'scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'group-hover:scale-110'}`} />
          {!isCollapsed && <span className="relative z-10 tracking-tight">Profile</span>}
        </motion.button>
      </nav>

      {/* User Sections */}
      <div className={`flex-1 overflow-y-auto no-scrollbar space-y-1 border-t border-white/5 pt-4 ${isCollapsed ? 'px-0' : 'px-1'}`}>
        {!isCollapsed ? (
          <p className="px-4 py-2 font-bold uppercase tracking-widest text-[10px] text-zinc-500">
            My Collection
          </p>
        ) : (
          <div className="border-b border-white/5 my-2" />
        )}

        <button
          id="sidebar-nav-my-songs"
          onClick={() => onSelectTab('my-songs')}
          className={`w-full flex items-center rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
            isCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-2.5'
          } ${
            activeTab === 'my-songs'
              ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="My Songs"
        >
          <div className={`flex items-center ${isCollapsed ? 'gap-0' : 'gap-3.5'}`}>
            <Music className="w-5 h-5" />
            {!isCollapsed && <span>My Songs</span>}
          </div>
          {!isCollapsed && customSongs.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
              {customSongs.length}
            </span>
          )}
        </button>

        <button
          id="sidebar-nav-playlists"
          onClick={() => onSelectTab('playlists')}
          className={`w-full flex items-center rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
            isCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-2.5'
          } ${
            activeTab === 'playlists'
              ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="My Playlists"
        >
          <div className={`flex items-center ${isCollapsed ? 'gap-0' : 'gap-3.5'}`}>
            <ListMusic className="w-5 h-5" />
            {!isCollapsed && <span>My Playlists</span>}
          </div>
          {!isCollapsed && customPlaylists.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
              {customPlaylists.length}
            </span>
          )}
        </button>

        <button
          id="sidebar-nav-favorites"
          onClick={() => onSelectTab('favorites')}
          className={`w-full flex items-center rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
            isCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-2.5'
          } ${
            activeTab === 'favorites'
              ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="Favorites"
        >
          <div className={`flex items-center ${isCollapsed ? 'gap-0' : 'gap-3.5'}`}>
            <Heart className="w-5 h-5 text-rose-400" />
            {!isCollapsed && <span>Favorites</span>}
          </div>
          {!isCollapsed && likedTrackIds.size > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
              {likedTrackIds.size}
            </span>
          )}
        </button>

        <button
          id="sidebar-nav-recents"
          onClick={() => onSelectTab('recently-played')}
          className={`w-full flex items-center rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
            isCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-2.5'
          } ${
            activeTab === 'recently-played'
              ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="Recently Played"
        >
          <div className={`flex items-center ${isCollapsed ? 'gap-0' : 'gap-3.5'}`}>
            <History className="w-5 h-5" />
            {!isCollapsed && <span>Recently Played</span>}
          </div>
          {!isCollapsed && recentlyPlayed.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
              {recentlyPlayed.length}
            </span>
          )}
        </button>
      </div>

      {/* Sidebar Footer */}
      <div className="border-t border-white/5 pt-2 space-y-1">
        <button
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center rounded-xl text-xs font-medium transition cursor-pointer ${
            isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2'
          } ${
            activeTab === 'settings'
              ? 'text-amber-400 bg-amber-500/15'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
          {!isCollapsed && <span>Settings</span>}
        </button>

        {user && (
          <button
            onClick={logout}
            className={`w-full flex items-center rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition cursor-pointer ${
              isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2'
            }`}
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
            {!isCollapsed && <span>Log Out</span>}
          </button>
        )}
      </div>
    </aside>
  );
};
