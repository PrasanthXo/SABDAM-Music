import React, { useState } from 'react';
import {
  X,
  Download,
  FileCode,
  Check,
  Terminal,
  Smartphone,
  Copy,
  ExternalLink,
  AlertCircle,
  Sparkles,
  Globe,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { getAndroidProjectFiles, generateAndroidStudioZip } from '../utils/androidProjectGenerator';
import { copyToClipboard } from '../utils/clipboardUtils';

interface AndroidProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidProjectModal: React.FC<AndroidProjectModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'apkbuild' | 'android-studio'>('apkbuild');
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);
  const [isGeneratingNativeZip, setIsGeneratingNativeZip] = useState<boolean>(false);
  const [isDownloadingWebZip, setIsDownloadingWebZip] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  if (!isOpen) return null;

  // The live web app URL that works with apkbuild.org
  const liveAppUrl = typeof window !== 'undefined'
    ? window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
      ? 'https://ais-pre-eavywet5zknxtgryw4gwib-602144079882.asia-southeast1.run.app'
      : window.location.origin
    : 'https://ais-pre-eavywet5zknxtgryw4gwib-602144079882.asia-southeast1.run.app';

  const files = getAndroidProjectFiles();
  const currentFile = files[selectedFileIdx] || files[0];

  // Download Web APK ZIP (has index.html at root, specifically solving apkbuild.org's error)
  const handleDownloadWebZip = async () => {
    try {
      setIsDownloadingWebZip(true);
      const res = await fetch('/api/export/web-apk-zip');
      if (!res.ok) throw new Error('Failed to fetch ZIP from server');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'MorningMusic-WebAPK-RootIndex.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsDownloadingWebZip(false);
    } catch (err) {
      console.error('Download error:', err);
      setIsDownloadingWebZip(false);
      alert('Could not generate Web ZIP. Try the Website URL method instead!');
    }
  };

  // Download Native Kotlin Android Studio Project
  const handleDownloadNativeZip = async () => {
    try {
      setIsGeneratingNativeZip(true);
      const blob = await generateAndroidStudioZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'MorningMusic-AndroidStudio.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsGeneratingNativeZip(false);
    } catch (err) {
      console.error('Failed to generate ZIP:', err);
      setIsGeneratingNativeZip(false);
    }
  };

  const handleCopyUrl = async () => {
    const copied = await copyToClipboard(liveAppUrl);
    if (copied) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  const handleCopyCode = async () => {
    if (currentFile) {
      const copied = await copyToClipboard(currentFile.content);
      if (copied) {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none">
      <div className="relative w-full max-w-4xl bg-[#181818] rounded-2xl overflow-hidden border border-white/10 shadow-2xl max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#1e1e1e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1db954]/20 border border-[#1db954]/40 flex items-center justify-center text-[#1db954]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>Android APK Builder & Source Code</span>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-[#1db954] text-black">
                  Sabdham
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Generate an installable APK or export the native Android Studio project
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#141414] px-4 pt-2 gap-2">
          <button
            id="tab-apkbuild"
            onClick={() => setActiveTab('apkbuild')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition-colors cursor-pointer ${
              activeTab === 'apkbuild'
                ? 'bg-[#1e1e1e] text-[#1db954] border-t-2 border-[#1db954]'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Create APK on apkbuild.org</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-[#1db954]/20 text-[#1db954] rounded font-bold">
              Fix Error
            </span>
          </button>

          <button
            id="tab-android-studio"
            onClick={() => setActiveTab('android-studio')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition-colors cursor-pointer ${
              activeTab === 'android-studio'
                ? 'bg-[#1e1e1e] text-[#1db954] border-t-2 border-[#1db954]'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Native Android Studio (Kotlin Project)</span>
          </button>
        </div>

        {/* Tab 1: apkbuild.org Fix & Options */}
        {activeTab === 'apkbuild' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 no-scrollbar">
            {/* Why Error Happened Banner */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="text-amber-200 font-bold">
                  Why you received this error: "ZIP must contain index.html at the root"
                </p>
                <p className="text-amber-300/80 leading-relaxed">
                  <span className="font-semibold text-white">apkbuild.org</span> is a Web-to-APK converter. It wraps web apps into Android APKs. When you uploaded the native Kotlin Android Studio project, it didn't contain an <code className="text-white font-mono bg-black/40 px-1 py-0.5 rounded">index.html</code> at the root.
                </p>
                <p className="text-white font-medium pt-1">
                  Choose either of the two guaranteed solutions below to create your APK:
                </p>
              </div>
            </div>

            {/* Method 1: The Easiest & Best Way (Live URL - NO ZIP NEEDED) */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1b2a1e] via-[#1a1a1a] to-[#161616] border border-[#1db954]/40 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#1db954] text-black text-xs font-black flex items-center justify-center">
                    1
                  </div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Method 1: Use Website URL on apkbuild.org (Fastest &amp; No Uploads!)
                  </h3>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#1db954] text-black uppercase tracking-wider">
                  Recommended
                </span>
              </div>

              <p className="text-xs text-neutral-300">
                You don't need to upload any ZIP file at all! apkbuild.org lets you convert any live website directly into an APK.
              </p>

              {/* URL Box with Copy Button */}
              <div className="flex items-center gap-2 bg-black/60 p-2.5 rounded-xl border border-white/10">
                <div className="flex-1 min-w-0 font-mono text-xs text-emerald-400 truncate select-all px-2">
                  {liveAppUrl}
                </div>
                <button
                  id="copy-apk-url-btn"
                  onClick={handleCopyUrl}
                  className="px-4 py-2 rounded-lg bg-[#1db954] hover:bg-[#1ed760] text-black text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
              </div>

              {/* Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px]">A</span>
                    Select "Website URL"
                  </p>
                  <p className="text-neutral-400 text-[11px]">
                    On apkbuild.org/dashboard, switch from "Upload ZIP" to the "Website URL" input tab.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px]">B</span>
                    Paste URL &amp; App Name
                  </p>
                  <p className="text-neutral-400 text-[11px]">
                    Paste the URL above, and name your app <span className="text-white font-medium">Sabdham</span>.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px]">C</span>
                    Click "Build APK"
                  </p>
                  <p className="text-neutral-400 text-[11px]">
                    The build finishes in ~30 seconds and outputs an installable APK for your phone!
                  </p>
                </div>
              </div>
            </div>

            {/* Method 2: Fixed Web ZIP (index.html at root) */}
            <div className="p-5 rounded-2xl bg-[#1e1e1e] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-neutral-700 text-white text-xs font-black flex items-center justify-center">
                    2
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Method 2: If you still want to upload a ZIP (Fixed Root index.html)
                  </h3>
                </div>
              </div>

              <p className="text-xs text-neutral-300">
                We have generated a dedicated Web ZIP where <code className="text-[#1db954] font-mono">index.html</code> is directly at the root, along with all compiled dark-mode Spotify UI bundles.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <CheckCircle2 className="w-4 h-4 text-[#1db954] shrink-0" />
                  <span>Has <strong className="text-white">index.html</strong> at root — passes apkbuild.org validation</span>
                </div>

                <button
                  id="download-web-zip-btn"
                  onClick={handleDownloadWebZip}
                  disabled={isDownloadingWebZip}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-white text-black hover:bg-neutral-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-transform hover:scale-102 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isDownloadingWebZip ? 'Downloading...' : 'Download Web APK ZIP'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Native Android Studio Project */}
        {activeTab === 'android-studio' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Download Banner Action */}
            <div className="p-4 bg-gradient-to-r from-neutral-900 via-[#1a1a1a] to-neutral-900 border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Complete Android Studio Project (.ZIP)
                  </p>
                  <p className="text-xs text-neutral-400">
                    Kotlin • Jetpack Compose • Material 3 • Media3 / ExoPlayer Service
                  </p>
                </div>
              </div>

              <button
                id="download-android-zip-btn"
                onClick={handleDownloadNativeZip}
                disabled={isGeneratingNativeZip}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-102 cursor-pointer shrink-0 disabled:opacity-50"
              >
                {isGeneratingNativeZip ? (
                  <span>Packaging ZIP...</span>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Native Project .ZIP</span>
                  </>
                )}
              </button>
            </div>

            {/* File Explorer & Code Viewer Tabs */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[320px]">
              {/* File Explorer Sidebar */}
              <div className="w-full md:w-64 bg-[#141414] border-r border-white/5 p-3 overflow-y-auto no-scrollbar space-y-1">
                <p className="text-[10px] uppercase font-bold text-neutral-400 px-2 py-1">
                  Kotlin Files
                </p>
                {files.map((file, idx) => (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFileIdx(idx)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-mono truncate flex items-center gap-2 transition-colors cursor-pointer ${
                      selectedFileIdx === idx
                        ? 'bg-[#282828] text-[#1db954] font-semibold'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{file.path}</span>
                  </button>
                ))}
              </div>

              {/* Code Viewer Panel */}
              <div className="flex-1 flex flex-col bg-[#111111] overflow-hidden">
                <div className="px-4 py-2 bg-[#161616] border-b border-white/5 flex items-center justify-between">
                  <span className="text-xs font-mono text-neutral-300 truncate">
                    MorningMusic/{currentFile.path}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-[#1db954]" /> : null}
                    <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>

                <pre className="flex-1 p-4 overflow-auto text-xs font-mono text-neutral-200 leading-relaxed no-scrollbar select-text bg-[#0d0d0d]">
                  <code>{currentFile.content}</code>
                </pre>
              </div>
            </div>

            {/* Build Commands Footer */}
            <div className="p-3.5 bg-[#141414] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#1db954]" />
                <span>To compile APK in Android Studio:</span>
                <code className="bg-black/60 px-2 py-0.5 rounded text-neutral-200 font-mono text-[11px] border border-white/10">
                  ./gradlew assembleDebug
                </code>
              </div>
              <span className="text-[11px] text-neutral-400">
                Outputs to <code className="text-neutral-200">app/build/outputs/apk/debug/app-debug.apk</code>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
