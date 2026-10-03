import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LiveVoiceCoachModal } from './LiveVoiceCoachModal';
import { DiagramViewer } from './DiagramViewer';
import {
  Sparkles,
  X,
  Send,
  MessageSquare,
  Bot,
  User as UserIcon,
  HelpCircle,
  Lightbulb,
  ChevronDown,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Code2,
  Terminal,
  Globe,
  ExternalLink,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Headphones,
  Loader2,
  History,
  Clock,
  Search,
  BookOpen,
  ArrowLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';

export interface ChatDiagram {
  title: string;
  type: 'mermaid' | 'svg';
  code: string;
  description: string;
  keyComponents?: string[];
}

export interface RecentQuestionItem {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
  dateStr: string;
  category?: string;
  sources?: { title: string; uri: string }[];
  usedSearch?: boolean;
  diagram?: ChatDiagram;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  sources?: { title: string; uri: string }[];
  usedSearch?: boolean;
  diagram?: ChatDiagram;
  isGeneratingDiagram?: boolean;
}

// Markdown formatting renderer for Plain Concept, Code, and Key Takeaway sections
const FormattedMessage: React.FC<{ text: string }> = ({ text }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (codeText: string, idx: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Split code blocks from regular text
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-xs leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const firstLineEnd = part.indexOf('\n');
          const lang = part.substring(3, firstLineEnd).trim().toLowerCase() || 'code';
          const codeContent = part.substring(firstLineEnd + 1, part.length - 3).trim();

          // Render conceptual diagrams directly inline if Mermaid or SVG block
          if (lang === 'mermaid' || lang === 'svg') {
            return (
              <div key={index} className="my-3">
                <DiagramViewer
                  code={codeContent}
                  type={lang === 'svg' ? 'svg' : 'mermaid'}
                />
              </div>
            );
          }

          return (
            <div
              key={index}
              className="my-2.5 rounded-xl border border-[rgba(0,210,255,0.25)] bg-[rgba(1,10,20,0.9)] overflow-hidden font-mono text-[11px]"
            >
              <div className="px-3 py-1.5 bg-[rgba(2,20,35,0.8)] border-b border-[rgba(0,210,255,0.15)] flex items-center justify-between text-[#789cb0]">
                <div className="flex items-center gap-1.5 text-[10px] text-[#20f5a2] font-semibold">
                  <Terminal className="w-3 h-3" />
                  <span>{lang.toUpperCase()}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeContent, index)}
                  className="flex items-center gap-1 text-[10px] text-[#a0c5d8] hover:text-[#20f5a2] transition-colors cursor-pointer"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check className="w-3 h-3 text-[#20f5a2]" />
                      <span className="text-[#20f5a2]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 overflow-x-auto text-[#d4e7f5] leading-normal selection:bg-[#20f5a2]/20">
                <code>{codeContent}</code>
              </pre>
            </div>
          );
        }

        const lines = part.split('\n');
        return (
          <div key={index} className="space-y-1">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1.5" />;

              const isPlainConcept = trimmed.startsWith('**Plain Concept');
              const isPracticalExample = trimmed.startsWith('**Practical Example');
              const isKeyTakeaway = trimmed.startsWith('**Key Takeaway');
              const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ');

              const renderFormattedInline = (str: string) => {
                const subParts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
                return subParts.map((sp, spIdx) => {
                  if (sp.startsWith('**') && sp.endsWith('**')) {
                    const inner = sp.slice(2, -2);
                    return (
                      <strong
                        key={spIdx}
                        className={
                          inner.includes('Plain Concept') || inner.includes('Practical Example') || inner.includes('Key Takeaway')
                            ? 'text-[#20f5a2] font-extrabold block text-xs mt-1.5'
                            : 'text-white font-bold'
                        }
                      >
                        {inner}
                      </strong>
                    );
                  }
                  if (sp.startsWith('`') && sp.endsWith('`')) {
                    return (
                      <code
                        key={spIdx}
                        className="px-1.5 py-0.5 rounded bg-[rgba(0,210,255,0.12)] border border-[rgba(0,210,255,0.25)] text-[#00cfff] font-mono text-[10.5px]"
                      >
                        {sp.slice(1, -1)}
                      </code>
                    );
                  }
                  return <span key={spIdx}>{sp}</span>;
                });
              };

              return (
                <div
                  key={lIdx}
                  className={`${
                    isPlainConcept || isPracticalExample || isKeyTakeaway
                      ? 'pt-1 font-semibold text-white'
                      : isBullet
                      ? 'pl-2 text-[#dcebf5] flex items-start gap-1.5'
                      : 'text-[#d3e5f2]'
                  }`}
                >
                  {isBullet && <span className="text-[#20f5a2] font-bold mt-0.5">•</span>}
                  <div className="flex-1">
                    {renderFormattedInline(isBullet ? trimmed.replace(/^[•\-\*]\s*/, '') : trimmed)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const LiveAIChatbot: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Audio Voice Explanation Player States
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isLoadingVoiceId, setIsLoadingVoiceId] = useState<string | null>(null);
  const [isVoicePaused, setIsVoicePaused] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1.0);
  const [autoReadVoice, setAutoReadVoice] = useState(false);
  const [selectedVoicePersona, setSelectedVoicePersona] = useState<'Charon' | 'Fenrir' | 'Zephyr'>('Charon');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Audio element and blob URL references
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Microphone Voice Dictation State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Recent Questions History Panel States
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);

  const [recentQuestions, setRecentQuestions] = useState<RecentQuestionItem[]>(() => {
    try {
      const stored = localStorage.getItem('speakmate_recent_questions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse recent questions:', e);
    }
    return [
      {
        id: 'seed-1',
        question: "Explain Ohm's Law and Kirchhoff's Laws (KVL & KCL) with a circuit walkthrough",
        answer: `### ⚡ Electrical Foundations: Ohm's & Kirchhoff's Laws\n\n**Plain Concept:**\nOhm's Law states current is directly proportional to voltage and inversely proportional to resistance ($V = I \\times R$). Kirchhoff's Current Law (KCL) dictates that total current entering a junction equals total current leaving, while Kirchhoff's Voltage Law (KVL) guarantees the algebraic sum of electrical potential differences around any closed circuit loop is zero.\n\n**Key Takeaway:**\nAlways assign consistent reference arrows for loop currents and node directions before solving the linear circuit equation system.`,
        timestamp: 'Earlier today',
        dateStr: 'Today',
        category: 'Engineering',
      },
      {
        id: 'seed-2',
        question: "Explain Dijkstra shortest path algorithm with min-heap complexity and Python implementation",
        answer: `### 💻 Dijkstra's Shortest Path Algorithm\n\n**Plain Concept:**\nDijkstra's algorithm finds the minimum-weight path from a chosen source vertex to all other nodes in a directed or undirected graph with non-negative edge weights using a greedy min-priority queue.\n\n**Key Takeaway:**\nTime complexity is $O((V + E) \\log V)$ when backed by an adjacency list and binary min-heap. For graphs featuring negative edge weights, Bellman-Ford must be chosen instead.`,
        timestamp: 'Earlier today',
        dateStr: 'Today',
        category: 'Engineering',
      },
      {
        id: 'seed-3',
        question: "Explain Central Dogma of Molecular Biology and CRISPR gene editing",
        answer: `### 🧬 Molecular Biology: Central Dogma & CRISPR\n\n**Plain Concept:**\nThe Central Dogma explains genetic transmission: DNA is transcribed into messenger RNA (mRNA), which ribosomes translate into polypeptides and proteins. CRISPR-Cas9 operates as programmable molecular scissors guided by single guide RNA (sgRNA) matching a 20-base-pair genomic target.\n\n**Key Takeaway:**\nCRISPR drives precise genetic knockouts, gene insertions, and disease-model therapies across biotechnology.`,
        timestamp: 'Earlier today',
        dateStr: 'Today',
        category: 'Sciences',
      },
      {
        id: 'seed-4',
        question: "Explain Maslow's Hierarchy of Needs and how it applies to workplace motivation",
        answer: `### 🧠 Psychological Frameworks: Maslow's Hierarchy\n\n**Plain Concept:**\nAbraham Maslow's theory organizes human drives into five hierarchical tiers: Physiological, Safety, Love/Belonging, Esteem, and Self-Actualization. Individuals prioritize addressing fundamental survival and security needs before higher-level psychological development.\n\n**Key Takeaway:**\nIn organizational leadership, competitive compensation satisfies basic security, while recognition, mentorship, and autonomous innovation unlock peak self-actualization.`,
        timestamp: 'Earlier today',
        dateStr: 'Today',
        category: 'Humanities',
      },
    ];
  });

  const saveRecentQuestions = (list: RecentQuestionItem[]) => {
    setRecentQuestions(list);
    try {
      localStorage.setItem('speakmate_recent_questions', JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save recent questions:', e);
    }
  };

  const handleDeleteRecentQuestion = (id: string) => {
    const updated = recentQuestions.filter((item) => item.id !== id);
    saveRecentQuestions(updated);
  };

  const handleClearAllHistory = () => {
    saveRecentQuestions([]);
  };

  const handleCopyHistory = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHistoryId(id);
    setTimeout(() => setCopiedHistoryId(null), 2000);
  };

  const handleReopenInChat = (item: RecentQuestionItem) => {
    const exists = messages.some(
      (m) => m.text.trim().toLowerCase() === item.question.trim().toLowerCase()
    );
    if (!exists) {
      setMessages((prev) => [
        ...prev,
        {
          id: `hist-user-${Date.now()}`,
          role: 'user',
          text: item.question,
          timestamp: item.timestamp,
        },
        {
          id: `hist-bot-${Date.now()}`,
          role: 'model',
          text: item.answer,
          timestamp: item.timestamp,
          sources: item.sources || [],
          usedSearch: item.usedSearch,
        },
      ]);
    }
    setShowHistoryPanel(false);
    setTimeout(scrollToBottom, 120);
  };

  const handleAskFollowUp = (item: RecentQuestionItem) => {
    setInputText(`Regarding "${item.question.slice(0, 36)}...": `);
    setShowHistoryPanel(false);
  };

  const filteredQuestions = recentQuestions.filter((item) => {
    const matchesSearch =
      !historySearchQuery.trim() ||
      item.question.toLowerCase().includes(historySearchQuery.toLowerCase().trim()) ||
      item.answer.toLowerCase().includes(historySearchQuery.toLowerCase().trim());

    const matchesCategory =
      historyCategoryFilter === 'all' ||
      item.category?.toLowerCase() === historyCategoryFilter.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  const [activeCategory, setActiveCategory] = useState<'all' | 'sciences' | 'engineering' | 'business' | 'humanities' | 'peerReview'>('all');

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'msg-welcome',
        role: 'model',
        text: `### 🌟 Welcome to SpeakMate Universal Academic & Peer Mentor! 🎓

I support students across **ALL branches & disciplines** — Engineering, Physical/Life Sciences, Business, Economics, Humanities, Medicine, and Law! ✨

**📊 New Feature: Conceptual Visual Diagrams (MermaidJS & SVG)**
• Click **📊 Visualize Concept (Diagram)** on any explanation or ask for a diagram to generate interactive architecture charts, biological pathways, algorithm trees, or system design schematics!
• Supports zoom in/out, fullscreen inspection, code view, and instant SVG download for study notes.

**🎙️ Male Voice Explanation (Charon - Articulate & Deep)**
• Click **🎙️ Male Voice Explanation** on any answer to hear SpeakMate explain the topic aloud with Charon — an articulate, calm, clear, and authoritative male mentor voice!
• You can switch between **Charon (Articulate)**, **Fenrir (Deep)**, and **Zephyr (Smooth)** in the audio bar, adjust speed (1x, 1.25x, 1.5x), and toggle **Auto-Read Voice** mode.

**🕒 Recent Questions History**
• Click the **🕒 Recent** toggle in the top bar to review your past questions, revisit explanations, and view saved visual diagrams anytime.

Ask any academic doubt or paste your answer for peer review below! 🚀`,
        timestamp: 'Just now',
      },
    ];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isThinking]);

  const categoryPrompts: Record<string, { label: string; prompt: string; search?: boolean }[]> = {
    all: [
      { label: '📊 Diagram: TCP 3-Way Handshake', prompt: 'Create an interactive conceptual visualization diagram explaining the TCP 3-Way Handshake protocol architecture with MermaidJS', search: false },
      { label: '📊 Flowchart: Cellular Respiration', prompt: 'Create a conceptual flowchart diagram showing the step-by-step pathway of Cellular Respiration from Glycolysis to ATP synthesis with MermaidJS', search: false },
      { label: '📊 Diagram: Microservices Architecture', prompt: 'Create a visual architecture diagram explaining modern Microservices with API Gateway, Redis caching, and databases using MermaidJS', search: false },
      { label: '🤝 Review My Answer (Peer Feedback)', prompt: 'Please give peer feedback and suggestions on my answer: "I handled a team disagreement by scheduling an open 1-on-1 discussion, clarifying our shared deadline, and choosing the solution that minimized technical risk."', search: false },
      { label: '🧬 Central Dogma & CRISPR', prompt: 'Explain the Central Dogma of Biology and how CRISPR gene editing works with real-world examples', search: false },
      { label: '⚡ Ohm\'s & Kirchhoff\'s Laws', prompt: 'Explain Ohm\'s Law and Kirchhoff\'s Current & Voltage Laws (KCL & KVL) with a circuit walkthrough', search: false },
      { label: '📈 Supply, Demand & Elasticity', prompt: 'Explain Supply and Demand market equilibrium and Price Elasticity with real-world business examples', search: false },
      { label: '🏗️ Stress-Strain & Hooke\'s Law', prompt: 'Explain the Stress-Strain curve and Hooke\'s Law for engineering materials', search: false },
      { label: '🧠 Maslow\'s Hierarchy of Needs', prompt: 'Explain Maslow\'s Hierarchy of Needs and how it applies to human motivation and team leadership', search: false },
      { label: '🌐 2026 Campus Hiring Trends', prompt: 'What are the top skills, interview patterns, and hiring trends across college campus placements in 2026?', search: true },
    ],
    sciences: [
      { label: '🧬 DNA Transcription & Translation', prompt: 'Explain DNA transcription and translation into proteins step-by-step with analogies', search: false },
      { label: '⚛️ Heisenberg Uncertainty Principle', prompt: 'Explain the Heisenberg Uncertainty Principle in quantum mechanics with physical intuition', search: false },
      { label: '🧪 Le Chatelier\'s Principle', prompt: 'Explain Le Chatelier\'s principle in chemical equilibrium with industrial ammonia synthesis example', search: false },
      { label: '📐 Eigenvalues & Eigenvectors', prompt: 'Explain Eigenvalues and Eigenvectors intuitively with geometric matrix transformations', search: false },
      { label: '🌿 Photosynthesis: Light & Dark', prompt: 'Explain the light-dependent reactions and Calvin cycle of photosynthesis', search: false },
    ],
    engineering: [
      { label: '⚡ Kirchhoff\'s Laws (KVL/KCL)', prompt: 'Explain KCL and KVL with step-by-step circuit equations and practical examples', search: false },
      { label: '🏗️ Young\'s Modulus & Stress-Strain', prompt: 'Explain Young\'s Modulus, yield strength, and the ductile stress-strain curve', search: false },
      { label: '🚗 Carnot Cycle & 2nd Law', prompt: 'Explain the Carnot Heat Engine cycle and the 2nd Law of Thermodynamics with thermal efficiency', search: false },
      { label: '💻 Dijkstra & Graph Search', prompt: 'Explain Dijkstra shortest path algorithm with min-heap complexity and Python implementation', search: false },
      { label: '🌊 Bernoulli\'s Fluid Equation', prompt: 'Explain Bernoulli\'s principle and how it explains aerodynamic lift and Venturi tubes', search: false },
    ],
    business: [
      { label: '📈 Price Elasticity of Demand', prompt: 'Explain Price Elasticity of Demand (PED) with formulas and elastic vs inelastic examples', search: false },
      { label: '💰 Net Present Value (NPV vs IRR)', prompt: 'Explain Net Present Value (NPV) and Internal Rate of Return (IRR) in capital budgeting', search: false },
      { label: '🏢 Porter\'s Five Forces', prompt: 'Explain Porter\'s 5 Forces framework with a real-world case study like Netflix or Apple', search: false },
      { label: '📑 3 Financial Statements', prompt: 'Explain the difference and connection between Balance Sheet, Income Statement, and Cash Flow', search: false },
      { label: '🎯 Marketing 4Ps Framework', prompt: 'Explain the 4Ps Marketing Mix (Product, Price, Place, Promotion) with modern digital examples', search: false },
    ],
    humanities: [
      { label: '🧠 Maslow\'s Hierarchy of Needs', prompt: 'Explain Maslow\'s 5 levels of human needs and modern psychological critiques', search: false },
      { label: '💭 Cognitive Behavioral Therapy (CBT)', prompt: 'Explain Cognitive Behavioral Therapy (CBT) and how thoughts, emotions, and behaviors interconnect', search: false },
      { label: '🏛️ Constitutional Separation of Powers', prompt: 'Explain the Separation of Powers and Checks and Balances in constitutional law', search: false },
      { label: '📖 Deductive vs Inductive Logic', prompt: 'Explain Deductive vs Inductive reasoning with arguments and logical fallacies to avoid', search: false },
      { label: '⚖️ Ethical Theories: Kant vs Utilitarianism', prompt: 'Compare Utilitarianism vs Deontological (Kantian) ethics with moral dilemmas', search: false },
    ],
    peerReview: [
      { label: '🤝 Review 60-Sec Self-Introduction', prompt: 'Please give peer feedback on my self-introduction: "Hello, I am a 3rd-year student who loves problem-solving and projects. I built a team portal and now want to grow my career in your company."', search: false },
      { label: '🎯 Review STAR Conflict Answer', prompt: 'Please review my STAR method response: "Situation: Our project deadline was in 2 days and two members disagreed on the database choice. Task: As team coordinator, I needed consensus. Action: I made a matrix comparing latency vs simplicity. Result: We agreed on SQLite, finished on time, and earned full marks."', search: false },
      { label: '💬 Review Group Discussion Point', prompt: 'Please give peer feedback on this GD statement: "While AI automation increases productivity, we must also invest heavily in workforce upskilling to prevent structural unemployment."', search: false },
      { label: '📝 Polish My Technical Summary', prompt: 'Please polish and critique my conceptual explanation: "A capacitor stores charge between two plates when voltage is applied, and blocks direct current while allowing alternating current."', search: false },
    ],
  };

  const currentPrompts = categoryPrompts[activeCategory] || categoryPrompts.all;

  // Stop any active speech or audio playback
  const handleStopVoice = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      audioElementRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingMessageId(null);
    setIsVoicePaused(false);
    setIsLoadingVoiceId(null);
  };

  // Browser Speech Synthesis Fallback
  const fallbackToBrowserSpeech = (textToSpeak: string, msgId: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsLoadingVoiceId(null);
      setPlayingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = voiceSpeed;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    // Prioritize high-quality natural male English voice
    const maleVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.toLowerCase().includes('male') ||
          v.name.includes('Daniel') ||
          v.name.includes('David') ||
          v.name.includes('Alex') ||
          v.name.includes('George') ||
          v.name.includes('Guy') ||
          v.name.includes('Aaron') ||
          v.name.includes('James') ||
          v.name.includes('Google UK English Male') ||
          v.name.includes('Google US English Male') ||
          v.name.includes('Natural (Male)'))
    ) || voices.find((v) => v.lang.startsWith('en'));

    if (maleVoice) {
      utterance.voice = maleVoice;
    }
    // Articulate, calm, and natural resonant male pitch & rate
    utterance.pitch = 0.9;
    utterance.rate = voiceSpeed * 0.95;

    utterance.onstart = () => {
      setIsLoadingVoiceId(null);
      setPlayingMessageId(msgId);
      setIsVoicePaused(false);
    };
    utterance.onend = () => {
      setPlayingMessageId(null);
      setIsVoicePaused(false);
    };
    utterance.onerror = () => {
      setPlayingMessageId(null);
      setIsVoicePaused(false);
      setIsLoadingVoiceId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Play voice explanation for a message
  const handlePlayVoice = async (msgId: string, text: string) => {
    // If clicking on currently playing message, toggle pause / resume
    if (playingMessageId === msgId) {
      if (audioElementRef.current) {
        if (audioElementRef.current.paused) {
          await audioElementRef.current.play();
          setIsVoicePaused(false);
        } else {
          audioElementRef.current.pause();
          setIsVoicePaused(true);
        }
        return;
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setIsVoicePaused(false);
        } else if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          setIsVoicePaused(true);
        }
        return;
      }
    }

    // Stop any other active voice audio
    handleStopVoice();

    // Prepare clean, conversational speech text (strip code blocks, markdown tables, asterisks)
    const cleanSpeechText = text
      .replace(/```[\s\S]*?```/g, ' [Refer to code implementation in explanation text above] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#+\s*/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\|[^\n]+\|/g, '')
      .replace(/[-*•]\s+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();

    setIsLoadingVoiceId(msgId);

    try {
      // Call Gemini TTS with selected deep male voice persona (default: Fenrir)
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanSpeechText, voiceName: selectedVoicePersona }),
      });

      const data = await res.json().catch(() => null);

      if (data && data.audioBase64) {
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
        }

        const byteCharacters = atob(data.audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.mimeType || 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);
        audioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audio.playbackRate = voiceSpeed;
        audioElementRef.current = audio;

        audio.onended = () => {
          setPlayingMessageId(null);
          setIsVoicePaused(false);
        };
        audio.onerror = () => {
          fallbackToBrowserSpeech(data.cleanText || cleanSpeechText, msgId);
        };

        await audio.play();
        setPlayingMessageId(msgId);
        setIsVoicePaused(false);
        setIsLoadingVoiceId(null);
      } else {
        fallbackToBrowserSpeech(data?.cleanText || cleanSpeechText, msgId);
      }
    } catch (_ttsErr) {
      fallbackToBrowserSpeech(cleanSpeechText, msgId);
    }
  };

  // Generate interactive conceptual visual diagram (MermaidJS or SVG) using Gemini API
  const handleGenerateDiagram = async (msgId: string, messageText: string, customTopic?: string) => {
    // Extract a clear, concise topic from the message
    let topic = customTopic || '';
    if (!topic) {
      const firstHeader = messageText.match(/###\s*[^\n]+/);
      if (firstHeader) {
        topic = firstHeader[0].replace(/###\s*[^\w\s]*/g, '').replace(/concept|intuition|direct answer|overview/gi, '').trim();
      } else {
        const msgIndex = messages.findIndex((m) => m.id === msgId);
        if (msgIndex > 0 && messages[msgIndex - 1].role === 'user') {
          topic = messages[msgIndex - 1].text.slice(0, 80);
        } else {
          topic = messageText.slice(0, 60);
        }
      }
    }

    if (!topic) topic = 'Academic Concept Visualization';

    // Mark message as generating diagram
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isGeneratingDiagram: true } : m))
    );

    try {
      const res = await fetch('/api/ai/diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          context: messageText.slice(0, 1000),
          preferredFormat: 'mermaid',
          studentBranch: user?.branch || 'All Disciplines',
        }),
      });

      const data = await res.json().catch(() => null);

      if (data && data.code) {
        const diagram: ChatDiagram = {
          title: data.title || `${topic} Visual Architecture`,
          type: data.type || 'mermaid',
          code: data.code,
          description: data.description || '',
          keyComponents: data.keyComponents || [],
        };

        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, diagram, isGeneratingDiagram: false } : m
          )
        );

        // Update in recentQuestions if the answer corresponds
        setRecentQuestions((prev) => {
          const updated = prev.map((q) => {
            if (q.id === msgId || q.answer === messageText) {
              return { ...q, diagram };
            }
            return q;
          });
          try {
            localStorage.setItem('speakmate_recent_questions', JSON.stringify(updated));
          } catch (e) {
            console.warn('LocalStorage save notice:', e);
          }
          return updated;
        });
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, isGeneratingDiagram: false } : m))
        );
      }
    } catch (_err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, isGeneratingDiagram: false } : m))
      );
    }
  };

  const cycleVoiceSpeed = () => {
    const speeds = [1.0, 1.25, 1.5];
    const nextIdx = (speeds.indexOf(voiceSpeed) + 1) % speeds.length;
    const newSpeed = speeds[nextIdx];
    setVoiceSpeed(newSpeed);
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = newSpeed;
    }
  };

  // Toggle microphone speech recognition dictation
  const handleToggleListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Microphone speech dictation is supported in Google Chrome, Microsoft Edge, and Safari.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInputText((prev) => (prev ? prev.trim() + ' ' + finalTranscript.trim() : finalTranscript.trim()));
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleStopVoice();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleSendMessage = async (textToSend?: string, forceSearch?: boolean) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent || isThinking) return;

    const willSearch = forceSearch !== undefined ? forceSearch : useSearchGrounding;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      usedSearch: willSearch,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputText('');
    setIsThinking(true);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/ai/live-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          history,
          useSearchGrounding: willSearch,
          studentName: user?.fullName || 'Student',
          studentBranch: user?.branch || 'All Disciplines',
          practiceGoal: user?.goal || 'Academic Excellence & Peer Communication',
        }),
      });

      const data = await res.json().catch(() => null);

      if (data && data.reply) {
        const botMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'model',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sources: data.sources || [],
          usedSearch: willSearch,
        };
        setMessages((prev) => [...prev, botMessage]);

        // Save to Recent Questions history
        const categoryLabels: Record<string, string> = {
          all: 'General',
          sciences: 'Sciences',
          engineering: 'Engineering',
          business: 'Business',
          humanities: 'Humanities',
          peerReview: 'Peer Feedback',
        };
        const newHistItem: RecentQuestionItem = {
          id: `rq-${Date.now()}`,
          question: messageContent,
          answer: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          dateStr: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
          category: categoryLabels[activeCategory] || 'General',
          sources: data.sources || [],
          usedSearch: willSearch,
        };
        setRecentQuestions((prev) => {
          const filtered = prev.filter(
            (q) => q.question.toLowerCase().trim() !== messageContent.toLowerCase().trim()
          );
          const updated = [newHistItem, ...filtered].slice(0, 30);
          try {
            localStorage.setItem('speakmate_recent_questions', JSON.stringify(updated));
          } catch (e) {
            console.warn('Failed to save to localStorage:', e);
          }
          return updated;
        });

        // Auto-play voice explanation if enabled
        if (autoReadVoice) {
          setTimeout(() => {
            handlePlayVoice(botMessage.id, data.reply);
          }, 350);
        }
      } else {
        const fallbackMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'model',
          text: `### 💡 Analysis for "${messageContent}"

**Direct Overview:**
When answering this topic in technical interviews, clarify the fundamental invariant first, detail the operational mechanics, and address time/space trade-offs.

**How to Structure This Answer:**
1. **Plain Concept:** Define what "${messageContent}" solves and why it is used over simpler alternatives.
2. **Step-by-Step Mechanics:** Walk through the algorithm flow or architectural data lifecycle with sample input.
3. **Edge Cases & Big-O:** Always state best/worst case complexities and concurrency or memory boundaries.

*You can submit this question again or launch Voice Call above to discuss it live.*`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, fallbackMessage]);

        // Save fallback to recent questions
        const newHistItem: RecentQuestionItem = {
          id: `rq-${Date.now()}`,
          question: messageContent,
          answer: fallbackMessage.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          dateStr: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
          category: 'General',
        };
        setRecentQuestions((prev) => {
          const filtered = prev.filter(
            (q) => q.question.toLowerCase().trim() !== messageContent.toLowerCase().trim()
          );
          const updated = [newHistItem, ...filtered].slice(0, 30);
          try {
            localStorage.setItem('speakmate_recent_questions', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    } catch (_networkError) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-fallback-${Date.now()}`,
          role: 'model',
          text: `### ⚠️ Connection Reconnect
A temporary network delay occurred while connecting to the assistant. Please press send again — our academic assistant will provide the complete step-by-step breakdown for **"${messageContent}"**.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `msg-${Date.now()}`,
        role: 'model',
        text: `**Conversation refreshed.** What technical or communication doubt would you like to clarify?`,
        timestamp: 'Just now',
      },
    ]);
  };

  return (
    <>
      {/* Floating Trigger Button in Bottom-Right */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Ask SpeakMate Academic Assistant"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-[#20f5a2] to-[#00bfff] text-[#00131c] font-bold text-xs sm:text-sm shadow-[0_8px_30px_rgba(0,210,255,0.4)] hover:shadow-[0_12px_40px_rgba(32,245,162,0.6)] hover:scale-105 active:scale-95 transition-all cursor-pointer group"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-[#00131c]" />
            <span className="w-2 h-2 rounded-full bg-emerald-950 absolute -top-0.5 -right-0.5 border border-white animate-pulse" />
          </div>
          <span>Live Academic AI</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#00131c] text-[#20f5a2] font-extrabold uppercase">
            AI
          </span>
        </button>
      )}

      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[95vw] sm:w-[480px] h-[620px] max-h-[90vh] rounded-3xl border border-[rgba(0,210,255,0.35)] bg-gradient-to-b from-[rgba(8,38,60,0.98)] to-[rgba(2,12,24,0.99)] shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col overflow-hidden text-white animate-in slide-in-from-bottom-5 zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-[rgba(0,210,255,0.18)] bg-[rgba(2,18,34,0.85)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#20f5a2] to-[#00aaff] flex items-center justify-center text-[#00131c] font-bold shadow-[0_0_15px_rgba(32,245,162,0.4)]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">SpeakMate Academic &amp; Peer Mentor</h3>
                  <span className="flex items-center gap-1 text-[9px] font-bold text-[#20f5a2] bg-[#20f5a2]/10 px-2 py-0.5 rounded-full border border-[#20f5a2]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#20f5a2] animate-pulse" />
                    ALL BRANCHES
                  </span>
                </div>
                <p className="text-[10px] text-[#7ea0b5]">Universal Tutor · Peer Feedback · Live Voice</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Recent Questions History Toggle */}
              <button
                type="button"
                onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                title="View Recent Questions History"
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  showHistoryPanel
                    ? 'border-[#20f5a2] bg-[#20f5a2]/20 text-[#20f5a2] shadow-[0_0_12px_rgba(32,245,162,0.3)]'
                    : 'border-[rgba(0,210,255,0.3)] bg-[rgba(0,210,255,0.08)] hover:bg-[rgba(0,210,255,0.18)] text-[#a5d2eb]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Recent</span>
                {recentQuestions.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#20f5a2] text-[#00131c] text-[9.5px] font-extrabold flex items-center justify-center">
                    {recentQuestions.length}
                  </span>
                )}
              </button>

              {/* Launch Live Voice Coach Button (gemini-3.8-live) */}
              <button
                type="button"
                onClick={() => setIsVoiceModalOpen(true)}
                title="Start Real-Time Voice Conversation (gemini-3.8-live)"
                className="px-2.5 py-1.5 rounded-xl border border-[#20f5a2]/40 bg-[#20f5a2]/10 hover:bg-[#20f5a2]/20 text-[#20f5a2] text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(32,245,162,0.2)]"
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Voice Call</span>
              </button>

              <button
                type="button"
                onClick={handleClearHistory}
                title="Clear conversation"
                className="p-1.5 rounded-lg text-[#6e8e9f] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize assistant"
                className="p-1.5 rounded-lg text-[#6e8e9f] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Discipline Category Tabs Bar */}
          <div className="px-3 py-1.5 bg-[rgba(1,15,30,0.95)] border-b border-[rgba(0,210,255,0.12)] flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-[#20f5a2]/20 text-[#20f5a2] border border-[#20f5a2]/40'
                  : 'text-[#8daab9] hover:text-white hover:bg-white/5'
              }`}
            >
              🌟 All Branches
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('sciences')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === 'sciences'
                  ? 'bg-[#00cfff]/20 text-[#00cfff] border border-[#00cfff]/40'
                  : 'text-[#8daab9] hover:text-white hover:bg-white/5'
              }`}
            >
              🔬 Sciences &amp; Math
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('engineering')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === 'engineering'
                  ? 'bg-[#ffb020]/20 text-[#ffb020] border border-[#ffb020]/40'
                  : 'text-[#8daab9] hover:text-white hover:bg-white/5'
              }`}
            >
              ⚙️ Engineering
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('business')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === 'business'
                  ? 'bg-[#a78bfa]/20 text-[#c4b5fd] border border-[#a78bfa]/40'
                  : 'text-[#8daab9] hover:text-white hover:bg-white/5'
              }`}
            >
              📊 Business &amp; Econ
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('humanities')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === 'humanities'
                  ? 'bg-[#ec4899]/20 text-[#f472b6] border border-[#ec4899]/40'
                  : 'text-[#8daab9] hover:text-white hover:bg-white/5'
              }`}
            >
              🧠 Humanities &amp; Law
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('peerReview')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === 'peerReview'
                  ? 'bg-[#10b981]/25 text-[#34d399] border border-[#10b981]/50 shadow-[0_0_10px_rgba(16,185,129,0.3)] font-bold'
                  : 'text-[#34d399] hover:bg-[#10b981]/10'
              }`}
            >
              🤝 Peer Feedback
            </button>
          </div>

          {/* Search Grounding & Voice Explanation Control Bar */}
          <div className="px-3.5 py-1.5 bg-[rgba(1,15,30,0.85)] border-b border-[rgba(0,210,255,0.12)] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Globe className={`w-3.5 h-3.5 ${useSearchGrounding ? 'text-[#00cfff]' : 'text-[#6e8e9f]'}`} />
              <span className="text-[11px] text-[#a4c5d7]">
                Google Search
              </span>
              <button
                type="button"
                onClick={() => setUseSearchGrounding(!useSearchGrounding)}
                className={`px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase transition-all cursor-pointer border ${
                  useSearchGrounding
                    ? 'bg-[#00cfff]/20 text-[#00cfff] border-[#00cfff]/40 shadow-[0_0_10px_rgba(0,207,255,0.3)]'
                    : 'bg-white/5 text-[#738f9f] border-white/10 hover:text-white'
                }`}
              >
                {useSearchGrounding ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Auto Voice Explanation Option Toggle */}
            <div className="flex items-center gap-1.5">
              <Mic className={`w-3.5 h-3.5 ${autoReadVoice ? 'text-[#20f5a2]' : 'text-[#6e8e9f]'}`} />
              <span className="text-[11px] text-[#a4c5d7]">
                🎙️ Auto Voice Explanations
              </span>
              <button
                type="button"
                onClick={() => setAutoReadVoice(!autoReadVoice)}
                title="When ON, SpeakMate will automatically speak voice explanations for each answer"
                className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase transition-all cursor-pointer border ${
                  autoReadVoice
                    ? 'bg-[#20f5a2]/25 text-[#20f5a2] border-[#20f5a2]/50 shadow-[0_0_10px_rgba(32,245,162,0.4)]'
                    : 'bg-white/5 text-[#738f9f] border-white/10 hover:text-white'
                }`}
              >
                {autoReadVoice ? 'AUTO ON' : 'OFF'}
              </button>
            </div>

            {/* Male Voice Persona Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] text-[#738f9f] font-medium">Voice:</span>
              <div className="flex items-center bg-[rgba(1,10,20,0.85)] rounded-lg p-0.5 border border-[rgba(0,210,255,0.2)]">
                <button
                  type="button"
                  onClick={() => setSelectedVoicePersona('Charon')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    selectedVoicePersona === 'Charon'
                      ? 'bg-[#00cfff]/25 text-[#00cfff] shadow-[0_0_8px_rgba(0,207,255,0.3)]'
                      : 'text-[#7ea0b5] hover:text-white'
                  }`}
                  title="Charon: Articulate, clear, and calm deep male academic mentor voice (Recommended)"
                >
                  Charon (Articulate)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVoicePersona('Fenrir')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    selectedVoicePersona === 'Fenrir'
                      ? 'bg-[#20f5a2]/25 text-[#20f5a2] shadow-[0_0_8px_rgba(32,245,162,0.3)]'
                      : 'text-[#7ea0b5] hover:text-white'
                  }`}
                  title="Fenrir: Deep, warm, resonant baritone male voice"
                >
                  Fenrir (Deep)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVoicePersona('Zephyr')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    selectedVoicePersona === 'Zephyr'
                      ? 'bg-[#a78bfa]/25 text-[#c4b5fd] shadow-[0_0_8px_rgba(167,139,250,0.3)]'
                      : 'text-[#7ea0b5] hover:text-white'
                  }`}
                  title="Zephyr: Smooth, gentle, calm balanced male voice"
                >
                  Zephyr (Smooth)
                </button>
              </div>
            </div>
          </div>

          {/* Sticky Active Voice Explanation Player (shown when any answer is actively speaking) */}
          {playingMessageId && (
            <div className="px-4 py-2 bg-gradient-to-r from-[rgba(2,24,40,0.98)] via-[rgba(1,18,34,0.95)] to-[rgba(2,24,40,0.98)] border-b border-[#20f5a2]/40 shadow-[0_4px_20px_rgba(32,245,162,0.18)] flex items-center justify-between text-xs animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-[#20f5a2]/20 flex items-center justify-center text-[#20f5a2] shadow-[0_0_10px_rgba(32,245,162,0.3)]">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-[11px]">
                      🎙️ Speaking Male Voice ({selectedVoicePersona} - Articulate & Deep)
                    </span>
                    {!isVoicePaused && (
                      <span className="flex items-center gap-0.5">
                        <span className="w-1 h-3 bg-[#20f5a2] rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1 h-4 bg-[#00cfff] rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1 h-2.5 bg-[#20f5a2] rounded-full animate-bounce [animation-delay:300ms]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#7ea0b5]">
                    {isVoicePaused ? 'Voice explanation paused' : 'Voice explanation actively playing aloud'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (playingMessageId) {
                      const msg = messages.find((m) => m.id === playingMessageId);
                      if (msg) handlePlayVoice(msg.id, msg.text);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {isVoicePaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
                  <span>{isVoicePaused ? 'Resume' : 'Pause'}</span>
                </button>
                <button
                  type="button"
                  onClick={cycleVoiceSpeed}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white cursor-pointer"
                  title="Voice Speed"
                >
                  {voiceSpeed}x
                </button>
                <button
                  type="button"
                  onClick={handleStopVoice}
                  className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 cursor-pointer transition-colors"
                  title="Stop Speech"
                >
                  <Square className="w-3 h-3 fill-current" />
                </button>
              </div>
            </div>
          )}

          {/* Main Body Area: Recent Questions History Panel vs Active Chat Messages */}
          {showHistoryPanel ? (
            <div className="flex-1 overflow-hidden flex flex-col bg-[rgba(1,14,28,0.98)] text-white">
              {/* History Panel Sub-Header */}
              <div className="px-4 py-2.5 bg-[rgba(2,22,40,0.95)] border-b border-[rgba(0,210,255,0.18)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHistoryPanel(false)}
                    className="px-2 py-1 rounded-lg text-[#7ea0b5] hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                    title="Back to active conversation"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Chat</span>
                  </button>
                  <span className="text-[#3b5e72]">|</span>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <History className="w-3.5 h-3.5 text-[#20f5a2]" />
                    <span>Recent Questions</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[9.5px] bg-[#20f5a2]/15 text-[#20f5a2] border border-[#20f5a2]/30 font-bold">
                      {recentQuestions.length}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {recentQuestions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllHistory}
                      className="text-[10px] font-semibold text-rose-300 hover:text-rose-100 px-2 py-0.5 rounded-lg hover:bg-rose-500/20 transition-colors flex items-center gap-1 cursor-pointer border border-rose-500/20"
                      title="Clear all question history"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear All</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowHistoryPanel(false)}
                    className="p-1 text-[#7ea0b5] hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
                    title="Close history panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search & Category Filter Toolbar */}
              <div className="p-3 bg-[rgba(1,18,34,0.85)] border-b border-[rgba(0,210,255,0.12)] space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#6e8e9f] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Search past questions, explanations, or concepts..."
                    className="w-full h-8 pl-8 pr-8 rounded-xl bg-[rgba(1,12,24,0.9)] border border-[rgba(0,210,255,0.22)] text-white text-xs placeholder-[#608092] focus:outline-none focus:border-[#20f5a2]"
                  />
                  {historySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7ea0b5] hover:text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[10.5px]">
                  {['all', 'Engineering', 'Sciences', 'Business', 'Humanities', 'Peer Feedback'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setHistoryCategoryFilter(cat)}
                      className={`px-2 py-0.5 rounded-lg whitespace-nowrap font-medium transition-colors cursor-pointer ${
                        historyCategoryFilter === cat
                          ? 'bg-[#20f5a2]/20 text-[#20f5a2] border border-[#20f5a2]/40 font-bold'
                          : 'text-[#7ea0b5] hover:text-white bg-white/5 border border-white/5'
                      }`}
                    >
                      {cat === 'all' ? 'All Questions' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Questions List */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                {filteredQuestions.length === 0 ? (
                  <div className="text-center py-10 px-4 space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-[#20f5a2]/10 border border-[#20f5a2]/20 flex items-center justify-center text-[#20f5a2]">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {historySearchQuery ? 'No matching questions found' : 'No question history yet'}
                      </h4>
                      <p className="text-[11px] text-[#7ea0b5] max-w-xs mx-auto mt-1">
                        {historySearchQuery
                          ? `No past explanations match "${historySearchQuery}". Try clearing search or asking a new question!`
                          : 'Ask SpeakMate any conceptual doubt or peer review question. Your answers and voice explanations will be preserved here for rapid recall!'}
                      </p>
                    </div>
                    {historySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setHistorySearchQuery('')}
                        className="text-[11px] text-[#20f5a2] underline font-semibold cursor-pointer"
                      >
                        Clear search query
                      </button>
                    )}
                  </div>
                ) : (
                  filteredQuestions.map((item) => {
                    const isExpanded = expandedQuestionId === item.id;
                    const isPlayingThis = playingMessageId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl border border-[rgba(0,210,255,0.22)] bg-gradient-to-b from-[rgba(2,24,42,0.85)] to-[rgba(1,16,30,0.92)] shadow-md hover:border-[#20f5a2]/50 transition-all space-y-2.5"
                      >
                        {/* Question Card Top Meta */}
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full font-bold bg-[#00cfff]/15 text-[#00cfff] border border-[#00cfff]/30">
                              {item.category || 'General'}
                            </span>
                            <span className="text-[#6e8e9f] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {item.timestamp}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecentQuestion(item.id)}
                            title="Remove this question from history"
                            className="p-1 rounded text-[#5e7e91] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Question Text */}
                        <h4
                          onClick={() => setExpandedQuestionId(isExpanded ? null : item.id)}
                          className="text-xs font-bold text-white hover:text-[#20f5a2] cursor-pointer transition-colors leading-snug flex items-start justify-between gap-2"
                        >
                          <span>{item.question}</span>
                          <ChevronRight
                            className={`w-3.5 h-3.5 text-[#20f5a2] shrink-0 mt-0.5 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </h4>

                        {/* Explanation Content (Collapsed snippet or Full formatted) */}
                        <div className="text-[11px] text-[#c9dfed] leading-relaxed bg-[rgba(1,12,24,0.6)] p-2.5 rounded-xl border border-[rgba(0,210,255,0.12)]">
                          {isExpanded ? (
                            <div className="space-y-2.5">
                              <FormattedMessage text={item.answer} />

                              {/* Interactive Conceptual Diagram in History */}
                              {item.diagram && (
                                <div className="mt-2.5 pt-2 border-t border-[rgba(0,210,255,0.15)]">
                                  <DiagramViewer
                                    code={item.diagram.code}
                                    type={item.diagram.type}
                                    title={item.diagram.title}
                                    description={item.diagram.description}
                                    keyComponents={item.diagram.keyComponents}
                                  />
                                </div>
                              )}

                              {item.sources && item.sources.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-[rgba(0,210,255,0.15)] space-y-1">
                                  <span className="text-[9.5px] font-bold text-[#20f5a2] uppercase">
                                    Sources:
                                  </span>
                                  {item.sources.map((s, sIdx) => (
                                    <a
                                      key={sIdx}
                                      href={s.uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block text-[10px] text-[#00cfff] hover:underline truncate"
                                    >
                                      {s.title || s.uri}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="line-clamp-2 text-[#9bbacf]">
                                {item.answer
                                  .replace(/```[\s\S]*?```/g, '')
                                  .replace(/[#*`]/g, '')
                                  .slice(0, 140)}
                                ...
                              </p>
                              {item.diagram && (
                                <div className="flex items-center gap-1 text-[10px] text-[#00d2ff] font-semibold pt-0.5">
                                  <Layers className="w-3 h-3" />
                                  <span>Visual Diagram attached (click to expand)</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons Row */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Male Voice Explanation Play Button */}
                            <button
                              type="button"
                              onClick={() => handlePlayVoice(item.id, item.answer)}
                              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                isPlayingThis
                                  ? 'bg-[#20f5a2] text-[#00131c] shadow-[0_0_10px_rgba(32,245,162,0.4)]'
                                  : 'bg-[#20f5a2]/15 text-[#20f5a2] border border-[#20f5a2]/35 hover:bg-[#20f5a2]/25'
                              }`}
                            >
                              {isPlayingThis ? (
                                <Pause className="w-3 h-3 fill-current" />
                              ) : (
                                <Play className="w-3 h-3 fill-current" />
                              )}
                              <span>{isPlayingThis ? 'Male Voice Playing' : '🎙️ Male Voice'}</span>
                            </button>

                            {/* Toggle Full Explanation */}
                            <button
                              type="button"
                              onClick={() => setExpandedQuestionId(isExpanded ? null : item.id)}
                              className="px-2 py-1 rounded-lg text-[10.5px] text-[#8eaec1] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              {isExpanded ? 'Collapse' : 'Read Full'}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Reopen in Chat */}
                            <button
                              type="button"
                              onClick={() => handleReopenInChat(item)}
                              title="View this question in the main chat"
                              className="px-2.5 py-1 rounded-lg text-[10.5px] font-semibold text-[#00cfff] bg-[#00cfff]/10 hover:bg-[#00cfff]/20 border border-[#00cfff]/30 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>In Chat</span>
                            </button>

                            {/* Ask Follow-up */}
                            <button
                              type="button"
                              onClick={() => handleAskFollowUp(item)}
                              title="Ask a follow-up doubt on this topic"
                              className="px-2 py-1 rounded-lg text-[10.5px] font-semibold text-[#ffb020] bg-[#ffb020]/10 hover:bg-[#ffb020]/20 border border-[#ffb020]/30 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Lightbulb className="w-3 h-3" />
                              <span>Follow-Up</span>
                            </button>

                            {/* Copy */}
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyHistory(`${item.question}\n\n${item.answer}`, item.id)
                              }
                              title="Copy question and explanation"
                              className="p-1 rounded-lg text-[#7ea0b5] hover:text-[#20f5a2] hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              {copiedHistoryId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-[#20f5a2]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Quick Questions Chips */}
          <div className="px-4 py-2 bg-[rgba(1,15,30,0.65)] border-b border-[rgba(0,210,255,0.1)] overflow-x-auto scrollbar-none flex gap-2">
            {currentPrompts.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(item.prompt, item.search)}
                disabled={isThinking}
                className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-full bg-[rgba(0,210,255,0.08)] border border-[rgba(0,210,255,0.2)] text-[#a3c9dc] hover:text-[#20f5a2] hover:border-[#20f5a2] hover:bg-[rgba(32,245,162,0.08)] transition-all cursor-pointer disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {messages.map((msg) => {
              const isBot = msg.role === 'model';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${isBot ? 'items-start' : 'items-start flex-row-reverse'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isBot
                        ? 'bg-gradient-to-br from-[#20f5a2] to-[#00aaff] text-[#00131c]'
                        : 'bg-[rgba(0,180,255,0.25)] text-white border border-[rgba(0,210,255,0.3)]'
                    }`}
                  >
                    {isBot ? <Bot className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[88%] p-4 rounded-2xl ${
                      isBot
                        ? 'bg-[rgba(2,24,40,0.85)] border border-[rgba(0,210,255,0.22)] shadow-md text-[#e2edf5]'
                        : 'bg-gradient-to-r from-[rgba(32,245,162,0.2)] to-[rgba(0,170,255,0.25)] border border-[rgba(32,245,162,0.4)] text-white'
                    }`}
                  >
                    {isBot ? (
                      <div>
                        <FormattedMessage text={msg.text} />

                        {/* Interactive Conceptual Visual Diagram (MermaidJS or SVG) */}
                        {msg.diagram && (
                          <div className="mt-3.5 pt-2">
                            <DiagramViewer
                              code={msg.diagram.code}
                              type={msg.diagram.type}
                              title={msg.diagram.title}
                              description={msg.diagram.description}
                              keyComponents={msg.diagram.keyComponents}
                            />
                          </div>
                        )}

                        {/* Display Google Search Grounding Sources */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-[rgba(0,210,255,0.18)] space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#20f5a2] uppercase tracking-wider">
                              <Globe className="w-3 h-3" />
                              <span>Google Search Sources ({msg.sources.length})</span>
                            </div>
                            <div className="space-y-1">
                              {msg.sources.map((s, sIdx) => (
                                <a
                                  key={sIdx}
                                  href={s.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-[10.5px] text-[#00cfff] hover:underline truncate"
                                >
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{s.title || s.uri}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Multi-modal Action Bar: Male Voice Explanation & Conceptual Diagram */}
                        <div className="mt-3.5 pt-2.5 border-t border-[rgba(0,210,255,0.18)] flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Male Voice Explanation Button */}
                            <button
                              type="button"
                              onClick={() => handlePlayVoice(msg.id, msg.text)}
                              disabled={isLoadingVoiceId === msg.id}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-md ${
                                playingMessageId === msg.id
                                  ? 'bg-gradient-to-r from-[#20f5a2] to-[#00cfff] text-[#00131c] shadow-[0_0_15px_rgba(32,245,162,0.4)]'
                                  : 'bg-[#20f5a2]/15 hover:bg-[#20f5a2]/25 text-[#20f5a2] border border-[#20f5a2]/40 hover:border-[#20f5a2]/70'
                              }`}
                              title={`Click to hear deep, articulate male voice explanation (${selectedVoicePersona}) of this answer`}
                            >
                              {isLoadingVoiceId === msg.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Generating Male Voice ({selectedVoicePersona})...</span>
                                </>
                              ) : playingMessageId === msg.id ? (
                                <>
                                  {isVoicePaused ? (
                                    <>
                                      <Play className="w-3.5 h-3.5 fill-current" />
                                      <span>Resume Male Voice</span>
                                    </>
                                  ) : (
                                    <>
                                      <Pause className="w-3.5 h-3.5 fill-current" />
                                      <span>Pause Male Voice</span>
                                      <span className="flex items-center gap-0.5 ml-1">
                                        <span className="w-1 h-3 bg-[#00131c] rounded-full animate-bounce [animation-delay:0ms]" />
                                        <span className="w-1 h-4 bg-[#00131c] rounded-full animate-bounce [animation-delay:150ms]" />
                                        <span className="w-1 h-2 bg-[#00131c] rounded-full animate-bounce [animation-delay:300ms]" />
                                      </span>
                                    </>
                                  )}
                                </>
                              ) : (
                                <>
                                  <Mic className="w-3.5 h-3.5 text-[#20f5a2]" />
                                  <span>🎙️ Male Voice ({selectedVoicePersona})</span>
                                </>
                              )}
                            </button>

                            {/* Conceptual Diagram Generator Button (MermaidJS / SVG) */}
                            <button
                              type="button"
                              onClick={() => handleGenerateDiagram(msg.id, msg.text)}
                              disabled={msg.isGeneratingDiagram}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-md ${
                                msg.diagram
                                  ? 'bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/50 hover:bg-[#00d2ff]/30'
                                  : 'bg-[#00d2ff]/10 hover:bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/30 hover:border-[#00d2ff]/60'
                              }`}
                              title="Generate interactive MermaidJS or SVG conceptual visualization using Gemini"
                            >
                              {msg.isGeneratingDiagram ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00d2ff]" />
                                  <span>Visualizing with Gemini...</span>
                                </>
                              ) : (
                                <>
                                  <Layers className="w-3.5 h-3.5 text-[#00d2ff]" />
                                  <span>{msg.diagram ? '🔄 Regenerate Diagram' : '📊 Visualize Concept (Diagram)'}</span>
                                </>
                              )}
                            </button>

                            {playingMessageId === msg.id && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={handleStopVoice}
                                  title="Stop voice explanation"
                                  className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 cursor-pointer transition-colors"
                                >
                                  <Square className="w-3 h-3 fill-current" />
                                </button>
                                <button
                                  type="button"
                                  onClick={cycleVoiceSpeed}
                                  title="Change voice speed"
                                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-white border border-white/15 cursor-pointer"
                                >
                                  {voiceSpeed}x
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[9.5px] text-[#69889a]">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.text, msg.id)}
                              title="Copy explanation text"
                              className="hover:text-white transition-colors cursor-pointer"
                            >
                              {copiedId === msg.id ? '✓ Copied' : '📋 Copy'}
                            </button>
                            <span>{msg.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {msg.text}
                        {msg.usedSearch && (
                          <div className="mt-1 flex items-center gap-1 text-[9.5px] text-[#00cfff]">
                            <Globe className="w-3 h-3" />
                            <span>Grounded with Google Search</span>
                          </div>
                        )}
                        <div className="text-[9px] text-[#69889a] mt-2 text-right">
                          {msg.timestamp}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isThinking && (
              <div className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#20f5a2] to-[#00aaff] text-[#00131c] flex items-center justify-center font-bold text-xs shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-3.5 rounded-2xl bg-[rgba(2,24,40,0.85)] border border-[rgba(0,210,255,0.2)] text-[#a5c5d7] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#20f5a2] animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00cfff] animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#20f5a2] animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[11px] ml-1">
                    {useSearchGrounding ? 'Retrieving fresh Google Search data...' : 'Formulating structured academic explanation...'}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
            </>
          )}

          {/* Input Footer */}
          <div className="p-3.5 bg-[rgba(2,18,34,0.92)] border-t border-[rgba(0,210,255,0.18)]">
            {/* Quick Action Helpers */}
            <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-none pb-0.5">
              <button
                type="button"
                onClick={() => {
                  setInputText('Generate an interactive conceptual visual diagram (Mermaid/SVG) explaining: ');
                }}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-[#00d2ff]/15 hover:bg-[#00d2ff]/25 text-[#00d2ff] border border-[#00d2ff]/35 flex items-center gap-1 font-semibold whitespace-nowrap cursor-pointer transition-colors shadow-[0_0_8px_rgba(0,210,255,0.2)]"
              >
                📊 Generate Concept Diagram
              </button>
              <button
                type="button"
                onClick={() => {
                  setAutoReadVoice(true);
                  setInputText('Explain this topic and provide male voice explanation: ');
                }}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-[#20f5a2]/15 hover:bg-[#20f5a2]/25 text-[#20f5a2] border border-[#20f5a2]/35 flex items-center gap-1 font-semibold whitespace-nowrap cursor-pointer transition-colors shadow-[0_0_8px_rgba(32,245,162,0.2)]"
              >
                🎙️ Male Voice Mode (Charon)
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputText('Please give peer feedback, rating, and suggestions on my answer: ""');
                }}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#34d399] border border-[#10b981]/30 flex items-center gap-1 font-semibold whitespace-nowrap cursor-pointer transition-colors"
              >
                🤝 Review My Answer
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputText('Explain the concept of ');
                }}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-[rgba(0,210,255,0.1)] hover:bg-[rgba(0,210,255,0.2)] text-[#a3c9dc] border border-[rgba(0,210,255,0.2)] flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
              >
                💡 Explain Any Concept
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputText('Ask me a challenging interview/exam question for my branch and provide peer critique on my response');
                }}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-[#a78bfa]/15 hover:bg-[#a78bfa]/25 text-[#c4b5fd] border border-[#a78bfa]/30 flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
              >
                🎯 Mock Question &amp; Feedback
              </button>
            </div>

            {/* Microphone Listening Active Banner */}
            {isListening && (
              <div className="mb-2 p-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-[11px] flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 text-red-400 animate-ping" />
                  <span className="font-semibold">Microphone active: Listening to your question... Speak clearly</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleListening}
                  className="text-[10px] font-bold underline hover:text-white cursor-pointer"
                >
                  Done speaking
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={useSearchGrounding ? "Ask any topic with live Google Search grounding..." : "Ask any subject topic, paste answer for peer review, or click Mic..."}
                className="flex-1 h-10 px-3.5 rounded-xl bg-[rgba(1,15,30,0.9)] border border-[rgba(0,210,255,0.25)] text-white text-xs focus:outline-none focus:border-[#20f5a2] focus:ring-1 focus:ring-[#20f5a2]"
              />

              {/* Microphone Voice Dictation Button */}
              <button
                type="button"
                onClick={handleToggleListening}
                title={isListening ? "Listening... click to stop" : "Speak your question via Microphone"}
                className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                  isListening
                    ? 'bg-red-500 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse'
                    : 'bg-[rgba(0,210,255,0.12)] hover:bg-[rgba(0,210,255,0.22)] text-[#00cfff] border-[rgba(0,210,255,0.25)] hover:border-[#00cfff]'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span className="hidden sm:inline">{isListening ? 'Listening...' : 'Voice'}</span>
              </button>

              <button
                type="submit"
                disabled={isThinking || !inputText.trim()}
                className="h-10 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-[#20f5a2] to-[#00aaff] text-[#00131c] shadow-[0_0_15px_rgba(0,210,255,0.3)] hover:shadow-[0_0_20px_rgba(32,245,162,0.5)] disabled:opacity-40 transition-all flex items-center justify-center cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-[10px] text-[#5e7e91] text-center mt-1.5">
              🎙️ Microphone Voice Explanations · Universal Branch Tutor · Peer Review &amp; Suggestions
            </p>
          </div>
        </div>
      )}

      {/* Real-Time Live Voice Interview Coach Modal (gemini-3.8-live) */}
      <LiveVoiceCoachModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        studentName={user?.fullName || 'Student'}
      />
    </>
  );
};
