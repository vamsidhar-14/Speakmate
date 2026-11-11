import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ArrowRight, KeyRound, Mail, X, CheckCircle2, AlertCircle, Sparkles, User } from 'lucide-react';
import { FluencisLogo } from '../components/FluencisLogo';

interface LoginPageProps {
  onNavigate: (tab: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, loginWithGoogle, loginAsGuest, sendPasswordReset, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [guestName, setGuestName] = useState('');

  const handleGuestLogin = async () => {
    setIsGuestLoading(true);
    const res = await loginAsGuest(guestName || 'Student Peer');
    setIsGuestLoading(false);
    if (res.success) {
      const pendingRoom = sessionStorage.getItem('pendingJoinRoomId');
      if (pendingRoom) {
        onNavigate('room');
      } else {
        onNavigate('rooms');
      }
    }
  };

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  const handleGoogleSignIn = async () => {
    setLocalError('');
    clearAuthError();
    setIsGoogleLoading(true);
    const res = await loginWithGoogle();
    setIsGoogleLoading(false);
    if (res.success) {
      onNavigate('dashboard');
    } else {
      setLocalError(res.error || 'Google sign-in failed.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearAuthError();

    if (!email.trim() || !password) {
      setLocalError('Please enter both your email address and password.');
      return;
    }

    setIsSubmitting(true);
    const res = await login(email, password);
    setIsSubmitting(false);

    if (res.success) {
      onNavigate('dashboard');
    } else {
      setLocalError(res.error || 'Login failed. Please verify credentials.');
    }
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetStatus({ type: 'error', message: 'Please enter your registered email address.' });
      return;
    }

    setIsSendingReset(true);
    setResetStatus({ type: null, message: '' });

    const res = await sendPasswordReset(resetEmail);
    setIsSendingReset(false);

    if (res.success) {
      setResetStatus({
        type: 'success',
        message: res.message || 'Password reset link sent! Please check your inbox.',
      });
    } else {
      setResetStatus({
        type: 'error',
        message: res.error || 'Failed to send password reset email.',
      });
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-[calc(100vh-72px)] max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
      {/* Left intro column */}
      <div className="lg:col-span-6 space-y-6">
        <FluencisLogo size={44} showText={true} textClassName="text-3xl" badgeText="Student Platform" />

        <p className="text-xs font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
          FIREBASE SECURE AUTHENTICATION
        </p>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
          Continue your{' '}
          <span className="bg-gradient-to-r from-[#20f5a2] to-[#00bfff] bg-clip-text text-transparent">
            communication journey.
          </span>
        </h1>

        <p className="text-sm text-[#b5c8d8] leading-relaxed max-w-md">
          Sign in to connect with fellow students, practice speaking in real time, and continue building lasting confidence for your career.
        </p>

        <div className="space-y-3.5 pt-4">
          {[
            { num: '01', text: 'Real authenticated student accounts powered by Firebase' },
            { num: '02', text: 'Practice with verified peers in secure WebRTC rooms' },
            { num: '03', text: 'Constructive post-session peer feedback stored in Firestore' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-3.5 text-sm text-[#c9d9e7]">
              <span className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-gradient-to-br from-[#20f5a2] to-[#00aaff] text-[#00131c] shrink-0 shadow-[0_0_12px_rgba(0,210,255,0.2)]">
                {item.num}
              </span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Login Card */}
      <div className="lg:col-span-6 flex justify-center">
        <div className="w-full max-w-md p-8 sm:p-9 rounded-3xl bg-gradient-to-br from-[rgba(10,50,75,0.72)] to-[rgba(2,15,30,0.92)] border border-[rgba(0,220,255,0.35)] shadow-2xl backdrop-blur-xl relative">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-1">Student Sign In</h2>
            <p className="text-xs text-[#8fa9bb]">
              Enter your verified email and password
            </p>
          </div>

          {displayError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isSubmitting}
            className="w-full h-11 px-4 rounded-xl font-bold text-xs text-white bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] border border-[rgba(255,255,255,0.2)] hover:border-[#20f5a2] shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-[rgba(0,190,255,0.2)] w-full" />
            <span className="bg-[#051c30] px-3 text-[10px] text-[#718b9d] uppercase tracking-wider relative shrink-0">
              or sign in with email
            </span>
            <div className="border-t border-[rgba(0,190,255,0.2)] w-full" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#dceaf4] mb-2">
                Student Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setLocalError('');
                }}
                placeholder="e.g. yourname@college.edu"
                className="w-full h-11 px-4 rounded-xl bg-[rgba(1,15,30,0.75)] border border-[rgba(0,190,255,0.25)] text-white text-sm focus:outline-none focus:border-[#20f5a2] focus:ring-1 focus:ring-[#20f5a2] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#dceaf4] mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setLocalError('');
                  }}
                  placeholder="Enter your password"
                  className="w-full h-11 px-4 pr-12 rounded-xl bg-[rgba(1,15,30,0.75)] border border-[rgba(0,190,255,0.25)] text-white text-sm focus:outline-none focus:border-[#20f5a2] focus:ring-1 focus:ring-[#20f5a2] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#20f5a2] font-semibold hover:text-[#00cfff] p-1 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-[#6c8699]">Secure Firebase Auth</span>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setResetStatus({ type: null, message: '' });
                  setIsForgotModalOpen(true);
                }}
                className="text-[#20f5a2] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl font-bold text-sm text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00aaff] shadow-[0_8px_25px_rgba(0,190,255,0.25)] hover:shadow-[0_12px_35px_rgba(0,220,210,0.4)] hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Verifying Credentials...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center mt-6 text-xs text-[#8198a9]">
            Don&apos;t have an account?{' '}
            <button
              onClick={() => onNavigate('signup')}
              className="text-[#20f5a2] font-bold hover:underline cursor-pointer"
            >
              Create Account
            </button>
          </div>

          {/* Quick 1-Click Guest Student Access for Testing and Joining Rooms */}
          <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#20f5a2] flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#20f5a2]" />
                <span>Quick Student Practice Access</span>
              </span>
              <span className="text-[10px] text-[#7693a7]">No password needed</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your Name (e.g. Student 2)"
                className="flex-1 px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-[#587385] focus:outline-none focus:border-[#20f5a2]"
              />
              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={isGuestLoading}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-[rgba(32,245,162,0.15)] border border-[rgba(32,245,162,0.4)] text-[#20f5a2] hover:bg-[#20f5a2] hover:text-[#00131c] transition-all cursor-pointer whitespace-nowrap"
              >
                {isGuestLoading ? 'Joining...' : 'Enter as Guest →'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-[rgba(0,210,255,0.3)] bg-gradient-to-br from-[rgba(10,50,75,0.92)] to-[rgba(2,15,30,0.98)] p-6 sm:p-8 shadow-2xl backdrop-blur-2xl text-white">
            <button
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-[#7892a5] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#20f5a2] uppercase tracking-wider">
                <KeyRound className="w-4 h-4" />
                <span>PASSWORD RECOVERY</span>
              </div>
              <h3 className="text-xl font-bold text-white">Reset your password</h3>
              <p className="text-xs text-[#8fa9bb]">
                Enter your account email. Firebase will send a secure link to reset your password.
              </p>
            </div>

            {resetStatus.message && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-start gap-2 ${
                  resetStatus.type === 'success'
                    ? 'bg-[#20f5a2]/10 border border-[#20f5a2]/30 text-[#20f5a2]'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {resetStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#20f5a2] mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                )}
                <span>{resetStatus.message}</span>
              </div>
            )}

            <form onSubmit={handleSendReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#dceaf4] mb-2">
                  Registered Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="student@college.edu"
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-[rgba(1,15,30,0.8)] border border-[rgba(0,190,255,0.25)] text-white text-xs sm:text-sm focus:outline-none focus:border-[#20f5a2]"
                  />
                  <Mail className="w-4 h-4 text-[#6e889b] absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[#8fa9bb] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingReset}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00aaff] shadow-[0_4px_15px_rgba(0,190,255,0.25)] hover:shadow-[0_6px_20px_rgba(32,245,162,0.4)] disabled:opacity-50 cursor-pointer"
                >
                  {isSendingReset ? 'Sending Email...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
