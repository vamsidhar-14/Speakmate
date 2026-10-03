import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { LiveVoiceCoachModal } from '../components/LiveVoiceCoachModal';
import {
  Sparkles,
  Mic,
  Play,
  Pause,
  Square,
  Volume2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Award,
  Globe,
  Radio,
  ExternalLink,
} from 'lucide-react';

export const AICoachPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'coach' | 'interview' | 'live-voice'>('coach');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Coach Analysis state
  const [speechText, setSpeechText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);

  // Interview state
  const [interviewRole, setInterviewRole] = useState('Campus Placement HR Interview');
  const [currentQuestion, setCurrentQuestion] = useState('Tell me about yourself, your educational background, and why you are interested in this software engineering position.');
  const [studentAnswer, setStudentAnswer] = useState('');
  const [questionCount, setQuestionCount] = useState(1);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [answerInputError, setAnswerInputError] = useState<string | null>(null);

  // Google Search Grounding state for live interview trends
  const [isSearchingTrends, setIsSearchingTrends] = useState(false);
  const [searchGroundedSources, setSearchGroundedSources] = useState<{ title: string; uri: string }[]>([]);

  // Voice Explanation state for Interview Questions and Feedback
  const [playingVoiceText, setPlayingVoiceText] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState(false);
  const pageAudioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayPageVoice = async (textToSpeak: string) => {
    if (!textToSpeak) return;

    if (playingVoiceText === textToSpeak) {
      if (pageAudioRef.current) {
        if (pageAudioRef.current.paused) {
          pageAudioRef.current.play();
        } else {
          pageAudioRef.current.pause();
          setPlayingVoiceText(null);
        }
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setPlayingVoiceText(null);
      }
      return;
    }

    if (pageAudioRef.current) {
      pageAudioRef.current.pause();
      pageAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setLoadingVoice(true);
    setPlayingVoiceText(textToSpeak);

    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, voiceName: 'Charon' }),
      });
      const data = await res.json().catch(() => null);

      if (data && data.audioBase64) {
        const byteCharacters = atob(data.audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.mimeType || 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        pageAudioRef.current = audio;
        audio.onended = () => setPlayingVoiceText(null);
        audio.onerror = () => {
          fallbackSpeech(textToSpeak);
        };
        await audio.play();
      } else {
        fallbackSpeech(textToSpeak);
      }
    } catch {
      fallbackSpeech(textToSpeak);
    } finally {
      setLoadingVoice(false);
    }
  };

  const fallbackSpeech = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setPlayingVoiceText(null);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const maleVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.toLowerCase().includes('male') ||
          v.name.includes('Daniel') ||
          v.name.includes('David') ||
          v.name.includes('Google UK English Male') ||
          v.name.includes('Google US English Male') ||
          v.name.includes('Guy') ||
          v.name.includes('Natural'))
    ) || voices.find((v) => v.lang.startsWith('en'));
    if (maleVoice) {
      u.voice = maleVoice;
    }
    u.pitch = 0.9;
    u.rate = 0.95;
    u.onend = () => setPlayingVoiceText(null);
    u.onerror = () => setPlayingVoiceText(null);
    window.speechSynthesis.speak(u);
  };

  const handleFetchSearchGroundedQuestion = async () => {
    setIsSearchingTrends(true);
    try {
      const res = await fetch('/api/ai/search-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `What are the most common technical and behavioral questions asked in 2026 engineering campus interviews for ${interviewRole}? Provide 1 targeted high-yield question.`,
          studentName: user?.fullName || 'Student',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          setCurrentQuestion(data.reply);
          if (Array.isArray(data.sources)) {
            setSearchGroundedSources(data.sources);
          }
        }
      }
    } catch (_err) {
      // Graceful fallback to default interview question
    } finally {
      setIsSearchingTrends(false);
    }
  };

  const samplePrompts = [
    'Introduce yourself for an HR round in under 90 seconds.',
    'Explain how you resolved a technical disagreement in a college project.',
    'Describe the difference between synchronous and asynchronous code simply.',
    'Why do you want to join our engineering team over other companies?',
  ];

  const handleAnalyze = async () => {
    if (!speechText.trim()) return;
    setAnalyzing(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speechText,
          practiceMode: 'Interview & Speech Delivery',
          focusGoal: user?.goal || 'Career Preparation',
        }),
      });
      const data = await res.json();
      setFeedback(data.feedback);
    } catch (_err) {
      // Handled gracefully with fallback state
    } finally {
      setAnalyzing(false);
    }
  };

  const handleNextInterviewQuestion = async () => {
    if (!studentAnswer.trim()) {
      setAnswerInputError('Please speak or type your answer before proceeding.');
      setTimeout(() => setAnswerInputError(null), 4000);
      return;
    }
    setAnswerInputError(null);
    setInterviewLoading(true);

    try {
      const res = await fetch('/api/ai/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: interviewRole,
          questionIndex: questionCount + 1,
          lastAnswer: studentAnswer,
          topic: 'Engineering & Communication Evaluation',
        }),
      });
      const data = await res.json();
      setCurrentQuestion(data.nextQuestion || 'How do you handle working under tight deadlines with ambiguous requirements?');
      setLastFeedback(data.feedbackOnLastAnswer || 'Great delivery. Ensure you quantify your results where possible.');
      setStudentAnswer('');
      setQuestionCount((prev) => prev + 1);
    } catch (_err) {
      setCurrentQuestion('How do you prioritize technical trade-offs between performance and maintainability in your projects?');
      setLastFeedback('Good structured delivery. Try quantifying project impact or metrics.');
      setStudentAnswer('');
      setQuestionCount((prev) => prev + 1);
    } finally {
      setInterviewLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 relative z-10">
      {/* Header */}
      <section className="space-y-3">
        <p className="text-xs font-bold tracking-[1.5px] text-[#20f5a2] uppercase">
          SPEAKMATE AI LAB
        </p>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          AI Communication{' '}
          <span className="bg-gradient-to-r from-[#20f5a2] to-[#00cfff] bg-clip-text text-transparent">
            Coach & Interviewer.
          </span>
        </h1>
        <p className="text-sm text-[#9eb6c8] max-w-2xl leading-relaxed">
          Powered by Google's Gemini models. Analyze your speech for filler words, grammar conciseness, and simulate realistic HR and technical placement rounds.
        </p>
      </section>

      {/* Tab Switcher */}
      <div className="flex gap-3 border-b border-[rgba(0,210,255,0.18)] pb-3">
        <button
          onClick={() => setActiveTab('coach')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'coach'
              ? 'bg-[#20f5a2] text-[#00131c] shadow-[0_0_15px_rgba(32,245,162,0.3)]'
              : 'border border-[rgba(0,210,255,0.2)] text-white hover:bg-[rgba(0,180,255,0.08)]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Speech & Filler-Word Analyzer</span>
        </button>

        <button
          onClick={() => setActiveTab('interview')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'interview'
              ? 'bg-[#20f5a2] text-[#00131c] shadow-[0_0_15px_rgba(32,245,162,0.3)]'
              : 'border border-[rgba(0,210,255,0.2)] text-white hover:bg-[rgba(0,180,255,0.08)]'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Interactive Mock Interviewer</span>
        </button>

        <button
          onClick={() => setIsVoiceModalOpen(true)}
          className="px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer border border-[#20f5a2]/50 bg-[#20f5a2]/15 text-[#20f5a2] hover:bg-[#20f5a2]/25 shadow-[0_0_15px_rgba(32,245,162,0.25)]"
        >
          <Mic className="w-4 h-4 animate-pulse" />
          <span>Live Voice Interview (gemini-3.8-live)</span>
        </button>
      </div>

      {activeTab === 'coach' ? (
        /* SPEECH ANALYSIS TAB */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="p-6 rounded-3xl border border-[rgba(0,210,255,0.22)] bg-[rgba(10,50,75,0.6)] backdrop-blur-xl space-y-4">
              <label className="block text-xs font-bold text-[#dceaf4] uppercase tracking-wider">
                Paste Your Speech Transcript or Speaking Notes
              </label>

              <textarea
                rows={6}
                value={speechText}
                onChange={(e) => setSpeechText(e.target.value)}
                placeholder="Type or paste what you spoke during your practice session, or practice introducing yourself..."
                className="w-full p-4 rounded-2xl bg-[rgba(1,15,30,0.75)] border border-[rgba(0,190,255,0.25)] text-white text-xs sm:text-sm focus:outline-none focus:border-[#20f5a2] leading-relaxed resize-none"
              />

              {/* Sample prompts */}
              <div>
                <span className="text-[10px] text-[#71899b] uppercase font-bold block mb-2">
                  Sample Practice Prompts:
                </span>
                <div className="flex flex-wrap gap-2">
                  {samplePrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSpeechText(p)}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-[rgba(0,210,255,0.2)] bg-[rgba(1,15,30,0.6)] text-[#b0c8dc] hover:border-[#20f5a2] hover:text-[#20f5a2] transition-all text-left"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !speechText.trim()}
                  className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00cfff] shadow-[0_8px_25px_rgba(0,190,255,0.25)] hover:shadow-[0_12px_35px_rgba(32,245,162,0.4)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{analyzing ? 'Analyzing with Gemini...' : 'Analyze Speech Delivery'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Feedback Output Card */}
          <div className="lg:col-span-5">
            {feedback ? (
              <div className="p-6 rounded-3xl border border-[rgba(32,245,162,0.35)] bg-[rgba(2,20,35,0.85)] backdrop-blur-xl shadow-2xl space-y-5 animate-in fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(0,210,255,0.15)]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#20f5a2]">
                      AI EVALUATION
                    </span>
                    <h3 className="text-xl font-bold text-white">Analysis Results</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-[#20f5a2]">
                      {feedback.overallScore}
                    </span>
                    <span className="text-[11px] text-[#71899b] block">/ 100 Overall</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[rgba(1,15,30,0.6)] border border-[rgba(0,210,255,0.15)]">
                    <span className="text-[#71899b] block text-[10px]">Clarity</span>
                    <strong className="text-white text-sm">{feedback.clarityScore || '8.2 / 10'}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[rgba(1,15,30,0.6)] border border-[rgba(0,210,255,0.15)]">
                    <span className="text-[#71899b] block text-[10px]">Filler Words Count</span>
                    <strong className="text-amber-400 text-sm">{feedback.fillerWordCount ?? 3}</strong>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-[#20f5a2] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Strengths
                  </h4>
                  <ul className="space-y-1.5 text-xs text-[#d0e2f0]">
                    {feedback.strengths?.map((s: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#20f5a2]">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Areas to Polish
                  </h4>
                  <ul className="space-y-1.5 text-xs text-[#d0e2f0]">
                    {feedback.areasToImprove?.map((a: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400">•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-2xl bg-[rgba(32,245,162,0.08)] border border-[rgba(32,245,162,0.25)]">
                  <span className="text-[10px] uppercase font-bold text-[#20f5a2] block mb-1">
                    Actionable Tip for Next Session
                  </span>
                  <p className="text-xs text-[#c6dded] leading-relaxed">
                    {feedback.actionableTip || 'Pause for 1 second instead of saying filler words.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-3xl border border-dashed border-[rgba(0,210,255,0.2)] bg-[rgba(1,15,30,0.4)] text-center space-y-3">
                <Sparkles className="w-8 h-8 text-[#20f5a2] mx-auto opacity-70" />
                <h3 className="text-sm font-bold text-white">Waiting for input</h3>
                <p className="text-xs text-[#71899b]">
                  Provide a speaking excerpt on the left to receive AI feedback on filler words, tone, and clarity.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* MOCK INTERVIEWER TAB */
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="p-6 rounded-3xl border border-[rgba(0,210,255,0.25)] bg-[rgba(10,50,75,0.65)] backdrop-blur-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[rgba(0,210,255,0.15)]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#20f5a2]">
                  INTERVIEW SIMULATION
                </span>
                <h3 className="text-lg font-bold text-white">Question #{questionCount}</h3>
              </div>
              <select
                value={interviewRole}
                onChange={(e) => setInterviewRole(e.target.value)}
                className="text-xs bg-[#041425] border border-[rgba(0,210,255,0.25)] text-white px-3 py-1.5 rounded-xl focus:outline-none"
              >
                <option value="Campus Placement HR Interview">Campus Placement HR Round</option>
                <option value="Software Engineer Technical Interview">Technical Architecture Round</option>
                <option value="Behavioral Leadership Round">Behavioral & Conflict Round</option>
              </select>
            </div>

            {/* Current Interview Question */}
            <div className="p-5 rounded-2xl bg-[rgba(1,15,30,0.85)] border border-[rgba(0,210,255,0.2)] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-[#20f5a2] uppercase tracking-wider block">
                  Interviewer Question:
                </span>
                <button
                  type="button"
                  onClick={handleFetchSearchGroundedQuestion}
                  disabled={isSearchingTrends}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-[rgba(0,210,255,0.3)] bg-[rgba(0,210,255,0.08)] text-[#00cfff] text-[11px] font-semibold hover:border-[#20f5a2] hover:text-[#20f5a2] transition-all cursor-pointer disabled:opacity-50"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{isSearchingTrends ? 'Searching 2026 Trends...' : 'Fetch 2026 Trends Question (Google Search)'}</span>
                </button>
              </div>

              <p className="text-sm sm:text-base font-semibold text-white leading-relaxed">
                "{currentQuestion}"
              </p>

              {/* Microphone Voice Explanation Button for Question */}
              <div className="pt-2 border-t border-[rgba(0,210,255,0.15)] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handlePlayPageVoice(currentQuestion)}
                  disabled={loadingVoice && playingVoiceText === currentQuestion}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md ${
                    playingVoiceText === currentQuestion
                      ? 'bg-gradient-to-r from-[#20f5a2] to-[#00cfff] text-[#00131c]'
                      : 'bg-[#20f5a2]/15 hover:bg-[#20f5a2]/25 text-[#20f5a2] border border-[#20f5a2]/35'
                  }`}
                >
                  {loadingVoice && playingVoiceText === currentQuestion ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading Voice...</span>
                    </>
                  ) : playingVoiceText === currentQuestion ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                      <span>Speaking Question Aloud...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      <span>🎙️ Voice Explanation</span>
                    </>
                  )}
                </button>
              </div>

              {searchGroundedSources.length > 0 && (
                <div className="pt-2 border-t border-[rgba(0,210,255,0.15)] flex flex-wrap items-center gap-3 text-[10px] text-[#789fb5]">
                  <span className="font-bold text-[#20f5a2]">Grounded Sources:</span>
                  {searchGroundedSources.map((s, idx) => (
                    <a
                      key={idx}
                      href={s.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00cfff] hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{s.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Feedback on previous question if available */}
            {lastFeedback && (
              <div className="p-4 rounded-xl bg-[rgba(32,245,162,0.08)] border border-[rgba(32,245,162,0.25)] text-xs text-[#c0dbec] space-y-2">
                <div className="flex items-center justify-between">
                  <strong className="text-[#20f5a2] block">Interviewer Critique:</strong>
                  <button
                    type="button"
                    onClick={() => handlePlayPageVoice(lastFeedback)}
                    disabled={loadingVoice && playingVoiceText === lastFeedback}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#20f5a2] hover:text-[#00cfff] transition-colors cursor-pointer"
                  >
                    <Mic className="w-3 h-3" />
                    <span>{playingVoiceText === lastFeedback ? 'Speaking...' : '🎙️ Voice Explanation'}</span>
                  </button>
                </div>
                <p className="leading-relaxed">{lastFeedback}</p>
              </div>
            )}

            {/* Answer input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-[#dceaf4] uppercase tracking-wider">
                  Your Spoken Answer
                </label>
                {answerInputError && (
                  <span className="text-xs text-amber-300 font-semibold animate-in fade-in flex items-center gap-1">
                    <span>⚠️</span>
                    <span>{answerInputError}</span>
                  </span>
                )}
              </div>
              <textarea
                rows={4}
                value={studentAnswer}
                onChange={(e) => setStudentAnswer(e.target.value)}
                placeholder="Speak or type how you would answer this interview question..."
                className="w-full p-4 rounded-2xl bg-[rgba(1,15,30,0.75)] border border-[rgba(0,190,255,0.25)] text-white text-xs sm:text-sm focus:outline-none focus:border-[#20f5a2] resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleNextInterviewQuestion}
                disabled={interviewLoading || !studentAnswer.trim()}
                className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00cfff] shadow-[0_8px_25px_rgba(0,190,255,0.25)] hover:shadow-[0_12px_35px_rgba(32,245,162,0.4)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <span>{interviewLoading ? 'Evaluating Answer...' : 'Submit Answer & Next Question'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
