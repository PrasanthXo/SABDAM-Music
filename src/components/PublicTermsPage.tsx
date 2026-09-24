import React from 'react';
import { Gavel, ArrowLeft, BookOpen, User, AlertTriangle } from 'lucide-react';

interface PublicTermsPageProps {
  onBack?: () => void;
}

export const PublicTermsPage: React.FC<PublicTermsPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 sm:p-8 flex justify-center">
      <div className="w-full max-w-3xl space-y-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Gavel className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">SABDHAM Terms of Service</h1>
              <p className="text-xs text-zinc-400">Last updated: September 2026 • Version 1.0.0</p>
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
            <BookOpen className="w-4 h-4" /> 1. Acceptance of Terms
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            By accessing or using Sabdham, you agree to be bound by these Terms of Service. If you do not agree to these terms, please discontinue use immediately.
          </p>
        </div>

        {/* Section 2: YouTube Integration */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> 2. YouTube API & Compliance
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Sabdham is a third-party application that facilitates access to audio content hosted on YouTube.
          </p>
          <ul className="text-sm text-zinc-300 space-y-2 list-disc pl-5 leading-relaxed">
            <li>We are not affiliated with, endorsed by, or sponsored by YouTube or Google.</li>
            <li>Usage of Sabdham is subject to YouTube's Terms of Service.</li>
            <li>All content rights, including playback rights, belong to their respective creators and YouTube.</li>
          </ul>
        </div>

        {/* Section 3: User Responsibility */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-amber-400 flex items-center gap-2">
            <User className="w-4 h-4" /> 3. User Conduct
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            You agree to use Sabdham for personal, non-commercial purposes. You must not:
          </p>
          <ul className="text-sm text-zinc-300 space-y-2 list-disc pl-5 leading-relaxed">
            <li>Attempt to bypass or manipulate YouTube streaming restrictions.</li>
            <li>Download or store content in ways that violate YouTube's terms or creator rights.</li>
            <li>Use the service to engage in illegal, harmful, or abusive behavior.</li>
          </ul>
        </div>

        {/* Section 4: Liability */}
        <div className="space-y-3 p-5 rounded-2xl bg-zinc-900 border border-white/10">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Gavel className="w-4 h-4 text-amber-400" /> 4. Disclaimer & Limitation of Liability
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Sabdham is provided on an "as-is" and "as-available" basis. We do not guarantee continuous, error-free streaming or access to any specific content. We are not liable for damages arising from your use of the service or YouTube content availability.
          </p>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-white/10 text-xs text-zinc-500 text-center">
          &copy; {new Date().getFullYear()} Sabdham Audio Inc. All rights reserved. High fidelity Tamil, Sinhala, & Global streaming engine.
        </div>
      </div>
    </div>
  );
};
