import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Award,
  TrendingUp,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Star,
  MessageSquare,
  ThumbsUp,
  Heart,
  Quote,
  Tag,
  KeyRound,
  Sun,
  Crown,
  Rocket,
  Globe,
  ShieldCheck,
  Target,
  Lock,
  Check,
  Share2,
  Flame,
  Zap,
  X,
  ChevronRight,
} from 'lucide-react';
import { PeerFeedback } from '../types';

interface ProgressPageProps {
  onNavigate: (tab: string) => void;
}

interface BadgeItem {
  id: string;
  title: string;
  category: 'Consistency' | 'Skill' | 'Leadership' | 'Milestone';
  icon: React.ElementType;
  iconBg: string;
  textColor: string;
  glowColor: string;
  description: string;
  requirement: string;
  progress: number;
  maxProgress: number;
  unit: string;
  unlocked: boolean;
  unlockedDate?: string;
  xpReward: number;
  perk: string;
}

export const ProgressPage: React.FC<ProgressPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { peerFeedbacks } = useSocket();
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'received' | 'given'>('all');
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'in_progress' | 'Consistency' | 'Skill' | 'Leadership'>('all');
  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null);
  const [copiedBadgeToast, setCopiedBadgeToast] = useState(false);

  // Filter feedback
  const currentUserName = (user?.fullName || '').toLowerCase().trim();
  const filteredFeedbacks = peerFeedbacks.filter((fb) => {
    if (feedbackFilter === 'received') {
      return (
        fb.toStudent.toLowerCase() === currentUserName ||
        fb.toStudent.toLowerCase().includes(currentUserName.split(' ')[0]) ||
        fb.toStudent === 'You' ||
        fb.toStudent === 'Student'
      );
    }
    if (feedbackFilter === 'given') {
      return (
        fb.fromStudent.toLowerCase() === currentUserName ||
        fb.fromStudent.toLowerCase().includes(currentUserName.split(' ')[0])
      );
    }
    return true;
  });

  const givenFeedbacksCount = peerFeedbacks.filter(
    (fb) => fb.fromStudent.toLowerCase() === currentUserName || fb.fromStudent.toLowerCase().includes(currentUserName.split(' ')[0])
  ).length;

  // Calculate dynamic stats
  const totalReviews = peerFeedbacks.length;
  const avgOverall = totalReviews > 0
    ? (peerFeedbacks.reduce((acc, f) => acc + (f.ratings?.overall || 4.5), 0) / totalReviews).toFixed(1)
    : '4.8';

  const avgClarity = totalReviews > 0
    ? Math.round((peerFeedbacks.reduce((acc, f) => acc + (f.ratings?.clarity || 4.5), 0) / totalReviews) * 20)
    : 88;

  const avgConfidence = totalReviews > 0
    ? Math.round((peerFeedbacks.reduce((acc, f) => acc + (f.ratings?.confidence || 4.2), 0) / totalReviews) * 20)
    : 82;

  const avgListening = totalReviews > 0
    ? Math.round((peerFeedbacks.reduce((acc, f) => acc + (f.ratings?.listening || 4.6), 0) / totalReviews) * 20)
    : 92;

  const avgStructure = totalReviews > 0
    ? Math.round((peerFeedbacks.reduce((acc, f) => acc + (f.ratings?.structure || 4.1), 0) / totalReviews) * 20)
    : 80;

  const skills = [
    { name: 'Voice Clarity & Articulation', score: avgClarity, color: '#20f5a2' },
    { name: 'Active Listening & Empathy', score: avgListening, color: '#00cfff' },
    { name: 'Confidence & Poise', score: avgConfidence, color: '#38bdf8' },
    { name: 'Answer Structure & STAR Method', score: avgStructure, color: '#2dd4bf' },
    { name: 'Technical & Professional Vocabulary', score: 86, color: '#20f5a2' },
  ];

  // Dynamically evaluated achievement badges
  const streakDays = 4;
  const totalMinutes = 75 + totalReviews * 15;

  const badges: BadgeItem[] = [
    {
      id: 'early-bird',
      title: 'Early Bird',
      category: 'Consistency',
      icon: Sun,
      iconBg: 'from-amber-400 to-orange-500',
      textColor: 'text-amber-300',
      glowColor: 'rgba(251, 191, 36, 0.35)',
      description: 'Completed communication practice during morning hours before 10:00 AM.',
      requirement: 'Complete 1 morning practice session before 10:00 AM',
      progress: 1,
      maxProgress: 1,
      unit: 'Morning Session',
      unlocked: true,
      unlockedDate: 'Unlocked Today, 8:45 AM',
      xpReward: 150,
      perk: '+10% Focus boost & Early Bird morning matchmaking badge',
    },
    {
      id: 'consistency-king',
      title: 'Consistency King',
      category: 'Consistency',
      icon: Crown,
      iconBg: 'from-[#20f5a2] to-emerald-600',
      textColor: 'text-[#20f5a2]',
      glowColor: 'rgba(32, 245, 162, 0.4)',
      description: 'Showed supreme discipline by maintaining a practice streak for 3+ consecutive days.',
      requirement: 'Reach a continuous 3-day practice streak',
      progress: Math.min(streakDays, 3),
      maxProgress: 3,
      unit: 'Streak Days',
      unlocked: streakDays >= 3,
      unlockedDate: 'Unlocked 2 days ago',
      xpReward: 300,
      perk: 'VIP Crown icon displayed on your video tile in practice rooms',
    },
    {
      id: 'confidence-booster',
      title: 'Confidence Booster',
      category: 'Skill',
      icon: Rocket,
      iconBg: 'from-cyan-400 to-blue-600',
      textColor: 'text-[#00cfff]',
      glowColor: 'rgba(0, 207, 255, 0.4)',
      description: 'Elevated speaking poise, eye contact, and projection to reach an 80%+ peer confidence rating.',
      requirement: 'Maintain an 80%+ peer confidence score across room sessions',
      progress: Math.min(avgConfidence, 80),
      maxProgress: 80,
      unit: '% Rating',
      unlocked: avgConfidence >= 80,
      unlockedDate: 'Unlocked Recently',
      xpReward: 250,
      perk: 'Unlocks Senior Mock Interviewer track in Group Discussions',
    },
    {
      id: 'global-communicator',
      title: 'Global Communicator',
      category: 'Milestone',
      icon: Globe,
      iconBg: 'from-violet-400 to-indigo-600',
      textColor: 'text-violet-300',
      glowColor: 'rgba(167, 139, 250, 0.35)',
      description: 'Practiced across multiple tracks and engaged in multilingual or global student sessions.',
      requirement: 'Practice in at least 2 distinct communication modes',
      progress: Math.min(totalReviews >= 1 ? 2 : 1, 2),
      maxProgress: 2,
      unit: 'Tracks Mastered',
      unlocked: true,
      unlockedDate: 'Unlocked Yesterday',
      xpReward: 200,
      perk: 'Special Global Communicator flair in Community Chat',
    },
    {
      id: 'room-pioneer',
      title: 'Room Pioneer',
      category: 'Leadership',
      icon: ShieldCheck,
      iconBg: 'from-emerald-400 to-teal-600',
      textColor: 'text-emerald-300',
      glowColor: 'rgba(52, 211, 153, 0.35)',
      description: 'Created and hosted a secure SpeakMate practice room using a unique Room ID.',
      requirement: 'Create and host 1 practice room session',
      progress: 1,
      maxProgress: 1,
      unit: 'Room Hosted',
      unlocked: true,
      unlockedDate: 'Unlocked Today',
      xpReward: 250,
      perk: 'Host Security controls: Meeting lock & screen share permissions',
    },
    {
      id: 'star-maestro',
      title: 'STAR Method Maestro',
      category: 'Skill',
      icon: Target,
      iconBg: 'from-pink-500 to-rose-600',
      textColor: 'text-pink-300',
      glowColor: 'rgba(244, 114, 182, 0.35)',
      description: 'Structured interview answers crisply using Situation, Task, Action, and Result.',
      requirement: 'Achieve an 80%+ rating on answer structure',
      progress: Math.min(avgStructure, 80),
      maxProgress: 80,
      unit: '% Structure',
      unlocked: avgStructure >= 80,
      unlockedDate: 'Unlocked This Week',
      xpReward: 200,
      perk: 'STAR framework cheat-sheet pinned to your practice HUD',
    },
    {
      id: 'feedback-philanthropist',
      title: 'Feedback Philanthropist',
      category: 'Leadership',
      icon: Heart,
      iconBg: 'from-rose-400 to-red-600',
      textColor: 'text-rose-300',
      glowColor: 'rgba(251, 113, 133, 0.35)',
      description: 'Submitted detailed, constructive peer feedback to help fellow students level up.',
      requirement: 'Give at least 2 constructive reviews to practice peers',
      progress: Math.min(givenFeedbacksCount + 1, 2),
      maxProgress: 2,
      unit: 'Reviews Given',
      unlocked: givenFeedbacksCount >= 1 || totalReviews >= 1,
      unlockedDate: 'Unlocked Today',
      xpReward: 200,
      perk: 'Peer reviews pinned to top of partner feedback feeds',
    },
    {
      id: 'century-club',
      title: 'Century Club',
      category: 'Milestone',
      icon: Clock,
      iconBg: 'from-amber-500 to-yellow-600',
      textColor: 'text-amber-200',
      glowColor: 'rgba(245, 158, 11, 0.35)',
      description: 'Logged 100+ minutes of live peer speaking practice on SpeakMate.',
      requirement: 'Accumulate 100 minutes of active stage speaking time',
      progress: Math.min(totalMinutes, 100),
      maxProgress: 100,
      unit: 'Minutes',
      unlocked: totalMinutes >= 100,
      unlockedDate: totalMinutes >= 100 ? 'Unlocked Today' : undefined,
      xpReward: 500,
      perk: 'Permanent Golden Century ring on user profile badge',
    },
  ];

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const totalXp = badges.filter((b) => b.unlocked).reduce((acc, b) => acc + b.xpReward, 0);

  const filteredBadges = badges.filter((b) => {
    if (badgeFilter === 'unlocked') return b.unlocked;
    if (badgeFilter === 'in_progress') return !b.unlocked;
    if (badgeFilter === 'Consistency' || badgeFilter === 'Skill' || badgeFilter === 'Leadership') {
      return b.category === badgeFilter;
    }
    return true;
  });

  const handleShareBadge = (badge: BadgeItem) => {
    const text = `🏆 I just unlocked the "${badge.title}" badge on SpeakMate! ${badge.description} Level up your communication skills!`;
    navigator.clipboard.writeText(text);
    setCopiedBadgeToast(true);
    setTimeout(() => setCopiedBadgeToast(false), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 relative z-10">
      {/* Header */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#20f5a2] shadow-[0_0_10px_#20f5a2] animate-pulse" />
          <p className="text-xs font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
            COMMUNICATION METRICS & PEER REVIEWS
          </p>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Your Progress &{' '}
          <span className="bg-gradient-to-r from-[#20f5a2] to-[#00cfff] bg-clip-text text-transparent">
            Peer Feedback Log.
          </span>
        </h1>
        <p className="text-sm text-[#9eb6c8] max-w-xl leading-relaxed">
          Review verified ratings, constructive speaking notes from practice partners, and track your communication roadmap.
        </p>
      </section>

      {/* Top Metrics Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Peer Reviews Logged', value: `${totalReviews}`, sub: 'From verified room sessions' },
          { label: 'Overall Rating', value: `${avgOverall} / 5.0`, sub: 'Peer communication impact' },
          { label: 'Practice Streak', value: '4 Days', sub: 'Placement readiness tier 1' },
          { label: 'Voice Clarity', value: `${avgClarity}%`, sub: 'Pronunciation & pacing' },
        ].map((item, idx) => (
          <div
            key={idx}
            className="p-5 rounded-2xl border border-[rgba(0,190,255,0.2)] bg-gradient-to-br from-[rgba(8,48,70,0.55)] to-[rgba(2,15,30,0.85)] backdrop-blur-md"
          >
            <span className="text-[11px] text-[#718b9e] block mb-1">{item.label}</span>
            <strong className="text-2xl font-bold text-white block">{item.value}</strong>
            <span className="text-[10px] text-[#20f5a2] mt-1 block">{item.sub}</span>
          </div>
        ))}
      </section>

      {/* STUDENT BADGES & ACHIEVEMENTS SYSTEM */}
      <section className="p-6 sm:p-8 rounded-3xl border border-[rgba(32,245,162,0.25)] bg-gradient-to-br from-[rgba(10,45,70,0.7)] to-[rgba(2,15,28,0.92)] backdrop-blur-xl shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[rgba(0,210,255,0.14)]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#20f5a2] animate-ping" />
              <span className="text-[11px] font-bold tracking-widest text-[#20f5a2] uppercase flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" />
                STUDENT ACHIEVEMENT & BADGE SYSTEM
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Unlock Communication Badges
            </h2>
            <p className="text-xs text-[#8fa9bb] max-w-xl">
              Earn verified achievements as you complete practice sessions, maintain consistency streaks, and level up speaking confidence.
            </p>
          </div>

          {/* XP & Level Summary Badge */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[rgba(1,15,30,0.75)] border border-[rgba(32,245,162,0.3)] shadow-[0_0_20px_rgba(32,245,162,0.12)] shrink-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#20f5a2] to-[#00cfff] flex items-center justify-center font-extrabold text-[#00131c] text-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <strong className="text-sm font-bold text-white">Tier 2: Pro Speaker</strong>
                <span className="text-[10px] font-mono font-bold text-[#20f5a2] bg-[#20f5a2]/10 px-2 py-0.5 rounded-full border border-[#20f5a2]/20">
                  {totalXp} XP
                </span>
              </div>
              <p className="text-[11px] text-[#718b9e]">
                {unlockedCount} of {badges.length} Badges Unlocked ({Math.round((unlockedCount / badges.length) * 100)}%)
              </p>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-[#718b9e] font-semibold mr-1">Filter Badges:</span>
          {[
            { id: 'all', label: `All (${badges.length})` },
            { id: 'unlocked', label: `Unlocked (${unlockedCount})` },
            { id: 'in_progress', label: `In Progress (${badges.length - unlockedCount})` },
            { id: 'Consistency', label: 'Consistency' },
            { id: 'Skill', label: 'Skill' },
            { id: 'Leadership', label: 'Leadership' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setBadgeFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                badgeFilter === tab.id
                  ? 'bg-gradient-to-r from-[#20f5a2] to-[#00cfff] text-[#00131c] font-bold shadow-[0_0_15px_rgba(32,245,162,0.3)]'
                  : 'bg-[rgba(1,15,30,0.6)] border border-[rgba(0,210,255,0.18)] text-[#8fa9bb] hover:text-white hover:border-[#20f5a2]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Badges Grid (4 columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredBadges.map((badge) => {
            const Icon = badge.icon;
            const pct = Math.min(Math.round((badge.progress / badge.maxProgress) * 100), 100);

            return (
              <div
                key={badge.id}
                onClick={() => setSelectedBadge(badge)}
                className={`group relative p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                  badge.unlocked
                    ? 'border-[rgba(32,245,162,0.35)] bg-gradient-to-b from-[rgba(7,38,60,0.7)] to-[rgba(1,15,30,0.85)] hover:border-[#20f5a2] hover:shadow-[0_0_30px_rgba(32,245,162,0.2)] hover:-translate-y-1'
                    : 'border-[rgba(0,210,255,0.15)] bg-[rgba(1,15,30,0.5)] opacity-85 hover:opacity-100 hover:border-[rgba(0,210,255,0.35)]'
                }`}
              >
                {/* Header: Icon & Category */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${badge.iconBg} flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-105`}
                      style={{
                        boxShadow: badge.unlocked ? `0 0 20px ${badge.glowColor}` : 'none',
                      }}
                    >
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-[#00cfff] bg-[rgba(0,207,255,0.1)] px-2 py-0.5 rounded border border-[rgba(0,207,255,0.2)]">
                        +{badge.xpReward} XP
                      </span>
                      {badge.unlocked ? (
                        <div className="w-6 h-6 rounded-full bg-[#20f5a2]/20 border border-[#20f5a2] flex items-center justify-center text-[#20f5a2]">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#6e889b]">
                          <Lock className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <strong className="block text-sm text-white font-bold group-hover:text-[#20f5a2] transition-colors">
                      {badge.title}
                    </strong>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#6e889b]">
                      {badge.category}
                    </span>
                    <p className="text-[11px] text-[#8fa9bb] leading-relaxed mt-1 line-clamp-2">
                      {badge.description}
                    </p>
                  </div>
                </div>

                {/* Progress bar & status footer */}
                <div className="pt-4 space-y-2 border-t border-white/5 mt-3">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className={badge.unlocked ? 'text-[#20f5a2] font-semibold' : 'text-[#718b9e]'}>
                      {badge.unlocked ? 'Achievement Unlocked' : 'Progress'}
                    </span>
                    <span className="font-mono text-white font-bold">
                      {badge.progress} / {badge.maxProgress} {badge.unit}
                    </span>
                  </div>

                  <div className="h-1.5 rounded-full bg-[rgba(0,20,35,0.8)] overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: badge.unlocked
                          ? 'linear-gradient(90deg, #20f5a2, #00cfff)'
                          : 'linear-gradient(90deg, #38bdf8, #818cf8)',
                      }}
                    />
                  </div>

                  {badge.unlocked && badge.unlockedDate && (
                    <span className="block text-[9px] text-[#20f5a2]/80 text-right">
                      {badge.unlockedDate}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Grid: Skill Rubric & Improvement Roadmap */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Core Dimensions (7 cols) */}
        <div className="lg:col-span-7 p-6 sm:p-7 rounded-3xl border border-[rgba(0,190,255,0.2)] bg-[rgba(10,50,75,0.6)] backdrop-blur-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold tracking-widest text-[#20f5a2] uppercase">
                PEER-EVALUATED RUBRIC
              </span>
              <h2 className="text-xl font-bold text-white mt-1">Communication Dimensions</h2>
              <p className="text-xs text-[#8fa9bb]">
                Aggregated from peer ratings submitted across your room sessions.
              </p>
            </div>
            <div className="p-2.5 rounded-2xl bg-[rgba(3,25,42,0.8)] border border-[rgba(0,210,255,0.2)] text-right">
              <span className="text-[10px] text-[#718b9e] block">Composite Score</span>
              <strong className="text-base text-[#20f5a2] font-mono">{avgOverall} ★</strong>
            </div>
          </div>

          <div className="space-y-4">
            {skills.map((s, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#d8e6ef] font-medium">{s.name}</span>
                  <span className="font-bold font-mono text-[#20f5a2]">{s.score}%</span>
                </div>
                <div className="h-2 rounded-full bg-[rgba(1,15,30,0.8)] overflow-hidden border border-[rgba(0,210,255,0.15)]">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${s.score}%`,
                      background: `linear-gradient(90deg, #20f5a2, #00cfff)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Improvement Roadmap (5 cols) */}
        <div className="lg:col-span-5 p-6 sm:p-7 rounded-3xl border border-[rgba(0,190,255,0.2)] bg-[rgba(10,50,75,0.6)] backdrop-blur-xl space-y-5">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#20f5a2] uppercase">
              PERSONALIZED ROADMAP
            </span>
            <h2 className="text-xl font-bold text-white mt-1">Placement Milestones</h2>
            <p className="text-xs text-[#8fa9bb]">Targeted for: {user?.goal || 'Campus Placements'}</p>
          </div>

          <div className="space-y-3.5 text-xs">
            {[
              {
                title: 'Deliver a 90-sec Elevator Pitch',
                desc: 'Highlight academic achievements, key skills, and passion project with zero filler words.',
                status: 'Complete',
              },
              {
                title: 'Peer Group Discussion Turn-Taking',
                desc: 'Practice politely building on a partner’s point without aggressive interruption.',
                status: 'In Progress',
              },
              {
                title: 'Technical STAR Method Practice',
                desc: 'Explain Situation, Task, Action, and Result for a challenging project roadblock.',
                status: 'Next Up',
              },
            ].map((milestone, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-[rgba(1,15,30,0.65)] border border-[rgba(0,190,255,0.15)] space-y-1"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-white text-xs">{milestone.title}</strong>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      milestone.status === 'Complete'
                        ? 'bg-[#20f5a2]/10 text-[#20f5a2] border border-[#20f5a2]/30'
                        : milestone.status === 'In Progress'
                        ? 'bg-sky-400/10 text-sky-400 border border-sky-400/30'
                        : 'bg-white/5 text-[#728b9e]'
                    }`}
                  >
                    {milestone.status}
                  </span>
                </div>
                <p className="text-[11px] text-[#7892a5] leading-relaxed">{milestone.desc}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => onNavigate('rooms')}
            className="w-full py-3.5 rounded-xl font-bold text-xs text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00aaff] shadow-[0_6px_20px_rgba(0,190,255,0.25)] hover:shadow-[0_10px_30px_rgba(32,245,162,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <span>Start Practice Room</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Dedicated Post-Room Peer Feedback & Constructive Notes Section */}
      <section className="p-6 sm:p-8 rounded-3xl border border-[rgba(0,190,255,0.2)] bg-[rgba(8,48,70,0.45)] backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgba(0,190,255,0.12)]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#20f5a2] uppercase tracking-wider mb-1">
              <Award className="w-4 h-4" />
              <span>POST-SESSION PEER FEEDBACK SYSTEM</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Constructive Notes & Peer Ratings
            </h2>
            <p className="text-xs text-[#8fa9bb] mt-0.5">
              Verified communication feedback submitted by fellow students after each practice session.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 p-1 rounded-xl bg-[rgba(1,15,30,0.7)] border border-[rgba(0,210,255,0.18)]">
            {(['all', 'received', 'given'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setFeedbackFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  feedbackFilter === filter
                    ? 'bg-[#20f5a2] text-[#00131c]'
                    : 'text-[#8fa9bb] hover:text-white'
                }`}
              >
                {filter === 'all' ? 'All Reviews' : filter === 'received' ? 'Received' : 'Given by You'}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback Cards List */}
        {filteredFeedbacks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFeedbacks.map((fb) => (
              <div
                key={fb.id}
                className="p-5 rounded-2xl border border-[rgba(0,210,255,0.18)] bg-gradient-to-br from-[rgba(3,25,42,0.7)] to-[rgba(1,15,30,0.85)] space-y-4 hover:border-[#20f5a2]/50 transition-all"
              >
                {/* Header: Reviewer & Session details */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#20f5a2] to-[#00aaff] flex items-center justify-center font-bold text-sm text-[#00131c] shrink-0">
                      {fb.fromInitial || fb.fromStudent.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong className="text-sm text-white block">
                        {fb.fromStudent}{' '}
                        <span className="text-[11px] font-normal text-[#718b9e]">
                          → {fb.toStudent}
                        </span>
                      </strong>
                      <div className="flex items-center gap-2 text-[10px] text-[#7896aa]">
                        <span>{fb.practiceMode}</span>
                        <span>·</span>
                        <span className="font-mono text-[#00cfff]">{fb.durationFormatted}</span>
                        {fb.roomId && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-[#6e889b]">Room: {fb.roomId}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Overall Star Badge */}
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#20f5a2]/10 border border-[#20f5a2]/30 text-[#20f5a2] font-mono text-xs font-bold shrink-0">
                    <Star className="w-3.5 h-3.5 fill-[#20f5a2]" />
                    <span>{fb.ratings?.overall || 5}/5</span>
                  </div>
                </div>

                {/* Dimension Breakdown Bar */}
                <div className="grid grid-cols-4 gap-2 text-center p-2.5 rounded-xl bg-[rgba(1,15,30,0.6)] border border-[rgba(0,210,255,0.08)]">
                  <div>
                    <span className="text-[9px] uppercase text-[#6e889b] block">Clarity</span>
                    <strong className="text-xs text-[#20f5a2] font-mono">{fb.ratings?.clarity || 5}★</strong>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-[#6e889b] block">Confidence</span>
                    <strong className="text-xs text-[#20f5a2] font-mono">{fb.ratings?.confidence || 4}★</strong>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-[#6e889b] block">Listening</span>
                    <strong className="text-xs text-[#20f5a2] font-mono">{fb.ratings?.listening || 5}★</strong>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-[#6e889b] block">Structure</span>
                    <strong className="text-xs text-[#20f5a2] font-mono">{fb.ratings?.structure || 4}★</strong>
                  </div>
                </div>

                {/* Constructive Notes Quote Box */}
                <div className="p-3.5 rounded-xl bg-[rgba(0,210,255,0.04)] border border-[rgba(0,210,255,0.12)] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-[#00cfff] tracking-wider block flex items-center gap-1.5">
                    <Quote className="w-3 h-3 text-[#20f5a2]" />
                    <span>Peer Constructive Notes</span>
                  </span>
                  <p className="text-xs text-[#d5e4ee] leading-relaxed italic">
                    &quot;{fb.constructiveNotes}&quot;
                  </p>
                  {fb.encouragement && (
                    <p className="text-[11px] text-[#20f5a2] flex items-center gap-1.5 mt-1">
                      <Heart className="w-3 h-3 fill-[#20f5a2]" />
                      <span>{fb.encouragement}</span>
                    </p>
                  )}
                </div>

                {/* Skill Badges / Tags */}
                {fb.tags && fb.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {fb.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] px-2.5 py-0.5 rounded-full bg-[rgba(32,245,162,0.08)] border border-[rgba(32,245,162,0.2)] text-[#20f5a2] font-medium"
                      >
                        ✓ {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Timestamp */}
                <div className="text-[10px] text-[#5e7788] text-right">
                  Logged: {fb.createdAt || 'Recent Session'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center rounded-2xl border border-dashed border-[rgba(0,210,255,0.2)] bg-[rgba(1,15,30,0.4)] space-y-3">
            <p className="text-sm text-[#8fa9bb]">
              No peer feedback records found under this filter yet.
            </p>
            <button
              onClick={() => onNavigate('rooms')}
              className="text-xs text-[#20f5a2] font-bold hover:underline inline-flex items-center gap-1"
            >
              <span>Join a room to complete a session & receive peer feedback →</span>
            </button>
          </div>
        )}
      </section>

      {/* Selected Badge Detailed Inspect Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-[rgba(32,245,162,0.4)] bg-gradient-to-b from-[#072439] to-[#010e19] p-6 sm:p-8 text-white shadow-2xl space-y-6 relative">
            <button
              onClick={() => setSelectedBadge(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-[#7896a9] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Top Badge Presentation */}
            <div className="flex flex-col items-center text-center space-y-3 pt-2">
              <div
                className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${selectedBadge.iconBg} flex items-center justify-center text-white shadow-2xl relative`}
                style={{
                  boxShadow: `0 0 35px ${selectedBadge.glowColor}`,
                }}
              >
                {React.createElement(selectedBadge.icon, { className: 'w-10 h-10' })}
                {selectedBadge.unlocked && (
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#20f5a2] text-[#00131c] flex items-center justify-center font-bold text-xs shadow-md">
                    ✓
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold tracking-widest text-[#20f5a2] uppercase block">
                  {selectedBadge.category} ACHIEVEMENT
                </span>
                <h3 className="text-2xl font-extrabold text-white mt-0.5">
                  {selectedBadge.title}
                </h3>
                <p className="text-xs text-[#8fa9bb] max-w-sm mt-1">
                  {selectedBadge.description}
                </p>
              </div>
            </div>

            {/* Requirement & Criteria Card */}
            <div className="p-4 rounded-2xl bg-[rgba(1,15,30,0.7)] border border-[rgba(0,210,255,0.18)] space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#8fa9bb] font-semibold">Unlock Requirement:</span>
                <span className="font-mono text-[#20f5a2] font-bold">+{selectedBadge.xpReward} XP</span>
              </div>
              <p className="text-white font-medium bg-white/5 p-2.5 rounded-xl border border-white/5">
                {selectedBadge.requirement}
              </p>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#718b9e]">Your Progress:</span>
                  <strong className="text-white font-mono">
                    {selectedBadge.progress} / {selectedBadge.maxProgress} {selectedBadge.unit}
                  </strong>
                </div>
                <div className="h-2 rounded-full bg-black/50 overflow-hidden border border-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(Math.round((selectedBadge.progress / selectedBadge.maxProgress) * 100), 100)}%`,
                      background: selectedBadge.unlocked
                        ? 'linear-gradient(90deg, #20f5a2, #00cfff)'
                        : 'linear-gradient(90deg, #38bdf8, #818cf8)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Perks / Reward details */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-[rgba(32,245,162,0.08)] to-transparent border border-[rgba(32,245,162,0.2)] flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#20f5a2] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-xs text-white">Student Perk & Recognition:</strong>
                <span className="text-[11px] text-[#20f5a2] leading-relaxed block mt-0.5">
                  {selectedBadge.perk}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleShareBadge(selectedBadge)}
                className="flex-1 py-3 rounded-xl border border-[rgba(0,210,255,0.25)] bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-[#00cfff]" />
                <span>{copiedBadgeToast ? 'Copied to Clipboard!' : 'Share Achievement'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedBadge(null);
                  onNavigate('rooms');
                }}
                className="flex-1 py-3 rounded-xl font-bold text-xs text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00cfff] shadow-[0_8px_25px_rgba(0,190,255,0.25)] hover:shadow-[0_12px_35px_rgba(32,245,162,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Practice in Rooms</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
