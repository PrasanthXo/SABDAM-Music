import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  RefreshCw,
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowLeft,
  RotateCcw,
  Inbox
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginModal: React.FC = () => {
  const {
    isLoginModalOpen,
    closeLoginModal,
    loginWithGoogle,
    sendOtp,
    verifyOtp,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [step, setStep] = useState<'email' | 'otp'>('email');

  // Fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Status & loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState<number>(0);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Reset errors and step when modal opens/closes
  useEffect(() => {
    if (isLoginModalOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsSubmitting(false);
    } else {
      setStep('email');
      setOtpCode('');
    }
  }, [isLoginModalOpen]);

  if (!isLoginModalOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    const res = await loginWithGoogle(rememberMe);
    setIsSubmitting(false);
    if (res.success) {
      setSuccessMessage(res.message);
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleTabSwitch = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setStep('email');
    setOtpCode('');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Step 1: Send OTP to email
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setErrorMessage('Please enter your name or display nickname.');
      return;
    }

    setIsSubmitting(true);
    const res = await sendOtp(
      cleanEmail,
      mode === 'signin' ? 'signin' : 'signup',
      mode === 'signup' ? name.trim() : undefined
    );
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMessage(res.message);
      setStep('otp');
      setResendCountdown(60);
    } else {
      setErrorMessage(res.message);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCountdown > 0 || isSubmitting) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    setIsSubmitting(true);
    const res = await sendOtp(
      email.trim().toLowerCase(),
      mode === 'signin' ? 'signin' : 'signup',
      mode === 'signup' ? name.trim() : undefined
    );
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMessage(`A fresh verification code has been dispatched to ${email}`);
      setResendCountdown(60);
    } else {
      setErrorMessage(res.message);
    }
  };

  // Step 2: Verify OTP code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    const res = await verifyOtp(
      email.trim().toLowerCase(),
      cleanCode,
      mode === 'signup' ? name.trim() : undefined,
      rememberMe
    );
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMessage(res.message);
    } else {
      setErrorMessage(res.message);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl overflow-hidden"
          id="login-modal-container"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={closeLoginModal}
            aria-label="Close modal"
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/5 transition cursor-pointer"
            id="login-modal-close-button"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 items-center justify-center shadow-lg shadow-amber-500/20 text-zinc-950 mb-3">
              {step === 'otp' ? (
                <Inbox className="w-6 h-6" />
              ) : mode === 'signin' ? (
                <Lock className="w-6 h-6" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {step === 'otp'
                ? 'Check Your Email'
                : mode === 'signin'
                ? 'Sign In to SABDHAM'
                : 'Create an Account'}
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
              {step === 'otp'
                ? `Enter the 6-digit verification code sent to ${email}`
                : mode === 'signin'
                ? 'Enter your email to receive a secure 6-digit code in your inbox'
                : 'Join SABDHAM with quick email verification'}
            </p>
          </div>

          {/* 2 Tabs: Sign In vs Register (only shown on email step) */}
          {step === 'email' && (
            <div className="grid grid-cols-2 p-1 mb-5 bg-zinc-800/90 rounded-xl border border-white/5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleTabSwitch('signin')}
                id="tab-sign-in"
                className={`py-2 px-3 rounded-lg transition-all text-center cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabSwitch('signup')}
                id="tab-create-account"
                className={`py-2 px-3 rounded-lg transition-all text-center cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>Register</span>
              </button>
            </div>
          )}

          {/* Error & Success alerts */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2"
              id="login-error-banner"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          {successMessage && !errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2"
              id="login-success-banner"
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </motion.div>
          )}

          {/* Google Sign-in Option (Only on initial step) */}
          {step === 'email' && (
            <div className="mb-5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                id="btn-google-signin"
                className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700/80 border border-white/10 rounded-xl text-sm font-semibold text-white flex items-center justify-center space-x-3 transition cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-zinc-900 px-2 text-zinc-500 font-medium">
                    or sign in or sign up with email
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: ENTER EMAIL (AND NAME IF REGISTER) */}
          {step === 'email' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4" id="form-email-step">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Your Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      id="signup-name-input"
                      className="w-full bg-zinc-800/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    autoFocus={mode === 'signin'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    id="email-input"
                    className="w-full bg-zinc-800/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                  />
                </div>
              </div>

              {/* Auto Signout / Remember Me Option */}
              <div className="pt-1">
                <label className="flex items-start space-x-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    id="checkbox-remember-me"
                    className="mt-0.5 w-4 h-4 rounded bg-zinc-800 border-white/20 text-amber-500 focus:ring-amber-500/30 focus:ring-offset-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-zinc-300 group-hover:text-white transition">
                      Keep me signed in on this browser
                    </span>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {rememberMe
                        ? 'Session remains saved across browser restarts.'
                        : 'Auto signout enabled: Session closes automatically when tab or browser is closed.'}
                    </p>
                  </div>
                </label>
              </div>

              <div className="p-3 rounded-xl bg-zinc-800/60 border border-white/5 text-xs text-zinc-400 leading-relaxed flex items-center space-x-2.5">
                <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>We will email a secure 6-digit verification code directly to your inbox.</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                id="btn-request-otp"
                className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-semibold rounded-xl text-sm flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-zinc-400 text-xs">
                {mode === 'signin' ? (
                  <span>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => handleTabSwitch('signup')}
                      className="text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                    >
                      Register here
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => handleTabSwitch('signin')}
                      className="text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                    >
                      Sign in
                    </button>
                  </span>
                )}
              </div>
            </form>
          ) : (
            /* STEP 2: ENTER OTP CODE FROM EMAIL INBOX */
            <form onSubmit={handleVerifyOtp} className="space-y-4" id="form-verify-otp">
              {/* Inbox notification guidance */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed flex items-start space-x-2.5">
                <Inbox className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-300 mb-0.5">Check Your Email Inbox</p>
                  <p className="text-zinc-300 text-[11px] leading-relaxed">
                    A 6-digit verification code has been sent to <strong className="text-white">{email}</strong>. Please check your inbox and spam/junk folder.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 text-center">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="------"
                  id="otp-code-input"
                  className="w-full bg-zinc-800/90 border border-amber-500/40 rounded-xl py-3 text-center text-2xl font-mono tracking-[0.4em] text-amber-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
                />
                <p className="text-[11px] text-zinc-500 text-center mt-1.5">
                  Code valid for 10 minutes
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otpCode.length !== 6}
                id="btn-verify-otp"
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-semibold rounded-xl text-sm flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{mode === 'signin' ? 'Verify & Sign In' : 'Verify & Create Account'}</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs text-zinc-400">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtpCode('');
                  }}
                  className="inline-flex items-center space-x-1 text-zinc-400 hover:text-white transition cursor-pointer"
                  id="btn-back-to-email"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Email</span>
                </button>

                <button
                  type="button"
                  disabled={resendCountdown > 0 || isSubmitting}
                  onClick={handleResendOtp}
                  className={`inline-flex items-center space-x-1 transition cursor-pointer ${
                    resendCountdown > 0
                      ? 'text-zinc-500 cursor-not-allowed'
                      : 'text-amber-400 hover:text-amber-300 font-semibold'
                  }`}
                  id="btn-resend-otp"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Security footnote */}
          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-center space-x-1.5 text-[11px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>Encrypted authentication backed by Google Cloud &amp; PostgreSQL</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

