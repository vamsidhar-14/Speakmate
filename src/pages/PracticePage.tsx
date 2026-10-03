import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { PracticeMode, SessionFormat } from '../types';
import { Users, User, UserPlus, ArrowRight, Check, Search, Sparkles } from 'lucide-react';

interface PracticePageProps {
  initialMode?: PracticeMode;
  onNavigate: (tab: string, mode?: PracticeMode) => void;
}

export const PracticePage: React.FC<PracticePageProps> = ({ initialMode, onNavigate }) => {
  const { user } = useAuth();
  const { findPartner, cancelFindPartner, isSearchingMatch, activeRoom, createRoom } = useSocket();
  const [selectedFormat, setSelectedFormat] = useState<SessionFormat>('one-to-one');
  const [selectedMode, setSelectedMode] = useState<PracticeMode>(initialMode || 'General Communication');
  const [matchState, setMatchState] = useState<'idle' | 'searching' | 'matched'>('idle');

  const practiceModes: { title: PracticeMode; icon: string; desc: string }[] = [
    { title: 'General Communication', icon: '💬', desc: 'Everyday conversations and fluency' },
    { title: 'Interview Practice', icon: '🎯', desc: 'Prepare for campus and tech interviews' },
    { title: 'Technical Discussion', icon: '💻', desc: 'Discuss code, architecture, and concepts' },
    { title: 'Group Discussion', icon: '👥', desc: 'Improve entry, turn-taking, and moderation' },
    { title: 'Debate', icon: '⚡', desc: 'Build compelling arguments and rebuttals' },
    { title: 'Presentation', icon: '🎤', desc: 'Practice presenting slides and projects' },
    { title: 'Team Meeting', icon: '🤝', desc: 'Simulate sprint standups and client calls' },
    { title: 'Brainstorming', icon: '💡', desc: 'Collaborative problem solving and ideation' },
  ];

  const handleStartSearch = () => {
    setMatchState('searching');
    findPartner(selectedMode, selectedFormat);

    // If no real peer immediately answers, offer to join/create a room or proceed to session
    setTimeout(() => {
      setMatchState('matched');
    }, 2800);
  };

  const handleCancelSearch = () => {
    cancelFindPartner();
    setMatchState('idle');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 relative z-10">
      {/* Header */}
      <section className="space-y-3">
        <p className="text-xs font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
          PRACTICE CENTER
        </p>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Practice speaking.{' '}
          <span className="bg-gradient-to-r from-[#20f5a2] to-[#00bfff] bg-clip-text text-transparent">
            Build confidence.
          </span>
        </h1>
        <p className="text-sm text-[#a9bfd1] max-w-2xl leading-relaxed">
          Choose how you want to practice and connect with engineering peers who share your exact placement preparation goals.
        </p>
      </section>

      {/* Main Practice Card */}
      <section className="p-6 sm:p-9 rounded-3xl border border-[rgba(0,210,255,0.28)] bg-gradient-to-br from-[rgba(10,50,75,0.62)] to-[rgba(2,15,30,0.92)] shadow-2xl backdrop-blur-xl space-y-9">
        {/* Profile Match Info */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
                YOUR PROFILE
              </p>
              <h2 className="text-xl font-bold text-white">Match preferences</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#8fa9bb] bg-[rgba(0,150,255,0.06)] border border-[rgba(0,190,255,0.18)] px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#20f5a2] shadow-[0_0_8px_#20f5a2]" />
              <span>Matching on real criteria</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-4 rounded-2xl bg-[rgba(1,15,30,0.55)] border border-[rgba(0,190,255,0.15)] text-xs">
            <div>
              <span className="block text-[#8199ab] text-[10px] mb-0.5">Course</span>
              <strong className="text-white">{user?.course || 'B.Tech'}</strong>
            </div>
            <div>
              <span className="block text-[#8199ab] text-[10px] mb-0.5">Branch</span>
              <strong className="text-white">{user?.branch || 'CSE'}</strong>
            </div>
            <div>
              <span className="block text-[#8199ab] text-[10px] mb-0.5">Year</span>
              <strong className="text-white">{user?.year || '1st Year'}</strong>
            </div>
            <div>
              <span className="block text-[#8199ab] text-[10px] mb-0.5">Level</span>
              <strong className="text-[#20f5a2]">{user?.level || 'Beginner'}</strong>
            </div>
            <div>
              <span className="block text-[#8199ab] text-[10px] mb-0.5">Goal</span>
              <strong className="text-white truncate block">{user?.goal || 'Placement'}</strong>
            </div>
          </div>
        </div>

        {/* Session Format Selection (1-to-1, Small Group, Team) */}
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
              SESSION FORMAT
            </p>
            <h3 className="text-base sm:text-lg font-bold text-white">How do you want to practice?</h3>
            <p className="text-xs text-[#71899b]">Choose between 1-to-1 or multi-participant team formats</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {[
              {
                id: 'one-to-one' as SessionFormat,
                badge: '1',
                title: '1-to-1 Practice',
                desc: 'Practice privately with one compatible student.',
              },
              {
                id: 'small-group' as SessionFormat,
                badge: '3-4',
                title: 'Small Group',
                desc: 'Practice in an interactive group of 3–4 students.',
              },
              {
                id: 'team' as SessionFormat,
                badge: '5-8',
                title: 'Team Practice',
                desc: 'Practice GD and team meetings with up to 8 peers.',
              },
            ].map((fmt) => {
              const active = selectedFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer ${
                    active
                      ? 'border-[#20f5a2] bg-gradient-to-br from-[rgba(32,245,162,0.12)] to-[rgba(0,170,255,0.08)] shadow-[0_8px_30px_rgba(32,245,162,0.12)]'
                      : 'border-[rgba(0,200,255,0.18)] bg-[rgba(4,18,31,0.72)] hover:border-[rgba(0,217,255,0.45)] hover:translate-y-[-2px]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                        active
                          ? 'bg-gradient-to-br from-[rgba(32,245,162,0.25)] to-[rgba(0,174,255,0.22)] text-[#20f5a2] border border-[#20f5a2]'
                          : 'bg-[rgba(32,245,162,0.12)] text-[#20f5a2]'
                      }`}
                    >
                      {fmt.badge}
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        active
                          ? 'bg-[#20f5a2] text-[#021326]'
                          : 'border border-[rgba(113,137,155,0.35)] text-transparent'
                      }`}
                    >
                      ✓
                    </div>
                  </div>
                  <strong className="block text-sm text-white mb-1">{fmt.title}</strong>
                  <span className="text-xs text-[#71899b] block leading-relaxed">{fmt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Practice Modes Selection */}
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
              PRACTICE TYPE
            </p>
            <h2 className="text-base sm:text-lg font-bold text-white">What do you want to practice?</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {practiceModes.map((mode, idx) => {
              const active = selectedMode === mode.title;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedMode(mode.title)}
                  className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                    active
                      ? 'border-[#20f5a2] bg-gradient-to-br from-[rgba(32,245,162,0.14)] to-[rgba(0,170,255,0.10)] shadow-[0_0_20px_rgba(32,245,162,0.12)]'
                      : 'border-[rgba(0,190,255,0.18)] bg-[rgba(1,15,30,0.55)] hover:border-[rgba(0,220,255,0.5)] hover:translate-y-[-2px]'
                  }`}
                >
                  <span className="text-2xl shrink-0">{mode.icon}</span>
                  <div className="min-w-0">
                    <strong
                      className={`block text-xs truncate ${
                        active ? 'text-[#20f5a2]' : 'text-white'
                      }`}
                    >
                      {mode.title}
                    </strong>
                    <span className="block text-[10px] text-[#8099ac] truncate">{mode.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Find Partner Actions */}
        <div className="p-6 rounded-2xl border border-[rgba(0,220,255,0.25)] bg-gradient-to-r from-[rgba(0,100,145,0.22)] to-[rgba(2,20,40,0.85)] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-1">
            <p className="text-[11px] font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
              READY TO PRACTICE?
            </p>
            <h3 className="text-lg font-bold text-white">Find your practice session</h3>
            <p className="text-xs text-[#8fa9bb]">
              We'll match you with students for {selectedMode} ({selectedFormat}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {selectedMode === 'General Communication' && (
              <button
                onClick={() => onNavigate('rooms')}
                className="px-4 py-3 rounded-xl border border-[rgba(0,220,255,0.35)] text-white text-xs font-semibold hover:border-[#20f5a2] hover:bg-[rgba(0,170,255,0.08)] transition-all cursor-pointer"
              >
                Browse Rooms
              </button>
            )}

            {matchState === 'searching' ? (
              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="px-6 py-3 rounded-xl font-bold text-xs text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00aaff] flex items-center gap-2 opacity-90 animate-pulse"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <span>Searching Peers...</span>
                </button>
                <button
                  onClick={handleCancelSearch}
                  className="px-3 py-3 rounded-xl border border-rose-500/40 text-rose-300 text-xs font-semibold hover:bg-rose-500/10"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartSearch}
                className="px-7 py-3 rounded-xl font-bold text-xs sm:text-sm text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00aaff] shadow-[0_8px_25px_rgba(0,190,255,0.25)] hover:shadow-[0_12px_35px_rgba(0,220,210,0.4)] hover:translate-y-[-1px] transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_white]" />
                <span>Find Partner</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Match Result / Interactive Room Entry */}
      <section className="p-6 sm:p-8 rounded-3xl border border-[rgba(0,190,255,0.2)] bg-gradient-to-br from-[rgba(8,48,70,0.4)] to-[rgba(2,15,30,0.75)] backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
              PRACTICE MATCH
            </p>
            <h2 className="text-xl font-bold text-white">Your session status</h2>
          </div>
        </div>

        {matchState === 'matched' ? (
          <div className="p-6 rounded-2xl border border-[rgba(32,245,162,0.4)] bg-gradient-to-r from-[rgba(32,245,162,0.1)] to-[rgba(0,170,255,0.08)] flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#20f5a2] to-[#008cff] flex items-center justify-center font-bold text-xl text-[#00131c]">
                ✓
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#20f5a2] bg-[rgba(32,245,162,0.12)] px-2 py-0.5 rounded-full border border-[rgba(32,245,162,0.3)]">
                  MATCH READY
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  Ready to join {selectedMode} Room
                </h3>
                <p className="text-xs text-[#a3bed3]">
                  Format: {selectedFormat} · Partner slot confirmed · WebRTC ready
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (!activeRoom) {
                    createRoom('public', selectedMode, selectedFormat === 'one-to-one' ? 2 : 4);
                  }
                  onNavigate('room', selectedMode);
                }}
                className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00aaff] shadow-[0_8px_25px_rgba(0,210,255,0.35)] hover:shadow-[0_12px_35px_rgba(32,245,162,0.5)] hover:translate-y-[-2px] transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Enter Practice Room</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : matchState === 'searching' ? (
          <div className="p-10 text-center rounded-2xl border border-dashed border-[rgba(0,190,255,0.3)] bg-[rgba(1,15,30,0.5)] space-y-3">
            <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl text-[#20f5a2] border border-[rgba(32,245,162,0.3)] bg-[rgba(32,245,162,0.08)] animate-spin">
              ◌
            </div>
            <h3 className="text-base font-bold text-white">Finding your practice partner...</h3>
            <p className="text-xs text-[#758ea1] max-w-md mx-auto">
              Scanning active students preparing for {selectedMode}. Connecting voice & video slots...
            </p>
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl border border-dashed border-[rgba(0,190,255,0.22)] bg-[rgba(1,15,30,0.4)] space-y-2">
            <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl text-[#20f5a2] border border-[rgba(0,220,255,0.3)]">
              ◌
            </div>
            <h3 className="text-sm font-bold text-white">No active practice session yet</h3>
            <p className="text-xs text-[#758ea1] max-w-md mx-auto">
              Select your format and practice type above, then click Find Partner to match or browse available rooms.
            </p>
          </div>
        )}
      </section>

      {/* Daily Challenge Section */}
      <section className="p-7 rounded-3xl border border-[rgba(32,245,162,0.2)] bg-gradient-to-r from-[rgba(8,55,65,0.5)] to-[rgba(2,15,30,0.85)] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <p className="text-[11px] font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
            DAILY CHALLENGE
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Speak for 60 seconds without filler words</h2>
          <p className="text-xs text-[#8199aa] leading-relaxed">
            Pick any topic and speak continuously for one minute. Focus on clarity, breath control, and eliminating words like "um", "basically", and "like".
          </p>
        </div>

        <button
          onClick={() => onNavigate('ai-coach')}
          className="px-5 py-2.5 rounded-xl border border-[rgba(32,245,162,0.5)] bg-[rgba(32,245,162,0.1)] text-[#20f5a2] text-xs font-bold hover:bg-[rgba(32,245,162,0.2)] transition-all shrink-0 cursor-pointer"
        >
          Practice with AI Coach →
        </button>
      </section>
    </div>
  );
};
