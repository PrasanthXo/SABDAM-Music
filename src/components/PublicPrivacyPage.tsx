import React from 'react';
import { Shield, ArrowLeft, Lock, Database, Eye, Globe } from 'lucide-react';

interface PublicPrivacyPageProps {
  onBack?: () => void;
}

export const PublicPrivacyPage: React.FC<PublicPrivacyPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 sm:p-8 flex justify-center">
      <div className="w-full max-w-3xl space-y-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">SABDHAM Privacy Policy</h1>
              <p className="text-xs text-zinc-400">Last updated: September 2026 • Version 1.0.0 Production</p>
            </div>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to App</span>
            </button>
          )}
        </div>

        {/* Section 1: Introduction */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <Eye className="w-4 h-4" /> 1. Overview & Commitment
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Sabdham (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the Sabdham music streaming application on Web and Android. We are committed to safeguarding your personal data and respecting your privacy rights under applicable data protection regulations including GDPR, CCPA, and Google Play Developer Policies.
          </p>
        </div>

        {/* Section 2: Data We Collect */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <Database className="w-4 h-4" /> 2. Information We Collect
          </h2>
          <ul className="text-sm text-zinc-300 space-y-2 list-disc pl-5 leading-relaxed">
            <li><strong className="text-white">Account Information:</strong> When you register or sign in, we collect your email address, display name, and authentication credentials (hashed passwords or Google OAuth identifier).</li>
            <li><strong className="text-white">Music Library & Preferences:</strong> Your custom playlists, liked tracks, listening history, and audio equalization preferences are synchronized to your account so you can access them across devices.</li>
            <li><strong className="text-white">Technical Diagnostics:</strong> Minimal network connection status and audio playback telemetry to ensure continuous stream quality and prevent audio stuttering.</li>
          </ul>
        </div>

        {/* Section 3: Data Security */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <Lock className="w-4 h-4" /> 3. Data Protection & Encryption
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            All user data in transit is encrypted using modern Transport Layer Security (TLS 1.3 / HTTPS). Passwords are never stored in plaintext and are hashed using bcrypt with salt rounds. We never sell, monetize, or broker your personal information to third-party advertisers.
          </p>
        </div>

        {/* Section 4: Data Retention & Deletion */}
        <div className="space-y-3 p-5 rounded-2xl bg-zinc-900 border border-white/10">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" /> 4. Your Rights & Account Deletion
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            You retain full ownership of your data. You may request permanent deletion of your account and all associated music libraries at any time:
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href="/?tab=delete-account"
              className="inline-flex items-center text-xs font-bold px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition"
            >
              Request Account & Data Deletion
            </a>
            <a
              href="mailto:support@sabdham.music"
              className="inline-flex items-center text-xs font-semibold px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 transition"
            >
              Contact Privacy Team
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-white/10 text-xs text-zinc-500 text-center">
          &copy; {new Date().getFullYear()} SABDHAM. All rights reserved. Built for seamless audio streaming.
        </div>
      </div>
    </div>
  );
};
