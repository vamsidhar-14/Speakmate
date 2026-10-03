import React from 'react';
import { ArrowRight, Mic, Users, Briefcase, Sparkles, MessageSquare, TrendingUp, CheckCircle2 } from 'lucide-react';
import { SpeakMateLogo } from '../components/SpeakMateLogo';

interface LandingPageProps {
  onNavigate: (tab: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="relative overflow-hidden">
      {/* ================= HERO SECTION ================= */}
      <section className="relative min-h-[580px] lg:min-h-[640px] flex items-center px-6 sm:px-12 lg:px-24 py-16 bg-[radial-gradient(circle_at_85%_40%,rgba(0,160,255,0.22),transparent_35%),radial-gradient(circle_at_15%_20%,rgba(0,255,180,0.14),transparent_35%),linear-gradient(110deg,#02101d,#03182b,#020a18)]">
        {/* Floating particle elements */}
        <div className="absolute left-[10%] top-[65%] w-1.5 h-1.5 rounded-full bg-[#20f5a2] shadow-[0_0_12px_#20f5a2]" />
        <div className="absolute left-[48%] top-[20%] w-1.5 h-1.5 rounded-full bg-[#00cfff] shadow-[0_0_12px_#00cfff]" />
        <div className="absolute right-[20%] top-[55%] w-1.5 h-1.5 rounded-full bg-[#20f5a2] shadow-[0_0_12px_#20f5a2]" />

        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6">
            <div className="mb-2">
              <SpeakMateLogo size={42} showText={true} textClassName="text-3xl" badgeText="Student Platform" />
            </div>

            <p className="text-xs font-bold tracking-[2px] text-[#20f5a2] uppercase">
              COMMUNICATION PRACTICE FOR STUDENTS
            </p>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.08] tracking-tight">
              Practice Speaking.{' '}
              <br />
              <span className="bg-gradient-to-r from-[#2af5a5] to-[#00cfff] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,255,200,0.2)]">
                Build Confidence.
              </span>
              <br />
              Prepare for Your Career.
            </h1>

