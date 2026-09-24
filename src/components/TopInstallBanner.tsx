import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, PlusSquare, Monitor, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const TopInstallBanner: React.FC = () => {
  const { isInstalled, triggerInstall, isInstallable, isIOS } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [activeModal, setActiveModal] = useState<'ios' | 'desktop' | null>(null);

  // Check if dismissed in current session
  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem('sabdham_pwa_banner_dismissed');
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    } catch {
      // Ignore sessionStorage errors in restricted iframe
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('sabdham_pwa_banner_dismissed', 'true');
    } catch {
      // Ignore
    }
  };

  const handleInstallClick = async () => {
    const outcome = await triggerInstall();
    if (outcome === 'manual_ios') {
      setActiveModal('ios');
    } else if (outcome === 'manual_desktop') {
      setActiveModal('desktop');
    }
  };

  // Do not show banner if already running in standalone PWA or user dismissed it
  if (isInstalled || isDismissed) {
    return null;
  }

  return (
    <>
      <div 
        id="top-webapp-install-banner"
        className="w-full bg-gradient-to-r from-amber-950/80 via-zinc-900 to-amber-950/70 border-b border-amber-500/30 px-3 sm:px-6 py-2.5 flex items-center justify-between text-xs sm:text-sm text-zinc-200 z-30 shadow-lg backdrop-blur-md transition-all duration-300"
      >
        <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0 pr-2">
          {/* App Icon */}
          <div className="relative flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden border border-amber-500/40 shadow-sm shadow-amber-500/20">
            <img 
              src="/logo.jpg" 
              alt="Sabdham Music" 
              className="w-full h-full object-cover" 
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-1.5 flex-wrap">
              <span className="font-bold text-white tracking-wide text-xs sm:text-sm">
                Install Sabdham Web App
              </span>
              <span className="hidden md:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PWA
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-zinc-300 truncate">
              {isIOS 
                ? 'Add to home screen for lock-screen controls & background playback'
                : 'Install on your device for seamless background playback & fast access'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={handleInstallClick}
            id="btn-install-webapp-top"
            className="flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md shadow-amber-500/25 transition cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            <span>Install App</span>
          </button>

          <button
            onClick={handleDismiss}
            id="btn-dismiss-install-banner"
            aria-label="Dismiss banner"
            className="p-1 sm:p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {activeModal === 'ios' && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in"
          onClick={() => setActiveModal(null)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-amber-500/30 p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Install on iPhone / iPad</h3>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-zinc-300">
              <div className="flex items-start space-x-2.5">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  Tap the <strong className="text-white inline-flex items-center gap-1 font-semibold">Share <Share className="w-3.5 h-3.5 inline text-amber-400" /></strong> button in the Safari toolbar at the bottom of the screen.
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  Scroll down the menu and tap <strong className="text-white inline-flex items-center gap-1 font-semibold">Add to Home Screen <PlusSquare className="w-3.5 h-3.5 inline text-amber-400" /></strong>.
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  Tap <strong className="text-white font-semibold">Add</strong> in the top-right corner to place the app on your home screen.
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl text-xs sm:text-sm transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Desktop / Manual Browser Guide Modal */}
      {activeModal === 'desktop' && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in"
          onClick={() => setActiveModal(null)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-amber-500/30 p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Monitor className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Install Sabdham Music</h3>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-zinc-300">
              <div className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  Click the <strong>Install</strong> icon (<Download className="w-3.5 h-3.5 inline text-amber-400" />) located on the right side of your browser's address/search bar.
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  Alternatively, open your browser menu (<strong>⋮</strong> or <strong>⋯</strong>) and select <strong>Install Sabdham Music</strong> or <strong>Add to Applications</strong>.
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </>
  );
};
