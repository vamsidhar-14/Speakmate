import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { PeerFeedback, PeerRatings } from '../types';
import {
  Star,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  ThumbsUp,
  Award,
  Send,
  X,
  Heart,
  Lightbulb,
} from 'lucide-react';

interface PostSessionFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  sessionData: {
    roomId: string;
    practiceMode: string;
    durationFormatted: string;
    partnerName: string;
  };
}

export const PostSessionFeedbackModal: React.FC<PostSessionFeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmitted,
  sessionData,
}) => {
  const { user } = useAuth();
  const { submitFeedback } = useSocket();

  const [ratings, setRatings] = useState<PeerRatings>({
    clarity: 5,
    confidence: 4,
    listening: 5,
    structure: 4,
    overall: 5,
  });

  const [selectedTags, setSelectedTags] = useState<string[]>([
    'Clear Articulation',
    'Active Listener',
  ]);
  const [constructiveNotes, setConstructiveNotes] = useState('');
  const [encouragement, setEncouragement] = useState('Great conversation! Very confident and easy to understand.');
  const [isRefiningAI, setIsRefiningAI] = useState(false);
  const [refineWarning, setRefineWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const availableTags = [
    'Clear Articulation',
    'Great Eye Contact',
    'Active Listener',
    'Paced Well',
    'STAR Method Used',
    'Calm & Composed',
    'Watch Filler Words',
    'Elaborate On Key Points',
    'Strong Conclusion',
    'Engaging Tone',
  ];

  if (!isOpen) return null;

  const handleRatingChange = (key: keyof PeerRatings, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleRefineWithAI = async () => {
    if (!constructiveNotes.trim()) {
      setRefineWarning('Please type a quick note first, and Fluencis AI will polish it into structured peer feedback.');
      setTimeout(() => setRefineWarning(null), 4000);
      return;
    }

    setRefineWarning(null);
    setIsRefiningAI(true);
    try {
      const res = await fetch('/api/ai/refine-peer-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roughNotes: constructiveNotes,
          ratings,
          practiceMode: sessionData.practiceMode,
          toStudent: sessionData.partnerName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.polishedNotes) {
          setConstructiveNotes(data.polishedNotes);
        }
        if (Array.isArray(data.recommendedTags)) {
          setSelectedTags((prev) => Array.from(new Set([...prev, ...data.recommendedTags])));
        }
      }
    } catch (err) {
      console.warn('AI feedback refinement error:', err);
    } finally {
      setIsRefiningAI(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const feedbackPayload: PeerFeedback = {
      id: `fb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      roomId: sessionData.roomId,
      fromStudent: user?.fullName || 'Student',
      fromInitial: user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'S',
      toStudent: sessionData.partnerName || 'Practice Partner',
      toInitial: sessionData.partnerName ? sessionData.partnerName.charAt(0).toUpperCase() : 'P',
      practiceMode: sessionData.practiceMode,
      durationFormatted: sessionData.durationFormatted,
      ratings,
      tags: selectedTags,
      constructiveNotes: constructiveNotes.trim() || 'Great session! Communicated clearly and stayed engaged throughout.',
      encouragement: encouragement.trim(),
      createdAt: 'Just now',
    };

    await submitFeedback(feedbackPayload);
    setIsSubmitting(false);
    setSubmittedSuccess(true);

    setTimeout(() => {
      onSubmitted();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl border border-[rgba(0,210,255,0.3)] bg-gradient-to-br from-[rgba(10,50,75,0.85)] to-[rgba(2,15,30,0.95)] p-6 sm:p-8 shadow-2xl backdrop-blur-2xl text-white my-8 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-[#7892a5] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {submittedSuccess ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#20f5a2] to-[#00aaff] flex items-center justify-center font-bold text-3xl text-[#00131c] mx-auto shadow-[0_0_30px_rgba(32,245,162,0.5)]">
              ✓
            </div>
            <h2 className="text-2xl font-extrabold text-white">Peer Review Submitted!</h2>
            <p className="text-sm text-[#9eb6c8] max-w-md mx-auto">
              Thank you for helping {sessionData.partnerName} improve. Your constructive review has been sent to their profile and logged in practice metrics.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header info */}
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#20f5a2] uppercase tracking-wider mb-1">
                <Award className="w-4 h-4" />
                <span>POST-SESSION FEEDBACK</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Rate your session with {sessionData.partnerName}
              </h2>
              <p className="text-xs text-[#9eb6c8] mt-1">
                Session: <strong className="text-white">{sessionData.practiceMode}</strong> · Duration:{' '}
                <strong className="text-[#20f5a2] font-mono">{sessionData.durationFormatted}</strong> · Room:{' '}
                <span className="font-mono text-[#00cfff]">{sessionData.roomId}</span>
              </p>
            </div>

            {/* Communication Dimensions Ratings */}
            <div className="space-y-3.5 p-4 rounded-2xl bg-[rgba(1,15,30,0.6)] border border-[rgba(0,190,255,0.18)]">
              <span className="text-[11px] font-bold text-[#20f5a2] uppercase tracking-wider block">
                1. Rate Core Communication Dimensions
              </span>

              {[
                { key: 'clarity' as keyof PeerRatings, label: 'Voice Clarity & Articulation', desc: 'Pronunciation, pacing, and tone' },
                { key: 'confidence' as keyof PeerRatings, label: 'Confidence & Poise', desc: 'Overcoming hesitation, authoritative delivery' },
                { key: 'listening' as keyof PeerRatings, label: 'Active Listening & Response', desc: 'Engaged with questions, responded thoughtfully' },
                { key: 'structure' as keyof PeerRatings, label: 'Structure & Coherence', desc: 'Clear beginning, middle points, and conclusion' },
                { key: 'overall' as keyof PeerRatings, label: 'Overall Communication Impact', desc: 'General effectiveness in this practice mode' },
              ].map((dim) => (
                <div key={dim.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1.5 border-b border-[rgba(0,210,255,0.08)] last:border-none">
                  <div>
                    <strong className="text-xs text-white block">{dim.label}</strong>
                    <span className="text-[10px] text-[#71899b]">{dim.desc}</span>
                  </div>

                  {/* 5-Star interactive control */}
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((starVal) => {
                      const isActive = ratings[dim.key] >= starVal;
                      return (
                        <button
                          key={starVal}
                          type="button"
                          onClick={() => handleRatingChange(dim.key, starVal)}
                          className="p-1 text-base transition-transform hover:scale-110 focus:outline-none cursor-pointer"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              isActive
                                ? 'fill-[#20f5a2] text-[#20f5a2] drop-shadow-[0_0_8px_rgba(32,245,162,0.6)]'
                                : 'text-[#476073] hover:text-[#20f5a2]'
                            }`}
                          />
                        </button>
                      );
                    })}
                    <span className="text-xs font-mono font-bold text-[#20f5a2] ml-2 w-6 text-right">
                      {ratings[dim.key]}/5
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Constructive Skill Tags */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-[#20f5a2] uppercase tracking-wider block">
                2. Highlight Specific Strengths & Focus Areas
              </span>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#20f5a2] bg-gradient-to-r from-[rgba(32,245,162,0.2)] to-[rgba(0,207,255,0.18)] text-[#20f5a2] font-semibold shadow-[0_0_12px_rgba(32,245,162,0.2)]'
                          : 'border-[rgba(0,210,255,0.18)] bg-[rgba(1,15,30,0.5)] text-[#8fa9bb] hover:border-[#20f5a2] hover:text-white'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Constructive Notes Area with AI Refinement */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#20f5a2] uppercase tracking-wider">
                  3. Constructive Notes for {sessionData.partnerName}
                </span>

                <button
                  type="button"
                  onClick={handleRefineWithAI}
                  disabled={isRefiningAI || !constructiveNotes.trim()}
                  className="inline-flex items-center gap-1.5 text-xs text-[#00cfff] hover:text-[#20f5a2] font-semibold bg-[rgba(0,207,255,0.08)] px-2.5 py-1 rounded-xl border border-[rgba(0,207,255,0.2)] hover:border-[#20f5a2] transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#20f5a2]" />
                  <span>{isRefiningAI ? 'Polishing with Gemini...' : 'Polish with AI'}</span>
                </button>
              </div>

              {refineWarning && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <span>💡</span>
                  <span>{refineWarning}</span>
                </div>
              )}

              <textarea
                rows={3}
                value={constructiveNotes}
                onChange={(e) => setConstructiveNotes(e.target.value)}
                placeholder="What did your partner explain exceptionally well? What is one actionable speaking advice for their next interview round?"
                className="w-full p-3.5 rounded-2xl bg-[rgba(1,15,30,0.8)] border border-[rgba(0,190,255,0.25)] text-white text-xs sm:text-sm focus:outline-none focus:border-[#20f5a2] focus:ring-1 focus:ring-[#20f5a2] resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-xs text-[#8fa9bb] hover:text-white transition-all cursor-pointer"
              >
                Skip for now
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-7 py-3 rounded-xl font-bold text-xs sm:text-sm text-[#00131c] bg-gradient-to-r from-[#20f5a2] to-[#00aaff] shadow-[0_8px_25px_rgba(0,190,255,0.25)] hover:shadow-[0_12px_35px_rgba(32,245,162,0.45)] hover:translate-y-[-1px] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Peer Feedback'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