            <p className="text-sm sm:text-base text-[#c9d9e8] leading-relaxed max-w-xl">
              Connect with compatible engineering and college students, practice real conversations,
              sharpen your communication skills, and prepare yourself for interviews, placements, and professional leadership.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => onNavigate('signup')}
                className="inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-full font-bold text-sm sm:text-base text-[#00131c] bg-gradient-to-r from-[#29f5a4] to-[#00aaff] shadow-[0_8px_30px_rgba(0,200,255,0.3)] hover:shadow-[0_12px_40px_rgba(0,230,210,0.45)] hover:translate-y-[-2px] transition-all cursor-pointer"
              >
                <span>Start Practicing</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => onNavigate('login')}
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-full font-bold text-sm sm:text-base text-white border border-[#00e4ff] hover:bg-[rgba(0,200,255,0.12)] hover:shadow-[0_0_20px_rgba(0,210,255,0.25)] transition-all cursor-pointer"
              >
                Sign In
              </button>
            </div>

            {/* Quick trust metrics */}
            <div className="pt-6 border-t border-[rgba(0,210,255,0.14)] grid grid-cols-3 gap-4 max-w-lg">
              <div>
                <div className="text-xl font-bold text-white">100%</div>
                <div className="text-[11px] text-[#7892a5]">Real Students Only</div>
              </div>
              <div>
                <div className="text-xl font-bold text-[#20f5a2]">8+</div>
                <div className="text-[11px] text-[#7892a5]">Practice Formats</div>
              </div>
              <div>
                <div className="text-xl font-bold text-[#00cfff]">Zero-Cost</div>
                <div className="text-[11px] text-[#7892a5]">Free for Students</div>
              </div>
            </div>
          </div>

          {/* Right Hero Visual: 3D Microphone & Platform */}
          <div className="lg:col-span-5 flex justify-center items-center relative min-h-[340px]">
            {/* 3D Mic Card */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl p-6 bg-gradient-to-br from-[rgba(26,255,172,0.18)] to-[rgba(0,110,255,0.18)] border border-[rgba(100,255,230,0.5)] shadow-[0_0_35px_rgba(0,150,255,0.25),inset_0_0_35px_rgba(0,255,200,0.1)] backdrop-blur-md flex flex-col items-center justify-center animate-card-float">
              {/* Animated Microphone Illustration */}
              <div className="relative flex flex-col items-center">
                {/* Sound waves */}
                <div className="absolute -left-7 top-2 w-8 h-14 border-r-2 border-r-[#20f5a2] rounded-r-full opacity-80 animate-pulse" />
                <div className="absolute -left-11 -top-1 w-12 h-20 border-r-2 border-r-[#00cfff] rounded-r-full opacity-60 animate-pulse delay-100" />
                <div className="absolute -right-7 top-2 w-8 h-14 border-l-2 border-l-[#20f5a2] rounded-l-full opacity-80 animate-pulse" />
                <div className="absolute -right-11 -top-1 w-12 h-20 border-l-2 border-l-[#00cfff] rounded-l-full opacity-60 animate-pulse delay-100" />

                {/* Mic Capsule */}
                <div className="w-12 h-20 rounded-2xl bg-gradient-to-br from-[#22f5a3] to-[#008cff] shadow-[0_0_25px_rgba(0,255,200,0.6)] flex items-center justify-center">
                  <Mic className="w-6 h-6 text-[#00131c]" />
                </div>
                {/* Mic Stand */}
                <div className="w-1.5 h-8 bg-gradient-to-b from-[#1af5a2] to-[#00baff] shadow-[0_0_10px_#00d9ff]" />
                {/* Mic Base */}
                <div className="w-16 h-2 rounded-full bg-[#19e9ff] shadow-[0_0_15px_#00d9ff]" />
              </div>

              {/* Chat speech bubble */}
              <div className="absolute -right-4 top-16 bg-gradient-to-br from-[rgba(0,220,255,0.9)] to-[rgba(0,150,255,0.85)] border-2 border-white/40 shadow-[0_0_25px_rgba(0,180,255,0.4)] px-3 py-2 rounded-2xl flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-white animate-bounce delay-150" />
                <span className="w-2 h-2 rounded-full bg-white animate-bounce delay-300" />
              </div>
            </div>

            {/* Glowing 3D Base Platform */}
            <div className="absolute -bottom-8 w-80 h-16 rounded-[50%] bg-gradient-to-r from-[#20f5a2] via-[#008cff] to-[#20f5a2] opacity-70 blur-md pointer-events-none" />
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how-it-works" className="py-20 px-6 sm:px-12 lg:px-24 bg-gradient-to-b from-[#02101e] to-[#020b18]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-[2px] text-[#22f5a4] uppercase mb-2">
              HOW IT WORKS
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Start improving in four simple steps.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                step: '01',
                icon: '♙',
                title: 'Create Your Profile',
                desc: 'Tell us about your college, branch, current communication level and career goals.',
              },
              {
                step: '02',
                icon: '♧',
                title: 'Find a Partner',
                desc: 'Instantly match with peer students focused on the exact same goals and topics.',
              },
              {
                step: '03',
                icon: '♫',
                title: 'Start Speaking',
                desc: 'Practice conversations, group discussions, or mock interviews through voice and video.',
              },
              {
                step: '04',
                icon: '↗',
                title: 'Analyze & Improve',
                desc: 'Track speaking metrics, practice daily challenges, and receive structured feedback.',
              },
            ].map((card, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border border-[rgba(0,180,255,0.28)] bg-gradient-to-br from-[rgba(0,80,120,0.18)] to-[rgba(2,20,40,0.75)] hover:border-[#20f5a2] hover:shadow-[0_10px_35px_rgba(0,210,255,0.15)] hover:translate-y-[-4px] transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs bg-gradient-to-br from-[#20f5a2] to-[#008cff] text-[#00131c]">
                    {card.step}
                  </span>
                  <span className="text-2xl text-[#00d9ff]">{card.icon}</span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
                <p className="text-xs text-[#a9bfd1] leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= ABOUT SPEAKMATE ================= */}
      <section id="about" className="py-20 px-6 sm:px-12 lg:px-24 bg-[#020b18] border-t border-[rgba(0,200,255,0.1)]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-4">
            <p className="text-xs font-bold tracking-[2px] text-[#22f5a4] uppercase">
              ABOUT SPEAKMATE
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
              Not another social media platform.
            </h2>
            <p className="text-sm text-[#a9bfd1] leading-relaxed">
              SpeakMate is built exclusively for students who want to bridge the gap between classroom theory and real-world speaking.
              Whether preparing for corporate campus placements, tech team standups, or international debates, SpeakMate turns speaking into an active daily habit.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="pl-5 border-l border-[rgba(0,190,255,0.4)] space-y-2">
              <div className="text-2xl text-[#20f5a2]">◎</div>
              <h3 className="text-sm font-bold text-white">Purpose Driven</h3>
              <p className="text-xs text-[#9db5c8] leading-relaxed">
                Zero meaningless chatter. Every practice session has clear speaking objectives and timed limits.
              </p>
            </div>

            <div className="pl-5 border-l border-[rgba(0,190,255,0.4)] space-y-2">
              <div className="text-2xl text-[#20f5a2]">♧</div>
              <h3 className="text-sm font-bold text-white">Practice Together</h3>
              <p className="text-xs text-[#9db5c8] leading-relaxed">
                Overcome shyness and speaking anxiety by conversing with supportive fellow students.
              </p>
            </div>

            <div className="pl-5 border-l border-[rgba(0,190,255,0.4)] space-y-2">
              <div className="text-2xl text-[#20f5a2]">▣</div>
              <h3 className="text-sm font-bold text-white">Career Focused</h3>
              <p className="text-xs text-[#9db5c8] leading-relaxed">
                Master group discussion skills, technical interview delivery, and presentation poise.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CALL TO ACTION ================= */}
      <section className="py-20 px-6 text-center bg-[radial-gradient(circle,rgba(0,190,255,0.16),transparent_60%)] bg-[#020b18]">
        <div className="max-w-3xl mx-auto space-y-6">
          <p className="text-xs font-bold tracking-[2px] text-[#20f5a2] uppercase">
            READY TO START?
          </p>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight">
            Your confidence grows <br />
            when you start speaking.
          </h2>
          <p className="text-sm text-[#8fa9bb] max-w-lg mx-auto">
            Create your free account today and join other engineering students sharpening their communication skills.
          </p>
          <div>
            <button
              onClick={() => onNavigate('signup')}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full font-bold text-sm sm:text-base text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00aaff] shadow-[0_8px_30px_rgba(0,190,255,0.3)] hover:shadow-[0_12px_40px_rgba(0,230,210,0.45)] hover:translate-y-[-2px] transition-all cursor-pointer"
            >
              <span>Join SpeakMate</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
