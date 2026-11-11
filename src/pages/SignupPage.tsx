import React, { useState } from 'react';
import { useAuth, SignupPayload } from '../context/AuthContext';
import { ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, Mail } from 'lucide-react';
import { FluencisLogo } from '../components/FluencisLogo';

interface SignupPageProps {
  onNavigate: (tab: string) => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({ onNavigate }) => {
  const { signup, loginWithGoogle, authError, clearAuthError } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    course: 'B.Tech',
    branch: 'CSE',
    year: '1st Year',
    level: 'Beginner',
    goal: 'Placement Preparation',
    interests: 'AI & Engineering',
    preferredPracticeModes: '1-to-1 Practice',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setLocalError('');
  };

  // Basic password strength calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { label: 'Empty', color: 'bg-transparent', score: 0 };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[A-Z]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { label: 'Weak (min 6 chars)', color: 'bg-rose-500', score };
    if (score <= 3) return { label: 'Medium', color: 'bg-amber-400', score };
    return { label: 'Strong', color: 'bg-[#20f5a2]', score };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearAuthError();

    // 1. Validate full name
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      setLocalError('Please enter your full name (at least 2 letters).');
      return;
    }

    // 2. Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      setLocalError('Please enter a valid email address (e.g., student@college.edu).');
      return;
    }

    // 3. Validate password length
    if (!formData.password || formData.password.length < 6) {
      setLocalError('Password must be at least 6 characters long for security.');
      return;
    }

    // 4. Validate password confirmation
    if (formData.password !== formData.confirmPassword) {
      setLocalError('Your passwords do not match. Please re-enter them.');
      return;
    }

    // 5. Validate branch
    if (!formData.branch.trim()) {
      setLocalError('Please specify your academic branch (e.g., CSE, ECE, Mech).');
      return;
    }

    setIsSubmitting(true);
    const payload: SignupPayload = {
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      course: formData.course,
      branch: formData.branch.trim(),
      year: formData.year,
      level: formData.level,
      goal: formData.goal,
      interests: formData.interests,
      preferredPracticeModes: formData.preferredPracticeModes,
    };

    const res = await signup(payload);
    setIsSubmitting(false);

    if (res.success) {
      setSignupSuccess(true);
    } else {
      setLocalError(res.error || 'Failed to create student account.');
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-[calc(100vh-72px)] max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
      {/* Left Column info */}
      <div className="lg:col-span-5 space-y-6">
        <FluencisLogo size={44} showText={true} textClassName="text-3xl" badgeText="Student Platform" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#20f5a2]/10 border border-[#20f5a2]/30 text-xs font-bold text-[#20f5a2]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>REAL FIREBASE AUTHENTICATION</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
          Start your journey{' '}
          <span className="bg-gradient-to-r from-[#20f5a2] to-[#00bfff] bg-clip-text text-transparent">
            towards confident communication.
          </span>
        </h1>

        <p className="text-sm text-[#b5c8d8] leading-relaxed">
          Create your verified student profile. Your private credentials are handled by Firebase Authentication, and your profile is securely stored in Cloud Firestore.
        </p>

        <div className="space-y-3.5 pt-4">
          {[
            'Zero plaintext password storage — protected by Google Cloud',
            'Private user data strictly partitioned with Firestore Security Rules',
            'Find verified peers by branch, year, and interview goals',
          ].map((text, idx) => (
            <div key={idx} className="flex items-center gap-3 text-sm text-[#c9d9e7]">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#20f5a2] to-[#00aaff] text-[#00131c] flex items-center justify-center font-bold text-xs shrink-0 shadow-[0_0_10px_rgba(32,245,162,0.4)]">
                ✓
              </div>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column Form */}
      <div className="lg:col-span-7 flex justify-center">
        <div className="w-full max-w-xl p-8 sm:p-9 rounded-3xl bg-gradient-to-br from-[rgba(10,50,75,0.7)] to-[rgba(2,15,30,0.92)] border border-[rgba(0,220,255,0.35)] shadow-2xl backdrop-blur-xl">
          {signupSuccess ? (
            <div className="py-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#20f5a2] to-[#00aaff] flex items-center justify-center font-bold text-3xl text-[#00131c] mx-auto shadow-[0_0_30px_rgba(32,245,162,0.6)]">
                ✓
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-white">Account Created Successfully!</h2>
                <p className="text-xs text-[#9eb6c8] max-w-md mx-auto leading-relaxed">
                  Welcome to Fluencis, <strong className="text-white">{formData.fullName}</strong>. Your account is secured with Firebase and your profile has been initialized in Cloud Firestore.
                </p>
                <div className="p-3 rounded-2xl bg-[rgba(0,210,255,0.08)] border border-[rgba(0,210,255,0.2)] text-xs text-[#00cfff] max-w-sm mx-auto flex items-center gap-2">
                  <Mail className="w-4 h-4 shrink-0 text-[#20f5a2]" />
                  <span>A verification email has been dispatched to {formData.email}.</span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="w-full h-12 rounded-xl font-bold text-sm text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00aaff] shadow-[0_8px_25px_rgba(0,190,255,0.25)] hover:shadow-[0_12px_35px_rgba(32,245,162,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Go to Student Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-1">Create Student Account</h2>
                <p className="text-xs text-[#8fa9bb]">
                  Join Fluencis with real Firebase Authentication &amp; Firestore.
                </p>
              </div>

              {displayError && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{displayError}</span>
                </div>
              )}

              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isSubmitting}
                className="w-full h-11 px-4 mb-4 rounded-xl font-bold text-xs text-white bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] border border-[rgba(255,255,255,0.2)] hover:border-[#20f5a2] shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>{isGoogleLoading ? 'Connecting to Google...' : 'Sign up instantly with Google'}</span>
              </button>

              <div className="relative flex items-center justify-center my-3.5">
                <div className="border-t border-[rgba(0,190,255,0.2)] w-full" />
                <span className="bg-[#051c30] px-3 text-[10px] text-[#718b9d] uppercase tracking-wider relative shrink-0">
                  or fill student registration form
                </span>
                <div className="border-t border-[rgba(0,190,255,0.2)] w-full" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Section 1: Personal Details */}
                <div className="text-xs font-bold tracking-wider text-[#20f5a2] uppercase pb-1 border-b border-[rgba(0,210,255,0.15)] pt-1">
                  1. Personal &amp; Security Credentials
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#dceaf4] mb-1.5">
                    Full Student Name <span className="text-[#20f5a2]">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="e.g. Vamsi Krishna"
                    className="w-full h-10 px-3.5 rounded-xl bg-[rgba(1,15,30,0.7)] border border-[rgba(0,190,255,0.25)] text-white text-xs focus:outline-none focus:border-[#20f5a2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#dceaf4] mb-1.5">
                    College / Personal Email <span className="text-[#20f5a2]">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="vamsi@college.edu"
                    className="w-full h-10 px-3.5 rounded-xl bg-[rgba(1,15,30,0.7)] border border-[rgba(0,190,255,0.25)] text-white text-xs focus:outline-none focus:border-[#20f5a2]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#dceaf4] mb-1.5">
                      Password <span className="text-[#20f5a2]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        required
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Min 6 characters"
                        className="w-full h-10 px-3.5 pr-10 rounded-xl bg-[rgba(1,15,30,0.7)] border border-[rgba(0,190,255,0.25)] text-white text-xs focus:outline-none focus:border-[#20f5a2]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#20f5a2] p-1"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#dceaf4] mb-1.5">
                      Confirm Password <span className="text-[#20f5a2]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        required
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Re-enter password"
                        className="w-full h-10 px-3.5 pr-10 rounded-xl bg-[rgba(1,15,30,0.7)] border border-[rgba(0,190,255,0.25)] text-white text-xs focus:outline-none focus:border-[#20f5a2]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#20f5a2] p-1"
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {formData.password && (
                  <div className="flex items-center justify-between text-[11px] text-[#7896aa]">
                    <span>Password Strength:</span>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${passwordStrength.color}`} />
                      {passwordStrength.label}
                    </span>
                  </div>
                )}

                {/* Section 2: Education Details */}
                <div className="text-xs font-bold tracking-wider text-[#20f5a2] uppercase pb-1 border-b border-[rgba(0,210,255,0.15)] pt-3">
                  2. Academic &amp; Branch Information
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#dceaf4] mb-1.5">
                      Course
                    </label>
                    <select
                      name="course"
                      value={formData.course}
                      onChange={handleChange}
                      className="w-full h-10 px-3 rounded-xl bg-[#041425] border border-[rgba(0,190,255,0.25)] text-white text-xs focus:outline-none focus:border-[#20f5a2]"
                    >
                      <option value="B.Tech">B.Tech</option>
                      <option value="BCA">BCA</option>
                      <option value="B.Sc">B.Sc</option>
                      <option value="BBA">BBA</option>
                      <option value="M.Tech">M.Tech</option>
                      <option value="MCA">MCA</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#dceaf4] mb-1.5">
                      Year
                    </label>
                    <select
                      name="year"
                      value={formData.year}
                      onChange={handleChange}
                      className="w-full h-10 px-3 rounded-xl bg-[#041425] border border-[rgba(0,190,255,0.25)] text-white text-xs focus:outline-none focus:border-[#20f5a2]"
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#dceaf4] mb-1.5">
                      Branch / Major <span className="text-[#20f5a2]">*</span>
                    </label>
                    <input
                      type="text"
                      name="branch"
                      required
                      value={formData.branch}
                      onChange={handleChange}
                      placeholder="CSE, ECE, IT..."
                      className="w-full h-10 px-3.5 rounded-xl bg-[rgba(1,15,30,0.7)] border border-[rgba(0,190,255,0.25)] text-white text-xs focus:outline-none focus:border-[#20f5a2]"
                    />
                  </div>
                </div>

                {/* Section 3: Communication Profile */}
                <div className="text-xs font-bold tracking-wider text-[#20f5a2] uppercase pb-1 border-b border-[rgba(0,210,255,0.15)] pt-3">
                  3. Communication &amp; Matchmaking Profile
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#dceaf4] mb-1.5">
                      Speaking Level
                    </label>
                    <select
                      name="level"
                      value={formData.level}
                      onChange={handleChange}
                      className="w-full h-10 px-3 rounded-xl bg-[#041425] border border-[rgba(0,190,255,0.25)] text-white text-xs focus:outline-none focus:border-[#20f5a2]"
                    >
                      <option value="Beginner">Beginner (Building vocabulary)</option>
                      <option value="Intermediate">Intermediate (Conversational)</option>
                      <option value="Advanced">Advanced (Fluent &amp; technical)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#dceaf4] mb-1.5">
                      Primary Goal
                    </label>
                    <select
                      name="goal"
                      value={formData.goal}
                      onChange={handleChange}
                      className="w-full h-10 px-3 rounded-xl bg-[#041425] border border-[rgba(0,190,255,0.25)] text-white text-xs focus:outline-none focus:border-[#20f5a2]"
                    >
                      <option value="Placement Preparation">Placement Preparation</option>
                      <option value="Interview Skills">Interview Skills</option>
                      <option value="Group Discussion">Group Discussion</option>
                      <option value="General Fluency">General Fluency</option>
                      <option value="Presentation Poise">Presentation Poise</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#dceaf4] mb-1.5">
                    Topics of Interest
                  </label>
                  <input
                    type="text"
                    name="interests"
                    value={formData.interests}
                    onChange={handleChange}
                    placeholder="e.g. AI &amp; Software, Startups, GD Topics, Coding"
                    className="w-full h-10 px-3.5 rounded-xl bg-[rgba(1,15,30,0.7)] border border-[rgba(0,190,255,0.25)] text-white text-xs focus:outline-none focus:border-[#20f5a2]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl font-bold text-sm text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00aaff] shadow-[0_8px_25px_rgba(0,190,255,0.25)] hover:shadow-[0_12px_35px_rgba(0,220,210,0.4)] hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2 cursor-pointer mt-4 disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Creating Firebase Account...' : 'Create Verified Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="text-center mt-5 text-xs text-[#8198a9]">
                Already have an account?{' '}
                <button
                  onClick={() => onNavigate('login')}
                  className="text-[#20f5a2] font-bold hover:underline cursor-pointer"
                >
                  Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
