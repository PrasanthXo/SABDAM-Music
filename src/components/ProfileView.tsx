import React, { useState } from 'react';
import { User, ShieldCheck, Mail, Calendar, Hash, Music, Heart, ListMusic, LogOut, Check, Sparkles, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { NavTab } from '../types';

const AVATAR_COLORS = [
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#f97316', // Orange
];

interface ProfileViewProps {
  onNavigate?: (tab: NavTab) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onNavigate }) => {
  const { user, logout, openLoginModal, updateProfile } = useAuth();
  const { likedTrackIds, customPlaylists, customSongs, recentlyPlayed } = useMusic();

  const [name, setName] = useState(user?.name || '');
  const [selectedColor, setSelectedColor] = useState(user?.avatarColor || '#f59e0b');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleNav = (tab: NavTab) => {
    if (onNavigate) {
      onNavigate(tab);
    }
  };

  if (!user) {
    return (
      <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6" id="user-profile-view">
        <div className="p-6 md:p-10 rounded-3xl bg-zinc-900 border border-white/10 text-center py-12 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-4">
            <User className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">User Profile</h2>
          <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
            Sign in or create an account with your email to sync and protect your music library across devices.
          </p>
          <button
            onClick={openLoginModal}
            id="profile-login-button"
            className="py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 hover:brightness-110 transition cursor-pointer"
          >
            Sign In / Create Account
          </button>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const ok = await updateProfile(name, selectedColor);
    setIsSaving(false);
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }) : 'Today';

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6" id="user-profile-view">
      {/* Profile Header Card */}
      <div className="relative p-6 sm:p-8 rounded-3xl bg-zinc-900 border border-white/10 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center text-3xl font-black text-zinc-950 shadow-xl flex-shrink-0"
            style={{ backgroundColor: selectedColor }}
          >
            {name ? name.slice(0, 1).toUpperCase() : user.email.slice(0, 1).toUpperCase()}
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {name || 'SABDHAM Listener'}
              </h1>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  Verified Email Account
                </span>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-zinc-400">
              <span className="flex items-center space-x-1.5">
                <Mail className="w-3.5 h-3.5 text-zinc-500" />
                <span>{user.email}</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span>Member since {memberSince}</span>
              </span>
              <span className="flex items-center space-x-1.5 font-mono">
                <Hash className="w-3.5 h-3.5 text-zinc-500" />
                <span>UID: {user.id.slice(0, 8)}...</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Cloud Stats Grid (Interactive Navigation Buttons) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => handleNav('favorites')}
          id="profile-stat-favorites"
          className="p-4 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 hover:border-rose-500/50 space-y-2 text-left transition-all group cursor-pointer shadow-md"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-semibold text-zinc-300 group-hover:text-rose-400 transition-colors">Favorites</span>
            <Heart className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold text-white font-mono">{likedTrackIds.size}</div>
            <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 flex items-center">
              View <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleNav('playlists')}
          id="profile-stat-playlists"
          className="p-4 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 hover:border-amber-500/50 space-y-2 text-left transition-all group cursor-pointer shadow-md"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-semibold text-zinc-300 group-hover:text-amber-400 transition-colors">Playlists</span>
            <ListMusic className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold text-white font-mono">{customPlaylists.length}</div>
            <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 flex items-center">
              View <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleNav('my-songs')}
          id="profile-stat-my-songs"
          className="p-4 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 hover:border-orange-500/50 space-y-2 text-left transition-all group cursor-pointer shadow-md"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-semibold text-zinc-300 group-hover:text-orange-400 transition-colors">My Songs</span>
            <Music className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold text-white font-mono">{customSongs.length}</div>
            <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 flex items-center">
              View <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleNav('recently-played')}
          id="profile-stat-history"
          className="p-4 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 hover:border-purple-500/50 space-y-2 text-left transition-all group cursor-pointer shadow-md"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-semibold text-zinc-300 group-hover:text-purple-400 transition-colors">History</span>
            <Sparkles className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold text-white font-mono">{recentlyPlayed.length}</div>
            <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 flex items-center">
              View <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </button>
      </div>

      {/* Profile Customization Form */}
      <div className="p-6 rounded-3xl bg-zinc-900/90 border border-white/10 space-y-5">
        <h2 className="text-base font-bold text-white">Customize Profile</h2>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maya"
              className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Avatar Theme Color
            </label>
            <div className="flex flex-wrap gap-3">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-md"
                  style={{ backgroundColor: color }}
                >
                  {selectedColor === color && <Check className="w-5 h-5 text-zinc-950 font-bold" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3">
            {saveSuccess ? (
              <span className="text-xs text-emerald-400 font-medium">✓ Profile updated successfully!</span>
            ) : (
              <span className="text-xs text-zinc-500">Your profile is isolated and private.</span>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="py-2.5 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Logout Row */}
      <div className="p-6 rounded-3xl bg-zinc-900/40 border border-red-500/20 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Log Out</h3>
          <p className="text-xs text-zinc-400">Sign out of your account on this browser.</p>
        </div>
        <button
          onClick={logout}
          id="profile-logout-button"
          className="py-2.5 px-5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-semibold rounded-xl text-xs flex items-center space-x-2 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
};
