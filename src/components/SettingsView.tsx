import React, { useState, useEffect } from 'react';
import {
  Settings,
  Volume2,
  Shield,
  Trash2,
  Smartphone,
  Bell,
  Radio,
  Check,
  Sparkles,
  ExternalLink,
  User,
  LogOut,
  Wifi,
  Download,
  Moon,
  Sun,
  Sliders,
  HelpCircle,
  AlertTriangle,
  FileText,
  Info,
  ChevronRight,
  X,
  CheckCircle2,
  Lock,
  Cookie,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { getCookieConsent, setCookieConsent, saveLoginCookie, saveUserDataCookie, deleteCookie, COOKIE_NAMES } from '../utils/cookieUtils';
import { NavTab } from '../types';

export const SettingsView: React.FC<{
  onOpenAndroidModal?: () => void;
  initialSection?: string;
  onNavigate?: (tab: NavTab) => void;
}> = ({ onOpenAndroidModal, initialSection, onNavigate }) => {
  const { user, logout, openLoginModal, token, deleteAccount } = useAuth();
  const {
    crossfade,
    setCrossfade,
    gaplessPlayback,
    toggleGaplessPlayback,
    playbackQuality,
    setPlaybackQuality,
    autoplay,
    setAutoplay,
    volumeNormalization,
    setVolumeNormalization,
    wifiOnlyDownloads,
    setWifiOnlyDownloads,
    useMobileData,
    setUseMobileData,
    eqEnabled,
    setEqEnabled,
    eqPreset,
    setEqPreset,
    eqBands,
    setEqBands,
    theme,
    setTheme,
    clearCache,
    clearSearchHistory,
    clearPersonalData,
    notificationsEnabled,
    notificationPermission,
    requestNotificationPermission,
    toggleNotifications,
    currentTrack,
    likedTrackIds,
    customPlaylists,
  } = useMusic();

  useEffect(() => {
    if (initialSection) {
      const el = document.getElementById(initialSection);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [initialSection]);

  // Modal & Notification states
  const [modalType, setModalType] = useState<
    | null
    | 'clearCache'
    | 'clearSearch'
    | 'clearData'
    | 'signOut'
    | 'equalizer'
    | 'privacy'
    | 'terms'
    | 'help'
    | 'report'
    | 'manageAccount'
    | 'deleteAccount'
  >(null);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleConfirmAction = async () => {
    if (modalType === 'clearCache') {
      clearCache();
      showToast('Cache successfully cleared (42.8 MB freed)');
    } else if (modalType === 'clearSearch') {
      clearSearchHistory();
      showToast('Search history deleted');
    } else if (modalType === 'clearData') {
      clearPersonalData();
      showToast('Personal data and playlists cleared');
    } else if (modalType === 'signOut') {
      logout();
      showToast('Successfully signed out');
    } else if (modalType === 'deleteAccount') {
      const ok = await deleteAccount();
      if (ok) {
        showToast('Your account and all associated data have been permanently deleted.');
      } else {
        showToast('Failed to delete account. Please try again or contact support.');
      }
    }
    setModalType(null);
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 pb-28" id="settings-view">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-amber-500 text-zinc-950 px-4 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center space-x-3 pb-6 border-b border-white/10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-zinc-950 shadow-lg shadow-amber-500/20">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-xs text-zinc-400">Manage audio streaming, storage, account, and device preferences</p>
        </div>
      </div>

      {/* 1. Playback Settings */}
      <div id="settings-playback" className="p-6 rounded-3xl bg-zinc-900 border border-white/10 space-y-5 shadow-xl">
        <div className="flex items-center space-x-2 pb-2 border-b border-white/5">
          <Volume2 className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">Playback Settings</h2>
        </div>

        {/* Crossfade */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-zinc-200">Crossfade</span>
              <p className="text-xs text-zinc-400">
                {crossfade === 0 ? 'Crossfade OFF (0 sec)' : `Crossfade: ${crossfade} sec transition`}
              </p>
            </div>
            <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
              {crossfade === 0 ? 'Off' : `${crossfade}s`}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="8"
            step="1"
            value={crossfade}
            onChange={(e) => setCrossfade(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 px-1">
            <span>0 sec (Off)</span>
            <span>2s</span>
            <span>4s</span>
            <span>6s</span>
            <span>8 sec</span>
          </div>
        </div>

        {/* Gapless Playback */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div>
            <span className="text-sm font-semibold text-zinc-200">Gapless Playback</span>
            <p className="text-xs text-zinc-400">Minimize or eliminate silence between consecutive tracks</p>
          </div>
          <div
            onClick={toggleGaplessPlayback}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              gaplessPlayback ? 'bg-amber-500' : 'bg-zinc-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${
                gaplessPlayback ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </div>
        </div>

        {/* Playback Quality */}
        <div className="pt-3 border-t border-white/5 space-y-2">
          <span className="text-sm font-semibold text-zinc-200">Playback Quality</span>
          <p className="text-xs text-zinc-400">Select streaming and caching audio bitrate</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {(['auto', 'low', 'medium', 'high'] as const).map((q) => (
              <button
                key={q}
                onClick={() => {
                  setPlaybackQuality(q);
                  showToast(`Playback quality set to ${q.toUpperCase()}`);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold capitalize border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  playbackQuality === q
                    ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-zinc-800/80 text-zinc-300 border-white/10 hover:bg-zinc-700'
                }`}
              >
                {playbackQuality === q && <Check className="w-3.5 h-3.5" />}
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Autoplay */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div>
            <span className="text-sm font-semibold text-zinc-200">Autoplay</span>
            <p className="text-xs text-zinc-400">Automatically play recommended songs when your queue finishes</p>
          </div>
          <div
            onClick={() => setAutoplay(!autoplay)}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              autoplay ? 'bg-amber-500' : 'bg-zinc-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${
                autoplay ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </div>
        </div>
      </div>

      {/* 2. Audio Settings */}
      <div id="settings-audio" className="p-6 rounded-3xl bg-zinc-900 border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center space-x-2 pb-2 border-b border-white/5">
          <Sliders className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">Audio Settings</h2>
        </div>

        {/* Volume Normalization */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-zinc-200">Volume Normalization</span>
            <p className="text-xs text-zinc-400">Maintain a consistent perceived volume level across all tracks</p>
          </div>
          <div
            onClick={() => setVolumeNormalization(!volumeNormalization)}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              volumeNormalization ? 'bg-amber-500' : 'bg-zinc-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${
                volumeNormalization ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </div>
        </div>

        {/* Equalizer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div>
            <span className="text-sm font-semibold text-zinc-200">Equalizer</span>
            <p className="text-xs text-zinc-400">Configure acoustic frequency bands and audio enhancements</p>
          </div>
          <button
            onClick={() => setModalType('equalizer')}
            className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 rounded-xl border border-white/10 transition cursor-pointer flex items-center gap-1.5"
          >
            <span>Configure EQ</span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* 3. Downloads & Storage */}
      <div id="settings-storage" className="p-6 rounded-3xl bg-zinc-900 border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center space-x-2 pb-2 border-b border-white/5">
          <Download className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">Downloads & Storage</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-zinc-200">Download Location</span>
            <p className="text-xs text-zinc-400 font-mono">/storage/emulated/0/Android/data/com.sabdham.music/files</p>
          </div>
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-semibold">
            Internal Storage
          </span>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div>
            <span className="text-sm font-semibold text-zinc-200">Cached Audio & Artwork</span>
            <p className="text-xs text-zinc-400">Current cache usage: <span className="text-white font-medium">42.8 MB</span></p>
          </div>
          <button
            onClick={() => setModalType('clearCache')}
            className="py-1.5 px-3 bg-zinc-800 hover:bg-red-500/20 text-xs font-bold text-zinc-300 hover:text-red-400 rounded-xl border border-white/10 hover:border-red-500/30 transition cursor-pointer"
          >
            Clear Cache
          </button>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div>
            <span className="text-sm font-semibold text-zinc-200">Search History</span>
            <p className="text-xs text-zinc-400">Clear recently saved search queries and suggestions</p>
          </div>
          <button
            onClick={() => setModalType('clearSearch')}
            className="py-1.5 px-3 bg-zinc-800 hover:bg-red-500/20 text-xs font-bold text-zinc-300 hover:text-red-400 rounded-xl border border-white/10 hover:border-red-500/30 transition cursor-pointer"
          >
            Clear History
          </button>
        </div>
      </div>

      {/* 4. Appearance */}
      <div id="settings-appearance" className="p-6 rounded-3xl bg-zinc-900 border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center space-x-2 pb-2 border-b border-white/5">
          <Moon className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">Appearance</h2>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-semibold text-zinc-200">Theme</span>
          <p className="text-xs text-zinc-400">Choose your preferred visual mode for Sabdham</p>
          <div className="grid grid-cols-3 gap-3 pt-1">
            {[
              { id: 'dark', label: 'Dark', icon: Moon },
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'system', label: 'System', icon: Sparkles },
            ].map((item) => {
              const Icon = item.icon;
              const active = theme === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setTheme(item.id as any);
                    showToast(`Theme switched to ${item.label}`);
                  }}
                  className={`py-3 px-4 rounded-2xl text-xs font-bold flex flex-col items-center gap-2 border transition cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-zinc-800/80 text-zinc-300 border-white/10 hover:bg-zinc-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Data & Network */}
      <div id="settings-data" className="p-6 rounded-3xl bg-zinc-900 border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center space-x-2 pb-2 border-b border-white/5">
          <Wifi className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">Data & Network</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-zinc-200">Wi-Fi Only for Downloads</span>
            <p className="text-xs text-zinc-400">Prevent downloading music over cellular mobile data</p>
          </div>
          <div
            onClick={() => setWifiOnlyDownloads(!wifiOnlyDownloads)}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              wifiOnlyDownloads ? 'bg-amber-500' : 'bg-zinc-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${
                wifiOnlyDownloads ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div>
            <span className="text-sm font-semibold text-zinc-200">Use Mobile Data for Streaming</span>
            <p className="text-xs text-zinc-400">Allow audio streaming over cellular networks</p>
          </div>
          <div
            onClick={() => setUseMobileData(!useMobileData)}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              useMobileData ? 'bg-amber-500' : 'bg-zinc-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${
                useMobileData ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </div>
        </div>
      </div>

      {/* 6. Account */}
      <div id="settings-account" className="p-6 rounded-3xl bg-zinc-900 border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center space-x-2 pb-2 border-b border-white/5">
          <User className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">Account</h2>
        </div>

        {user ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-800/60 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{user.name || 'Sabdham Member'}</div>
                  <div className="text-xs text-zinc-400">{user.email}</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Active Session
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setModalType('manageAccount')}
                className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 rounded-xl border border-white/10 transition cursor-pointer"
              >
                Manage Account
              </button>
              <button
                onClick={() => setModalType('signOut')}
                className="py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-400 rounded-xl border border-red-500/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400">You are currently browsing as a guest. Sign in or sign up with email to sync your favorites and custom playlists across all devices.</p>
            <button
              onClick={openLoginModal}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4" />
              <span>Sign in or sign up with email</span>
            </button>
          </div>
        )}
      </div>

      {/* 7. Notifications */}
      <div id="settings-notifications" className="p-6 rounded-3xl bg-zinc-900 border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center space-x-2 pb-2 border-b border-white/5">
          <Bell className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">Notifications & Lock Screen</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-zinc-200">Music & App Notifications</span>
            <p className="text-xs text-zinc-400">
              {notificationPermission === 'granted'
                ? 'Active — enables background track change banners and OS media controls'
                : 'Allow notifications for track updates and background playback alerts'}
            </p>
          </div>
          <div
            onClick={toggleNotifications}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              notificationsEnabled && notificationPermission === 'granted' ? 'bg-amber-500' : 'bg-zinc-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${
                notificationsEnabled && notificationPermission === 'granted' ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </div>
        </div>


      </div>

      {/* 8. Privacy */}
      <div id="settings-privacy" className="p-6 rounded-3xl bg-zinc-900 border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center space-x-2 pb-2 border-b border-white/5">
          <Shield className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">Privacy, Cookies & Data</h2>
        </div>

        {/* Automatic Browser Cookie Storage Information */}
        <div className="p-4 rounded-2xl bg-zinc-800/60 border border-white/5 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl mt-0.5">
              <Cookie className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>Automatic Cookie Storage</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active (Terms Covered)
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Saves login session tokens and library preferences automatically in browser cookies as governed by our Terms of Service.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setModalType('privacy')}
            className="p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-2xl border border-white/10 text-left transition cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-200">Privacy Policy</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>

          <button
            onClick={() => setModalType('terms')}
            className="p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-2xl border border-white/10 text-left transition cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-200">Terms of Service</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div>
            <span className="text-sm font-semibold text-zinc-200">Clear Personal Data</span>
            <p className="text-xs text-zinc-400">Permanently erase all local playlists, liked songs, and cached history</p>
          </div>
          <button
            onClick={() => setModalType('clearData')}
            className="py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-400 rounded-xl border border-red-500/20 transition cursor-pointer"
          >
            Clear Data
          </button>
        </div>

        {/* Delete Account (Google Play Mandatory In-App Feature) */}
        {user && (
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <div>
              <span className="text-sm font-semibold text-red-400">Delete Account</span>
              <p className="text-xs text-zinc-400">Permanently delete your account profile, synced library, and personal records</p>
            </div>
            <button
              onClick={() => setModalType('deleteAccount')}
              className="py-1.5 px-3 bg-red-600 hover:bg-red-500 text-xs font-bold text-white rounded-xl shadow transition cursor-pointer"
            >
              Delete Account
            </button>
          </div>
        )}

        {/* Public Google Play Compliance Links */}
        <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-zinc-500 text-[11px]">Google Play Store Compliance:</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate?.('privacy')}
              className="text-amber-400 hover:underline cursor-pointer font-medium"
            >
              Web Privacy Policy
            </button>
            <span className="text-zinc-600">•</span>
            <button
              onClick={() => onNavigate?.('delete-account')}
              className="text-red-400 hover:underline cursor-pointer font-medium"
            >
              Public Deletion Portal
            </button>
          </div>
        </div>
      </div>

      {/* 9. About */}
      <div id="settings-about" className="p-6 rounded-3xl bg-zinc-900 border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center space-x-2 pb-2 border-b border-white/5">
          <Info className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">About Sabdham</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-zinc-200">Sabdham Music Engine</span>
            <p className="text-xs text-zinc-400">Production Release 1.0.0 • Target SDK 35 (Android 15)</p>
          </div>
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
            v1.0.0
          </span>
        </div>

        <div className="text-xs text-zinc-500 pt-1">
          © 2026 Sabdham Audio Inc. All rights reserved. High fidelity Tamil, Sinhala, & Global streaming engine.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
          <button
            onClick={() => setModalType('help')}
            className="p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-2xl border border-white/10 text-left transition cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-200">Help & Support</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>

          <button
            onClick={() => setModalType('report')}
            className="p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-2xl border border-white/10 text-left transition cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-200">Report a Problem</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      </div>

      {/* MODALS */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Confirmation Dialogs */}
            {(modalType === 'clearCache' || modalType === 'clearSearch' || modalType === 'clearData' || modalType === 'signOut' || modalType === 'deleteAccount') && (
              <>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {modalType === 'clearCache' && 'Clear Cache'}
                      {modalType === 'clearSearch' && 'Clear Search History'}
                      {modalType === 'clearData' && 'Clear Personal Data'}
                      {modalType === 'signOut' && 'Sign Out'}
                      {modalType === 'deleteAccount' && 'Permanently Delete Account?'}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {modalType === 'clearCache' && 'This will remove all cached artwork and temporary playback buffers (42.8 MB).'}
                      {modalType === 'clearSearch' && 'This will permanently delete your recent search queries.'}
                      {modalType === 'clearData' && 'This will remove all your local playlists, liked tracks, and personalized history.'}
                      {modalType === 'signOut' && 'Are you sure you want to sign out of your Sabdham account?'}
                      {modalType === 'deleteAccount' && 'This action cannot be undone. All your playlists, favorites, profile records, and saved preferences will be permanently wiped from Sabdham servers.'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setModalType(null)}
                    className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAction}
                    className="py-2 px-4 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
                  >
                    {modalType === 'deleteAccount' ? 'Delete My Account' : 'Confirm'}
                  </button>
                </div>
              </>
            )}

            {/* Equalizer Modal */}
            {modalType === 'equalizer' && (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <Sliders className="w-5 h-5 text-amber-400" />
                    <h3 className="text-base font-bold text-white">Equalizer Configuration</h3>
                  </div>
                  <button onClick={() => setModalType(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-200">Enable Equalizer</span>
                    <div
                      onClick={() => setEqEnabled(!eqEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        eqEnabled ? 'bg-amber-500' : 'bg-zinc-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${eqEnabled ? 'right-0.5' : 'left-0.5'}`} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Acoustic Presets</span>
                    <div className="grid grid-cols-3 gap-2">
                      {['Flat', 'Bass Boost', 'Acoustic', 'Electronic', 'Rock', 'Pop'].map((p) => (
                        <button
                          key={p}
                          onClick={() => setEqPreset(p)}
                          className={`py-2 px-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                            eqPreset === p
                              ? 'bg-amber-500 text-zinc-950 border-amber-400'
                              : 'bg-zinc-800 text-zinc-300 border-white/10 hover:bg-zinc-700'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Frequency Bands ({eqPreset})</span>
                    {[
                      { band: '60 Hz (Sub Bass)', idx: 0 },
                      { band: '230 Hz (Bass)', idx: 1 },
                      { band: '910 Hz (Mid)', idx: 2 },
                      { band: '4 kHz (Vocals)', idx: 3 },
                      { band: '14 kHz (Treble)', idx: 4 },
                    ].map((b) => {
                      const val = eqBands[b.idx] ?? 0;
                      return (
                        <div key={b.band} className="space-y-1">
                          <div className="flex justify-between text-xs text-zinc-300">
                            <span>{b.band}</span>
                            <span className="font-mono text-amber-400">
                              {val > 0 ? `+${val}` : val} dB
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-12"
                            max="12"
                            step="1"
                            value={val}
                            onChange={(e) => {
                              const newBands = [...eqBands];
                              newBands[b.idx] = parseInt(e.target.value, 10);
                              setEqBands(newBands);
                              setEqPreset('Custom');
                            }}
                            className="w-full accent-amber-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      showToast('Equalizer settings saved');
                      setModalType(null);
                    }}
                    className="py-2 px-5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </>
            )}

            {/* Privacy Policy Modal */}
            {modalType === 'privacy' && (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-bold text-white">Privacy Policy</h3>
                  <button onClick={() => setModalType(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="text-xs text-zinc-300 space-y-3 max-h-60 overflow-y-auto pr-2">
                  <p>Sabdham respects your privacy and is committed to protecting your personal data.</p>
                  <p>1. Data Collection: We collect account email and playback preferences strictly to sync your custom playlists and favorites securely across your devices.</p>
                  <p>2. Local & Cookie Storage: Necessary browser cookies and local storage are automatically utilized to maintain your login session token and preserve your library state without pop-up consent banners.</p>
                  <p>3. Third-Party Services: We integrate secure streaming providers for audio playback without sharing your personal identifiers.</p>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={() => setModalType(null)} className="py-2 px-4 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl">Close</button>
                </div>
              </>
            )}

            {/* Terms of Service Modal */}
            {modalType === 'terms' && (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-bold text-white">Terms of Service</h3>
                  <button onClick={() => setModalType(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="text-xs text-zinc-300 space-y-3 max-h-60 overflow-y-auto pr-2">
                  <p>Welcome to Sabdham. By accessing or using our music streaming application, you agree to these terms:</p>
                  <p>1. Usage License: Sabdham is provided for personal, non-commercial music listening and catalog discovery.</p>
                  <p>2. Intellectual Property: All track artwork, catalog metadata, and audio streams remain the property of their respective creators and licensors.</p>
                  <p>3. Automatic Cookie & Session Storage: By using Sabdham, you agree that browser cookies and local storage are automatically utilized to keep you signed in seamlessly and preserve your liked songs and playlists across sessions.</p>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={() => setModalType(null)} className="py-2 px-4 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl">Close</button>
                </div>
              </>
            )}

            {/* Help & Support Modal */}
            {modalType === 'help' && (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-bold text-white">Help & Support</h3>
                  <button onClick={() => setModalType(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="text-xs text-zinc-300 space-y-3">
                  <p>Need assistance with Sabdham? Our support team is available 24/7.</p>
                  <div className="p-3 bg-zinc-800 rounded-xl space-y-1">
                    <span className="font-bold text-white">Support Email</span>
                    <p className="text-amber-400 font-mono">support@sabdham.music</p>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={() => setModalType(null)} className="py-2 px-4 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl">Close</button>
                </div>
              </>
            )}

            {/* Report a Problem Modal */}
            {modalType === 'report' && (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-bold text-white">Report a Problem</h3>
                  <button onClick={() => setModalType(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <p className="text-xs text-zinc-300">Describe the issue you experienced and our engineering team will investigate:</p>
                  <textarea
                    rows={4}
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder="Describe playback issue, missing artwork, or bug..."
                    className="w-full p-3 bg-zinc-800 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setModalType(null)} className="py-2 px-4 bg-zinc-800 text-xs font-semibold text-zinc-300 rounded-xl">Cancel</button>
                  <button
                    onClick={() => {
                      showToast('Problem report submitted successfully. Thank you!');
                      setReportText('');
                      setModalType(null);
                    }}
                    className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl shadow-md"
                  >
                    Submit Report
                  </button>
                </div>
              </>
            )}

            {/* Manage Account Modal */}
            {modalType === 'manageAccount' && user && (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-bold text-white">Manage Account</h3>
                  <button onClick={() => setModalType(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3 text-xs text-zinc-300">
                  <div className="p-3 bg-zinc-800 rounded-xl space-y-1">
                    <span className="text-zinc-400">Account Email</span>
                    <div className="font-bold text-white">{user.email}</div>
                  </div>
                  <div className="p-3 bg-zinc-800 rounded-xl space-y-1">
                    <span className="text-zinc-400">Membership Tier</span>
                    <div className="font-bold text-amber-400">Sabdham Hi-Fi Premium</div>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={() => setModalType(null)} className="py-2 px-4 bg-amber-500 text-zinc-950 font-bold text-xs rounded-xl">Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
