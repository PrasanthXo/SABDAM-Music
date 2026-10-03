import React from 'react';
import { Gavel, ArrowLeft, BookOpen, User, AlertTriangle, Radio, ListMusic } from 'lucide-react';

interface PublicTermsPageProps {
  onBack?: () => void;
}

export const PublicTermsPage: React.FC<PublicTermsPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 sm:p-8 flex justify-center">
      <div className="w-full max-w-3xl space-y-8 py-6">
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Gavel className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">SABDHAM Terms &amp; Conditions</h1>
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
            <BookOpen className="w-4 h-4" /> 1. Acceptance &amp; Independent Project
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            By installing, accessing or using SABDHAM, you agree to these Terms &amp; Conditions. SABDHAM is an independently developed personal software project published under the developer name Santh Creatives. Santh Creatives is not represented as a registered company, record label or music licensing organisation.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <ListMusic className="w-4 h-4" /> 2. What SABDHAM Provides
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            SABDHAM may provide music discovery, search, playback, personalized catalogues, public-playlist discovery, playlist import, liked songs, queue management, audio-output routing, library management, accounts, preferences, metadata and artwork.
          </p>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Search and playlist results may combine multiple external providers. Playlist items, artwork, metadata, streaming references and playback sources can change or become unavailable without notice.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <Radio className="w-4 h-4" /> 3. Third-Party Services &amp; Content
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Depending on the requested feature, SABDHAM may communicate with third-party services including Google/Firebase, Spotify, YouTube, Audius, Apple/iTunes, MusicBrainz, Cover Art Archive, Last.fm and TMDB. Each provider is governed by its own terms and policies.
          </p>
          <ul className="text-sm text-zinc-300 space-y-2 list-disc pl-5 leading-relaxed">
            <li>SABDHAM does not claim ownership of third-party songs, recordings, lyrics, artwork, videos, artist identities, trademarks or metadata.</li>
            <li>Public availability does not mean material is copyright-free or licensed for unrestricted redistribution.</li>
            <li>Use of SABDHAM does not grant a copyright licence or ownership right in third-party content.</li>
            <li>Provider availability, accuracy and continued operation are outside SABDHAM's control.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <User className="w-4 h-4" /> 4. User Responsibilities
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">You must not knowingly use SABDHAM to:</p>
          <ul className="text-sm text-zinc-300 space-y-2 list-disc pl-5 leading-relaxed">
            <li>infringe intellectual-property rights or distribute unauthorized protected material;</li>
            <li>bypass security systems, access controls or provider restrictions;</li>
            <li>gain unauthorized access, abuse accounts or interfere with SABDHAM infrastructure; or</li>
            <li>use the service in violation of applicable law.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> 5. Playback, Audio Output &amp; Availability
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            SABDHAM may use more than one playback source or resolver to improve reliability. A fallback source may be used when earlier sources fail. On supported Android devices, SABDHAM may show and switch between system-provided phone, Bluetooth or other audio routes.
          </p>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Actual playback, route availability, multi-device behavior, bitrate and compatibility depend on the device, Android version, connected hardware, network and third-party services. No specific track, route or source is guaranteed to remain available.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400">6. Accounts, Personalization &amp; Synchronization</h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            SABDHAM may store and synchronize profile information, playlists, likes, recently played items, playback-interest data and settings. This information may be used to personalize catalogues and discovery. Synchronization is a convenience feature and should not be treated as a guaranteed permanent backup.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400">7. Updates &amp; Service Changes</h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            SABDHAM may provide optional or required updates for security, compatibility, provider changes, legal requirements, reliability or new features. Older versions may lose access when they are no longer compatible with current services.
          </p>
        </div>

        <div className="space-y-3 p-5 rounded-2xl bg-zinc-900 border border-white/10">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Gavel className="w-4 h-4 text-amber-400" /> 8. Disclaimer &amp; Limitation of Liability
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            To the maximum extent permitted by law, SABDHAM is provided on an &quot;as is&quot; and &quot;as available&quot; basis. No guarantee is made that operation will always be uninterrupted, error-free or compatible with every device, provider, network or media source.
          </p>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Nothing in these Terms excludes rights or liabilities that cannot legally be excluded.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400">9. Copyright, Removal &amp; Account Deletion</h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Rights holders may request review, correction, restriction or removal of disputed material through SABDHAM support. Where account deletion is available, deletion may remove profile, playlist, like and settings data, subject to limited retention required for security, fraud prevention or legal obligations.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400">10. Changes to These Terms</h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            These Terms may be updated when SABDHAM changes its functionality, infrastructure, third-party services or legal requirements. The updated date will be changed when material revisions are published.
          </p>
        </div>

        <div className="pt-6 border-t border-white/10 text-xs text-zinc-500 text-center">
          SABDHAM 1.2.0 • Independent project developed and published by Santh Creatives
        </div>
      </div>
    </div>
  );
};
