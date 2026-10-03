import React from 'react';
import { Shield, ArrowLeft, Lock, Database, Eye, Globe, Radio, Search } from 'lucide-react';

interface PublicPrivacyPageProps {
  onBack?: () => void;
}

export const PublicPrivacyPage: React.FC<PublicPrivacyPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 sm:p-8 flex justify-center">
      <div className="w-full max-w-3xl space-y-8 py-6">
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">SABDHAM Privacy Policy</h1>
              <p className="text-xs text-zinc-400">Last updated: 3 October 2026 • Version 1.2.0</p>
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

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <Eye className="w-4 h-4" /> 1. Overview
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            SABDHAM is an independent music application developed and published under the name Santh Creatives. This policy explains how information may be collected, used, stored, synchronized, protected and deleted when you use SABDHAM.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <Database className="w-4 h-4" /> 2. Information We May Process
          </h2>
          <ul className="text-sm text-zinc-300 space-y-2 list-disc pl-5 leading-relaxed">
            <li><strong className="text-white">Account data:</strong> email address, display name, account identifier, authentication provider, profile image, profile information and session information.</li>
            <li><strong className="text-white">Library data:</strong> liked songs, playlists, playlist contents, imported playlist references and custom song references.</li>
            <li><strong className="text-white">Playback and personalization data:</strong> recently played items, playback interests, app preferences and playback-related settings.</li>
            <li><strong className="text-white">Technical data:</strong> limited diagnostic, request and security information needed to operate, debug and protect the service.</li>
            <li><strong className="text-white">Support data:</strong> information you choose to send when reporting a problem, requesting deletion or contacting support.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <Search className="w-4 h-4" /> 3. Search, Playlist &amp; Artwork Requests
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            When you search for music, open a public playlist, resolve a track or request artwork, SABDHAM may send relevant search terms, track identifiers, artist names, album information, playlist identifiers or similar request data to the external provider needed to perform that feature.
          </p>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Like most internet services, external providers may also receive technical connection information such as IP address, request time and network or device headers needed to deliver the request.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <Radio className="w-4 h-4" /> 4. Audio Output Information
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            On supported Android devices, SABDHAM may read system-provided audio-route information so it can display and switch between available phone, Bluetooth or other supported outputs. SABDHAM does not intentionally use audio-route information for precise-location tracking.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400">5. How Information Is Used</h2>
          <ul className="text-sm text-zinc-300 space-y-2 list-disc pl-5 leading-relaxed">
            <li>authenticate users and maintain sessions;</li>
            <li>restore and synchronize playlists, likes and preferences;</li>
            <li>personalize catalogues and music discovery;</li>
            <li>provide search, playlist discovery, artwork lookup and playback;</li>
            <li>display and switch supported audio outputs;</li>
            <li>diagnose technical problems and improve reliability;</li>
            <li>protect accounts, prevent abuse and maintain security;</li>
            <li>process account deletion and support requests.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <Globe className="w-4 h-4" /> 6. Third-Party Services
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            SABDHAM may use Google/Firebase for authentication and may use external hosting or database providers to operate the service.
          </p>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Depending on the feature you request, SABDHAM may communicate with services including Spotify, YouTube, Audius, Apple/iTunes, MusicBrainz, Cover Art Archive, Last.fm and TMDB. Those providers process information according to their own privacy policies and terms.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400">7. Local Storage, Cookies &amp; Sessions</h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            SABDHAM may store limited information locally on your device, including cache data, preferences, library state, playback state and session information. The web version may use cookies or browser storage where needed for sign-in and app state.
          </p>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Clearing app data or uninstalling the app can remove local information but does not necessarily delete cloud account data.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400">8. Sale, Advertising &amp; Sensitive Data</h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            SABDHAM does not sell users&apos; personal information and does not intentionally use account information for unrelated advertising profiling.
          </p>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Unless a future feature specifically requires it and appropriate disclosure is provided, SABDHAM does not intentionally require precise location, contact lists, SMS history, call logs, microphone recordings, camera recordings or financial account credentials.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <Lock className="w-4 h-4" /> 9. Security &amp; Retention
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            SABDHAM uses reasonable technical measures intended to protect user information, including encrypted HTTPS connections where supported. No online service can guarantee absolute security.
          </p>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Account data may be retained while an account is active and for as long as reasonably necessary to provide the service. Limited technical, security or fraud-prevention records may be retained where necessary for debugging, security, dispute resolution or legal obligations.
          </p>
        </div>

        <div className="space-y-3 p-5 rounded-2xl bg-zinc-900 border border-white/10">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" /> 10. Account &amp; Data Deletion
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            You may request deletion of your SABDHAM account through the available account-deletion controls. Deletion is intended to remove personal account and library information that is no longer required, subject to limited lawful, security or fraud-prevention retention.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href="/?tab=delete-account"
              className="inline-flex items-center text-xs font-bold px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition"
            >
              Request Account &amp; Data Deletion
            </a>
            <a
              href="mailto:sabdhammusic@gmail.com"
              className="inline-flex items-center text-xs font-semibold px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 transition"
            >
              Contact Support
            </a>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400">11. International Processing &amp; Your Rights</h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Third-party providers may process information in countries different from your own. Depending on applicable law, you may have rights to request access, correction or deletion of personal information.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400">12. Policy Updates</h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            This Privacy Policy may change when SABDHAM changes its data practices, features, infrastructure or third-party services. The updated date will be changed when material revisions are published.
          </p>
        </div>

        <div className="pt-6 border-t border-white/10 text-xs text-zinc-500 text-center">
          SABDHAM 1.2.0 • Independent project developed and published by Santh Creatives
        </div>
      </div>
    </div>
  );
};
