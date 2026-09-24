import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstalled, triggerInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    const outcome = await triggerInstall();
    if (outcome === 'manual_ios') {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        id="btn-header-install-app"
        title="Install Web App"
        className="hidden sm:flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-300 shadow-sm hover:bg-amber-500 hover:text-zinc-950 transition cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>

      {showIOSGuide && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowIOSGuide(false)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl bg-zinc-900 p-5 shadow-2xl border border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white">Install on iPhone / iPad</h3>
            <p className="mt-2 text-xs sm:text-sm text-zinc-300 leading-relaxed">
              1. Tap the <strong>Share</strong> button in your Safari toolbar.<br />
              2. Scroll down and tap <strong>Add to Home Screen</strong>.<br />
              3. Tap <strong>Add</strong> in the top right.
            </p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full rounded-xl bg-zinc-800 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-700 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
