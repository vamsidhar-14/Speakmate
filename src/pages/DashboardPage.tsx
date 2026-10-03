import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  ArrowRight,
  Sparkles,
  Mic,
  Briefcase,
  Users,
  Code,
  BarChart2,
  Zap,
  UserCheck,
  Edit3,
  ShieldCheck,
  Mail,
  AlertTriangle,
  Trash2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { PracticeMode, UserProfile } from '../types';

interface DashboardPageProps {
  onNavigate: (tab: string, mode?: PracticeMode) => void;
  onOpenChat?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenChat }) => {
  const { user, isOwner, updateProfile, resendVerificationEmail, deleteAccount } = useAuth();
  const { onlineStudents, peerFeedbacks, isConnected } = useSocket();

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: user?.fullName || '',
    course: user?.course || 'B.Tech',
    branch: user?.branch || 'CSE',
    year: user?.year || '1st Year',
    level: user?.level || 'Beginner',
    goal: user?.goal || 'Placement Preparation',
    interests: user?.interests || 'AI & Engineering',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Email verification resend state
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState('');

  // Account deletion modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const avgScore = peerFeedbacks.length > 0
    ? ((peerFeedbacks.reduce((acc, f) => acc + (f.ratings?.overall || 4.5), 0) / peerFeedbacks.length) * 2).toFixed(1)
    : '8.8';

  const modes: { title: PracticeMode; icon: string; desc: string }[] = [
    { title: 'General Communication', icon: '🎤', desc: 'Improve everyday fluency and voice projection' },
    { title: 'Interview Practice', icon: '💼', desc: 'Mock HR and behavioral interview answers' },
    { title: 'Group Discussion', icon: '👥', desc: 'Practice structured turn-taking and points' },
    { title: 'Technical Discussion', icon: '💻', desc: 'Explain complex engineering architectures' },
    { title: 'Presentation', icon: '📊', desc: 'Build presentation poise and slide pacing' },
    { title: 'Debate', icon: '⚡', desc: 'Defend viewpoints and construct quick rebuttals' },
  ];

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    const res = await updateProfile({
      fullName: editFormData.fullName.trim() || user?.fullName,
      course: editFormData.course,
      branch: editFormData.branch.trim() || user?.branch,
      year: editFormData.year,
      level: editFormData.level,
      goal: editFormData.goal,
      interests: editFormData.interests.trim(),
    });
    setIsSavingProfile(false);

    if (res.success) {
      setProfileSaveSuccess(true);
      setProfileErrorMsg(null);
      setTimeout(() => {
        setProfileSaveSuccess(false);
        setIsEditingProfile(false);
      }, 1000);
    } else {
      setProfileErrorMsg(res.error || 'Failed to save profile updates.');
    }
  };

  const handleResendVerification = async () => {
    setIsResendingEmail(true);
    setEmailStatusMsg('');
    const res = await resendVerificationEmail();
    setIsResendingEmail(false);
    setEmailStatusMsg(res.message || res.error || 'Done.');
    setTimeout(() => setEmailStatusMsg(''), 5000);
  };

  const handleDeleteAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError('Please enter your account password to confirm deletion.');
      return;
    }

    setIsDeletingAccount(true);
    const res = await deleteAccount(deletePassword);
    setIsDeletingAccount(false);

    if (res.success) {
      setDeleteSuccess(true);
      setTimeout(() => {
        onNavigate('landing');
      }, 1500);
    } else {
      setDeleteError(res.error || 'Account deletion failed.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 relative z-10">
      {/* Email Verification Banner */}
      {!user?.emailVerified && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Verify your student email:</strong> We sent a verification email to{' '}
              <strong className="text-white">{user?.email}</strong>. Please check your inbox.
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {emailStatusMsg && <span className="text-[#20f5a2]">{emailStatusMsg}</span>}
            <button
              onClick={handleResendVerification}
              disabled={isResendingEmail}
              className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 text-white font-semibold hover:bg-amber-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isResendingEmail ? 'Sending...' : 'Resend Email'}
            </button>
          </div>
        </div>
      )}

      {/* Welcome Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-4">
        <div className="space-y-3 max-w-2xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-4 h-4 ${isOwner ? 'text-amber-400' : 'text-[#20f5a2]'}`} />
            <p className={`text-xs font-bold tracking-[1.5px] uppercase ${isOwner ? 'text-amber-400' : 'text-[#20f5a2]'}`}>
              {isOwner ? 'PLATFORM OWNER & ADMINISTRATOR' : 'AUTHENTICATED STUDENT ACCOUNT'}
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(0,210,255,0.08)] border border-[rgba(0,210,255,0.2)] text-[#86a8bd]">
              {isOwner ? 'Master Access' : 'Production Core: Non-Editable'}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Welcome back,{' '}
            <span className="bg-gradient-to-r from-[#20f5a2] to-[#00bfff] bg-clip-text text-transparent">
              {user?.fullName || 'Student'}.
            </span>
          </h1>
          <p className="text-sm text-[#91aabd] leading-relaxed">
            {isOwner
              ? 'You are logged in as the verified application owner (amireddysrinivas1978@gmail.com). The web application core, server, and other users\' data are completely locked against external edits.'
              : 'Ready to practice, speak and become more confident? Find a compatible student and start a meaningful peer communication session.'}
          </p>
        </div>

        <div className="text-left md:text-center shrink-0">
          <button
            onClick={() => onNavigate('practice', 'General Communication')}
            className="inline-flex items-center justify-center gap-3 min-w-[200px] h-13 px-6 rounded-2xl font-bold text-sm text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00aaff] shadow-[0_10px_30px_rgba(0,190,255,0.25)] hover:shadow-[0_14px_40px_rgba(0,220,210,0.4)] hover:translate-y-[-2px] transition-all cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_white]" />
            <span>Practice Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[11px] text-[#667f91] mt-2">
            Find compatible students online right now
          </p>
        </div>
      </section>

      {/* Quick Stats Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: '◉', label: 'Peer Reviews Logged', val: `${peerFeedbacks.length}` },
          { icon: '↗', label: 'Communication Score', val: `${avgScore} / 10` },
          { icon: '◇', label: 'Current Streak', val: '4 days' },
          { icon: '◎', label: 'Practice Time', val: `${peerFeedbacks.length * 15 + 20} min` },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="p-5 rounded-2xl border border-[rgba(0,190,255,0.2)] bg-gradient-to-br from-[rgba(8,48,70,0.55)] to-[rgba(2,15,30,0.8)] backdrop-blur-md flex items-center gap-4 hover:border-[rgba(32,245,162,0.5)] hover:translate-y-[-2px] transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-[rgba(0,210,255,0.08)] border border-[rgba(0,210,255,0.2)] flex items-center justify-center text-xl text-[#20f5a2] shrink-0 font-mono">
              {stat.icon}
            </div>
            <div>
              <div className="text-[11px] text-[#718b9e]">{stat.label}</div>
              <div className="text-lg font-bold text-white tracking-tight">{stat.val}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Main Dashboard Grid: Practice Modes & Profile Card */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Practice Modes (8 cols) */}
        <div className="lg:col-span-8 p-6 sm:p-7 rounded-3xl border border-[rgba(0,190,255,0.2)] bg-gradient-to-br from-[rgba(8,48,70,0.52)] to-[rgba(2,15,30,0.86)] backdrop-blur-xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-[11px] font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
                PRACTICE MODES
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Choose your focus</h2>
            </div>
            <span className="text-xs font-mono font-bold text-[#496678]">01</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {modes.map((m, idx) => (
              <button
                key={idx}
                onClick={() => onNavigate('practice', m.title)}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-[rgba(0,190,255,0.15)] bg-[rgba(1,17,31,0.65)] hover:border-[rgba(32,245,162,0.55)] hover:bg-[rgba(0,80,110,0.25)] hover:translate-y-[-2px] transition-all text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[rgba(32,245,162,0.15)] to-[rgba(0,170,255,0.15)] flex items-center justify-center text-lg shrink-0">
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-white group-hover:text-[#20f5a2] transition-colors truncate">
                    {m.title}
                  </h3>
                  <p className="text-[11px] text-[#718b9e] truncate">{m.desc}</p>
                </div>
                <span className="text-[#20f5a2] opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                  →
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Profile Card (4 cols) */}
        <div className="lg:col-span-4 p-6 sm:p-7 rounded-3xl border border-[rgba(0,190,255,0.2)] bg-gradient-to-br from-[rgba(8,48,70,0.52)] to-[rgba(2,15,30,0.86)] backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[11px] font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
                  FIRESTORE PROFILE
                </p>
                <h2 className="text-xl font-bold text-white">Student Account</h2>
              </div>
              <span className="text-xs font-mono font-bold text-[#496678]">02</span>
            </div>

            <div className="text-center py-2 mb-4">
              <div className="w-16 h-16 rounded-full mx-auto mb-2.5 flex items-center justify-center font-bold text-xl text-[#00131c] bg-gradient-to-br from-[#20f5a2] to-[#008cff] shadow-[0_0_20px_rgba(0,210,255,0.3)]">
                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'S'}
              </div>
              <h3 className="text-base font-bold text-white">{user?.fullName || 'Student'}</h3>
              <p className="text-xs text-[#728b9d]">
                {user?.email}
              </p>
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    user?.emailVerified
                      ? 'bg-[#20f5a2]/15 text-[#20f5a2] border border-[#20f5a2]/30'
                      : 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                  }`}
                >
                  {user?.emailVerified ? 'Email Verified' : 'Email Unverified'}
                </span>
              </div>
            </div>

            {/* Profile details list (or edit form) */}
            {!isEditingProfile ? (
              <div className="divide-y divide-[rgba(0,190,255,0.1)] text-xs border-y border-[rgba(0,190,255,0.12)] my-2">
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#6f8799]">Course</span>
                  <strong className="text-[#d8e6ef]">{user?.course || 'B.Tech'}</strong>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#6f8799]">Branch</span>
                  <strong className="text-[#d8e6ef]">{user?.branch || 'CSE'}</strong>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#6f8799]">Year</span>
                  <strong className="text-[#d8e6ef]">{user?.year || '1st Year'}</strong>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#6f8799]">Speaking Level</span>
                  <strong className="text-[#20f5a2] font-semibold">{user?.level || 'Beginner'}</strong>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#6f8799]">Primary Goal</span>
                  <strong className="text-[#d8e6ef]">{user?.goal || 'Career Preparation'}</strong>
                </div>
                {user?.interests && (
                  <div className="py-2.5 flex justify-between">
                    <span className="text-[#6f8799]">Interests</span>
                    <strong className="text-[#d8e6ef] truncate max-w-[140px]">{user.interests}</strong>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 bg-[rgba(1,15,30,0.8)] p-4 rounded-2xl border border-[rgba(0,210,255,0.25)] text-xs">
                <div>
                  <label className="text-[10px] text-[#7892a5] uppercase font-bold block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                    className="w-full h-8 px-2 rounded-lg bg-[#031422] border border-[rgba(0,210,255,0.2)] text-white text-xs focus:outline-none focus:border-[#20f5a2]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#7892a5] uppercase font-bold block mb-1">Course</label>
                    <select
                      value={editFormData.course}
                      onChange={(e) => setEditFormData({ ...editFormData, course: e.target.value })}
                      className="w-full h-8 px-2 rounded-lg bg-[#031422] border border-[rgba(0,210,255,0.2)] text-white text-xs"
                    >
                      <option value="B.Tech">B.Tech</option>
                      <option value="BCA">BCA</option>
                      <option value="B.Sc">B.Sc</option>
                      <option value="BBA">BBA</option>
                      <option value="M.Tech">M.Tech</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#7892a5] uppercase font-bold block mb-1">Branch</label>
                    <input
                      type="text"
                      value={editFormData.branch}
                      onChange={(e) => setEditFormData({ ...editFormData, branch: e.target.value })}
                      className="w-full h-8 px-2 rounded-lg bg-[#031422] border border-[rgba(0,210,255,0.2)] text-white text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#7892a5] uppercase font-bold block mb-1">Year</label>
                    <select
                      value={editFormData.year}
                      onChange={(e) => setEditFormData({ ...editFormData, year: e.target.value })}
                      className="w-full h-8 px-2 rounded-lg bg-[#031422] border border-[rgba(0,210,255,0.2)] text-white text-xs"
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#7892a5] uppercase font-bold block mb-1">Level</label>
                    <select
                      value={editFormData.level}
                      onChange={(e) => setEditFormData({ ...editFormData, level: e.target.value })}
                      className="w-full h-8 px-2 rounded-lg bg-[#031422] border border-[rgba(0,210,255,0.2)] text-white text-xs"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#7892a5] uppercase font-bold block mb-1">Goal</label>
                  <select
                    value={editFormData.goal}
                    onChange={(e) => setEditFormData({ ...editFormData, goal: e.target.value })}
                    className="w-full h-8 px-2 rounded-lg bg-[#031422] border border-[rgba(0,210,255,0.2)] text-white text-xs"
                  >
                    <option value="Placement Preparation">Placement Preparation</option>
                    <option value="Interview Skills">Interview Skills</option>
                    <option value="Group Discussion">Group Discussion</option>
                    <option value="General Fluency">General Fluency</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#7892a5] uppercase font-bold block mb-1">Interests</label>
                  <input
                    type="text"
                    value={editFormData.interests}
                    onChange={(e) => setEditFormData({ ...editFormData, interests: e.target.value })}
                    className="w-full h-8 px-2 rounded-lg bg-[#031422] border border-[rgba(0,210,255,0.2)] text-white text-xs"
                  />
                </div>

                {profileErrorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] animate-in fade-in">
                    {profileErrorMsg}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="flex-1 py-2 rounded-xl bg-[#20f5a2] text-[#00131c] font-bold text-xs hover:shadow-[0_0_15px_rgba(32,245,162,0.4)] disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingProfile ? 'Saving...' : profileSaveSuccess ? '✓ Saved!' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    className="px-3 py-2 rounded-xl bg-white/10 text-white text-xs hover:bg-white/20 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 space-y-2">
            {!isEditingProfile && (
              <button
                onClick={() => {
                  setEditFormData({
                    fullName: user?.fullName || '',
                    course: user?.course || 'B.Tech',
                    branch: user?.branch || 'CSE',
                    year: user?.year || '1st Year',
                    level: user?.level || 'Beginner',
                    goal: user?.goal || 'Placement Preparation',
                    interests: user?.interests || 'AI & Engineering',
                  });
                  setIsEditingProfile(true);
                }}
                className="w-full h-10 rounded-xl border border-[rgba(0,210,255,0.3)] bg-transparent text-[#b7cad8] text-xs font-bold hover:text-[#20f5a2] hover:border-[#20f5a2] hover:bg-[rgba(32,245,162,0.06)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}

            <button
              onClick={() => {
                setDeletePassword('');
                setDeleteError('');
                setIsDeleteModalOpen(true);
              }}
              className="w-full text-center text-[11px] text-[#718b9e] hover:text-rose-400 py-1 cursor-pointer transition-colors"
            >
              Account Security &amp; Settings →
            </button>
          </div>
        </div>
      </section>

      {/* Online Students Section */}
      <section className="p-7 rounded-3xl border border-[rgba(0,190,255,0.2)] bg-gradient-to-br from-[rgba(8,48,70,0.45)] to-[rgba(2,15,30,0.8)] backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
              COMMUNITY DIRECTORY
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Students Online Now</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20f5a2] animate-pulse" />
            <span className="text-xs text-[#20f5a2] font-semibold">
              {onlineStudents.length} Connected
            </span>
          </div>
        </div>

        {onlineStudents.filter((s) => s.name !== user?.fullName).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {onlineStudents
              .filter((s) => s.name !== user?.fullName)
              .map((student, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-[rgba(0,210,255,0.2)] bg-[rgba(1,15,30,0.55)] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#20f5a2] to-[#00aaff] flex items-center justify-center font-bold text-xs text-[#00131c]">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{student.name}</div>
                      <div className="text-[10px] text-[#71899b]">
                        {student.level} · {student.goal}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onOpenChat && (
                      <button
                        onClick={onOpenChat}
                        title={`Message ${student.name} in Community Chat`}
                        className="p-1.5 rounded-lg border border-[rgba(0,210,255,0.25)] text-[#8ea4b8] hover:text-[#20f5a2] hover:border-[#20f5a2] hover:bg-[rgba(32,245,162,0.1)] transition-all cursor-pointer"
                      >
                        💬
                      </button>
                    )}
                    <button
                      onClick={() => onNavigate('practice', 'General Communication')}
                      className="px-2.5 py-1 text-[11px] rounded-lg border border-[rgba(0,210,255,0.3)] text-[#20f5a2] hover:bg-[rgba(32,245,162,0.1)] transition-all cursor-pointer font-semibold"
                    >
                      Match
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl border border-dashed border-[rgba(0,190,255,0.2)] bg-[rgba(0,20,35,0.35)] space-y-3">
            <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl text-[#20f5a2] border border-[rgba(32,245,162,0.25)] bg-[rgba(32,245,162,0.05)]">
              ◌
            </div>
            <h3 className="text-sm font-bold text-white">No other practice partners in queue</h3>
            <p className="text-xs text-[#71899b] max-w-md mx-auto">
              You are ready! Click Find Practice Partner to initiate the student matchmaking queue or create a public room.
            </p>
            <button
              onClick={() => onNavigate('practice', 'General Communication')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00aaff] shadow-[0_6px_20px_rgba(0,190,255,0.2)] hover:translate-y-[-1px] transition-all cursor-pointer"
            >
              <span>Find Practice Partner</span>
              <span>→</span>
            </button>
          </div>
        )}
      </section>

      {/* Daily Practice Challenge with Voice Waves */}
      <section className="p-8 rounded-3xl border border-[rgba(32,245,162,0.2)] bg-[radial-gradient(circle_at_75%_50%,rgba(0,190,255,0.12),transparent_40%),linear-gradient(135deg,rgba(8,55,65,0.55),rgba(2,15,30,0.9))] flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-3 max-w-xl">
          <p className="text-[11px] font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
            TODAY&apos;S PRACTICE
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
            Your voice becomes stronger every time you use it.
          </h2>
          <p className="text-xs sm:text-sm text-[#8199aa] leading-relaxed">
            Spend just 5 minutes speaking with another student today. Consistent peer practice is the proven key to building interview presence.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('practice', 'General Communication')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[rgba(32,245,162,0.5)] bg-[rgba(32,245,162,0.08)] text-[#20f5a2] text-xs font-bold hover:bg-[rgba(32,245,162,0.16)] hover:shadow-[0_0_25px_rgba(32,245,162,0.15)] hover:translate-y-[-1px] transition-all cursor-pointer"
            >
              <span>Start a Session</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Animated Voice Circle with 5 Sound Waves */}
        <div className="w-36 h-36 rounded-full border border-[rgba(32,245,162,0.3)] bg-[radial-gradient(circle,rgba(32,245,162,0.13),rgba(0,150,255,0.06)_55%,transparent_70%)] shadow-[0_0_40px_rgba(0,200,255,0.12),inset_0_0_30px_rgba(32,245,162,0.08)] flex items-center justify-center gap-1.5 shrink-0">
          <div className="w-1 h-6 rounded-full bg-gradient-to-t from-[#20f5a2] to-[#00bfff] animate-voice-wave" />
          <div className="w-1 h-11 rounded-full bg-gradient-to-t from-[#20f5a2] to-[#00bfff] animate-voice-wave [animation-delay:0.2s]" />
          <div className="w-1 h-16 rounded-full bg-gradient-to-t from-[#20f5a2] to-[#00bfff] animate-voice-wave [animation-delay:0.35s]" />
          <div className="w-1 h-11 rounded-full bg-gradient-to-t from-[#20f5a2] to-[#00bfff] animate-voice-wave [animation-delay:0.2s]" />
          <div className="w-1 h-6 rounded-full bg-gradient-to-t from-[#20f5a2] to-[#00bfff] animate-voice-wave [animation-delay:0.1s]" />
        </div>
      </section>

      {/* Account Settings & Deletion Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-rose-500/40 bg-gradient-to-br from-[rgba(30,10,20,0.95)] to-[rgba(2,15,30,0.98)] p-6 sm:p-8 shadow-2xl backdrop-blur-2xl text-white">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-[#7892a5] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>DANGER ZONE: ACCOUNT DELETION</span>
              </div>
              <h3 className="text-xl font-bold text-white">Delete SpeakMate Account</h3>
              <p className="text-xs text-[#a0a8b0] leading-relaxed">
                This will permanently delete your authentication record and all associated private profile data from Cloud Firestore. This action cannot be reversed.
              </p>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            {deleteSuccess ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#20f5a2]/20 border border-[#20f5a2] text-[#20f5a2] flex items-center justify-center font-bold text-xl mx-auto shadow-[0_0_15px_rgba(32,245,162,0.4)]">
                  ✓
                </div>
                <h4 className="text-base font-bold text-white">Account Successfully Deleted</h4>
                <p className="text-xs text-[#8da5b6]">Your authentication records and data have been cleared. Redirecting...</p>
              </div>
            ) : (
              <form onSubmit={handleDeleteAccountSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#dceaf4] mb-2">
                    Confirm Password to Authorize Deletion
                  </label>
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full h-11 px-4 rounded-xl bg-[rgba(1,15,30,0.85)] border border-rose-500/30 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs text-[#8fa9bb] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeletingAccount}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isDeletingAccount ? 'Deleting...' : 'Delete My Account'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
