import React, { useState } from 'react';
import { Trash2, ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface PublicAccountDeletionPageProps {
  onBack?: () => void;
}

export const PublicAccountDeletionPage: React.FC<PublicAccountDeletionPageProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || confirmText !== 'DELETE') {
      setStatus('error');
      setMessage('Please enter your account email and type "DELETE" to confirm.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/auth/request-data-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('success');
        setMessage(data.message || 'Your account and associated personal data have been scheduled for immediate deletion.');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to submit deletion request. Please verify your email address.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again or email support@sabdham.music.');
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 sm:p-8 flex justify-center items-center">
      <div className="w-full max-w-xl space-y-6 p-6 sm:p-8 rounded-3xl bg-zinc-900 border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Delete Account & Data</h1>
              <p className="text-xs text-zinc-400">Google Play Policy Compliance Portal</p>
            </div>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-2xl bg-zinc-800/60 border border-white/5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Permanent Data Deletion Notice</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            In compliance with Google Play User Data policies, you may permanently purge your Sabdham account. Upon submission, all your playlists, favorite tracks, playback history, and profile data will be permanently erased from our active servers within 24 hours.
          </p>
        </div>

        {status === 'success' ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Deletion Request Received</h3>
            <p className="text-xs text-zinc-300">{message}</p>
            <div className="pt-2">
              <a
                href="/"
                className="inline-flex text-xs font-bold px-4 py-2 bg-zinc-800 text-zinc-200 rounded-xl hover:bg-zinc-700 transition"
              >
                Return to Home
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Account Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-3 bg-zinc-800 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-red-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Type <span className="font-mono text-red-400 font-bold">DELETE</span> to confirm
              </label>
              <input
                type="text"
                required
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-3 bg-zinc-800 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-red-500 font-mono transition"
              />
            </div>

            {message && status === 'error' && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
            >
              <Trash2 className="w-4 h-4" />
              <span>{status === 'loading' ? 'Processing Request...' : 'Permanently Delete My Account'}</span>
            </button>
          </form>
        )}

        <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
          <span>Verified Google Play Account & Data Deletion Portal</span>
        </div>
      </div>
    </div>
  );
};
