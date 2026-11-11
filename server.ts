import express from 'express';
import type { Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Global shared GoogleGenAI client with standard telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Robust model fallback handler prioritizing fast, high-availability models with retry backoff
async function generateWithModelFallback(params: {
  contents: any;
  config?: any;
  preferredModels?: string[];
}): Promise<{ text: string; response: any; model: string }> {
  // Use gemini-3.8-flash as primary workhorse, with fallback to gemini-3.1-flash-lite and gemini-flash-latest
  const candidateModels = params.preferredModels && params.preferredModels.length > 0
    ? params.preferredModels
    : ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        if (response && typeof response.text === 'string' && response.text.trim()) {
          return { text: response.text, response, model };
        }
      } catch (err: any) {
        const errMsg = typeof err?.message === 'string' ? err.message : '';
        const isQuotaOrDemand = errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('429') || errMsg.includes('resource_exhausted') || errMsg.includes('quota');
        if (isQuotaOrDemand && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 150));
        } else {
          break;
        }
      }
    }
  }
  throw new Error('All AI models temporarily at capacity or quota exhausted');
}

// Multilingual language detection helper for Fluencis Academic Mentor
function detectLanguage(text: string, preferredLang?: string): string {
  if (preferredLang && preferredLang.toLowerCase() !== 'auto') {
    const p = preferredLang.toLowerCase();
    if (p.includes('telugu') || p === 'te') return 'Telugu';
    if (p.includes('hindi') || p === 'hi') return 'Hindi';
    if (p.includes('tamil') || p === 'ta') return 'Tamil';
    if (p.includes('german') || p === 'de' || p.includes('deutsch')) return 'German';
    if (p.includes('malayalam') || p === 'ml') return 'Malayalam';
    if (p.includes('kannada') || p === 'kn') return 'Kannada';
    if (p.includes('english') || p === 'en') return 'English';
  }
  const str = text || '';
  if (/[\u0C00-\u0C7F]/.test(str) || /\b(cheppu|gurinchi|ante enti|ardham|telugu|ela|endi|enti|baga|telugulo)\b/i.test(str)) return 'Telugu';
  if (/[\u0900-\u097F]/.test(str) || /\b(batao|kya hai|kaise|hindi|samjhao|kariye|kya hota|hindime)\b/i.test(str)) return 'Hindi';
  if (/[\u0B80-\u0BFF]/.test(str) || /\b(sollunga|tamil|patthi|enna|eppadi|puriyala|tamilla)\b/i.test(str)) return 'Tamil';
  if (/[\u0D00-\u0D7F]/.test(str) || /\b(parayu|enthanu|engane|malayalam|kurichu|ariyumo|malayalamil)\b/i.test(str)) return 'Malayalam';
  if (/[\u0C80-\u0CFF]/.test(str) || /\b(heli|enu|hege|kannada|bagge|artha|kannadadalli)\b/i.test(str)) return 'Kannada';
  if (/\b(erkläre|warum|wie funktioniert|deutsch|wissenschaft|algorithmus|bitte)\b/i.test(str) || /[äöüß]/i.test(str)) return 'German';
  return 'English';
}

const app = express();
const httpServer = createServer(app);

// Robust command line and env port parsing
let portFromArg: number | null = null;
for (let i = 0; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--port' && process.argv[i + 1]) {
    portFromArg = parseInt(process.argv[i + 1], 10);
  } else if (arg.startsWith('--port=')) {
    portFromArg = parseInt(arg.split('=')[1], 10);
  }
}
const PORT = portFromArg || (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

process.on('uncaughtException', (err) => {
  console.error('[Fluencis Server] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fluencis Server] Unhandled rejection at:', promise, 'reason:', reason);
});

app.use(express.json());

// Fast healthcheck for platform probes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// In-memory real-time state for Fluencis
interface Participant {
  socketId: string;
  name: string;
  initial: string;
  role: 'Host' | 'Participant' | 'Invited';
  level: string;
  goal: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isHandRaised?: boolean;
  joinedAt: number;
}

interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
}

interface ChatMessage {
  id: string;
  sender: string;
  senderId: string;
  initial: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
  type?: 'message' | 'prompt' | 'system' | 'question';
  channelId?: string;
  reactions?: MessageReaction[];
}

interface Room {
  id: string;
  type: 'public' | 'private';
  mode: string;
  host: string;
  capacity: number;
  participants: Participant[];
  createdAt: string;
  chatMessages: ChatMessage[];
  locked?: boolean;
}

const onlineStudents = new Map<string, { socketId: string; name: string; mode: string; level: string; goal: string; status: 'AVAILABLE' | 'IN_ROOM' }>();
const rooms = new Map<string, Room>();
const roomCleanupTimers = new Map<string, NodeJS.Timeout>();

function cancelRoomCleanup(roomId: string) {
  const timer = roomCleanupTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    roomCleanupTimers.delete(roomId);
  }
}

function scheduleRoomCleanup(roomId: string) {
  cancelRoomCleanup(roomId);
  const timer = setTimeout(() => {
    roomCleanupTimers.delete(roomId);
    const room = findRoomById(roomId);
    if (room && room.participants.length === 0) {
      rooms.delete(room.id);
      io.emit('public-rooms', getPublicRoomsList());
      console.log(`[Socket] Room ${room.id} cleaned up after grace period`);
    }
  }, 90000); // 90 seconds grace period
  roomCleanupTimers.set(roomId, timer);
}

// Case-insensitive room finder helper
function findRoomById(id: string): Room | undefined {
  if (!id) return undefined;
  const clean = id.trim();
  if (rooms.has(clean)) return rooms.get(clean);
  const lower = clean.toLowerCase();
  for (const [key, value] of rooms.entries()) {
    if (key.toLowerCase() === lower) {
      return value;
    }
  }
  return undefined;
}

// Global community chat room so all students can communicate in real time across the platform
const communityChatMessages: ChatMessage[] = [
  {
    id: 'comm-welcome-1',
    sender: 'Fluencis Bot',
    senderId: 'system',
    initial: 'S',
    text: 'Welcome to the Fluencis Student Community! Share placement questions, find discussion partners, and exchange speaking tips in real time.',
    timestamp: '10:00 AM',
    isSystem: true,
    type: 'system',
    channelId: 'community',
    reactions: [{ emoji: '👋', count: 5, users: ['Admin', 'Sneha', 'Arjun', 'Sai', 'Kiran'] }],
  },
  {
    id: 'comm-welcome-2',
    sender: 'Sneha',
    senderId: 'demo-sneha',
    initial: 'S',
    text: 'Hey everyone! Anyone preparing for technical interviews or STAR method practice today?',
    timestamp: '10:05 AM',
    type: 'message',
    channelId: 'community',
    reactions: [{ emoji: '🚀', count: 3, users: ['Vamsi', 'Arjun', 'Sai'] }],
  }
];

interface PeerFeedbackRecord {
  id: string;
  roomId: string;
  fromStudent: string;
  fromInitial?: string;
  toStudent: string;
  toInitial?: string;
  practiceMode: string;
  durationFormatted: string;
  ratings: {
    clarity: number;
    confidence: number;
    listening: number;
    structure: number;
    overall: number;
  };
  tags: string[];
  constructiveNotes: string;
  encouragement: string;
  aiPolishedNotes?: string;
  createdAt: string;
}

const peerFeedbackRecords: PeerFeedbackRecord[] = [
  {
    id: 'fb-seed-1',
    roomId: 'SM-CSE901',
    fromStudent: 'Sneha R.',
    fromInitial: 'S',
    toStudent: 'Vamsi',
    toInitial: 'V',
    practiceMode: 'General Communication',
    durationFormatted: '15:20',
    ratings: {
      clarity: 5,
      confidence: 4,
      listening: 5,
      structure: 4,
      overall: 5,
    },
    tags: ['Clear Articulation', 'Great Eye Contact', 'Paced Well', 'Active Listener'],
    constructiveNotes: 'Excellent explanation of your engineering projects. Keep practicing your conclusion to summarize the key points naturally!',
    encouragement: 'You speak with strong conviction, very easy to follow!',
    createdAt: 'Today, 4:45 PM',
  },
  {
    id: 'fb-seed-2',
    roomId: 'SM-TECH404',
    fromStudent: 'Arjun K.',
    fromInitial: 'A',
    toStudent: 'Vamsi',
    toInitial: 'V',
    practiceMode: 'Technical Interview',
    durationFormatted: '22:10',
    ratings: {
      clarity: 4,
      confidence: 4,
      listening: 5,
      structure: 4,
      overall: 4,
    },
    tags: ['STAR Method Used', 'Good Depth', 'Engaging Tone'],
    constructiveNotes: 'Very solid understanding of database indexing and APIs. Try cutting down on "basically" when starting new sentences.',
    encouragement: 'Impressive technical knowledge and calm demeanor!',
    createdAt: 'Yesterday, 6:40 PM',
  }
];

// Matchmaking queue
interface QueuedStudent {
  socketId: string;
  name: string;
  mode: string;
  format: string; // 'one-to-one' | 'small-group' | 'team'
  level: string;
  goal: string;
  queuedAt: number;
}
const matchmakingQueue: QueuedStudent[] = [];

// Skill level ranking and similarity computation
function getSkillRank(level?: string): number {
  if (!level) return 2;
  const l = level.toLowerCase();
  if (l.includes('begin') || l.includes('basic') || l.includes('elementary') || l.includes('a1') || l.includes('a2')) return 1;
  if (l.includes('inter') || l.includes('b1') || l.includes('b2')) return 2;
  if (l.includes('adv') || l.includes('c1')) return 3;
  if (l.includes('fluent') || l.includes('native') || l.includes('expert') || l.includes('c2')) return 4;
  return 2;
}

function computeMatchScore(a: { mode: string; level: string }, b: { mode: string; level: string }): {
  isCompatible: boolean;
  score: number;
  reason: string;
} {
  const rankA = getSkillRank(a.level);
  const rankB = getSkillRank(b.level);
  const levelDiff = Math.abs(rankA - rankB);

  // Topics: exact or related
  const modeA = (a.mode || '').toLowerCase().trim();
  const modeB = (b.mode || '').toLowerCase().trim();
  const exactMode = modeA === modeB;
  const relatedMode =
    exactMode ||
    (modeA.includes('interview') && modeB.includes('interview')) ||
    ((modeA.includes('general') || modeA.includes('chit-chat')) &&
      (modeB.includes('general') || modeB.includes('chit-chat')));

  if (!relatedMode && levelDiff > 1) {
    return { isCompatible: false, score: 0, reason: 'Different focus and proficiency levels' };
  }

  // Similar skill level means levelDiff <= 1 (exact or adjacent tier)
  const isSkillSimilar = levelDiff <= 1;
  if (!isSkillSimilar && !exactMode) {
    return { isCompatible: false, score: 0, reason: 'Proficiency levels differ significantly' };
  }

  let baseScore = exactMode ? 50 : 35;
  if (levelDiff === 0) baseScore += 50;
  else if (levelDiff === 1) baseScore += 35;
  else baseScore += 15;

  const score = Math.min(100, Math.max(50, baseScore));
  const reason = exactMode
    ? (levelDiff === 0
        ? `Ideal Match: Both practicing ${a.mode} at ${a.level} level`
        : `Great Match: Complementary levels (${a.level} & ${b.level}) for ${a.mode}`)
    : `Balanced Match: Similar skill levels for ${a.mode}`;

  return { isCompatible: true, score, reason };
}

// Socket.io setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

function getPublicRoomsList() {
  const list: any[] = [];
  rooms.forEach((room) => {
    if (room.type === 'public') {
      list.push({
        id: room.id,
        type: room.type,
        mode: room.mode,
        host: room.host,
        capacity: room.capacity,
        participantCount: room.participants.length,
        participants: room.participants,
        createdAt: room.createdAt,
        locked: room.locked || false,
      });
    }
  });
  return list;
}

function getOnlineStudentsList() {
  return Array.from(onlineStudents.values()).map(s => ({
    name: s.name,
    mode: s.mode,
    level: s.level,
    goal: s.goal,
    status: s.status,
  }));
}

io.on('connection', (socket: Socket) => {
  console.log(`[Socket] Student connected: ${socket.id}`);

  // Register online student
  socket.on('student-online', (data: { name: string; mode?: string; level?: string; goal?: string }) => {
    const student = {
      socketId: socket.id,
      name: data.name || 'Student',
      mode: data.mode || 'General Communication',
      level: data.level || 'Beginner',
      goal: data.goal || 'Career Preparation',
      status: 'AVAILABLE' as const,
    };
    onlineStudents.set(socket.id, student);
    io.emit('online-students', getOnlineStudentsList());
    socket.emit('public-rooms', getPublicRoomsList());
    socket.emit('community-messages', communityChatMessages);
  });

  // Create room
  socket.on('create-room', (data: { id?: string; type: 'public' | 'private'; mode: string; capacity: number; hostName?: string; userProfile?: any }) => {
    const rawId = (data.id || '').trim();
    const roomId = rawId || `SM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const hostName = data.hostName || 'Student';
    const initial = hostName.charAt(0).toUpperCase() || 'S';

    const hostParticipant: Participant = {
      socketId: socket.id,
      name: hostName,
      initial,
      role: 'Host',
      level: data.userProfile?.level || 'Beginner',
      goal: data.userProfile?.goal || 'General Communication',
      isMuted: false,
      isVideoOff: false,
      joinedAt: Date.now(),
    };

    // If room already exists, check if same host
    const existing = findRoomById(roomId);
    if (existing) {
      const isSameHost =
        existing.host.trim().toLowerCase() === hostName.trim().toLowerCase() ||
        existing.participants.some(
          (p) =>
            p.socketId === socket.id ||
            p.socketId === 'host-rest' ||
            p.name.trim().toLowerCase() === hostName.trim().toLowerCase()
        );

      if (isSameHost) {
        existing.type = data.type || existing.type;
        existing.mode = data.mode || existing.mode;
        existing.capacity = Number(data.capacity) || existing.capacity;
        const hostIdx = existing.participants.findIndex(
          (p) => p.role === 'Host' || p.name.trim().toLowerCase() === hostName.trim().toLowerCase()
        );
        if (hostIdx !== -1) {
          existing.participants[hostIdx] = hostParticipant;
        } else {
          existing.participants.unshift(hostParticipant);
        }

        rooms.set(existing.id, existing);
        cancelRoomCleanup(existing.id);
        socket.join(existing.id);

        const student = onlineStudents.get(socket.id);
        if (student) {
          student.status = 'IN_ROOM';
          io.emit('online-students', getOnlineStudentsList());
        }

        socket.emit('room-created', existing);
        io.to(existing.id).emit('room-state', existing);
        io.emit('public-rooms', getPublicRoomsList());
        console.log(`[Socket] Host ${hostName} refreshed room: ${existing.id}`);
        return;
      }

      if (existing.participants.length > 0) {
        socket.emit('room-error', {
          message: `A practice room with ID "${roomId}" is already active with host ${existing.host}. Please join it or choose a different ID.`,
        });
        return;
      }
    }

    const newRoom: Room = {
      id: roomId,
      type: data.type || 'public',
      mode: data.mode || 'General Communication',
      host: hostName,
      capacity: Number(data.capacity) || 2,
      participants: [hostParticipant],
      createdAt: new Date().toISOString(),
      chatMessages: [
        {
          id: `sys-${Date.now()}`,
          sender: 'Fluencis System',
          senderId: 'system',
          initial: 'S',
          text: `Practice room ${roomId} started. Focus: ${data.mode || 'General Communication'}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSystem: true,
          type: 'system',
        },
      ],
    };

    rooms.set(roomId, newRoom);
    cancelRoomCleanup(roomId);
    socket.join(roomId);

    // Update student status
    const student = onlineStudents.get(socket.id);
    if (student) {
      student.status = 'IN_ROOM';
      io.emit('online-students', getOnlineStudentsList());
    }

    socket.emit('room-created', newRoom);
    io.emit('public-rooms', getPublicRoomsList());
    console.log(`[Socket] Room created: ${roomId} by ${hostName}`);
  });

  // Join room
  socket.on('join-room', (data: { roomId: string; studentName?: string; userProfile?: any } | string) => {
    const rawId = typeof data === 'string' ? data : data.roomId;
    const cleanId = (rawId || '').trim();
    const studentName = typeof data === 'string' ? 'Student' : (data.studentName || 'Student');
    const userProfile = typeof data === 'string' ? null : data.userProfile;

    const room = findRoomById(cleanId);
    if (!room) {
      socket.emit('room-error', { message: `Room "${cleanId}" was not found. Please double-check the unique room ID.` });
      return;
    }

    const roomId = room.id;

    cancelRoomCleanup(roomId);

    if (room.locked) {
      socket.emit('room-error', { message: `Room "${roomId}" is currently locked by the host for privacy and security.` });
      return;
    }

    const isRoomHost = room.host.trim().toLowerCase() === studentName.trim().toLowerCase();

    // Clean up stale host-rest placeholder if any
    const placeholderIdx = room.participants.findIndex(p => p.socketId === 'host-rest');
    if (placeholderIdx !== -1 && (room.participants.length > 1 || isRoomHost)) {
      room.participants.splice(placeholderIdx, 1);
    }

    const existingParticipant = room.participants.find(
      (p) =>
        p.socketId === socket.id ||
        (isRoomHost && p.role === 'Host') ||
        (studentName !== 'Student' && p.name.trim().toLowerCase() === studentName.trim().toLowerCase())
    );

    if (existingParticipant) {
      // Reconnection: update socket ID to latest connection
      existingParticipant.socketId = socket.id;
      if (isRoomHost) existingParticipant.role = 'Host';
      if (userProfile?.level) existingParticipant.level = userProfile.level;
    } else {
      if (room.participants.length >= room.capacity && !isRoomHost) {
        // Purge any stale disconnected sockets
        const activeSockets = io.sockets.sockets;
        room.participants = room.participants.filter(p => p.socketId === 'host-rest' || activeSockets.has(p.socketId));
        if (room.participants.length >= room.capacity) {
          socket.emit('room-error', { message: `Room ${roomId} has reached its maximum capacity of ${room.capacity} students.` });
          return;
        }
      }

      const newParticipant: Participant = {
        socketId: socket.id,
        name: studentName,
        initial: studentName.charAt(0).toUpperCase() || 'S',
        role: isRoomHost ? 'Host' : 'Participant',
        level: userProfile?.level || 'Beginner',
        goal: userProfile?.goal || 'General Communication',
        isMuted: false,
        isVideoOff: false,
        joinedAt: Date.now(),
      };
      room.participants.push(newParticipant);

      // System notification message
      const joinMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        sender: 'Fluencis',
        senderId: 'system',
        initial: 'S',
        text: `${studentName} joined the room.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSystem: true,
        type: 'system',
      };
      room.chatMessages.push(joinMsg);
    }

    socket.join(roomId);

    // Update student status
    const student = onlineStudents.get(socket.id);
    if (student) {
      student.status = 'IN_ROOM';
      io.emit('online-students', getOnlineStudentsList());
    }

    socket.emit('room-joined', room);
    io.to(roomId).emit('room-state', room);
    io.emit('public-rooms', getPublicRoomsList());
    socket.to(roomId).emit('student-joined', { socketId: socket.id, name: studentName, profile: userProfile });
    console.log(`[Socket] Student ${studentName} (${socket.id}) joined room ${roomId}`);
  });

  // Leave room
  socket.on('leave-room', (roomId: string) => {
    const room = findRoomById(roomId);
    if (room) {
      const targetRoomId = room.id;
      const leavingParticipant = room.participants.find(p => p.socketId === socket.id);
      room.participants = room.participants.filter(p => p.socketId !== socket.id);
      socket.leave(targetRoomId);

      if (leavingParticipant) {
        const leaveMsg: ChatMessage = {
          id: `sys-${Date.now()}`,
          sender: 'Fluencis',
          senderId: 'system',
          initial: 'S',
          text: `${leavingParticipant.name} left the practice session.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSystem: true,
          type: 'system',
        };
        room.chatMessages.push(leaveMsg);
      }

      if (room.participants.length === 0) {
        scheduleRoomCleanup(targetRoomId);
        console.log(`[Socket] Room ${targetRoomId} scheduled for cleanup`);
      } else {
        if (!room.participants.some(p => p.role === 'Host')) {
          room.participants[0].role = 'Host';
          room.host = room.participants[0].name;
        }
        io.to(targetRoomId).emit('room-state', room);
        io.to(targetRoomId).emit('participant-left', { socketId: socket.id, name: leavingParticipant?.name });
      }
      io.emit('public-rooms', getPublicRoomsList());
    }

    const student = onlineStudents.get(socket.id);
    if (student) {
      student.status = 'AVAILABLE';
      io.emit('online-students', getOnlineStudentsList());
    }
  });

  // Quick Match: Find active student with similar skill level and preferred practice topic
  socket.on('find-partner', (data: { name: string; mode: string; format?: string; level?: string; goal?: string }) => {
    const studentName = data.name || 'Student';
    const studentMode = data.mode || 'General Communication';
    const studentLevel = data.level || 'Intermediate';
    const studentFormat = data.format || 'one-to-one';
    const studentGoal = data.goal || 'Fluency & Confidence';

    // 1. Check queue for compatible partner (similar skill level + preferred practice topic)
    const compatibleInQueue: { candidate: QueuedStudent; score: number; reason: string }[] = [];

    for (let i = 0; i < matchmakingQueue.length; i++) {
      const q = matchmakingQueue[i];
      if (q.socketId === socket.id) continue;

      const matchRes = computeMatchScore(
        { mode: studentMode, level: studentLevel },
        { mode: q.mode, level: q.level }
      );

      if (matchRes.isCompatible) {
        compatibleInQueue.push({
          candidate: q,
          score: matchRes.score,
          reason: matchRes.reason,
        });
      }
    }

    if (compatibleInQueue.length > 0) {
      // Sort by highest compatibility score first, then earliest queued time
      compatibleInQueue.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.candidate.queuedAt - b.candidate.queuedAt;
      });

      const best = compatibleInQueue[0];
      const qIdx = matchmakingQueue.findIndex(q => q.socketId === best.candidate.socketId);
      const matchedPeer = qIdx !== -1 ? matchmakingQueue.splice(qIdx, 1)[0] : best.candidate;

      // Remove current user from queue if present
      const currIdx = matchmakingQueue.findIndex(q => q.socketId === socket.id);
      if (currIdx !== -1) matchmakingQueue.splice(currIdx, 1);

      const roomId = `SM-QM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const hostParticipant: Participant = {
        socketId: matchedPeer.socketId,
        name: matchedPeer.name,
        initial: matchedPeer.name.charAt(0).toUpperCase(),
        role: 'Host',
        level: matchedPeer.level,
        goal: matchedPeer.goal,
        joinedAt: Date.now(),
      };

      const joinerParticipant: Participant = {
        socketId: socket.id,
        name: studentName,
        initial: studentName.charAt(0).toUpperCase(),
        role: 'Participant',
        level: studentLevel,
        goal: studentGoal,
        joinedAt: Date.now(),
      };

      const newRoom: Room = {
        id: roomId,
        type: 'public',
        mode: studentMode,
        host: matchedPeer.name,
        capacity: 2,
        participants: [hostParticipant, joinerParticipant],
        createdAt: new Date().toISOString(),
        chatMessages: [
          {
            id: `sys-${Date.now()}`,
            sender: 'Fluencis Quick Match',
            senderId: 'system',
            initial: '⚡',
            text: `⚡ Quick Match Connected! ${matchedPeer.name} (${matchedPeer.level}) and ${studentName} (${studentLevel}) are practicing ${studentMode}. Compatibility: ${best.score}%.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSystem: true,
            type: 'system',
          }
        ]
      };

      rooms.set(roomId, newRoom);
      io.to(matchedPeer.socketId).socketsJoin(roomId);
      socket.join(roomId);

      // Update student presence status
      const s1 = onlineStudents.get(matchedPeer.socketId);
      if (s1) s1.status = 'IN_ROOM';
      const s2 = onlineStudents.get(socket.id);
      if (s2) s2.status = 'IN_ROOM';

      io.to(matchedPeer.socketId).emit('match-found', {
        roomId,
        room: newRoom,
        matchScore: best.score,
        reason: best.reason,
        partner: {
          name: studentName,
          level: studentLevel,
          goal: studentGoal,
          mode: studentMode,
        }
      });

      socket.emit('match-found', {
        roomId,
        room: newRoom,
        matchScore: best.score,
        reason: best.reason,
        partner: {
          name: matchedPeer.name,
          level: matchedPeer.level,
          goal: matchedPeer.goal,
          mode: matchedPeer.mode,
        }
      });

      io.emit('public-rooms', getPublicRoomsList());
      io.emit('online-students', getOnlineStudentsList());
      console.log(`[QuickMatch] Paired ${matchedPeer.name} and ${studentName} in room ${roomId} (Score: ${best.score}%)`);
    } else {
      // Add or update in matchmakingQueue
      const existingIdx = matchmakingQueue.findIndex(q => q.socketId === socket.id);
      const queueItem: QueuedStudent = {
        socketId: socket.id,
        name: studentName,
        mode: studentMode,
        format: studentFormat,
        level: studentLevel,
        goal: studentGoal,
        queuedAt: Date.now(),
      };

      if (existingIdx !== -1) {
        matchmakingQueue[existingIdx] = queueItem;
      } else {
        matchmakingQueue.push(queueItem);
      }

      // Check available online students with similar skill level and topic
      const compatibleOnline: any[] = [];
      onlineStudents.forEach((st) => {
        if (st.socketId !== socket.id && st.status === 'AVAILABLE') {
          const matchRes = computeMatchScore(
            { mode: studentMode, level: studentLevel },
            { mode: st.mode, level: st.level }
          );
          if (matchRes.isCompatible) {
            compatibleOnline.push({
              socketId: st.socketId,
              name: st.name,
              level: st.level,
              mode: st.mode,
              score: matchRes.score,
            });
          }
        }
      });

      socket.emit('match-searching', {
        message: 'Scanning active students with similar skill level and topic...',
        mode: studentMode,
        level: studentLevel,
        compatibleCount: compatibleOnline.length,
        compatibleStudents: compatibleOnline,
      });
    }
  });

  // Direct instant match invite to an active online student
  socket.on('instant-match-invite', (data: { targetSocketId: string; mode: string; level: string; name: string }) => {
    io.to(data.targetSocketId).emit('incoming-match-invite', {
      fromSocketId: socket.id,
      fromName: data.name,
      fromLevel: data.level,
      mode: data.mode,
    });
  });

  socket.on('accept-match-invite', (data: { fromSocketId: string; mode: string; level: string; name: string }) => {
    const fromStudent = onlineStudents.get(data.fromSocketId);
    const acceptingStudent = onlineStudents.get(socket.id);
    const hostName = fromStudent?.name || 'Classmate';
    const joinerName = acceptingStudent?.name || data.name || 'Student';

    const roomId = `SM-QM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const newRoom: Room = {
      id: roomId,
      type: 'public',
      mode: data.mode || 'General Communication',
      host: hostName,
      capacity: 2,
      participants: [
        {
          socketId: data.fromSocketId,
          name: hostName,
          initial: hostName.charAt(0).toUpperCase(),
          role: 'Host',
          level: fromStudent?.level || data.level || 'Intermediate',
          goal: fromStudent?.goal || 'Fluency',
          joinedAt: Date.now(),
        },
        {
          socketId: socket.id,
          name: joinerName,
          initial: joinerName.charAt(0).toUpperCase(),
          role: 'Participant',
          level: acceptingStudent?.level || data.level || 'Intermediate',
          goal: acceptingStudent?.goal || 'Fluency',
          joinedAt: Date.now(),
        }
      ],
      createdAt: new Date().toISOString(),
      chatMessages: [
        {
          id: `sys-${Date.now()}`,
          sender: 'Fluencis Quick Match',
          senderId: 'system',
          initial: '⚡',
          text: `⚡ Quick Match Connected! ${hostName} and ${joinerName} are practicing ${data.mode}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSystem: true,
          type: 'system',
        }
      ]
    };

    rooms.set(roomId, newRoom);
    io.to(data.fromSocketId).socketsJoin(roomId);
    socket.join(roomId);

    if (fromStudent) fromStudent.status = 'IN_ROOM';
    if (acceptingStudent) acceptingStudent.status = 'IN_ROOM';

    const q1 = matchmakingQueue.findIndex(q => q.socketId === data.fromSocketId);
    if (q1 !== -1) matchmakingQueue.splice(q1, 1);
    const q2 = matchmakingQueue.findIndex(q => q.socketId === socket.id);
    if (q2 !== -1) matchmakingQueue.splice(q2, 1);

    io.to(data.fromSocketId).emit('match-found', {
      roomId,
      room: newRoom,
      matchScore: 95,
      reason: `Direct Quick Match: Practicing ${data.mode}`,
      partner: {
        name: joinerName,
        level: acceptingStudent?.level || 'Intermediate',
        goal: acceptingStudent?.goal || 'Fluency',
        mode: data.mode,
      }
    });

    socket.emit('match-found', {
      roomId,
      room: newRoom,
      matchScore: 95,
      reason: `Direct Quick Match: Practicing ${data.mode}`,
      partner: {
        name: hostName,
        level: fromStudent?.level || 'Intermediate',
        goal: fromStudent?.goal || 'Fluency',
        mode: data.mode,
      }
    });

    io.emit('public-rooms', getPublicRoomsList());
    io.emit('online-students', getOnlineStudentsList());
  });

  socket.on('decline-match-invite', (data: { fromSocketId: string; name: string }) => {
    io.to(data.fromSocketId).emit('match-invite-declined', {
      message: `${data.name || 'User'} is currently busy or declined the Quick Match invite.`
    });
  });

  socket.on('cancel-search', () => {
    const idx = matchmakingQueue.findIndex(q => q.socketId === socket.id);
    if (idx !== -1) {
      matchmakingQueue.splice(idx, 1);
      socket.emit('search-cancelled');
    }
  });

  // Real-time Chat
  socket.on('send-message', (data: { roomId?: string; text: string; sender: string; initial?: string; channelId?: string }) => {
    const isCommunity = !data.roomId || data.channelId === 'community' || data.roomId === 'community';

    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender: data.sender || 'Student',
      senderId: socket.id,
      initial: data.initial || (data.sender ? data.sender.charAt(0).toUpperCase() : 'S'),
      text: data.text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'message',
      channelId: isCommunity ? 'community' : 'room',
      reactions: [],
    };

    if (isCommunity) {
      communityChatMessages.push(message);
      if (communityChatMessages.length > 200) {
        communityChatMessages.shift();
      }
      io.emit('new-community-message', message);
    } else if (data.roomId) {
      const room = findRoomById(data.roomId);
      if (room) {
        room.chatMessages.push(message);
        if (room.chatMessages.length > 100) {
          room.chatMessages.shift();
        }
        io.to(room.id).emit('new-message', message);
      }
    }
  });

  // Real-time Typing Indicator
  socket.on('typing', (data: { roomId?: string; sender: string; isTyping: boolean; channelId?: string }) => {
    if (data.channelId === 'community' || !data.roomId || data.roomId === 'community') {
      socket.broadcast.emit('user-typing', {
        sender: data.sender,
        isTyping: data.isTyping,
        channelId: 'community',
      });
    } else {
      const room = findRoomById(data.roomId);
      const targetRoomId = room ? room.id : data.roomId;
      socket.to(targetRoomId).emit('user-typing', {
        sender: data.sender,
        isTyping: data.isTyping,
        roomId: targetRoomId,
        channelId: 'room',
      });
    }
  });

  // Add Message Reaction (e.g. 👍, 🔥, 👏, 💡)
  socket.on('add-reaction', (data: { messageId: string; emoji: string; userName: string; roomId?: string; channelId?: string }) => {
    const isCommunity = !data.roomId || data.channelId === 'community' || data.roomId === 'community';

    const updateReactionsInList = (list: ChatMessage[]) => {
      const targetMsg = list.find((m) => m.id === data.messageId);
      if (!targetMsg) return null;
      if (!targetMsg.reactions) targetMsg.reactions = [];

      const existingReaction = targetMsg.reactions.find((r) => r.emoji === data.emoji);
      if (existingReaction) {
        if (!existingReaction.users.includes(data.userName)) {
          existingReaction.users.push(data.userName);
          existingReaction.count += 1;
        } else {
          // toggle off if clicked again
          existingReaction.users = existingReaction.users.filter((u) => u !== data.userName);
          existingReaction.count -= 1;
        }
      } else {
        targetMsg.reactions.push({
          emoji: data.emoji,
          count: 1,
          users: [data.userName],
        });
      }
      return targetMsg;
    };

    if (isCommunity) {
      const updated = updateReactionsInList(communityChatMessages);
      if (updated) {
        io.emit('message-reaction-updated', {
          messageId: data.messageId,
          reactions: updated.reactions,
          channelId: 'community',
        });
      }
    } else if (data.roomId) {
      const room = findRoomById(data.roomId);
      if (room) {
        const updated = updateReactionsInList(room.chatMessages);
        if (updated) {
          io.to(room.id).emit('message-reaction-updated', {
            messageId: data.messageId,
            reactions: updated.reactions,
            roomId: room.id,
            channelId: 'room',
          });
        }
      }
    }
  });

  // Media state updates (mute/camera toggled)
  socket.on('media-toggle', (data: { roomId: string; isMuted?: boolean; isVideoOff?: boolean }) => {
    const room = findRoomById(data.roomId);
    if (room) {
      const participant = room.participants.find(p => p.socketId === socket.id);
      if (participant) {
        if (typeof data.isMuted === 'boolean') participant.isMuted = data.isMuted;
        if (typeof data.isVideoOff === 'boolean') participant.isVideoOff = data.isVideoOff;
        socket.to(room.id).emit('participant-media-changed', {
          socketId: socket.id,
          isMuted: participant.isMuted,
          isVideoOff: participant.isVideoOff,
        });
      }
    }
  });

  // Raise Hand (Microsoft Teams feature)
  socket.on('raise-hand', (data: { roomId: string; isRaised: boolean }) => {
    const room = findRoomById(data.roomId);
    if (room) {
      const participant = room.participants.find(p => p.socketId === socket.id);
      if (participant) {
        participant.isHandRaised = data.isRaised;
        io.to(room.id).emit('participant-hand-raised', {
          socketId: socket.id,
          name: participant.name,
          isRaised: data.isRaised,
        });
      }
    }
  });

  // Host Room Security: Lock / Unlock Meeting
  socket.on('toggle-room-lock', (data: { roomId: string; locked: boolean }) => {
    const room = findRoomById(data.roomId);
    if (room) {
      room.locked = data.locked;
      io.to(room.id).emit('room-lock-changed', {
        roomId: room.id,
        locked: data.locked,
        message: data.locked
          ? 'Host locked this meeting for security. No new participants may join.'
          : 'Host unlocked this meeting.',
      });
      io.emit('public-rooms', getPublicRoomsList());
    }
  });

  // Host Room Security: Kick / Remove Participant
  socket.on('kick-participant', (data: { roomId: string; targetSocketId: string }) => {
    const room = findRoomById(data.roomId);
    if (room) {
      const host = room.participants.find(p => p.role === 'Host');
      if (host && host.socketId === socket.id) {
        io.to(data.targetSocketId).emit('kicked-from-room', {
          message: 'You have been removed from the practice room by the host.',
        });
        const kicked = room.participants.find(p => p.socketId === data.targetSocketId);
        room.participants = room.participants.filter(p => p.socketId !== data.targetSocketId);
        io.to(room.id).emit('room-state', room);
        io.to(room.id).emit('participant-left', { socketId: data.targetSocketId, name: kicked?.name });
        io.emit('public-rooms', getPublicRoomsList());
      }
    }
  });

  // WebRTC Signaling
  socket.on('peer-ready', (data: { roomId: string }) => {
    const room = findRoomById(data.roomId);
    const targetRoomId = room ? room.id : data.roomId;
    socket.to(targetRoomId).emit('peer-ready', {
      socketId: socket.id,
      roomId: targetRoomId,
    });
  });

  socket.on('webrtc-offer', (data: { targetSocketId?: string; roomId: string; offer: any }) => {
    const room = findRoomById(data.roomId);
    const targetRoomId = room ? room.id : data.roomId;
    if (data.targetSocketId) {
      io.to(data.targetSocketId).emit('webrtc-offer', {
        senderSocketId: socket.id,
        offer: data.offer,
      });
    } else {
      socket.to(targetRoomId).emit('webrtc-offer', {
        senderSocketId: socket.id,
        offer: data.offer,
      });
    }
  });

  socket.on('webrtc-answer', (data: { targetSocketId: string; answer: any }) => {
    io.to(data.targetSocketId).emit('webrtc-answer', {
      senderSocketId: socket.id,
      answer: data.answer,
    });
  });

  socket.on('webrtc-ice-candidate', (data: { targetSocketId?: string; roomId?: string; candidate: any }) => {
    if (data.targetSocketId) {
      io.to(data.targetSocketId).emit('webrtc-ice-candidate', {
        senderSocketId: socket.id,
        candidate: data.candidate,
      });
    } else if (data.roomId) {
      const room = findRoomById(data.roomId);
      const targetRoomId = room ? room.id : data.roomId;
      socket.to(targetRoomId).emit('webrtc-ice-candidate', {
        senderSocketId: socket.id,
        candidate: data.candidate,
      });
    }
  });

  // Live Captions Relay
  socket.on('live-caption', (data: { roomId: string; speaker: string; text: string }) => {
    const room = findRoomById(data.roomId);
    const targetRoomId = room ? room.id : data.roomId;
    socket.to(targetRoomId).emit('live-caption', data);
  });

  // End conversation signal (Host ends for everyone, regular participant only exits)
  socket.on('end-conversation', (roomId: string) => {
    const room = findRoomById(roomId);
    if (room) {
      const participant = room.participants.find(p => p.socketId === socket.id);
      if (participant && participant.role === 'Host') {
        io.to(room.id).emit('conversation-ended', { endedBy: socket.id, hostEnded: true });
      } else {
        // Participant leaves without destroying room for others
        socket.emit('conversation-ended', { endedBy: socket.id, hostEnded: false });
      }
    } else {
      io.to(roomId).emit('conversation-ended', { endedBy: socket.id, hostEnded: true });
    }
  });

  // Room Lookup by unique ID
  socket.on('lookup-room', (roomId: string, callback?: (res: any) => void) => {
    const cleanId = (roomId || '').trim();
    const room = findRoomById(cleanId);
    const result = room
      ? {
          exists: true,
          room: {
            id: room.id,
            type: room.type,
            mode: room.mode,
            host: room.host,
            capacity: room.capacity,
            participantCount: room.participants.length,
            isFull: room.participants.length >= room.capacity,
            participants: room.participants,
          },
        }
      : { exists: false, message: `Room ${cleanId} not found or has expired.` };

    if (typeof callback === 'function') {
      callback(result);
    } else {
      socket.emit('lookup-room-result', result);
    }
  });

  // Submit Peer Feedback
  socket.on('submit-feedback', (feedbackData: any) => {
    const feedbackRecord = {
      id: feedbackData.id || `fb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      roomId: feedbackData.roomId || 'UNKNOWN',
      fromStudent: feedbackData.fromStudent || 'Student',
      fromInitial: feedbackData.fromInitial || (feedbackData.fromStudent ? feedbackData.fromStudent.charAt(0).toUpperCase() : 'S'),
      toStudent: feedbackData.toStudent || 'Student',
      toInitial: feedbackData.toInitial || (feedbackData.toStudent ? feedbackData.toStudent.charAt(0).toUpperCase() : 'S'),
      practiceMode: feedbackData.practiceMode || 'General Communication',
      durationFormatted: feedbackData.durationFormatted || '10:00',
      ratings: feedbackData.ratings || { clarity: 5, confidence: 5, listening: 5, structure: 5, overall: 5 },
      tags: Array.isArray(feedbackData.tags) ? feedbackData.tags : [],
      constructiveNotes: feedbackData.constructiveNotes || '',
      encouragement: feedbackData.encouragement || '',
      aiPolishedNotes: feedbackData.aiPolishedNotes || '',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', Today',
    };

    peerFeedbackRecords.unshift(feedbackRecord);

    // Notify peer if online
    const targetName = feedbackRecord.toStudent.toLowerCase().trim();
    for (const [peerSocketId, student] of onlineStudents.entries()) {
      const sName = student.name.toLowerCase().trim();
      if (sName === targetName || sName.includes(targetName) || targetName.includes(sName)) {
        io.to(peerSocketId).emit('peer-feedback-received', feedbackRecord);
      }
    }

    if (feedbackRecord.roomId && feedbackRecord.roomId !== 'UNKNOWN') {
      io.to(feedbackRecord.roomId).emit('peer-feedback-received', feedbackRecord);
    }

    socket.emit('feedback-submitted-ack', { success: true, feedback: feedbackRecord });
    console.log(`[Feedback] Saved peer review from ${feedbackRecord.fromStudent} to ${feedbackRecord.toStudent}`);
  });

  // Disconnection
  socket.on('disconnect', () => {
    onlineStudents.delete(socket.id);
    const qIdx = matchmakingQueue.findIndex(q => q.socketId === socket.id);
    if (qIdx !== -1) matchmakingQueue.splice(qIdx, 1);

    // Leave any room
    rooms.forEach((room, rId) => {
      const idx = room.participants.findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        const leaving = room.participants[idx];
        room.participants.splice(idx, 1);
        if (room.participants.length === 0) {
          scheduleRoomCleanup(rId);
        } else {
          if (!room.participants.some(p => p.role === 'Host')) {
            room.participants[0].role = 'Host';
            room.host = room.participants[0].name;
          }
          io.to(rId).emit('room-state', room);
          io.to(rId).emit('participant-left', { socketId: socket.id, name: leaving.name });
        }
      }
    });

    io.emit('online-students', getOnlineStudentsList());
    io.emit('public-rooms', getPublicRoomsList());
    console.log(`[Socket] Student disconnected: ${socket.id}`);
  });
});

// All Active Rooms API
app.get('/api/rooms', (_req: Request, res: Response) => {
  return res.json({
    rooms: getPublicRoomsList(),
    count: rooms.size,
  });
});

// Create/Register Room via REST API
app.post('/api/rooms', (req: Request, res: Response) => {
  const { id, type, mode, capacity, host, participants } = req.body;
  const rawId = (id || '').trim();
  if (!rawId) {
    return res.status(400).json({ error: 'Room ID required' });
  }

  const existing = findRoomById(rawId);
  if (existing) {
    return res.json({ success: true, room: existing });
  }

  const hostName = host || 'Student';
  const newRoom: Room = {
    id: rawId,
    type: type || 'public',
    mode: mode || 'General Communication',
    host: hostName,
    capacity: Number(capacity) || 2,
    participants: Array.isArray(participants) && participants.length > 0 ? participants : [
      {
        socketId: 'host-rest',
        name: hostName,
        initial: hostName.charAt(0).toUpperCase() || 'S',
        role: 'Host',
        level: 'Beginner',
        goal: 'General Practice',
        joinedAt: Date.now(),
      }
    ],
    createdAt: new Date().toISOString(),
    chatMessages: [],
  };

  rooms.set(rawId, newRoom);
  io.emit('public-rooms', getPublicRoomsList());
  return res.json({ success: true, room: newRoom });
});

// Room Lookup API
app.get('/api/rooms/:roomId', (req: Request, res: Response) => {
  const cleanId = (req.params.roomId || '').trim();
  const room = findRoomById(cleanId);
  if (!room) {
    return res.status(404).json({ exists: false, message: `Room "${cleanId}" not found.` });
  }
  return res.json({
    exists: true,
    room: {
      id: room.id,
      type: room.type,
      mode: room.mode,
      host: room.host,
      capacity: room.capacity,
      participantCount: room.participants.length,
      isFull: room.participants.length >= room.capacity,
      participants: room.participants,
      createdAt: room.createdAt,
    },
  });
});

// Room Verification API: verifies unique Room ID when joining
app.post('/api/rooms/verify', (req: Request, res: Response) => {
  const { targetRoomId, enteredRoomId } = req.body;
  const targetId = (targetRoomId || '').trim();
  const inputId = (enteredRoomId || targetRoomId || '').trim();

  if (!inputId) {
    return res.status(400).json({ valid: false, message: 'Please enter the unique Room ID.' });
  }

  // If a specific target room was clicked in the list, verify entered ID matches (case-insensitive)
  if (targetId && inputId.toLowerCase() !== targetId.toLowerCase()) {
    return res.status(400).json({
      valid: false,
      message: `The entered Room ID "${inputId}" does not match the room you selected (${targetId}). Please enter the exact unique Room ID to join!`,
    });
  }

  const room = findRoomById(inputId);
  if (!room) {
    return res.status(404).json({
      valid: false,
      message: `Room "${inputId}" does not exist or has expired. Please verify the unique ID with the host.`,
    });
  }

  if (room.participants.length >= room.capacity) {
    return res.status(400).json({
      valid: false,
      isFull: true,
      message: `Room "${inputId}" has reached its maximum capacity of ${room.capacity} students.`,
    });
  }

  return res.json({
    valid: true,
    room: {
      id: room.id,
      type: room.type,
      mode: room.mode,
      host: room.host,
      capacity: room.capacity,
      participantCount: room.participants.length,
      participants: room.participants,
    },
    message: `Room verified! Joining ${room.host}'s ${room.mode} practice session...`,
  });
});

// Peer Feedback APIs
app.get('/api/feedback/:studentName', (req: Request, res: Response) => {
  const name = (req.params.studentName || '').toLowerCase().trim();
  const firstName = name.split(' ')[0] || name;
  const received = peerFeedbackRecords.filter(f => {
    const to = f.toStudent.toLowerCase().trim();
    return to === name || to === firstName || to === 'student' || to === 'you' || to.includes(firstName) || (name.includes('srinivas') && to === 'vamsi');
  });
  const given = peerFeedbackRecords.filter(f => {
    const from = f.fromStudent.toLowerCase().trim();
    return from === name || from === firstName || from.includes(firstName);
  });
  return res.json({
    received,
    given,
    totalReceived: received.length,
    totalGiven: given.length,
  });
});

app.post('/api/feedback', (req: Request, res: Response) => {
  try {
    const feedbackData = req.body;
    const feedbackRecord: PeerFeedbackRecord = {
      id: feedbackData.id || `fb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      roomId: feedbackData.roomId || 'UNKNOWN',
      fromStudent: feedbackData.fromStudent || 'Student',
      fromInitial: feedbackData.fromInitial || (feedbackData.fromStudent ? feedbackData.fromStudent.charAt(0).toUpperCase() : 'S'),
      toStudent: feedbackData.toStudent || 'Student',
      toInitial: feedbackData.toInitial || (feedbackData.toStudent ? feedbackData.toStudent.charAt(0).toUpperCase() : 'S'),
      practiceMode: feedbackData.practiceMode || 'General Communication',
      durationFormatted: feedbackData.durationFormatted || '10:00',
      ratings: feedbackData.ratings || { clarity: 5, confidence: 5, listening: 5, structure: 5, overall: 5 },
      tags: Array.isArray(feedbackData.tags) ? feedbackData.tags : [],
      constructiveNotes: feedbackData.constructiveNotes || '',
      encouragement: feedbackData.encouragement || '',
      aiPolishedNotes: feedbackData.aiPolishedNotes || '',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', Today',
    };

    peerFeedbackRecords.unshift(feedbackRecord);

    // Notify online peer via socket
    const targetName = feedbackRecord.toStudent.toLowerCase().trim();
    for (const [peerSocketId, student] of onlineStudents.entries()) {
      const sName = student.name.toLowerCase().trim();
      if (sName === targetName || sName.includes(targetName) || targetName.includes(sName)) {
        io.to(peerSocketId).emit('peer-feedback-received', feedbackRecord);
      }
    }
    if (feedbackRecord.roomId && feedbackRecord.roomId !== 'UNKNOWN') {
      io.to(feedbackRecord.roomId).emit('peer-feedback-received', feedbackRecord);
    }

    return res.status(201).json({ success: true, feedback: feedbackRecord });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save feedback' });
  }
});

// AI Feedback Refinement API
app.post('/api/ai/refine-peer-feedback', async (req: Request, res: Response) => {
  try {
    const { roughNotes, ratings, practiceMode, toStudent } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(200).json({
        polishedNotes: `Constructive Observation: "${roughNotes || 'Good performance'}". Actionable Recommendation: Keep structuring answers with distinct beginning, key points, and conclusion. Great job keeping the conversation engaging!`,
        recommendedTags: ['Engaging Tone', 'Clear Structure', 'Good Eye Contact'],
      });
    }

    const prompt = `You are an expert student communication mentor on Fluencis.
A student just finished a peer communication practice session in mode "${practiceMode || 'General Communication'}".
They want to give constructive, encouraging, and actionable feedback to their peer "${toStudent || 'Partner'}".
Their rough feedback notes: "${roughNotes || 'Spoke clearly but spoke too fast at times'}".
Ratings given: ${JSON.stringify(ratings || {})}.

Convert these rough notes into:
1. "polishedNotes": A polite, constructive, and actionable 2-3 sentence review that highlights one major strength and one actionable improvement area.
2. "recommendedTags": An array of 3-4 short badge strings (e.g., ["Clear Voice", "Active Listener", "Mind Filler Words"]).

Return JSON only:
{
  "polishedNotes": "string",
  "recommendedTags": ["string", "string", "string"]
}`;

    const { text } = await generateWithModelFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(text || '{}');
    return res.json(parsed);
  } catch (_err: any) {
    return res.json({
      polishedNotes: `Observation: ${req.body?.roughNotes || 'Good speaking engagement'}. Actionable Tip: Continue structuring responses clearly with Plain Concept, Practical Examples, and Key Takeaways.`,
      recommendedTags: ['Clear Articulation', 'Active Listener', 'Paced Well'],
    });
  }
});

// AI Communication Coach & Interviewer API using @google/genai
app.post('/api/ai/analyze', async (req: Request, res: Response) => {
  try {
    const { speechText, practiceMode, focusGoal } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(200).json({
        mock: true,
        feedback: {
          overallScore: 82,
          strengths: [
            'Articulate pacing and clear voice projection',
            'Strong structure introducing the core concept',
            'Professional tone appropriate for workplace communication'
          ],
          areasToImprove: [
            'Noticeable filler words (um, like, basically)',
            'Conclusion was slightly rushed without summarizing key takeaways'
          ],
          fillerWordCount: 4,
          clarityScore: '8.4 / 10',
          confidenceScore: '8.0 / 10',
          actionableTip: 'Try pausing silently for 1 second instead of saying "um" when transitioning between thoughts.'
        }
      });
    }

    const prompt = `You are the Fluencis Communication Coach for undergraduate engineering students preparing for internships, interviews, and presentations.
Analyze the following speech excerpt from a student session.
Practice Mode: ${practiceMode || 'General Communication'}
Goal: ${focusGoal || 'Confidence and Fluency'}
Speech Excerpt: "${speechText || 'Hello everyone, today I want to share my thoughts on why effective communication is vital in engineering teams.'}"

Return a valid JSON object only with this exact structure:
{
  "overallScore": number (0-100),
  "clarityScore": "X / 10",
  "confidenceScore": "Y / 10",
  "strengths": ["string", "string", "string"],
  "areasToImprove": ["string", "string"],
  "fillerWordCount": number,
  "actionableTip": "string"
}`;

    const { text } = await generateWithModelFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(text || '{}');
    return res.json({ feedback: parsed });
  } catch (_error: any) {
    return res.status(200).json({
      mock: true,
      feedback: {
        overallScore: 84,
        strengths: [
          'Articulate pacing and clear voice projection',
          'Good logical flow explaining the core concept',
          'Professional demeanor appropriate for academic and team discussions'
        ],
        areasToImprove: [
          'Incorporate more quantitative metrics or concrete examples',
          'Structure transitions using the STAR framework'
        ],
        fillerWordCount: 3,
        clarityScore: '8.5 / 10',
        confidenceScore: '8.2 / 10',
        actionableTip: 'Pause intentionally for 1-2 seconds between main points rather than rushing into the next sentence.'
      }
    });
  }
});

app.post('/api/ai/interview', async (req: Request, res: Response) => {
  try {
    const { role, questionIndex, lastAnswer, topic } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(200).json({
        nextQuestion: 'Tell me about a challenging technical or teamwork conflict you resolved, and what you learned from the experience.',
        feedbackOnLastAnswer: lastAnswer ? 'Good concise explanation, but try to use the STAR method (Situation, Task, Action, Result) to make your impact measurable.' : null,
      });
    }

    const prompt = `You are a Senior Technical & HR Interviewer on Fluencis.
Current Interview Track: ${role || 'Software Engineering Internship'}
Topic: ${topic || 'Technical & Behavioral'}
Question Number: ${questionIndex || 1}
Student's previous answer: "${lastAnswer || 'None yet, starting the interview.'}"

Generate the next realistic interview question and, if a previous answer was provided, 2 sentences of constructive critique.
Return JSON only:
{
  "nextQuestion": "string",
  "feedbackOnLastAnswer": "string or null",
  "keySkillTested": "string"
}`;

    const { text } = await generateWithModelFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(text || '{}');
    return res.json(parsed);
  } catch (_error: any) {
    return res.status(200).json({
      nextQuestion: 'Tell me about a challenging technical or teamwork conflict you resolved, and what you learned from the experience.',
      feedbackOnLastAnswer: req.body?.lastAnswer ? 'Good concise explanation, but try to use the STAR method (Situation, Task, Action, Result) to make your impact measurable.' : null,
      keySkillTested: 'Problem Solving & Team Leadership'
    });
  }
});

// Helper: World-Class academic knowledge engine with real-time science, world facts, and multilingual fluency
function generateAcademicFallback(message: string, studentName?: string, language?: string): string {
  const lang = detectLanguage(message, language);
  const q = (message || '').toLowerCase();

  // 1. Real-Time Science: James Webb Space Telescope (JWST)
  if (q.includes('james webb') || q.includes('jwst') || q.includes('space telescope') || q.includes('deep field')) {
    if (lang === 'Telugu') {
      return `### 💡 కాన్సెప్ట్ అర్థం & ప్రత్యక్ష వివరణ (James Webb Space Telescope - JWST)
**జేమ్స్ వెబ్ స్పేస్ టెలిస్కోప్ (JWST)** అనేది నాసా (NASA), యూరోపియన్ స్పేస్ ఏజెన్సీ (ESA), మరియు కెనడియన్ స్పేస్ ఏజెన్సీ (CSA) సంయుక్తంగా నిర్మించిన మానవ చరిత్రలోనే అత్యంత శక్తివంతమైన ఇన్ఫ్రారెడ్ స్పేస్ అబ్జర్వేటరీ.
*పోలిక:* ఇది ఒక టైమ్ మెషిన్ లాంటిది. విశ్వం బిగ్ బ్యాంగ్ తర్వాత 13.5 బిలియన్ సంవత్సరాల క్రితం పుట్టిన తొలి నక్షత్రాలు, గెలాక్సీల నుండి ప్రయాణించిన కాంతిని పసిగడుతుంది.

### ⚙️ ఇది ఎలా పనిచేస్తుంది (Core Technical Mechanics)
1. **లాగ్రాంజ్ పాయింట్ 2 (L2):** భూమి నుండి సుమారు 15 లక్షల కిలోమీటర్ల దూరంలో ఉన్న L2 కక్ష్యలో ఉండి సూర్యుడు, భూమి యొక్క ఉష్ణోగ్రత మరియు కాంతి నుండి రక్షించబడుతుంది.
2. **బంగారు పూత పూసిన అద్దాలు (Beryllium Gold Mirrors):** 6.5 మీటర్ల వ్యాసం గల 18 షట్కోణ బెరీలియం మిర్రర్లు లేత బంగారు పూతతో ఇన్ఫ్రారెడ్ కిరణాలను గరిష్టంగా ప్రతిబింబిస్తాయి.
3. **క్రయోజెనిక్ శీతలీకరణ (Cryocooling):** -233°C (-388°F) వరకు చల్లగా ఉండే 5-పొరల టెన్నిస్ కోర్ట్ పరిమాణపు సన్‌షీల్డ్ టెలిస్కోప్ సెన్సార్లను రక్షిస్తుంది.
4. **సైన్స్ పరికరాలు:** NIRCam (నియర్ ఇన్ఫ్రారెడ్ కెమెరా), NIRSpec, మరియు MIRI ద్వారా ఎక్సోప్లానెట్ల (Exoplanets) వాతావరణంలో నీటి ఆవిరి, కార్బన్ డైఆక్సైడ్, మీథేన్ వాయువులను కనుగొంటోంది.

### 🔬 ఇటీవలి శాస్త్రీయ ఆవిష్కరణలు (Latest Real-Time Discoveries)
• **JADES-GS-z14-0:** బిగ్ బ్యాంగ్ జరిగిన కేవలం 290 మిలియన్ సంవత్సరాల నాటి అత్యంత ప్రాచీన గెలాక్సీని కనుగొని ప్రామాణిక ఖగోళ సిద్ధాంతాలను సరికొత్తగా ఆవిష్కరించింది.
• **K2-18b ఎక్సోప్లానెట్:** నివాసయోగ్యమైన మండలంలో ఉన్న ఈ గ్రహం వాతావరణంలో డైమిథైల్ సల్ఫైడ్ (DMS) మరియు కార్బన్ బేస్డ్ అణువుల జాడలను పరిశీలిస్తోంది.

### 🎯 ముఖ్యమైన అంశాలు (Key Takeaways)
• హబుల్ టెలిస్కోప్ విజిబుల్ & UV కాంతిని చూస్తే, వెబ్ టెలిస్కోప్ కాస్మిక్ రెడ్‌షిఫ్ట్ (Cosmic Redshift) కారణంగా సాగిన ఇన్ఫ్రారెడ్ కాంతిని క్లియర్‌గా చూస్తుంది.
• శాస్త్రవేత్తలు విశ్వ ఆవిర్భావం మరియు జీవం పుట్టుకను అర్థం చేసుకోవడంలో JWST అగ్రగామిగా నిలిచింది.`;
    }

    if (lang === 'Hindi') {
      return `### 💡 संकल्पना और मुख्य उत्तर (James Webb Space Telescope - JWST)
**जेम्स वेब स्पेस टेलीस्कोप (JWST)** नासा, ईएसए और सीएसए द्वारा निर्मित खगोल विज्ञान का सबसे शक्तिशाली और उन्नत इन्फ्रारेड अंतरिक्ष वेधशाला है।
*सादृश्य:* यह एक प्रकार की "टाइम मशीन" है जो ब्रह्मांड की उत्पत्ति (बिग बैंग) के 13.5 अरब वर्ष पहले के पहले तारों और आकाशगंगाओं की तस्वीरें कैप्चर कर सकता है।

### ⚙️ कार्यप्रणाली (Step-by-Step Breakdown)
1. **लैग्रेंज बिंदु 2 (L2):** पृथ्वी से 15 लाख किमी दूर L2 बिंदु पर स्थित है, जिससे यह सूरज और पृथ्वी की ऊष्मा से सुरक्षित रहता है।
2. **स्वर्ण-लेपित दर्पण:** 6.5 मीटर चौड़ा प्राथमिक दर्पण 18 हेक्सागोनल बेरिलियम खंडों से बना है जिस पर शुद्ध सोने की परत चढ़ाई गई है ताकि इन्फ्रारेड प्रकाश सर्वोत्तम ढंग से परावर्तित हो।
3. **5-परत सनशील्ड:** पतंग के आकार की टेनिस कोर्ट जितनी बड़ी सनशील्ड टेलीस्कोप को -233°C के अत्यधिक ठंडे तापमान पर रखती है।
4. **वैज्ञानिक उपकरण:** NIRCam, NIRSpec और MIRI के माध्यम से सुदूर बाह्यग्रहों (Exoplanets) के वायुमंडल में जलवाष्प, कार्बन और मीथेन का विश्लेषण करता है।

### 🔬 नवीनतम वैज्ञानिक खोजें (Latest Real-Time Discoveries)
• **JADES-GS-z14-0:** बिग बैंग के केवल 290 मिलियन वर्ष बाद बनी सबसे पुरानी ज्ञात आकाशगंगा की पुष्टि की।
• **K2-18b ग्रह:** संभावित महासागरीय दुनिया के वातावरण में जीवन से जुड़े संभावित कार्बन आधारित अणुओं की पहचान।

### 🎯 मुख्य बिंदु (Key Takeaways)
• हबल मुख्य रूप से दृश्य प्रकाश (Visible Light) देखता है, जबकि जेम्स वेब कॉस्मिक रेडशिफ्ट के इन्फ्रारेड प्रकाश को गहराई से भेदने में सक्षम है।`;
    }

    if (lang === 'Tamil') {
      return `### 💡 கருத்து விளக்கம் & நேரடி விடை (James Webb Space Telescope - JWST)
**ஜேம்ஸ் வெப் விண்வெளி தொலைநோக்கி (JWST)** என்பது மனித வரலாற்றில் உருவாக்கப்பட்ட அதிநவீன, சக்திவாய்ந்த அகச்சிவப்பு (Infrared) விண்வெளி ஆய்வு மையமாகும்.
*உவமை:* இது ஒரு "கால இயந்திரம்" (Time Machine) போன்றது; பெருவெடிப்புக்கு (Big Bang) பிந்தைய 13.5 பில்லியன் ஆண்டுகளுக்கு முந்தைய பிரபஞ்சத்தின் முதல் விண்மீன் திரள்களைக் காண உதவுகிறது.

### ⚙️ இது எவ்வாறு இயங்குகிறது? (Core Mechanism)
1. **லாக்ராஞ்ச் புள்ளி 2 (L2):** பூமியிலிருந்து 1.5 மில்லியன் கி.மீ தொலைவில் சூரியன்-பூமி சமநிலை ஈர்ப்புப் புள்ளியில் நிலைநிறுத்தப்பட்டுள்ளது.
2. **தங்க முலாம் பூசப்பட்ட கண்ணாடிகள்:** 18 அறுகோண பெரிலியம் கண்ணாடிகள் தூய தங்க முலாம் பூசப்பட்டு அகச்சிவப்பு கதிர்களைத் துல்லியமாகப் பிரதிபலிக்கின்றன.
3. **5-அடுக்கு சூரியக் கவசம்:** விண்கலத்தை -233°C மிகக் குளிர்ந்த வெப்பநிலையில் பராமரிக்க டென்னிஸ் மைதான அளவிலான கவசம் உதவுகிறது.

### 🔬 சமீபத்திய அறிவியல் கண்டுபிடிப்புகள்
• **JADES-GS-z14-0:** பெருவெடிப்புக்குப் பின் 290 மில்லியன் ஆண்டுகளில் உருவான பிரபஞ்சத்தின் மிகத் தொன்மையான விண்மீன் மண்டலத்தைக் கண்டறிந்துள்ளது.`;
    }

    if (lang === 'German') {
      return `### 💡 Konzept-Intuition & Direkte Erklärung (James Webb Space Telescope - JWST)
Das **James-Webb-Weltraumteleskop (JWST)** ist das größte, leistungsstärkste und komplexeste Infrarot-Weltraumobservatorium der Menschheit, gemeinschaftlich betrieben von NASA, ESA und CSA.
*Analogie:* Es fungiert wie eine kosmische Zeitmaschine, die das infrarote Licht der allerersten Galaxien einfängt, die vor über 13,5 Milliarden Jahren kurz nach dem Urknall entstanden sind.

### ⚙️ Funktionsweise (Technische Grundlagen)
1. **Lagrange-Punkt L2:** Positioniert rund 1,5 Millionen Kilometer von der Erde entfernt im Schatten des Erde-Sonne-Systems.
2. **Beryllium-Gold-Spiegel:** Ein 6,5 Meter großer Primärspiegel aus 18 hexagonalen Segmenten mit hauchdünner Goldbeschichtung für maximale Infrarot-Reflexion.
3. **Kryogener 5-Lagen-Sonnenschild:** Hält die wissenschaftlichen Instrumente (NIRCam, NIRSpec, MIRI) bei ca. -233 °C (40 Kelvin) stabil.
4. **Neueste Entdeckungen:** Identifikation der frühesten Galaxie JADES-GS-z14-0 nur 290 Mio. Jahre nach dem Urknall sowie Atmosphärenanalysen von Exoplaneten wie K2-18b.`;
    }

    if (lang === 'Malayalam') {
      return `### 💡 അടിസ്ഥാന ആശയം & വിശദീകരണം (James Webb Space Telescope - JWST)
മനുഷ്യൻ നിർമ്മിച്ചതിൽ വച്ച് ഏറ്റവും ശക്തവും നൂതനവുമായ ഇൻഫ്രാറെഡ് ബഹിരാകാശ ദൂരദർശിനിയാണ് **ജെയിംസ് വെബ് സ്പേസ് ടെലിസ്കോപ്പ് (JWST)**.
*ഉദാഹരണം:* പ്രപഞ്ചത്തിന്റെ തുടക്കകാലമായ 13.5 ബില്യൺ വർഷങ്ങൾക്ക് മുൻപുള്ള പ്രകാശത്തെ ഒപ്പിയെടുക്കാൻ കഴിയുന്ന ഒരു "ടൈം മെഷീൻ" പോലെയാണിത് പ്രവർത്തിക്കുന്നത്.

### ⚙️ പ്രവർത്തന തത്വം (Core Mechanics)
1. **ലഗ്രാഞ്ച് പോയിന്റ് 2 (L2):** ഭൂമിയിൽ നിന്ന് 15 ലക്ഷം കിലോമീറ്റർ അകലെയുള്ള എൽ2 ബിന്ദുവിൽ നിന്നാണ് ഇത് പ്രവർത്തിക്കുന്നത്.
2. **സ്വർണ്ണം പൂശിയ ബെറിലിയം ദർപ്പണങ്ങൾ:** 6.5 മീറ്റർ വ്യാസമുള്ള 18 ഷഡ്ഭുജാകൃതിയിലുള്ള സ്വർണ്ണ കണ്ണാടികൾ ഇൻഫ്രാറെഡ് രശ്മികളെ കൃത്യമായി കേന്ദ്രീകരിക്കുന്നു.
3. **കണ്ടുപിടുത്തങ്ങൾ:** മഹാവിസ്ഫോടനത്തിന് (Big Bang) വെറും 290 ദശലക്ഷം വർഷങ്ങൾക്ക് ശേഷം രൂപംകൊണ്ട JADES-GS-z14-0 എന്ന പുരാതന ഗാലക്സിയെ വെബ് കണ്ടെത്തി.`;
    }

    if (lang === 'Kannada') {
      return `### 💡 ಪರಿಕಲ್ಪನೆಯ ಅರ್ಥ & ವಿವರಣೆ (James Webb Space Telescope - JWST)
**ಜೇಮ್ಸ್ ವೆಬ್ ಬಾಹ್ಯಾಕಾಶ ದೂರದರ್ಶಕ (JWST)** ಮಾನವ ಇತಿಹಾಸದಲ್ಲೇ ಅತ್ಯಂತ ಶಕ್ತಿಶಾಲಿ ಮತ್ತು ಸುಧಾರಿತ ಇನ್‌ಫ್ರಾರೆಡ್ ಬಾಹ್ಯಾಕಾಶ ವೀಕ್ಷಣಾಲಯವಾಗಿದೆ (NASA, ESA, CSA ಸಹಯೋಗ).
*ಹೋಲಿಕೆ:* ಇದು ಬ್ರಹ್ಮಾಂಡದ ಹುಟ್ಟಿನ ಕಾಲಕ್ಕೆ ಕೊಂಡೊಯ್ಯುವ "ಟೈಮ್ ಮೆಷಿನ್" ನಂತಿದ್ದು, 13.5 ಬಿಲಿಯನ್ ವರ್ಷಗಳ ಹಿಂದಿನ ನಕ್ಷತ್ರಗಳು ಮತ್ತು ಗೆಲಕ್ಸಿಗಳನ್ನು ಪತ್ತೆಹಚ್ಚುತ್ತದೆ.

### ⚙️ ಕಾರ್ಯವಿಧಾನ (How It Works)
1. **ಲ್ಯากรಾಂಜ್ ಪಾಯಿಂಟ್ 2 (L2):** ಭೂಮಿಯಿಂದ 15 ಲಕ್ಷ ಕಿ.ಮೀ ದೂರದಲ್ಲಿರುವ L2 ಕಕ್ಷೆಯಲ್ಲಿ ಸ್ಥಾಪಿತವಾಗಿದ್ದು, ತೀವ್ರ ಶೀತಲ ವಾತಾವರಣದಲ್ಲಿ (-233°C) ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ.
2. **ಚಿನ್ನದ ಲೇಪಿತ ಕನ್ನಡಿಗಳು:** 18 ಷಡ್ಭುಜಾಕಾರದ ಬೆರಿಲಿಯಮ್ ಕನ್ನಡಿಗಳು ಇನ್‌ಫ್ರಾರೆಡ್ ಬೆಳಕನ್ನು ನಿಖರವಾಗಿ ಪ್ರತಿಫಲಿಸುತ್ತವೆ.
3. **ಇತ್ತೀಚಿನ ಸಂಶೋಧನೆಗಳು:** ಬಿಗ್ ಬ್ಯಾಂಗ್ ಆದ ಕೇವಲ 290 ಮಿಲಿಯನ್ ವರ್ಷಗಳ ನಂತರ ರೂಪುಗೊಂಡ ಅತ್ಯಂತ ಪ್ರಾಚೀನ ಗೆಲಕ್ಸಿ JADES-GS-z14-0 ಅನ್ನು ಪತ್ತೆಹಚ್ಚಿದೆ.`;
    }

    return `### 💡 Concept Intuition & Direct Answer
The **James Webb Space Telescope (JWST)** is humanity's flagship infrared space observatory, engineered collaboratively by NASA, ESA, and CSA to study every phase in cosmic history.
*Analogy:* Think of JWST as a cosmic time machine. Because light takes time to travel across space, JWST's giant gold mirrors capture infrared light emitted over 13.5 billion years ago, letting us witness the birth of the very first stars and galaxies!

### ⚙️ How It Works (Step-by-Step Breakdown)
1. **Lagrange Point 2 (L2 Orbit):** Stationed ~1.5 million kilometers (1 million miles) from Earth, locked in an equilibrium orbit where Earth and Sun gravity balance, staying cold and shielded.
2. **6.5-Meter Primary Mirror:** Formed from 18 ultra-lightweight hexagonal beryllium segments, each vapor-coated with a microscopic layer of pure gold ($100\\text{ nm}$ thick) optimized for high infrared reflectivity.
3. **Five-Layer Kapton Sunshield:** Tennis-court-sized sunshield blocks solar, terrestrial, and lunar thermal radiation, maintaining science instruments below $40\\text{ Kelvin}$ ($-233^\\circ\\text{C}$).
4. **Science Payload:** NIRCam, NIRSpec, MIRI, and FGS/NIRISS capture high-resolution spectroscopy to determine the chemical composition of exoplanet atmospheres (water, methane, CO2).

### 🔬 Real-Time Scientific Breakthroughs
• **JADES-GS-z14-0 Discovery:** Confirmed the most distant and earliest galaxy ever observed, shining intensely just 290 million years after the Big Bang, revolutionizing astrophysical models of early star formation.
• **Exoplanet Atmospheric Profiles:** Detected carbon dioxide, water vapor, and potential biosignature precursors on habitable-zone exoplanets like WASP-96b, WASP-39b, and K2-18b.

### 🎯 Key Takeaways & Exam Points
• **Why Infrared?** As the universe expands, visible light from distant galaxies experiences **cosmic cosmological redshift**, stretching wavelengths into the infrared spectrum.
• **Hubble vs JWST:** Hubble observed primarily ultraviolet and visible light; JWST observes infrared, peering straight through dense cosmic dust clouds.`;
  }

  // 2. Real-Time Science: Chandrayaan-3 & Space Missions
  if (q.includes('chandrayaan') || q.includes('isro') || q.includes('moon landing') || q.includes('gaganyaan') || q.includes('aditya')) {
    if (lang === 'Telugu') {
      return `### 💡 కాన్సెప్ట్ అర్థం & ప్రత్యక్ష వివరణ (ISRO Chandrayaan-3)
భారత అంతరిక్ష పరిశోధనా సంస్థ (ISRO) చేపట్టిన **చంద్రయాన్-3 (Chandrayaan-3)** మిషన్ ద్వారా భారతదేశం చంద్రుని దక్షిణ ధ్రువం (Lunar South Pole) పై విజయవంతంగా అడుగుపెట్టిన ప్రపంచంలోనే మొట్టమొదటి దేశంగా చరిత్ర సృష్టించింది.

### ⚙️ ఇది ఎలా సాధ్యమైంది (Technical Execution)
1. **సాఫ్ట్ ల్యాండింగ్ టెక్నాలజీ:** విక్రమ్ ల్యాండర్ 4 థ్రస్టర్ ఇంజిన్లను నియంత్రిస్తూ '15 నిమిషాల భయంకరమైన వేగాన్ని' (15 Minutes of Terror) క్రమంగా తగ్గించి 'శివశక్తి పాయింట్' వద్ద సురక్షితంగా దిగింది.
2. **ప్రజ్ఞాన్ రోవర్ (Pragyan Rover):** 6 చక్రాల రోవర్ చంద్రుని మట్టిలో తిరుగుతూ LIBS (లేజర్ ఇండ్యూస్డ్ బ్రేక్‌డౌన్ స్పెక్ట్రోస్కోపీ) పరికరం ద్వారా **సల్ఫర్ (Sulfur), అల్యూమినియం, ఐరన్, కాల్షియం, టైటానియం** వంటి మూలకాలను ప్రత్యక్షంగా ధృవీకరించింది.
3. **ఉష్ణోగ్రత రికార్డు (ChaSTE):** చంద్రుని ఉపరితలంపై +50°C ఉండగా, కేవలం 8 సెం.మీ లోపల -10°C చల్లదనం ఉందని ChaSTE సెన్సార్ కనుగొంది.

### 🚀 భారత్ తదుపరి మిషన్లు
• **ఆదిత్య-L1 (Aditya-L1):** సూర్యుని పరిశీలించే తొలి భారతీయ సౌర వేధశాల, ప్రస్తుతం L1 పాయింట్ వద్ద నిరంతరం కరోనల్ మాస్ ఎజెక్షన్లను పర్యవేక్షిస్తోంది.
• **గగన్‌యాన్ (Gaganyaan):** భారతదేశం స్వదేశీ పరిజ్ఞానంతో వ్యోమగాములను లో-ఎర్త్ ఆర్బిట్‌లోకి పంపే తొలి మానవ సహిత అంతరిక్ష యాత్ర.`;
    }

    if (lang === 'Hindi') {
      return `### 💡 संकल्पना और मुख्य उत्तर (ISRO Chandrayaan-3)
**चंद्रयान-3 (Chandrayaan-3)** भारतीय अंतरिक्ष अनुसंधान संगठन (ISRO) का ऐतिहासिक चंद्र अन्वेषण मिशन है जिसने भारत को चंद्रमा के दक्षिणी ध्रुव पर सॉफ्ट-लैंडिंग करने वाला विश्व का पहला देश बनाया।

### ⚙️ तकनीकी विवरण (Step-by-Step Breakdown)
1. **विक्रम लैंडर व प्रज्ञान रोवर:** 23 अगस्त 2023 को विक्रम लैंडर ने चंद्रमा के 'शिव शक्ति' बिंदु पर सुरक्षित लैंडिंग की।
2. **सल्फर (Sulfur) की खोज:** प्रज्ञान रोवर के LIBS उपकरण ने पहली बार इन-सीटू परीक्षण द्वारा चंद्रमा की मिट्टी में सल्फर, लोहा, टाइटेनियम और एल्यूमीनियम की उपस्थिति की पुष्टि की।
3. **तापमान भिन्नता (ChaSTE):** सतह पर 50°C और महज 8 सेमी नीचे -10°C का भारी तापीय अंतर दर्ज किया।

### 🎯 मुख्य बिंदु
• भारत चंद्रमा पर सॉफ्ट लैंडिंग करने वाला चौथा देश और दक्षिणी ध्रुव पर उतरने वाला विश्व का पहला देश बना।`;
    }

    return `### 💡 Concept Intuition & Direct Answer
**Chandrayaan-3** is the historic lunar mission developed by the Indian Space Research Organisation (ISRO) that made India the **first nation in human history to achieve a soft-landing on the Moon's South Pole**, and the fourth nation globally to land on the lunar surface.

### ⚙️ Mission Architecture & Scientific Payload
1. **Propulsion & Lander Module (Vikram):** Executed autonomous hazard detection, throttleable liquid-propellant descent braking from $1.68\\text{ km/s}$ down to zero velocity at the **Shiv Shakti Point** ($69.37^\\circ\\text{S}, 32.35^\\circ\\text{E}$).
2. **Rover (Pragyan):** A 26-kg, 6-wheeled robotic rover equipped with:
   - **LIBS (Laser-Induced Breakdown Spectroscopy):** Used high-energy laser pulses to vaporize lunar regolith, conclusively confirming elemental **Sulfur (S)**, Iron, Calcium, and Titanium.
   - **APXS (Alpha Particle X-Ray Spectrometer):** Measured mineralogical compositions.
3. **ChaSTE (Chandra's Surface Thermophysical Experiment):** Inserted a thermal probe 8 cm deep, recording an astonishing thermal gradient (from $+50^\\circ\\text{C}$ on surface to $-10^\\circ\\text{C}$ just 8 cm below), demonstrating regolith's extreme thermal insulation properties.

### 🎯 Key Takeaways & Space Context
• **Why the Lunar South Pole?** Permanently shadowed craters retain billions of tons of water ice, a critical resource for rocket propellant ($H_2 + O_2$) and life support for future Artemis and lunar base missions.`;
  }

  // 3. Real-Time Science: Quantum Computing
  if (q.includes('quantum computing') || q.includes('qubit') || q.includes('superposition') || q.includes('entanglement')) {
    if (lang === 'Telugu') {
      return `### 💡 కాన్సెప్ట్ అర్థం & ప్రత్యక్ష వివరణ (Quantum Computing)
**క్వాంటం కంప్యూటింగ్ (Quantum Computing)** అనేది సాధారణ కంప్యూటర్ల మాదిరిగా బిట్స్ (0 లేదా 1) తో కాకుండా, క్వాంటం మెకానిక్స్ సూత్రాలైన **సూపర్‌పొజిషన్ (Superposition)** మరియు **ఎంటాంగిల్‌మెంట్ (Entanglement)** ఆధారంగా పనిచేసే విప్లవాత్మక కంప్యూటింగ్ సాంకేతికత.

### ⚙️ ముఖ్య భావనలు (Core Quantum Principles)
1. **క్యుబిట్ (Qubit):** క్లాసికల్ కంప్యూటర్‌లో ఒక బిట్ 0 లేదా 1 మాత్రమే అవుతుంది. కానీ క్యుబిట్ ఏకకాలంలో $|0\\rangle$ మరియు $|1\\rangle$ రెండింటి యొక్క సంభావ్యత మిశ్రమంగా (Superposition) ఉండగలదు:
   $$|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle$$
2. **ఎంటాంగిల్‌మెంట్ (Entanglement):** రెండు క్యుబిట్లు ఎంత దూరంలో ఉన్నా ఒకదానితో ఒకటి అనుసంధానించబడి ఉంటాయి. ఒక క్యుబిట్ స్థితి మారితే రెండోది తక్షణమే మారుతుంది (ఐన్‌స్టీన్ దీనిని "Spooky action at a distance" అన్నారు).
3. **క్వాంటం సుప్రీమసీ (Quantum Supremacy):** సాధారణ సూపర్‌కంప్యూటర్‌కు 10,000 సంవత్సరాలు పట్టే అత్యంత సంక్లిష్ట గణనను క్వాంటం కంప్యూటర్ కొన్ని సెకన్లలోనే పరిష్కరించగలదు!

### 🔬 నిజ జీవిత ఉపయోగాలు (Real-World Applications)
• **ఔషధాల ఆవిష్కరణ (Drug Discovery):** సంక్లిష్ట మాలిక్యూల్స్ మరియు ప్రోటీన్ ఫోల్డింగ్ సిమ్యులేషన్.
• **క్రిప్టోగ్రఫీ:** షోర్స్ అల్గారిథమ్ ద్వారా ప్రస్తుత RSA ఎన్‌క్రిప్షన్‌ను బద్దలు కొట్టగల సామర్థ్యం మరియు పోస్ట్-క్వాంటం క్రిప్టోగ్రఫీ.`;
    }

    return `### 💡 Concept Intuition & Direct Answer
**Quantum Computing** leverages the fundamental principles of quantum mechanics—specifically **Superposition**, **Quantum Entanglement**, and **Interference**—to perform complex parallel calculations exponentially faster than classical supercomputers.

### ⚙️ How It Works (Step-by-Step Breakdown)
1. **Qubits vs Classical Bits:**
   - A classical bit is deterministically either \`0\` or \`1\`.
   - A **Qubit** (quantum bit) exists in a linear combination of both states simultaneously:
     $$|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle \\quad \\text{where } |\\alpha|^2 + |\\beta|^2 = 1$$
   - While $N$ classical bits store $N$ values, $N$ entangled qubits store $2^N$ states simultaneously in superposition.
2. **Quantum Entanglement:**
   Two or more qubits become inextricably correlated such that the state of one instantly dictates the state of another, enabling massive parallel processing across entangled registers.
3. **Quantum Interference:**
   Algorithms (like Shor's and Grover's) use destructive interference to cancel out incorrect answers while constructive interference amplifies the probability amplitude of the correct answer.

### 🎯 Key Takeaways & Real-World Impact
• **Physical Systems:** Superconducting transmon qubits (IBM, Google), trapped-ion qubits, and topological qubits operating near absolute zero (15 millikelvin).
• **Shor's Algorithm:** Can factorize large prime numbers in polynomial time $O((\\log N)^3)$, necessitating worldwide migration to Post-Quantum Cryptography (NIST standards).`;
  }

  // 4. Real-Time Science: Nuclear Fusion Energy
  if (q.includes('nuclear fusion') || q.includes('fusion') || q.includes('tokamak') || q.includes('iter') || q.includes('net energy')) {
    return `### 💡 Concept Intuition & Direct Answer
**Nuclear Fusion** is the cosmic process that powers the Sun and all stars, where light atomic nuclei (typically isotopes of Hydrogen: Deuterium and Tritium) combine at extreme temperatures and pressures to form a heavier Helium nucleus, releasing colossal amounts of clean energy.
$$\\text{Reaction: } ^2\\text{H} + ^3\\text{H} \\rightarrow ^4\\text{He} (3.5\\text{ MeV}) + n (14.1\\text{ MeV}) + 17.6\\text{ MeV}$$

### ⚙️ How It Works & Breakthrough Milestones
1. **Overcoming Coulomb Barrier:** Positively charged hydrogen nuclei repel each other. To force them to fuse, fuel must be heated into a plasma state exceeding **100 to 150 million °C** (10x hotter than the Sun's core!).
2. **Confinement Approaches:**
   - **Magnetic Confinement (Tokamak / Stellarator):** Magnetic fields inside a donut-shaped chamber (e.g. ITER in France, KSTAR in South Korea) suspend the blazing plasma away from vessel walls.
   - **Inertial Confinement (Laser Fusion):** High-powered lasers compress a peppercorn-sized fuel pellet (achieved net energy gain $Q > 1$ at Lawrence Livermore National Laboratory NIF).
3. **Zero Carbon & Inherent Safety:** Unlike fission, fusion produces zero long-lived radioactive waste, cannot melt down (plasma collapses instantly if breached), and fuel is derived from seawater (Deuterium) and lithium (Tritium).`;
  }

  // 5. Facts Around the World: Cosmic, Earth & Biology Records
  if (q.includes('speed of light') || q.includes('mariana') || q.includes('brain') || q.includes('neurons') || q.includes('universe') || q.includes('cern') || q.includes('fact')) {
    if (lang === 'Telugu') {
      return `### 🌍 అద్భుతమైన ప్రపంచ & విజ్ఞాన శాస్త్ర వాస్తవాలు (Facts Around the World)

### 1. ⚡ కాంతి వేగం (The Speed of Light - $c$):
• కాంతి శూన్యంలో సెకనుకు సుమారు **2,99,792 కిలోమీటర్లు** ($3 \\times 10^8\\text{ m/s}$) వేగంతో ప్రయాణిస్తుంది.
• ఇది కేవలం ఒక సెకనులో భూమి చుట్టూ 7.5 సార్లు తిరగగలదు! సూర్యుని నుండి కాంతి భూమిని చేరడానికి 8 నిమిషాల 20 సెకన్లు పడుతుంది.

### 2. 🌊 మరియానా ట్రెంచ్ (Mariana Trench - భూమిపై అత్యంత లోతైన ప్రదేశం):
• పసిఫిక్ మహాసముద్రంలోని ఛాలెంజర్ డీప్ లోతు సుమారు **10,994 మీటర్లు** (సుమారు 11 కిలోమీటర్లు).
• ఎవరెస్ట్ పర్వతాన్ని (8,848 మీ) ఇక్కడ పెట్టినా, దానిపై ఇంకా 2 కిలోమీటర్ల మేర నీరు ఉంటుంది! ఇక్కడి నీటి పీడనం సముద్ర ఉపరితలం కంటే 1,000 రెట్లు ఎక్కువ.

### 3. 🧠 మానవ మెదడు & న్యూరాన్లు (The Human Brain):
• మానవ మెదడులో సుమారు **86 బిలియన్ న్యూరాన్లు** ఉంటాయి. ప్రతి న్యూరాన్ వేలాది సినాప్సెస్ ద్వారా అనుసంధానించబడి పెటాబైట్ల సమాచారాన్ని కేవలం 20 వాట్ల శక్తితో ప్రాసెస్ చేస్తుంది!

### 4. 🔬 సెర్న్ లార్జ్ హాడ్రాన్ కొలైడర్ (CERN LHC):
• స్విట్జర్లాండ్-ఫ్రాన్స్ సరిహద్దులో భూగర్భంలో 27 కిలోమీటర్ల పొడవైన సొరంగంలో ఉన్న ప్రపంచంలోనే అతిపెద్ద పార్టికల్ యాక్సిలరేటర్. 2012లో ద్రవ్యరాశిని ఇచ్చే "హిగ్స్ బోసన్" (గాడ్ పార్టికల్) ను ఇక్కడే కనుగొన్నారు.`;
    }

    if (lang === 'Hindi') {
      return `### 🌍 दुनिया और विज्ञान के रोचक तथ्य (Fascinating Facts Around the World)

### 1. ⚡ प्रकाश की गति (The Speed of Light):
• निर्वात में प्रकाश की गति **2,99,792,458 मीटर प्रति सेकंड** होती है। प्रकाश 1 सेकंड में पृथ्वी के 7.5 चक्कर लगा सकता है, और सूर्य से पृथ्वी तक आने में 8 मिनट 20 सेकंड लेता है।

### 2. 🌊 मारियाना ट्रेंच (Mariana Trench):
• प्रशांत महासागर में चैलेंजर डीप पृथ्वी का सबसे गहरा स्थान है, जिसकी गहराई लगभग **10,994 मीटर (लगभग 11 किमी)** है। यदि माउंट एवरेस्ट को इसमें डुबो दिया जाए, तो भी उसकी चोटी से 2 किमी ऊपर पानी रहेगा!

### 3. 🧠 मानव मस्तिष्क और न्यूरॉन्स:
• एक वयस्क मानव मस्तिष्क में लगभग **86 अरब (86 Billion) न्यूरॉन्स** होते हैं, जो मिलकर एक सुपरकंप्यूटर से भी अधिक गणना क्षमता केवल 20 वॉट ऊर्जा में संचालित करते हैं।

### 4. 🌌 अवलोकनीय ब्रह्मांड का विस्तार:
• दृश्य ब्रह्मांड का व्यास लगभग **93 अरब प्रकाश वर्ष** है, जिसमें 2 ट्रिलियन से अधिक आकाशगंगाएँ मौजूद हैं।`;
    }

    return `### 🌍 Fascinating Facts Around the World & Science

### 1. ⚡ The Speed of Light ($c = 299,792,458\\text{ m/s}$)
• The absolute cosmic speed limit of the universe. In just 1 second, a photon travels around the Earth's equator **7.5 times**. Light takes 8 minutes and 20 seconds to travel 150 million km from the Sun to Earth.

### 2. 🌊 The Mariana Trench (Deepest Spot on Earth)
• Located in the Western Pacific, Challenger Deep drops down to **10,994 meters (36,070 feet)**. If Mount Everest (8,848 m) were dropped into it, its peak would still be submerged under more than 2 kilometers of water! Hydrostatic pressure exceeds 1,000 atmospheres.

### 3. 🧠 The Human Brain & Neural Density
• Your brain houses approximately **86 billion neurons**, each with thousands of synaptic interconnections, forming an adaptive neural network capable of petabytes of associative memory powered by just ~20 watts of biochemical energy!

### 4. 🔬 CERN Large Hadron Collider (LHC)
• The world's largest scientific instrument: a 27-kilometer subterranean ring beneath France and Switzerland accelerating protons to 99.9999991% the speed of light at 13.6 TeV, confirming the existence of the Higgs Boson in 2012.

### 5. 🌌 Observable Universe Scale
• The observable universe spans **93 billion light-years** in diameter, containing an estimated 2 trillion galaxies and $10^{24}$ stars, while ordinary baryonic matter (atoms) makes up less than 5% of total cosmic mass-energy!`;
  }

  // 6. Multilingual Core Computer Science: Dijkstra's Algorithm
  if (q.includes('dijkstra') || q.includes('shortest path')) {
    if (lang === 'Telugu') {
      return `### 💡 కాన్సెప్ట్ అర్థం & ప్రత్యక్ష వివరణ (Dijkstra's Algorithm)
**డైక్‌స్ట్రాస్ అల్గారిథమ్ (Dijkstra's Algorithm)** అనేది నాన్-నెగటివ్ వెయిట్స్ (Non-negative edge weights) ఉన్న గ్రాఫ్‌లలో ఒక నిర్దిష్ట ప్రారంభ నోడ్ (Source Node) నుండి మిగిలిన అన్ని నోడ్స్‌కు అతి తక్కువ దూరాన్ని (Shortest Path) కనుగొనే గ్రీడీ అల్గారిథమ్ (Greedy Algorithm).
*పోలిక:* GPS మ్యాప్స్ లాంటిది. మీరు బయలుదేరిన చోటు నుండి చుట్టుపక్కల ఉన్న దగ్గరి కూడళ్లను చూస్తూ, గమ్యస్థానానికి తక్కువ దూరంలో చేరే మార్గాన్ని కనుగొంటుంది.

### ⚙️ ఇది ఎలా పనిచేస్తుంది (Step-by-Step Breakdown)
1. **ప్రారంభం (Initialization):** ప్రారంభ నోడ్ దూరాన్ని \`0\` గాను, మిగిలిన అన్ని నోడ్స్ దూరాన్ని అనంతం ($\infty$) గాను నిర్ణయించాలి.
2. **మిన్-హీప్ (Min-Heap / Priority Queue):** సందర్శించని నోడ్స్‌లో అతి తక్కువ దూరం ఉన్న నోడ్ $u$ ను బయటకు తీయాలి.
3. **రిలాక్సేషన్ (Edge Relaxation):** నోడ్ $u$ నుండి దాని పొరుగు నోడ్స్ $v$ కు ఉన్న దూరాన్ని సరిచూడాలి:
   \`if dist[u] + weight(u, v) < dist[v] => dist[v] = dist[u] + weight(u, v)\`
4. **ముగింపు:** ప్రాధాన్యత క్యూ ఖాళీ అయ్యే వరకు ఈ విధానాన్ని పునరావృతం చేయాలి.

### 💻 ప్రాక్టికల్ పైథాన్ కోడ్ (Python Implementation)
\`\`\`python
import heapq

def dijkstra(graph, start):
    distances = {node: float('infinity') for node in graph}
    distances[start] = 0
    pq = [(0, start)] # (distance, node)

    while pq:
        curr_dist, u = heapq.heappop(pq)
        if curr_dist > distances[u]:
            continue
        for neighbor, weight in graph.get(u, []):
            new_dist = curr_dist + weight
            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                heapq.heappush(pq, (new_dist, neighbor))
    return distances
\`\`\`

### 🎯 ఇంటర్వ్యూ & ఎగ్జామ్ ముఖ్యమైన పాయింట్లు
• **టైమ్ కాంప్లెక్సిటీ:** బైనరీ హీప్‌తో $O((V + E) \\log V)$, ఇక్కడ $V$ అంటే నోడ్స్, $E$ అంటే ఎడ్జెస్.
• **నెగటివ్ వెయిట్స్:** డైక్‌స్ట్రా నెగటివ్ వెయిట్స్ ఉన్న గ్రాఫ్‌లపై పనిచేయదు; అలాంటి గ్రాఫ్‌లకు **బెల్‌మ్యాన్-ఫోర్డ్ (Bellman-Ford)** అల్గారిథమ్ వాడాలి!`;
    }

    if (lang === 'Hindi') {
      return `### 💡 संकल्पना और मुख्य उत्तर (Dijkstra's Algorithm)
**डाइक्स्ट्रा का एल्गोरिदम (Dijkstra's Algorithm)** गैर-ऋणात्मक भार (non-negative edge weights) वाले भारित ग्राफ़ में एकल स्रोत से अन्य सभी शीर्षों (nodes) तक न्यूनतम दूरी (Shortest Path) ज्ञात करने के लिए उपयोग किया जाने वाला एक प्रसिद्ध ग्रीडी एल्गोरिदम (Greedy Algorithm) है।
*सादृश्य:* यह गूगल मैप्स की तरह है जो आपके वर्तमान स्थान से शुरू करके हमेशा निकटतम चौराहे का चयन करता है।

### ⚙️ कार्यप्रणाली (Step-by-Step Breakdown)
1. **आरंभीकरण:** स्रोत शीर्ष की दूरी को \`0\` और अन्य सभी शीर्षों की दूरी को अनन्त ($\infty$) सेट करें। एक मिन-प्रायोरिटी कतार (Min-Heap) का उपयोग करें।
2. **न्यूनतम दूरी चयन:** कतार से न्यूनतम दूरी वाले शीर्ष $u$ को निकालें।
3. **किनारा शिथिलन (Edge Relaxation):** यदि \`dist[u] + weight(u, v) < dist[v]\`, तो \`dist[v]\` को अपडेट करें।

### 🎯 मुख्य बिंदु
• समय जटिलता: $O((V + E) \\log V)$ मिन-हीप के साथ।
• ऋणात्मक भार (Negative Weights) पर काम नहीं करता (उसके लिए Bellman-Ford का उपयोग करें)।`;
    }

    if (lang === 'Tamil') {
      return `### 💡 கருத்து விளக்கம் & நேரடி விடை (Dijkstra's Algorithm)
**டிஜ்க்ஸ்ட்ரா அல்காரிதம் (Dijkstra's Algorithm)** என்பது எதிர்மறை எடையற்ற (non-negative weights) வரைபடத்தில் (Graph) ஒரு தொடக்க முனையிலிருந்து மற்ற அனைத்து முனைகளுக்கும் குறைந்தபட்ச தூரப் பாதையைக் (Shortest Path) கண்டறியும் ஒரு பேராசை நெறிமுறையாகும் (Greedy Algorithm).

### ⚙️ செயல்படும் விதம்
1. தொடக்க முனையின் தூரத்தை \`0\` எனவும், பிற முனைகளின் தூரத்தை முடிவிலி ($\infty$) எனவும் அமைக்கவும்.
2. குறைந்த தூரமுள்ள முனையை Min-Heap மூலமாகத் தேர்ந்தெடுத்து விளிம்பு தளர்வு (Edge Relaxation) செய்யவும்: \`dist[u] + weight(u, v) < dist[v]\`.
3. நேரம்: $O((V + E) \\log V)$. எதிர்மறை எடைகளுக்கு பெல்மேன்-ஃபோர்டு (Bellman-Ford) அல்காரிதத்தைப் பயன்படுத்த வேண்டும்.`;
    }

    if (lang === 'German') {
      return `### 💡 Konzept-Intuition & Direkte Erklärung (Dijkstra-Algorithmus)
Der **Dijkstra-Algorithmus** ist ein grundlegender gieriger Algorithmus (Greedy-Algorithmus), der den kürzesten Weg von einem einzelnen Startknoten zu allen anderen Knoten in einem gewichteten Graphen mit **nicht-negativen Kantengewichten** berechnet.
*Analogie:* Wie ein Navigationssystem (GPS), das ausgehend vom Startort schrittweise die nächstgelegene Kreuzung wählt und die kürzesten Fahrzeiten iterativ aktualisiert.

### ⚙️ Funktionsweise (Schritt-für-Schritt)
1. **Initialisierung:** Distanz zum Startknoten = \`0\`, alle anderen Knoten = $\\infty$. Min-Priority-Queue (Min-Heap) verwalten.
2. **Kantenrelaxation (Edge Relaxation):** Für Nachbarn $v$ von $u$: Wenn \`dist[u] + weight(u, v) < dist[v]\`, aktualisiere \`dist[v]\`.
3. **Komplexität:** $O((V + E) \\log V)$ mit Binärem Heap.
4. **Wichtige Einschränkung:** Funktioniert **nicht** bei negativen Kantengewichten (hierfür Bellman-Ford verwenden).`;
    }

    if (lang === 'Malayalam') {
      return `### 💡 അടിസ്ഥാന ആശയം & വിശദീകരണം (Dijkstra's Algorithm)
നെഗറ്റീവ് ഭാരങ്ങളില്ലാത്ത (Non-negative weights) ഒരു ഗ്രാഫിൽ ഒരു പ്രാരംഭ നോഡിൽ നിന്ന് മറ്റ് എല്ലാ നോഡുകളിലേക്കുമുള്ള ഏറ്റവും കുറഞ്ഞ ദൂരം (Shortest Path) കണ്ടെത്തുന്നതിനുള്ള പ്രശസ്തമായ ഗ്രീഡി അൽഗോരിതമാണ് **ഡൈക്‌സ്ട്ര അൽഗോരിതം (Dijkstra's Algorithm)**.
*ഉദാഹരണം:* ഗൂഗിൾ മാപ്‌സ് പോലെ ഏറ്റവും കുറഞ്ഞ സമയത്തിൽ ലക്ഷ്യസ്ഥാനത്ത് എത്താനുള്ള റൂട്ട് കണ്ടെത്തുന്നു.
• സമയം: $O((V + E) \\log V)$ മിൻ-ഹീപ്പ് ഉപയോഗിക്കുമ്പോൾ. നെഗറ്റീവ് വെയ്റ്റുകൾക്ക് ബെൽമാൻ-ഫോർഡ് (Bellman-Ford) ഉപയോഗിക്കണം.`;
    }

    if (lang === 'Kannada') {
      return `### 💡 ಪರಿಕಲ್ಪನೆಯ ಅರ್ಥ & ವಿವರಣೆ (Dijkstra's Algorithm)
ಋಣಾತ್ಮಕವಲ್ಲದ ತೂಕವಿರುವ (Non-negative edge weights) ಗ್ರಾಫ್‌ನಲ್ಲಿ ಒಂದು ಆರಂಭಿಕ ನೋಡ್‌ನಿಂದ ಇತರ ಎಲ್ಲಾ ನೋಡ್‌ಗಳಿಗೆ ಕನಿಷ್ಠ ದೂರದ ಮಾರ್ಗವನ್ನು (Shortest Path) ಕಂಡುಹಿಡಿಯಲು **ಡೈಕ್‌ಸ್ಟ್ರಾ ಅಲ್ಗಾರಿದಮ್ (Dijkstra's Algorithm)** ಅನ್ನು ಬಳಸಲಾಗುತ್ತದೆ.
• ಗೂಗಲ್ ಮ್ಯಾಪ್ಸ್ ರೀತಿಯಲ್ಲಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ.
• ಸಮಯದ ಸಂಕೀರ್ಣತೆ: $O((V + E) \\log V)$. ಋಣಾತ್ಮಕ ತೂಕಗಳಿದ್ದಾಗ ಬೆಲ್‌ಮನ್-ಫೋರ್ಡ್ (Bellman-Ford) ಅಲ್ಗಾರಿದಮ್ ಬಳಸಬೇಕು.`;
    }

    return `### 💡 Concept Intuition & Direct Answer
**Dijkstra's Algorithm** is the foundational greedy algorithm used to find the shortest path from a single source node to all other nodes in a weighted graph with **non-negative edge weights**.
*Analogy:* Think of GPS navigation. It progressively explores outwards from your starting point, always choosing the nearest unvisited intersection first, and constantly updating the shortest known driving time to neighboring cities.

### ⚙️ How It Works (Step-by-Step Breakdown)
1. **Initialization:** Assign distance = \`0\` to the source node and \`Infinity\` ($\infty$) to all other nodes. Maintain a min-priority queue (or min-heap) of unvisited nodes.
2. **Greedy Extraction:** In each step, extract the node $u$ with the minimum tentative distance from the priority queue.
3. **Edge Relaxation:** For every neighbor $v$ of $u$, calculate \`newDist = dist[u] + weight(u, v)\`. If \`newDist < dist[v]\`, update \`dist[v] = newDist\` and push/update $v$ in the priority queue.
4. **Termination:** Repeat until the priority queue is empty or the destination node is finalized.

### 💻 Practical Code (Python with Min-Heap)
\`\`\`python
import heapq

def dijkstra(graph, start):
    # graph: dict of {node: [(neighbor, weight)]}
    distances = {node: float('infinity') for node in graph}
    distances[start] = 0
    pq = [(0, start)] # (current_distance, node)

    while pq:
        curr_dist, u = heapq.heappop(pq)
        
        # Stale entry in priority queue: skip
        if curr_dist > distances[u]:
            continue

        for neighbor, weight in graph.get(u, []):
            distance = curr_dist + weight
            # Relaxation step
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                heapq.heappush(pq, (distance, neighbor))
                
    return distances

# Example Graph
graph = {
    'A': [('B', 2), ('C', 5)],
    'B': [('C', 1), ('D', 4)],
    'C': [('D', 1)],
    'D': []
}
print(dijkstra(graph, 'A')) # Output: {'A': 0, 'B': 2, 'C': 3, 'D': 4}
\`\`\`

### 🎯 Key Takeaways & Interview Traps
• **Complexity:** Time is $O((V + E) \log V)$ with a binary heap, where $V$ is vertices and $E$ is edges. Space is $O(V)$ for distance table and priority queue.
• **Negative Weight Trap:** Dijkstra **cannot** handle negative weights or negative cycles because once a node is marked visited, its distance is assumed minimal and never revisited. For graphs with negative weights, use the **Bellman-Ford algorithm** ($O(V \cdot E)$).
• **60-Second Interview Pitch:** *"Dijkstra is a greedy single-source shortest path algorithm for non-negative weighted graphs that uses a min-priority queue to iteratively relax neighboring distances in $O((V+E)\log V)$ time."*`;
  }

  // 7. Operating Systems: Deadlock & 4 Coffman Conditions
  if (q.includes('deadlock') || q.includes('coffman')) {
    if (lang === 'Telugu') {
      return `### 💡 కాన్సెప్ట్ అర్థం & ప్రత్యక్ష వివరణ (Deadlock & 4 Coffman Conditions)
ఆపరేటింగ్ సిస్టమ్‌లో **డెడ్‌లాక్ (Deadlock)** అంటే రెండు లేదా అంతకంటే ఎక్కువ ప్రాసెస్‌లు ఒకదానికొకటి కావాల్సిన వనరుల (Resources) కోసం నిరంతరం వేచి ఉంటూ, ఏ ప్రాసెస్ కూడా ముందుకు సాగలేని స్తంభించిన స్థితి.
*పోలిక:* నాలుగు కార్లు ఒకే సమయంలో నాలుగు వైపుల నుండి సింగిల్ లేన్ జంక్షన్‌లోకి వచ్చి, ఒకదానికొకటి ఎదురుగా ఆగిపోయి ఏ కారు ముందుకు వెళ్లలేని ట్రాఫిక్ జామ్ లాంటిది.

### ⚙️ 4 కాఫ్‌మ్యాన్ పరిస్థితులు (The 4 Coffman Conditions):
1. **మ్యూచువల్ ఎక్స్‌క్లూజన్ (Mutual Exclusion):** కనీసం ఒక రిసోర్స్ ఒకేసారి ఒక ప్రాసెస్ మాత్రమే వాడగలిగేలా ఉండాలి.
2. **హోల్డ్ అండ్ వెయిట్ (Hold and Wait):** ఒక ప్రాసెస్ ఇప్పటికే ఒక రిసోర్స్‌ను కలిగి ఉండి, మరో రిసోర్స్ కోసం వేచి ఉండాలి.
3. **నో ప్రీ-ఎంప్షన్ (No Preemption):** ఒక ప్రాసెస్ నుండి బలవంతంగా రిసోర్స్‌ను లాక్కోలేము; అది స్వచ్ఛందంగా మాత్రమే విడుదల చేయాలి.
4. **సర్క్యులర్ వెయిట్ (Circular Wait):** ప్రాసెస్ $P_0$ కోసం $P_1$, $P_1$ కోసం $P_2$, ..., మరియు $P_n$ కోసం $P_0$ వేచి ఉండే చక్రీయ శ్రేణి ఏర్పడాలి.

### 🎯 నివారణ ఉపాయం:
సర్క్యులర్ వెయిట్‌ను బద్దలు కొట్టడానికి, అన్ని రిసోర్స్‌లకు వరుస సంఖ్యలు కేటాయించి (Strict Resource Ordering), ఎల్లప్పుడూ ఆరోహణ క్రమంలోనే లాక్‌లను తీసుకోవాలి.`;
    }

    return `### 💡 Concept Intuition & Direct Answer
A **Deadlock** is a permanent operating system standstill where two or more processes are unable to proceed because each is holding a resource and waiting for another resource currently held by another process in the circular set.
*Analogy:* Four cars arriving at a 4-way single-lane intersection at the exact same moment; each car blocks the car behind it while waiting for the car in front to move.

### ⚙️ The 4 Coffman Conditions (Must occur simultaneously):
1. **Mutual Exclusion:** At least one resource must be non-shareable (held in an exclusive mode by only one process at a time).
2. **Hold and Wait:** A process is holding at least one resource while waiting to acquire additional resources held by others.
3. **No Preemption:** Resources cannot be forcibly revoked from a process; they can only be released voluntarily after completing its task.
4. **Circular Wait:** A closed chain of processes $\{P_0, P_1, ..., P_n\}$ exists where $P_0$ waits for a resource held by $P_1$, and $P_n$ waits for a resource held by $P_0$.

### 💻 Practical Code / Deadlock Fix (Python Simulation)
\`\`\`python
import threading
import time

lock_a = threading.Lock()
lock_b = threading.Lock()

# SAFE SOLUTION: Strict Global Resource Hierarchy
def safe_thread_worker(worker_id):
    # Rule: Always acquire locks in ascending order (lock_a then lock_b)
    with lock_a:
        time.sleep(0.05) # Simulated task
        with lock_b:
            print(f"Worker {worker_id} safely executed with both resources")

t1 = threading.Thread(target=safe_thread_worker, args=(1,))
t2 = threading.Thread(target=safe_thread_worker, args=(2,))
t1.start(); t2.start(); t1.join(); t2.join()
\`\`\`

### 🎯 Key Takeaways & Interview Traps
• **Prevention vs Avoidance:** Prevention invalidates one of the 4 Coffman conditions (most commonly eliminating Circular Wait via strict total resource ordering). Avoidance uses algorithms like **Banker's Algorithm** to dynamically ensure the system never enters an unsafe state.
• **Deadlock vs Starvation:** In Starvation, a process waits indefinitely while higher-priority processes make progress. In Deadlock, **no process** in the set can ever make progress.`;
  }

  // 8. General Comprehensive Academic Mentor Response
  const languageNames: Record<string, string> = {
    Telugu: 'తెలుగు (Telugu)',
    Hindi: 'हिन्दी (Hindi)',
    Tamil: 'தமிழ் (Tamil)',
    German: 'Deutsch (German)',
    Malayalam: 'മലയാളം (Malayalam)',
    Kannada: 'ಕನ್ನಡ (Kannada)',
    English: 'English',
  };

  const selectedName = languageNames[lang] || 'English';

  if (lang === 'Telugu') {
    return `### 💡 విద్యా విషయాల వివరణ (Educational Explanation in Telugu)

మీరు అడిగిన అంశం: **"${message}"**

### 🌟 ప్రాథమిక అవగాహన & ప్రత్యక్ష సమాధానం
ఈ అంశం ఆధునిక విద్యా విధానంలో మరియు ఇంజనీరింగ్ / సైన్స్ రంగాలలో అత్యంత కీలకమైనది.
• **నిర్వచనం:** సైన్స్ మరియు సాంకేతిక సూత్రాలను ఉపయోగించి సమస్యలను శాస్త్రీయంగా మరియు సమర్థవంతంగా పరిష్కరించడం దీని ముఖ్య ఉద్దేశం.
• **రోజువారీ పోలిక:** ఏదైనా క్లిష్టమైన యంత్రం లేదా సిస్టమ్‌ను అర్థం చేసుకోవడానికి, దాని అంతర్గత విడిభాగాలను దశలవారీగా పరిశీలించినట్లే, ఈ కాన్సెప్ట్ కూడా వ్యవస్థీకృత విధానాన్ని అందిస్తుంది.

### ⚙️ ఎలా పనిచేస్తుంది (Step-by-Step Breakdown)
1. **మొదటి దశ (Input & Governing Principles):** మూల సిద్ధాంతాలను మరియు ఆధారాలను సరిచూసుకోవడం.
2. **రెండవ దశ (Core Execution & Mechanics):** సూత్రాలు లేదా గణనలను క్రమపద్ధతిలో అమలు చేయడం.
3. **మూడవ దశ (Validation & Outcome):** ఫలితాలను పరిశీలించి, తప్పులను సరిచేయడం.

### 🎯 పరీక్షలు & ఇంటర్వ్యూలలో గుర్తుంచుకోవలసిన ముఖ్యమైన చిట్కాలు
• సమాధానం చెప్పేటప్పుడు ఎల్లప్పుడూ 1 వాక్యంలో ప్రధాన నిర్వచనం ఇవ్వండి, ఆ తర్వాత 1 నిజ జీవిత ఉదాహరణ చెప్పండి.
• సాంకేతిక పదాలను ఇంగ్లీష్ మరియు తెలుగు రెండింటిలోనూ అర్థం చేసుకోవడం వలన కాన్సెప్ట్ తేలికగా గుర్తుంటుంది!

✨ *మీరు దీనికి సంబంధించిన మరింత సమాచారం, ప్రాక్టికల్ లెక్కలు లేదా రేఖాచిత్రాలు (Diagrams) చూడాలనుకుంటున్నారా? అడగండి!*`;
  }

  if (lang === 'Hindi') {
    return `### 💡 शैक्षणिक विषय और संकल्पना (Educational Explanation in Hindi)

आपका प्रश्न: **"${message}"**

### 🌟 मूल अवधारणा और प्रत्यक्ष उत्तर
यह विषय शैक्षणिक और वैज्ञानिक दृष्टिकोण से अत्यंत महत्वपूर्ण है।
• **परिभाषा:** वैज्ञानिक और तकनीकी सिद्धांतों का उपयोग करके जटिल समस्याओं का सटीक समाधान करना इसका मुख्य लक्ष्य है।
• **दैनिक जीवन का उदाहरण:** जैसे किसी बड़े भवन की मजबूती उसकी ठोस नींव पर निर्भर करती है, वैसे ही यह संकल्पना संबंधित क्षेत्र में बुनियादी आधार प्रदान करती है।

### ⚙️ चरण-दर-चरण कार्यप्रणाली (Step-by-Step Breakdown)
1. **प्रथम चरण:** मौलिक नियमों और इनपुट को समझना।
2. **द्वितीय चरण:** मुख्य सिद्धांतों या एल्गोरिदम का निष्पादन।
3. **तृतीय चरण:** परिणाम का सत्यापन और निष्कर्ष।

### 🎯 मुख्य बिंदु
• तकनीकी शब्दावली को अंग्रेजी और हिंदी दोनों में समझें ताकि परीक्षा और साक्षात्कार में आत्मविश्वास से उत्तर दे सकें।

✨ *क्या आप इस पर और गहराई से चर्चा करना चाहते हैं? बेझिझक पूछें!*`;
  }

  if (lang === 'Tamil') {
    return `### 💡 கல்வி மற்றும் அறிவியல் விளக்கம் (Tamil)

உங்கள் கேள்வி: **"${message}"**

### 🌟 நேரடி விடை மற்றும் அடிப்படை விளக்கம்
இந்தக் கருத்து அறிவியல், பொறியியல் மற்றும் கல்வித்துறையில் மிகவும் முக்கியமானது.
• எளிய முறையில் புரிந்து கொள்ளும்போது இது பல நடைமுறை சிக்கல்களுக்குத் தீர்வை வழங்குகிறது.

### ⚙️ செயல்படும் விதம்
1. அடிப்படை விதிகள் மற்றும் கோட்பாடுகளைப் புரிந்துகொள்ளுதல்.
2. படிநிலையான அணுகுமுறை மற்றும் பரிசோதனை.
3. துல்லியமான விளைவை அடைதல்.

✨ *இதன் கூடுதல் விவரங்களை அறிய விரும்பினால் கேளுங்கள்!*`;
  }

  if (lang === 'German') {
    return `### 💡 Akademische Erklärung (Deutsch)

Ihre Frage zu: **"${message}"**

### 🌟 Konzept-Intuition & Direkte Erklärung
Dieses Thema ist eine fundamentale Säule in Wissenschaft, Ingenieurwesen und universitärer Ausbildung.
• **Definition:** Es beschreibt die systematische Modellierung und Lösung komplexer Fragestellungen auf Basis etablierter wissenschaftlicher Gesetzmäßigkeiten.
• **Analogie:** Wie das Fundament eines soliden Gebäudes bildet dieses Prinzip das theoretische und praktische Rückgrat in seinem Fachbereich.

### ⚙️ Funktionsweise (Schritt-für-Schritt)
1. **Grundlagen & Axiome:** Erfassung der Ausgangsbedingungen.
2. **Mechanismus:** Schrittweise Transformation und analytische Auswertung.
3. **Ergebnis:** Messbarer Nutzen und praktische Realisierung.

### 🎯 Wichtige Prüfungshinweise
• Definieren Sie das Konzept prägnant in 1 Satz, erläutern Sie den Kernmechanismus und schließen Sie mit einem greifbaren Praxisbeispiel ab.`;
  }

  if (lang === 'Malayalam') {
    return `### 💡 വിദ്യാഭ്യാസ വിഷയം - വിശദീകരണം (Malayalam)

നിങ്ങളുടെ ചോദ്യം: **"${message}"**

### 🌟 അടിസ്ഥാന ആശയവും വ്യക്തമായ ഉത്തരവും
വിദ്യാഭ്യാസ-സാങ്കേതിക മേഖലകളിൽ വളരെ പ്രാധാന്യമുള്ള ഒരു വിഷയമാണിത്.
ലളിതമായ നിത്യജീവിത ഉദാഹരണങ്ങളിലൂടെ ഈ ആശയം എളുപ്പത്തിൽ മനസ്സിലാക്കാൻ സാധിക്കും.

### ⚙️ പ്രവർത്തന രീതി
1. അടിസ്ഥാന തത്വങ്ങൾ മനസ്സിലാക്കുക.
2. ഘട്ടം ഘട്ടമായുള്ള വിശകലനം.
3. കൃത്യമായ ഫലം വിലയിരുത്തൽ.

✨ *കൂടുതൽ ചോദ്യങ്ങൾ ഉണ്ടെങ്കിൽ ചോദിക്കാവുന്നതാണ്!*`;
  }

  if (lang === 'Kannada') {
    return `### 💡 ಶೈಕ್ಷಣಿಕ ವಿಷಯದ ವಿವರಣೆ (Kannada)

ನಿಮ್ಮ ಪ್ರಶ್ನೆ: **"${message}"**

### 🌟 ಮೂಲ ಪರಿಕಲ್ಪನೆ ಮತ್ತು ವಿವರಣೆ
ಈ ವಿಷಯವು ವಿಜ್ಞಾನ, ಎಂಜಿನಿಯರಿಂಗ್ ಮತ್ತು ಶೈಕ್ಷಣಿಕ ಕ್ಷೇತ್ರದಲ್ಲಿ ಅತ್ಯಂತ ಮುಖ್ಯವಾದುದು.
• ದೈನಂದಿನ ಜೀವನದ ಉದಾಹರಣೆಗಳೊಂದಿಗೆ ಈ ಪರಿಕಲ್ಪನೆಯನ್ನು ಸುಲಭವಾಗಿ ಗ್ರಹಿಸಬಹುದು.

### ⚙️ ಕಾರ್ಯವಿಧಾನ
1. ಮೂಲ ನಿಯಮಗಳನ್ನು ತಿಳಿದುಕೊಳ್ಳುವುದು.
2. ಹಂತ ಹಂತವಾಗಿ ವಿಶ್ಲೇಷಣೆ ನಡೆಸುವುದು.
3. ನಿಖರವಾದ ಫಲಿತಾಂಶವನ್ನು ಪಡೆಯುವುದು.

✨ *ನೀವು ಈ ವಿಷಯದ ಬಗ್ಗೆ ಹೆಚ್ಚಿನ ಮಾಹಿತಿ ಬಯಸಿದರೆ ಕೇಳಬಹುದು!*`;
  }

  // 1. Computer Science & Core Algorithms
  if (q.includes('quicksort') || q.includes('mergesort') || q.includes('sort')) {
    return `### 💡 Concept Intuition & Direct Answer
Both **QuickSort** and **MergeSort** are divide-and-conquer sorting algorithms with an average time complexity of $O(n \log n)$, but they conquer in reverse order:
• **MergeSort:** Divides the array in half first unconditionally, sorts the sub-arrays recursively, and does the heavy work during the **merge step**.
• **QuickSort:** Does the heavy work first by **partitioning** elements around a chosen pivot, and then sorts the sub-arrays in-place without needing extra merge steps.

### ⚙️ Architectural & Complexity Comparison
| Feature | QuickSort | MergeSort |
| :--- | :--- | :--- |
| **Best / Avg Time** | $O(n \log n)$ | $O(n \log n)$ |
| **Worst Time** | $O(n^2)$ (poor pivot selection) | $O(n \log n)$ (guaranteed) |
| **Space Complexity** | $O(\log n)$ call stack (In-Place) | $O(n)$ auxiliary array |
| **Stability** | Unstable by default | **Stable** (preserves relative order) |
| **Best For** | In-memory arrays, cache-locality | Linked lists, external disk sorting |

### 💻 Practical Code: QuickSort Partition & MergeSort
\`\`\`python
# QuickSort (In-place Lomuto Partition)
def quicksort(arr, low, high):
    if low < high:
        pi = partition(arr, low, high)
        quicksort(arr, low, pi - 1)
        quicksort(arr, pi + 1, high)

def partition(arr, low, high):
    pivot = arr[high]
    i = low - 1
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1
\`\`\`

### 🎯 Key Takeaways & Interview Traps
• **Worst-Case Mitigation:** QuickSort hits $O(n^2)$ when the pivot is always the smallest or largest element (e.g., sorted array with last element pivot). Fix: **Randomized pivot selection** or **Median-of-three**.
• **Why Java/Python use both:** Java uses Dual-Pivot QuickSort for primitive arrays (faster cache locality, no objects), and TimSort (hybrid MergeSort) for reference objects where stability is strictly required.`;
  }

  if (q.includes('binary search') || q.includes('off by one')) {
    return `### 💡 Concept Intuition & Direct Answer
**Binary Search** is an optimal $O(\log n)$ search algorithm that repeatedly divides a sorted search interval in half.
*Core Invariant:* If the target value is less than the middle element, it must be in the left half; otherwise, it must be in the right half.

### ⚙️ Boundary Rules to Eliminate Off-by-One Bugs
1. **Loop Condition:** Use \`while low <= high:\` when searching for an exact element.
2. **Integer Overflow:** In languages like Java/C++, never do \`(low + high) / 2\`. Do \`mid = low + (high - low) // 2\` to avoid 32-bit signed integer overflow.
3. **Pointers Update:** Always do \`low = mid + 1\` or \`high = mid - 1\` to ensure guaranteed convergence and prevent infinite loops.

### 💻 Practical Code (Python with Robust Bounds)
\`\`\`python
def binary_search(nums, target):
    low, high = 0, len(nums) - 1
    
    while low <= high:
        mid = low + (high - low) // 2 # Prevents arithmetic overflow
        
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
            
    return -1 # Not found
\`\`\`

### 🎯 Key Takeaways & Interview Traps
• **Lower Bound / Upper Bound:** In interview problems (e.g. finding first occurrence), adjust the condition to \`while low < high\` and compress the search range without discarding potential candidates.
• **Prerequisite:** The input array **must be sorted** or exhibit a monotonic predicate (True/False property).`;
  }

  if (q.includes('process') && q.includes('thread') || q.includes('concurrency')) {
    return `### 💡 Concept Intuition & Direct Answer
• A **Process** is an independent executing program instance with its own dedicated virtual memory address space (text, data, heap, and open file descriptors).
• A **Thread** is the smallest unit of CPU execution *inside* a process. Multiple threads within the same process share the same heap, global variables, and code section, but each has its own private stack and registers.

### ⚙️ Core Technical Comparison
| Dimension | Process | Thread |
| :--- | :--- | :--- |
| **Address Space** | Isolated (safe, protected) | Shared (risk of race conditions) |
| **Creation Overhead** | High (allocates new page tables, PCB) | Low (shares existing process memory) |
| **Context Switching** | Slow (flushes CPU TLB caches) | Fast (no page table flush) |
| **Communication** | Inter-Process Comm (Pipes, Sockets, Shared Memory) | Direct memory reads/writes |
| **Failure Impact** | One crash doesn't crash others | One uncaught crash can kill the entire process |

### 🎯 Key Takeaways & Interview Traps
• **Race Conditions:** Because threads share memory, concurrent writes without synchronization (Mutex/Locks) cause non-deterministic data corruption.
• **Context Switch Cost:** A process context switch is expensive primarily because it invalidates the CPU's **Translation Lookaside Buffer (TLB)**, degrading cache performance until warmed up.`;
  }

  if (q.includes('acid') || q.includes('transaction')) {
    return `### 💡 Concept Intuition & Direct Answer
**ACID** is the set of four foundational guarantees that relational database transactions must satisfy to ensure absolute data integrity even across hardware crashes, power outages, or concurrent operations.

### ⚙️ Detailed Breakdown:
1. **Atomicity ("All or Nothing"):** Either every operation in the transaction executes successfully, or the entire transaction is rolled back to its initial state. Implemented via the **Write-Ahead Log (WAL)** or undo log.
2. **Consistency:** A transaction transitions the database from one valid state to another valid state, upholding all schema constraints, foreign keys, and business rules.
3. **Isolation:** Concurrent transactions execute without interfering with one another. Standard SQL isolation levels: *Read Uncommitted*, *Read Committed*, *Repeatable Read*, and *Serializable*. Implemented via **Two-Phase Locking (2PL)** or **MVCC (Multi-Version Concurrency Control)**.
4. **Durability:** Once a transaction commits, its modifications are permanently recorded in non-volatile storage and survive any immediate server crash. Implemented via persistent write-ahead logging.

### 🎯 Key Takeaways & Interview Traps
• **Isolation Anomalies:** Dirty Reads (reading uncommitted data), Non-Repeatable Reads (row changes between reads), and Phantom Reads (new rows inserted matching search range).
• **Real-World Trade-Off:** Higher isolation levels (Serializable) prevent all anomalies but drastically reduce database write concurrency and throughput.`;
  }

  if (q.includes('tcp') || q.includes('handshake') || q.includes('udp')) {
    return `### 💡 Concept Intuition & Direct Answer
• **TCP (Transmission Control Protocol):** Connection-oriented, reliable, ordered protocol with flow control and congestion avoidance. Used for HTTP/HTTPS, WebSockets, SSH, and file downloads.
• **UDP (User Datagram Protocol):** Connectionless, lightweight, unreliable "fire-and-forget" protocol with zero overhead. Used for VoIP, video streaming, DNS, and multiplayer gaming.

### ⚙️ The TCP 3-Way Handshake (Connection Establishment)
1. **SYN (Synchronize):** Client selects an initial sequence number ($ISN_C$) and sends a packet with \`SYN = 1\` to the server. (Client enters \`SYN_SENT\`).
2. **SYN-ACK:** Server receives SYN, allocates socket buffers, selects its own initial sequence number ($ISN_S$), and sends a packet with \`SYN = 1, ACK = ISN_C + 1\`. (Server enters \`SYN_RCVD\`).
3. **ACK:** Client receives SYN-ACK and sends \`ACK = ISN_S + 1\`. (Both transition to \`ESTABLISHED\`). Data transmission can now begin!

### 🎯 Key Takeaways & Interview Traps
• **Why 3 steps and not 2?** Two messages cannot reliably confirm two-way communication. The server must verify that the client can receive packets before dedicating resources to the connection, preventing stale duplicate packets from ghost connections.
• **Connection Teardown:** TCP termination requires **4 steps (FIN, ACK, FIN, ACK)** because TCP is full-duplex; one side can close sending while still receiving incoming data.`;
  }

  if (q.includes('star') || q.includes('behavioral')) {
    return `### 💡 Concept Intuition & Direct Answer
The **STAR Framework** (Situation, Task, Action, Result) is the gold-standard method for delivering structured, quantifiable behavioral interview answers for engineering internships and full-time roles.

### ⚙️ How to Structure Your Response (Time Distribution):
• **Situation (15%):** Briefly set the technical context, team setup, and constraints.
• **Task (15%):** Clarify your explicit responsibility (not just the team's goal).
• **Action (50% - THE CORE):** Detail the exact engineering decisions *you* made, trade-offs evaluated, tools implemented, and how you navigated roadblocks.
• **Result (20%):** Quantify the tangible outcome with metrics (speedups, error reductions, user satisfaction).

### 💻 Concrete Engineering Example
*"In our 3rd-year capstone project (Situation), our real-time WebSocket backend began crashing under mock load of 500 concurrent connections 48 hours before evaluation (Task). As the backend lead, I profiled our Node.js memory heaps using Chrome DevTools, traced the bottleneck to uncleaned event listeners inside disconnected socket instances, and implemented an automated garbage collection cleanup hook with Redis adapter pub/sub (Action). As a result, memory consumption stabilized by 65%, connection latency dropped from 420ms to 78ms, and our team scored an A on the evaluation (Result)."*

### 🎯 Key Takeaways:
• Always speak in terms of **"I did"** rather than "we did" for the Action portion so the interviewer can evaluate your individual contribution.`;
  }

  if (q.includes('tell me about yourself') || q.includes('introduce') || q.includes('introduction')) {
    return `### 💡 Concept Intuition & Direct Answer
"Tell me about yourself" is not a reading of your resume; it is an **elevator pitch** demonstrating technical passion, relevant projects, and cultural alignment within 75 to 90 seconds.

### ⚙️ The Present-Past-Future Formula:
1. **Present (30s):** Who you are, your degree/branch, and your primary technical domain.
2. **Past (40s):** 1-2 major technical accomplishments or projects that prove real problem-solving ability.
3. **Future (20s):** Why you are excited about this specific engineering role and company.

### 💻 Example Script for Engineering Students
*"I am currently a pre-final year Computer Science undergraduate at college with a deep interest in distributed systems and full-stack web architectures. Recently, I built a real-time collaborative communication platform using WebSockets, WebRTC, and PostgreSQL, where I solved high-concurrency connection sync issues and cut latency down to under 80ms. That project solidified my passion for backend performance and systems design. I've been following how your engineering team scales microservices for millions of users, and I'm eager to bring my strong problem-solving foundation to this software engineering internship."*

### 🎯 Key Takeaways:
• Keep delivery between 150 and 180 words. Avoid reciting school grades or childhood stories; focus on software engineering curiosity and results.`;
  }

  if (q.includes('filler') || q.includes('um') || q.includes('pacing')) {
    return `### 💡 Concept Intuition & Direct Answer
Filler words (*"um", "like", "basically", "you know"*) happen when your speaking speed outpaces your cognitive formulating speed. Your brain inserts noise to prevent perceived silence.

### ⚙️ Practical Action Steps:
1. **The 1-Second Power Pause:** When transitioning between thoughts, close your lips and take a silent 1-second breath. Silence sounds thoughtful and composed to an interviewer; fillers sound hesitant.
2. **Transition Anchors:** Replace fillers with professional framing: *"From an architectural standpoint..."*, *"Looking at the trade-offs..."*, or *"The primary metric to consider here is..."*
3. **Pacing Target:** Aim for 130–150 words per minute. Practice recording your 60-second answers and counting your pauses.`;
  }

  if (q.includes('gd') || q.includes('group discussion')) {
    return `### 💡 Concept Intuition & Direct Answer
Group Discussions (GD) evaluate structured thinking, active listening, polite assertion, and team collaboration under pressure—not aggressive dominance.

### ⚙️ Essential Transition Scripts:
• **Building on a point:** *"I agree with Rahul's point regarding cloud scalability, and to take that further, we must consider cost governance..."*
• **Respectful counter:** *"Sneha makes a valid observation on initial deployment speed; however, if we evaluate long-term technical debt, an alternative architecture emerges..."*
• **Consensus builder:** *"We have shared valuable perspectives on technology and security. Let us now summarize the key implementation trade-offs before time elapses."*

### 🎯 Key Takeaways & Peer Feedback:
• Never interrupt abruptly. Wait for a natural breath pause, use open posture, and acknowledge the prior speaker before transitioning.`;
  }

  // 1. Peer Feedback & Review Mode
  if (q.includes('review my') || q.includes('peer feedback') || q.includes('rate my') || q.includes('critique my') || q.includes('check my answer') || q.includes('feedback on my')) {
    return `### 🤝 Fluencis Peer Practice Review & Suggestions

Here is your detailed peer evaluation breakdown:

### 🌟 Key Strengths (What Shined)
• **Clear Premise:** You establish the core context early, avoiding unnecessary hesitation.
• **Authentic Tone:** Your voice sounds enthusiastic and grounded in practical experience.
• **Relevance:** The core message addresses the heart of the prompt directly.

### 💡 Constructive Critique & Areas to Improve
• **Structure:** Try tightening your response into three clear beats: (1) Main claim/thesis, (2) Concrete example or metric, and (3) Broader takeaway.
• **Quantifiable Impact:** Replace general phrases like *"improved it significantly"* with approximate metrics or concrete outcomes (e.g., *"reduced latency by ~30%"* or *"saved the team 4 hours weekly"*).
• **Pacing & Breathing:** Pause silently for 1 second between ideas rather than rushing through transitions.

### ✍️ Polished Alternative (Upgraded Rephrasing)
*"When tackling this challenge, my primary focus was balancing rapid delivery with long-term reliability. Specifically, I broke down the bottleneck into three actionable steps: profiling the root cause, isolating edge cases, and implementing automated validation. As a direct result, our turnaround time improved substantially and team confidence grew."*

### 🎯 Next Practice Challenge & Discussion Starters
1. **Challenge 1:** Try delivering this answer in under 60 seconds with zero filler words ("um", "like", "basically").
2. **Challenge 2:** How would you adapt this answer if the interviewer specifically asks about your biggest mistake during the process?`;
  }

  // 2. Natural Sciences: Biology, Genetics & Biotech
  if (q.includes('central dogma') || q.includes('transcription') || q.includes('dna') || q.includes('crispr') || q.includes('photosynthesis')) {
    return `### 💡 Concept Intuition & Direct Answer
The **Central Dogma of Molecular Biology** describes the fundamental directional flow of genetic information within biological systems:
$$\\text{DNA} \\xrightarrow{\\text{Transcription}} \\text{mRNA} \\xrightarrow{\\text{Translation}} \\text{Protein}$$
*Analogy:* Think of DNA as the master blueprint locked safely in an architect's vault (the nucleus). RNA is the portable photocopy taken to the construction site (the ribosome), and Proteins are the actual brick-and-mortar buildings that perform functional work.

### ⚙️ How It Works (Step-by-Step Biological Mechanics)
1. **Replication (DNA $\\rightarrow$ DNA):** DNA Polymerase duplicates genetic material with high fidelity ($3' \\rightarrow 5'$ reading, $5' \\rightarrow 3'$ synthesis) prior to cell division.
2. **Transcription (DNA $\\rightarrow$ mRNA):** RNA Polymerase binds to a gene's promoter region, unwinds the double helix, and transcribes the template strand into precursor messenger RNA. In eukaryotes, introns are spliced out, adding a 5' cap and poly-A tail.
3. **Translation (mRNA $\\rightarrow$ Protein):** Ribosomes read mRNA codons in triplets. Transfer RNA (tRNA) molecules carry matching amino acids to synthesize polypeptide chains, which fold into active 3D enzymes and structural proteins.

### 🔬 Real-World Application & Case Study
• **CRISPR-Cas9 Gene Editing:** Utilizes guide RNA to target precise genomic coordinates, allowing molecular scissors (Cas9) to introduce targeted gene knockouts or insertions.
• **mRNA Vaccines:** Instead of injecting weakened pathogens, mRNA sequences instruct human cells to temporarily express harmless viral spike proteins, eliciting robust immune memory.

### 🎯 Key Takeaways & Exam Traps
• **Exceptions:** Retroviruses (like HIV) utilize **Reverse Transcriptase** to convert RNA back into DNA, violating the strict unidirectional model!
• **60-Second Exam Pitch:** *"The central dogma governs genetic expression: DNA is transcribed into messenger RNA in the nucleus, which is then translated by ribosomes in the cytoplasm into functional proteins that drive cellular biochemistry."*

### ✨ Next Steps & Peer Discussion Starters
• *Discussion Question:* How does epigenetic methylation affect gene transcription without changing the underlying DNA sequence?`;
  }

  // 3. Electrical & Electronics Engineering
  if (q.includes('ohm') || q.includes('kirchhoff') || q.includes('kvl') || q.includes('kcl') || q.includes('diode') || q.includes('transistor') || q.includes('mosfet')) {
    return `### 💡 Concept Intuition & Direct Answer
**Ohm's Law ($V = IR$)** and **Kirchhoff's Laws (KCL & KVL)** form the bedrock of circuit analysis across all electrical and electronic systems.
*Analogy:* Think of water flowing through pipes: **Voltage ($V$)** is water pressure, **Current ($I$)** is the rate of flow (liters/sec), and **Resistance ($R$)** is pipe friction or constriction.

### ⚙️ How It Works (Core Governing Equations)
1. **Ohm's Law:** $V = I \\cdot R$ (Voltage across a conductor is directly proportional to current flowing through it at constant temperature).
2. **Kirchhoff's Current Law (KCL - Conservation of Charge):**
   $$\\sum I_{\\text{in}} = \\sum I_{\\text{out}}$$
   The algebraic sum of all currents entering and leaving any circuit node is zero.
3. **Kirchhoff's Voltage Law (KVL - Conservation of Energy):**
   $$\\sum V_{\\text{loop}} = 0$$
   The algebraic sum of all electrical potential differences around any closed circuit loop is zero.

### ⚡ Practical Circuit Example
\`\`\`text
  +---[ R1 = 4Ω ]---+---[ R2 = 6Ω ]---+
  |                                   |
 (10V)                                |
  |                                   |
  +-----------------------------------+
  Total Series Resistance R_eq = 4 + 6 = 10Ω
  Current I = V / R_eq = 10V / 10Ω = 1.0 Ampere
  Voltage Drop V1 = 1A * 4Ω = 4V
  Voltage Drop V2 = 1A * 6Ω = 6V (Sum = 10V, satisfying KVL!)
\`\`\`

### 🎯 Key Takeaways & Exam Traps
• **Non-Ohmic Devices:** Semiconductors (diodes, transistors, thermistors) do NOT obey linear Ohm's law; their $I-V$ characteristic is non-linear and exponential!
• **Node vs Mesh Analysis:** Use KCL for nodal voltage analysis when a circuit has multiple parallel branches; use KVL for mesh current analysis in planar circuits.

### ✨ Next Steps & Peer Discussion Starters
• *Discussion Question:* How does the depletion region in a PN junction diode change under forward vs reverse bias?`;
  }

  // 4. Mechanical & Civil Engineering
  if (q.includes('stress') || q.includes('strain') || q.includes('hooke') || q.includes('bernoulli') || q.includes('fluid') || q.includes('thermodynamics') || q.includes('carnot')) {
    return `### 💡 Concept Intuition & Direct Answer
**Stress vs. Strain** and **Hooke's Law** describe how solid structural materials deform under external loads, forming the foundation of mechanical design and civil structural integrity.
• **Stress ($\\sigma$):** Internal resisting force per unit area ($\ ext{N/m}^2$ or Pascals).
• **Strain ($\\varepsilon$):** Fractional physical deformation or elongation (dimensionless ratio $\\Delta L / L_0$).

### ⚙️ How It Works & The Stress-Strain Curve
1. **Hooke's Law (Elastic Region):** $\\sigma = E \\cdot \\varepsilon$, where $E$ is **Young's Modulus** (a material's intrinsic stiffness).
2. **Proportional & Elastic Limit:** Below this threshold, when the load is removed, the material returns completely to its original dimensions with zero permanent deformation.
3. **Yield Point ($\\sigma_y$):** The boundary where permanent plastic deformation begins.
4. **Ultimate Tensile Strength (UTS):** Maximum engineering stress the material can sustain before necking.
5. **Fracture Point:** The point of physical rupture or structural failure.

### 🏗️ Practical Engineering Application
• **Factor of Safety (FoS):** In civil bridges and aerospace airframes, working stress is strictly maintained well below yield stress: $\\text{FoS} = \\frac{\\sigma_{\\text{yield}}}{\\sigma_{\\text{allowable}}} > 1.5 - 3.0$.
• **Bernoulli's Principle ($P + \\frac{1}{2}\\rho v^2 + \\rho g h = \\text{constant}$):** Explains fluid pressure drops in converging nozzles (Venturi effect) and aerodynamic lift on aircraft wings.

### 🎯 Key Takeaways & Exam Traps
• **Ductile vs Brittle:** Mild steel exhibits pronounced yielding and plastic elongation before failure; concrete and cast iron exhibit almost no plastic deformation and fracture abruptly without warning!

### ✨ Next Steps & Peer Discussion Starters
• *Discussion Question:* In structural beam design, why is an I-beam significantly more weight-efficient against bending stress than a solid rectangular beam?`;
  }

  // 5. Business, Economics & Management
  if (q.includes('supply and demand') || q.includes('elasticity') || q.includes('inflation') || q.includes('gdp') || q.includes('npv') || q.includes('irr') || q.includes('balance sheet') || q.includes('porter')) {
    return `### 💡 Concept Intuition & Direct Answer
**Supply and Demand** and **Price Elasticity** govern price discovery, resource allocation, and market equilibrium in microeconomics and business strategy.
*Analogy:* Market equilibrium is like a financial thermostat. If prices are set too high, excess inventory (surplus) forces discounts; if prices are too low, shortages drive competitive bidding until equilibrium price ($P^*$) clears the market.

### ⚙️ How It Works (Core Economic Mechanics)
1. **Law of Demand:** Ceteris paribus (all else equal), as price increases, quantity demanded decreases (downward-sloping curve).
2. **Law of Supply:** As market price increases, suppliers are incentivized to produce more units (upward-sloping curve).
3. **Price Elasticity of Demand (PED):**
   $$E_d = \\frac{\\% \\Delta Q_d}{\\% \\Delta P}$$
   • $|E_d| > 1$ (**Elastic**): Consumers are highly price-sensitive (luxury goods, non-essentials).
   • $|E_d| < 1$ (**Inelastic**): Consumers purchase regardless of price increases (gasoline, life-saving medicines).

### 📊 Business Case Study & Finance
• **Net Present Value (NPV):** Evaluates capital investments by discounting future cash flows:
  $$\\text{NPV} = \\sum_{t=1}^n \\frac{C_t}{(1 + r)^t} - C_0$$
  If $\\text{NPV} > 0$, the project generates value above the cost of capital ($r$).
• **Porter's 5 Forces:** Analyzes industry attractiveness through Threat of New Entrants, Bargaining Power of Buyers, Bargaining Power of Suppliers, Threat of Substitutes, and Competitive Rivalry.

### 🎯 Key Takeaways & Exam Traps
• **Shift vs Movement:** A change in the product's *own price* causes a **movement along** the curve. A change in external factors (consumer income, tariffs, competitor prices) **shifts the entire curve**!

### ✨ Next Steps & Peer Discussion Starters
• *Discussion Question:* When launching a SaaS product, how do network effects make demand relatively inelastic over time?`;
  }

  // 6. Psychology, Humanities & Social Sciences
  if (q.includes('maslow') || q.includes('psychology') || q.includes('cbt') || q.includes('conditioning') || q.includes('constitution') || q.includes('ethics')) {
    return `### 💡 Concept Intuition & Direct Answer
**Maslow's Hierarchy of Needs** is a foundational psychological framework proposing that human motivation is governed by a hierarchical progression of physiological and psychological needs.
*Analogy:* Building a pyramid. You cannot construct the decorative peak without solid foundation blocks. An individual struggling for food and safety cannot prioritize self-actualization or philosophical pursuits.

### ⚙️ The 5 Levels of Maslow's Pyramid (Base to Summit):
1. 🍞 **Physiological Needs:** Basic biological survival (air, water, food, shelter, sleep).
2. 🛡️ **Safety & Security:** Physical security, health, employment, financial and emotional stability.
3. 🤝 **Love & Social Belonging:** Friendships, intimate relationships, family ties, and community acceptance.
4. 🌟 **Esteem Needs:** Self-respect, status, recognition, competence, and peer reputation.
5. 🚀 **Self-Actualization:** Fulfilling one's highest personal potential, creative expression, and intellectual growth.

### 🧠 Practical Application in Modern Organizations
• **Workplace Leadership:** Fair compensation satisfies physiological needs; healthcare and job contracts satisfy safety; collaborative team culture satisfies belonging; merit promotions satisfy esteem; and autonomous innovation labs satisfy self-actualization.
• **Cognitive Behavioral Therapy (CBT):** Examines the interconnection between thoughts, emotions, and behaviors, helping individuals reframe cognitive distortions.

### 🎯 Key Takeaways & Critical Insights
• **Dynamic Reality:** Modern psychologists note that real human behavior is fluid—people often pursue esteem, creative art, or altruistic causes even while enduring physical hardship.

### ✨ Next Steps & Peer Discussion Starters
• *Discussion Question:* How can team leaders identify whether an employee's disengagement stems from a lack of psychological safety (Level 2) versus a lack of recognition (Level 4)?`;
  }

  // 7. Dynamic Universal Synthesizer for ANY OTHER subject or branch
  const cleanSubject = message.trim().replace(/\?+$/, '');
  return `### 💡 Concept Intuition & Direct Answer
**${cleanSubject}** is an essential subject in academic curricula and professional practice.
At its core, this concept exists to solve a fundamental challenge in its field: establishing a reliable framework to analyze, model, or optimize real-world phenomena.

### ⚙️ How It Works (Step-by-Step Breakdown)
1. 🎯 **Fundamental Invariant / Law:** It defines the governing boundaries, assumptions, or mathematical/logical rules under which the system operates.
2. 🔄 **Operational Mechanics:**
   - **Input / Stimulus:** The initial condition, hypothesis, raw data, or material state is introduced.
   - **Transformation / Dynamics:** Interactions occur according to established laws (e.g., thermodynamic, computational, economic, or behavioral).
   - **Output / Equilibrium:** The system reaches an outcome, synthesized conclusion, or steady state.
3. ⚖️ **Core Trade-Offs:** Every methodology balances precision vs. generalizability, or speed vs. resource expenditure.

### 🔬 Practical Real-World Example & Application
\`\`\`text
[Initial Context / Problem] ──> [Governing Principles & Methods]
                                           │
                                           ▼
                            [Empirical Application / Testing]
                                           │
                                           ▼
                            [Actionable Outcome / Value Created]
\`\`\`
• **Real-World Impact:** Whether in scientific research, engineering design, business management, or social policy, applying this concept minimizes guesswork and grounds decisions in verified principles.

### 🎯 Key Takeaways & Exam/Interview Traps
• **Common Misconceptions:** Avoid confusing correlation with causation, or theoretical assumptions with real-world non-ideal conditions.
• **Exam/Interview Tip:** Always define the concept in 1 sentence, explain its practical mechanism, and conclude with a concrete real-world scenario.

### ✨ Proactive Suggestions & Peer Discussion Starters
• **Peer Practice:** Try explaining this topic aloud to a peer in under 90 seconds using an everyday analogy!
• **Follow-up Doubt:** Would you like to explore mathematical derivations, practical case studies, or mock exam questions on this topic?`;
}

// Helper: Educational Conceptual Diagram fallback engine for offline or model disruption resilience
function getFallbackDiagram(topic: string): {
  title: string;
  type: 'mermaid' | 'svg';
  code: string;
  description: string;
  keyComponents: string[];
} {
  const t = (topic || '').toLowerCase();

  if (t.includes('tcp') || t.includes('handshake') || t.includes('network') || t.includes('protocol')) {
    return {
      title: 'TCP/IP 3-Way Handshake Protocol Architecture',
      type: 'mermaid',
      code: `sequenceDiagram
    autonumber
    actor Client as 💻 Client (Host A)
    actor Server as 🖥️ Server (Host B)
    Note over Client,Server: Step 1: Connection Request (SYN)
    Client->>Server: SYN (seq = x) [State: SYN_SENT]
    Note over Server: Server Allocates Buffer & TCB
    Note over Client,Server: Step 2: Acknowledgment & Sync (SYN-ACK)
    Server->>Client: SYN-ACK (seq = y, ack = x + 1) [State: SYN_RCVD]
    Note over Client: Client Verifies ACK & Moves to ESTABLISHED
    Note over Client,Server: Step 3: Final Confirmation (ACK)
    Client->>Server: ACK (ack = y + 1, seq = x + 1) [State: ESTABLISHED]
    Note over Client,Server: 🚀 Reliable Full-Duplex Data Transmission Active`,
      description: 'The TCP 3-Way Handshake establishes a synchronized, reliable, connection-oriented session between client and server, preventing duplicate old connection requests from causing race conditions.',
      keyComponents: ['SYN Packet (Seq=x)', 'SYN-ACK Packet (Seq=y, Ack=x+1)', 'ACK Packet (Ack=y+1)', 'ESTABLISHED Socket State'],
    };
  }

  if (t.includes('dijkstra') || t.includes('binary tree') || t.includes('graph') || t.includes('bst') || t.includes('tree')) {
    return {
      title: 'Binary Search Tree (BST) & Algorithmic Traversal',
      type: 'mermaid',
      code: `graph TD
    Root((50 👑)) -->|Left < 50| NodeL((30))
    Root -->|Right > 50| NodeR((70))
    NodeL -->|Left| L1((20))
    NodeL -->|Right| L2((40))
    NodeR -->|Left| R1((60))
    NodeR -->|Right| R2((80))

    classDef root fill:#003554,stroke:#00cfff,stroke-width:2px,color:#fff;
    classDef branch fill:#02253e,stroke:#20f5a2,stroke-width:2px,color:#e0f2fe;
    classDef leaf fill:#011b30,stroke:#38bdf8,stroke-width:1px,color:#bae6fd;

    class Root root;
    class NodeL,NodeR branch;
    class L1,L2,R1,R2 leaf;`,
      description: 'Binary Search Tree invariant: for every node, all keys in the left subtree are smaller, and all keys in the right subtree are greater, yielding O(log N) lookup and insertion when balanced.',
      keyComponents: ['Root Node (Anchor)', 'Left Subtree (< Parent)', 'Right Subtree (> Parent)', 'Leaf Nodes (Base Case)'],
    };
  }

  if (t.includes('ml') || t.includes('machine learning') || t.includes('neural') || t.includes('ai') || t.includes('deep learning')) {
    return {
      title: 'End-to-End Machine Learning Pipeline Architecture',
      type: 'mermaid',
      code: `flowchart LR
    subgraph Data["1. Data Engineering"]
      Raw[📊 Raw Datasets] --> Clean[🧹 Cleaning & Imputation]
      Clean --> Features[⚙️ Feature Extraction]
    end

    subgraph Modeling["2. Model Training"]
      Features --> Split[✂️ Train/Test Split]
      Split --> Train[🧠 Model Optimization & Backprop]
      Train --> Val[📈 Cross-Validation]
    end

    subgraph Production["3. Inference & Serving"]
      Val --> Eval{Pass Threshold?}
      Eval -- Yes --> Deploy[🚀 Production Microservice]
      Eval -- No --> Train
      Deploy --> Monitor[📡 Drift Monitoring]
    end

    classDef pBlock fill:#02233f,stroke:#00d2ff,stroke-width:2px,color:#e0f2fe;
    class Raw,Clean,Features,Split,Train,Val,Deploy,Monitor pBlock;`,
      description: 'Production machine learning demands continuous feedback loops between feature engineering, gradient backpropagation, evaluation thresholds, and real-time concept drift monitoring.',
      keyComponents: ['Feature Pipeline', 'Training & Gradient Descent', 'Validation Gate', 'Serving API & Drift Watcher'],
    };
  }

  if (t.includes('photosynthesis') || t.includes('biology') || t.includes('cell') || t.includes('respiration') || t.includes('mitochondria')) {
    return {
      title: 'Cellular Respiration & ATP Energy Generation Pathway',
      type: 'mermaid',
      code: `flowchart TD
    Glucose[🍬 Glucose (C6H12O6)] -->|Cytoplasm| Glycolysis[⚡ Glycolysis]
    Glycolysis -->|Yield: 2 ATP + 2 NADH| Pyruvate[🧪 2x Pyruvate (3C)]

    Pyruvate -->|Mitochondrial Matrix| Krebs[🔄 Krebs / Citric Acid Cycle]
    Krebs -->|Yield: 2 ATP + 6 NADH + 2 FADH2| Coenzymes[🔋 High-Energy Electron Carriers]

    Coenzymes -->|Inner Mitochondrial Membrane| ETC[⚡ Electron Transport Chain & ATP Synthase]
    O2[💨 Oxygen (O2 Final Acceptor)] --> ETC
    ETC -->|Chemiosmosis Yield: ~30-32 ATP| ATP[✨ Net Cellular Energy: 32 ATP + H2O]

    classDef bio fill:#022c22,stroke:#20f5a2,stroke-width:2px,color:#ecfdf5;
    classDef energy fill:#04324f,stroke:#38bdf8,stroke-width:2px,color:#e0f2fe;
    class Glucose,Pyruvate,Krebs bio;
    class Glycolysis,ETC,ATP energy;`,
      description: 'Cellular respiration oxidizes glucose through glycolysis, the Krebs cycle, and oxidative phosphorylation, transferring electrons to oxygen to fuel ATP synthesis via proton-motive force.',
      keyComponents: ['Glycolysis (Cytosol)', 'Krebs Cycle (Matrix)', 'Electron Transport Chain (Cristae)', 'ATP Synthase (Proton Gradient)'],
    };
  }

  if (t.includes('microservice') || t.includes('architecture') || t.includes('mvc') || t.includes('system design')) {
    return {
      title: 'Scalable Microservices Cloud Architecture',
      type: 'mermaid',
      code: `flowchart TD
    Client[📱 Web / Mobile Client] -->|HTTPS Requests| CDN[🌐 Cloudflare / CloudFront CDN]
    CDN -->|Dynamic API Traffic| Gateway[🛡️ API Gateway & Rate Limiter]

    subgraph Microservices["Core Domain Services"]
      Gateway --> AuthSvc[🔐 Auth & Identity Service]
      Gateway --> UserSvc[👤 Student Profile Service]
      Gateway --> PracticeSvc[🎙️ Real-time Practice Engine]
    end

    subgraph DataTier["Distributed Data Storage"]
      AuthSvc --> Redis[(⚡ Redis Session Cache)]
      UserSvc --> Postgres[(🐘 PostgreSQL Master / Replica)]
      PracticeSvc --> S3[(📦 Object Storage & Audio Logs)]
    end

    classDef sBlock fill:#01243e,stroke:#00d2ff,stroke-width:1.5px,color:#dcf0fa;
    class Client,CDN,Gateway,AuthSvc,UserSvc,PracticeSvc,Redis,Postgres,S3 sBlock;`,
      description: 'Modern distributed architectures isolate responsibilities into domain services behind an API Gateway, decoupling fast memory caching from persistent ACID relational storage.',
      keyComponents: ['API Gateway / Reverse Proxy', 'Stateless Domain Services', 'Redis Low-Latency Cache', 'Relational Persistent Store'],
    };
  }

  // Generic universal academic flowchart fallback
  return {
    title: `${topic || 'Academic Topic'} - Conceptual Framework`,
    type: 'mermaid',
    code: `graph TD
    Input[📥 Core Inputs & Governing Axioms] --> Proc1[⚙️ Step 1: Fundamental Mechanics]
    Proc1 --> Proc2[🔬 Step 2: Transformation & Interactions]
    Proc2 --> Validation{🔍 Evaluation / Equilibrium Criteria}
    Validation -->|Stable / Validated| Outcome[🎯 Measurable Result & Academic Impact]
    Validation -->|Anomaly / Feedback| Proc1

    classDef nodeStyle fill:#02233f,stroke:#00d2ff,stroke-width:2px,color:#e0f2fe;
    classDef checkStyle fill:#0a324b,stroke:#20f5a2,stroke-width:2px,color:#20f5a2;
    class Input,Proc1,Proc2,Outcome nodeStyle;
    class Validation checkStyle;`,
    description: `Conceptual visualization of ${topic || 'the topic'} illustrating governing principles, internal step-by-step mechanisms, and resulting outcomes.`,
    keyComponents: ['Inputs & Preconditions', 'Internal Mechanics', 'Equilibrium Verification', 'Actionable Outcomes'],
  };
}

// Real-Time Live AI Assistant for Student Doubts, Real-Time Science & Multilingual Academic Guidance
app.post('/api/ai/live-assistant', async (req: Request, res: Response) => {
  try {
    const { message, history, studentName, studentBranch, practiceGoal, language, targetLanguage } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const cleanMessage = message.trim();
    const preferredLang = language || targetLanguage || 'English';
    const detectedLang = detectLanguage(cleanMessage, preferredLang);

    // If API key is missing, return high-quality educational fallback
    if (!apiKey) {
      const reply = generateAcademicFallback(cleanMessage, studentName, detectedLang);
      return res.json({ reply, sources: [] });
    }

    const systemInstruction = `You are Fluencis Universal Academic & Peer Mentor, an all-branch AI professor, real-time science scholar, world facts encyclopedia, and multilingual coach modeled after state-of-the-art educational models like ChatGPT.

SCOPE & BRANCH AGNOSTIC TEACHING:
You assist students across ALL academic fields and branches:
1. 🔬 Natural & Applied Sciences: Physics, Chemistry, Biology, Mathematics, Statistics, Biotechnology, Astronomy, Environmental Science.
2. ⚙️ Engineering & Technology: Computer Science, AI/ML, Data Science, Mechanical, Civil, Electrical, Electronics, Chemical, Aerospace, Robotics.
3. 📊 Business, Commerce & Management: Economics, Finance, Marketing, Accounting, Human Resources, Supply Chain, Business Analytics.
4. 🧠 Humanities & Social Sciences: Psychology, Sociology, History, Political Science, Philosophy, Literature, Linguistics.
5. 🩺 Medicine & Health Sciences: Anatomy, Physiology, Pharmacology, Biochemistry, Pathology, Public Health.
6. ⚖️ Law & Public Policy: Constitutional Law, Jurisprudence, Contracts, Criminal Law, Intellectual Property, Ethics.
7. 🚀 Career & Placement: Quantitative Aptitude, Logical Reasoning, Verbal Ability, GATE/UPSC/GRE/CAT prep, Group Discussions, Interview Practice.

🌐 MULTILINGUAL INCLUSIVE TEACHING (Telugu, English, Hindi, Tamil, German, Malayalam, Kannada):
The student's selected/detected language is: ${detectedLang} (Preferred: ${preferredLang}).
You are fully fluent in:
- 🇮🇳 Telugu (తెలుగు)
- 🇬🇧 English
- 🇮🇳 Hindi (हिन्दी)
- 🇮🇳 Tamil (தமிழ்)
- 🇩🇪 German (Deutsch)
- 🇮🇳 Malayalam (മലയാളം)
- 🇮🇳 Kannada (ಕನ್ನಡ)

If the student chose or asks in Telugu, Hindi, Tamil, German, Malayalam, or Kannada (in native script or Romanized script like "cheppu", "batao", "sollunga", "parayu", "heli"):
1. Explain the topic completely and fluently in that chosen language (${detectedLang}) so students who do not know English can understand every concept clearly!
2. Provide technical terms in BOTH the native language script and standard English in brackets (e.g., Telugu: "కణ శ్వాసక్రియ (Cellular Respiration)", Hindi: "प्रकाश संश्लेषण (Photosynthesis)", Tamil: "ஒளிச்சேர்க்கை (Photosynthesis)", German: "Zellatmung (Cellular Respiration)", Malayalam: "കോശ ശ്വസനം (Cellular Respiration)", Kannada: "ಕೋಶೀಯ ಉಸಿರಾಟ (Cellular Respiration)").
3. Use relatable everyday analogies from everyday life so complex topics feel intuitive and friendly.

🔬 REAL-TIME SCIENCE & FACTS AROUND THE WORLD DIRECTIVES:
1. Real-Time Science:
   - Provide up-to-date, deeply accurate knowledge on recent scientific breakthroughs, space exploration (James Webb Space Telescope discoveries, ISRO Chandrayaan-3 and Gaganyaan, NASA Artemis, Mars rovers), Quantum Computing qubits, Nuclear Fusion net energy milestones, CRISPR gene editing, clean energy, and artificial intelligence.
2. Facts Around the World:
   - Deliver fascinating, accurate, verified facts about global geography, Earth wonders (Mariana Trench, Amazon biome), physical constants (speed of light, Planck constant), cosmic scales, human brain neurology (86 billion neurons), world civilizations, and global scientific institutions (CERN LHC, ISRO, NASA).

ABSOLUTE TEACHING DIRECTIVES:
1. 💡 DIRECT ANSWER & THOROUGH EXPLANATION:
   - Clarify WHAT it is, WHY it matters, and HOW it works internally.
2. 🎨 STRUCTURED MULTI-PART PEDAGOGY WITH RICH EMOJIS:
   - ### 💡 Concept Intuition & Direct Answer
   - ### ⚙️ How It Works (Step-by-Step Breakdown)
   - ### 🔬 Practical Example / Code / Real-World Case Study
   - ### 🎯 Key Takeaways & Exam/Interview Traps
   - ✨ Next Steps & Discussion Starters (Proactive Suggestions)
3. 📊 CONCEPTUAL DIAGRAMS (MermaidJS):
   - Include valid \`\`\`mermaid ... \`\`\` diagrams for workflows, architectures, biological pathways, and data structures whenever helpful.

Student: ${studentName || 'Student'}
Branch/Field: ${studentBranch || 'All Academic Disciplines'}
Target Goal: ${practiceGoal || 'Academic Excellence & Peer Communication'}`;

    // Robust multi-turn history sanitization
    const sanitizedHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

    if (Array.isArray(history)) {
      for (const h of history) {
        if (!h.text || typeof h.text !== 'string' || !h.text.trim()) continue;
        const role = h.role === 'model' ? 'model' : 'user';

        if (sanitizedHistory.length === 0 && role === 'model') {
          continue;
        }

        const prev = sanitizedHistory[sanitizedHistory.length - 1];
        if (prev && prev.role === role) {
          prev.parts[0].text += `\n\n${h.text.trim()}`;
        } else {
          sanitizedHistory.push({
            role,
            parts: [{ text: h.text.trim() }],
          });
        }
      }
    }

    const recentHistory = sanitizedHistory.slice(-6);
    if (recentHistory.length > 0 && recentHistory[recentHistory.length - 1].role === 'user') {
      recentHistory.pop();
    }

    recentHistory.push({
      role: 'user',
      parts: [{ text: cleanMessage }],
    });

    const isRealTimeOrFactQuery = /\b(latest|recent|real[- ]time|today|current|2024|2025|2026|news|breakthrough|discovery|discoveries|james webb|chandrayaan|artemis|quantum|fusion|nobel|fact|facts|world record|deepest|fastest|space|science)\b/i.test(cleanMessage);
    const useSearch = !!req.body.useSearchGrounding || isRealTimeOrFactQuery;
    const sources: { title: string; uri: string }[] = [];

    // Attempt 1: Search grounding for real-time science & facts
    if (useSearch) {
      try {
        const searchRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: recentHistory,
          config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
          },
        });

        if (searchRes && searchRes.text) {
          const chunks = searchRes.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (Array.isArray(chunks)) {
            for (const c of chunks) {
              if (c.web?.uri) {
                sources.push({
                  title: c.web.title || c.web.uri,
                  uri: c.web.uri,
                });
              }
            }
          }
          return res.json({ reply: searchRes.text, sources });
        }
      } catch (_searchErr: any) {
        // Fall back directly to standard deep model generation
      }
    }

    // Attempt 2: Standard deep generation with model fallback and automatic retries
    try {
      const { text } = await generateWithModelFallback({
        contents: recentHistory,
        config: {
          systemInstruction,
        },
      });

      if (text && text.trim()) {
        return res.json({ reply: text, sources });
      }
    } catch (_genError: any) {
      // Fall through to comprehensive academic knowledge engine
    }

    // Attempt 3: Comprehensive structured academic fallback engine in the student's language
    const reply = generateAcademicFallback(cleanMessage, studentName, detectedLang);
    return res.json({ reply, sources: [] });
  } catch (_error: any) {
    const detectedLang = detectLanguage(req.body?.message || '', req.body?.language || req.body?.targetLanguage);
    const reply = generateAcademicFallback(req.body?.message || '', req.body?.studentName, detectedLang);
    return res.json({ reply, sources: [] });
  }
});

// Dedicated Google Search Grounding API for real-time interview trends & facts
app.post('/api/ai/search-grounding', async (req: Request, res: Response) => {
  try {
    const { query, studentName } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Search query cannot be empty.' });
    }

    const cleanQuery = query.trim();

    if (!apiKey) {
      return res.json({
        reply: `### 🌐 2026 Campus Placement Intelligence for "${cleanQuery}"
• **Technical Demands:** Top tier engineering recruiters are emphasizing deep conceptual fundamentals in OS, Distributed Systems, and Low-Level System Design over simple LeetCode memorization.
• **Communication Bar:** Strong emphasis on the STAR framework (Situation, Task, Action, Result) and articulate explanation of architectural trade-offs.`,
        sources: [
          { title: 'Campus Placement & Interview Intelligence', uri: 'https://careers.google.com' }
        ],
      });
    }

    const systemInstruction = `You are Fluencis Placement Intelligence Mentor for college engineering students.
Provide up-to-date, highly accurate, and fact-grounded information on campus hiring trends, current interview rounds, technology standards, and company expectations. Keep answers crisp, structured, and informative.`;

    const sources: { title: string; uri: string }[] = [];

    // Try with googleSearch first
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: cleanQuery,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
        },
      });

      if (response && response.text) {
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (Array.isArray(chunks)) {
          for (const c of chunks) {
            if (c.web?.uri) {
              sources.push({
                title: c.web.title || c.web.uri,
                uri: c.web.uri,
              });
            }
          }
        }
        return res.json({ reply: response.text, sources });
      }
    } catch (_searchErr: any) {
      // Direct model fallback with retries
    }

    // Direct model fallback
    try {
      const { text } = await generateWithModelFallback({
        contents: cleanQuery,
        config: {
          systemInstruction,
        },
      });

      return res.json({ reply: text, sources });
    } catch (_modelErr: any) {
      return res.json({
        reply: `### 🌐 2026 Campus Placement Intelligence for "${cleanQuery}"
• **Core Engineering Fundamentals:** Top recruitment teams are assessing foundational problem-solving in algorithms, system architecture, memory models, and state management rather than superficial boilerplate.
• **Articulate Communication:** High focus on structured responses using the STAR method (Situation, Task, Action, Result) and clear trade-off justification during technical design discussions.
• **Practical Tip:** Pair every theoretical statement with a concrete real-world implementation example and clear complexity metrics ($O(N)$ / $O(1)$).`,
        sources: [
          { title: 'Campus Placement & Industry Intelligence', uri: 'https://careers.google.com' }
        ],
      });
    }
  } catch (_err: any) {
    return res.json({
      reply: `### 🌐 Placement Intelligence Insights
Current 2026 campus hiring highlights strong problem-solving fundamentals, STAR structured behavioral communication, and practical systems engineering competence.`,
      sources: [],
    });
  }
});

// Dedicated Diagram Generation API using Gemini for MermaidJS and SVG conceptual visualizations
app.post('/api/ai/diagram', async (req: Request, res: Response) => {
  try {
    const { topic, context, preferredFormat = 'mermaid', studentBranch } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ error: 'Topic cannot be empty.' });
    }

    const cleanTopic = topic.trim();
    const branchContext = studentBranch ? `Branch/Field: ${studentBranch}` : '';

    if (!apiKey) {
      const fallback = getFallbackDiagram(cleanTopic);
      return res.json(fallback);
    }

    const systemInstruction = `You are Fluencis Academic Visualizer & Diagram Architect.
Your task is to generate crystal-clear, pedagogically sound, and visually stunning conceptual diagrams for academic topics across all branches of study (Computer Science, Electronics, Mechanical, Civil, Biology, Chemistry, Physics, Medicine, Business, Law, Mathematics).

GUIDELINES:
1. Determine the best diagram type:
   - For architecture, workflows, algorithms, hierarchies, entity relations, state transitions, pipelines, networks, sequences: use 'mermaid'.
   - For physical setups, anatomical/cellular structures, circuit topologies, continuous curves, mathematical coordinate plots: use 'svg'.
   (Default to 'mermaid' unless 'svg' is explicitly preferred or best suited).

2. If generating Mermaid:
   - Use clean, standard, valid Mermaid syntax (e.g. 'graph TD', 'flowchart LR', 'sequenceDiagram', 'stateDiagram-v2', 'classDiagram', 'mindmap', or 'erDiagram').
   - Keep node labels concise, meaningful, and easy to read.
   - Use descriptive node IDs (e.g. Client, Server, DB, Step1).
   - Use clean styling or emojis inside labels (e.g. ["🖥️ Client Node"], ["⚡ Fast Processing"]).
   - Output ONLY the mermaid definition string in the 'code' property (do NOT wrap it in backticks).

3. If generating SVG:
   - Provide a clean, standalone, responsive SVG: <svg viewBox="0 0 800 480" xmlns="http://www.w3.org/2000/svg">
   - Use an aesthetic dark background (#01182c or #021f38) with rounded cards (#033054, stroke #00cfff), vivid glow/accents (#00d2ff, #20f5a2, #f59e0b), clear text (#ffffff and #a0cce8), and clear connection markers/arrows.
   - Output ONLY valid SVG XML in the 'code' property (do NOT wrap it in backticks).

Respond with a JSON object adhering to this schema:
{
  "title": "Title of the diagram",
  "type": "mermaid" | "svg",
  "code": "The raw diagram syntax or SVG XML",
  "description": "2-3 clear sentences explaining what this conceptual diagram illustrates and key academic takeaways.",
  "keyComponents": ["Component or Step 1", "Component or Step 2", "Component or Step 3", "Component or Step 4"]
}`;

    const prompt = `Create a high-quality conceptual visual diagram for the following academic topic:
Topic: ${cleanTopic}
${context ? `Additional Context: ${context}` : ''}
${branchContext}
Preferred Format: ${preferredFormat}`;

    // Prioritize high-availability models with retries
    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

    for (const model of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
            },
          });

          const rawText = response.text ? response.text.trim() : '';
          if (rawText) {
            try {
              const parsed = JSON.parse(rawText);
              if (parsed && parsed.code && parsed.type) {
                return res.json(parsed);
              }
            } catch {
              const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
              const parsed = JSON.parse(stripped);
              if (parsed && parsed.code && parsed.type) {
                return res.json(parsed);
              }
            }
          }
        } catch (_modelErr: any) {
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 150));
          }
        }
      }
    }

    const fallback = getFallbackDiagram(cleanTopic);
    return res.json(fallback);
  } catch (_err: any) {
    const fallback = getFallbackDiagram(req.body?.topic || 'Academic Concept');
    return res.json(fallback);
  }
});

// Dedicated Text-to-Speech Voice Explanation API using gemini-3.8-flash-lite-tts
app.post('/api/ai/tts', async (req: Request, res: Response) => {
  try {
    const { text, voiceName } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text to speak cannot be empty.' });
    }

    // Prepare speech-friendly text:
    // Strip code blocks or summarize them cleanly, strip markdown headers/symbols/URLs
    let cleanSpeechText = text
      .replace(/```[\s\S]*?```/g, ' [Refer to code implementation in explanation text above] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#+\s*/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\|[^\n]+\|/g, '') // remove markdown tables
      .replace(/[-*•]\s+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();

    // If text is very long, take the first 1200 characters to keep audio response rapid and within limits
    if (cleanSpeechText.length > 1200) {
      cleanSpeechText = cleanSpeechText.slice(0, 1200).replace(/\.[^.]*$/, '') + '.';
    }

    // Default to male voice 'Charon' (deep, articulate, calm, and authoritative male academic mentor voice)
    const selectedVoice = voiceName || 'Charon'; // 'Charon', 'Fenrir', 'Zephyr' (male voices)

    if (!apiKey) {
      return res.json({ useBrowserSpeech: true, cleanText: cleanSpeechText, voice: selectedVoice });
    }

    try {
      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanSpeechText,
                speechMetadata: {
                  style: 'Clear, articulate, calm, and deep male academic mentor with natural pacing, warm resonance, and professional enunciation',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      const mimeType = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/wav';

      if (audioBase64) {
        return res.json({
          audioBase64,
          mimeType,
          cleanText: cleanSpeechText,
          voice: selectedVoice,
        });
      }
    } catch (_ttsError: any) {
      // Smoothly switch to browser speech synthesis
    }

    return res.json({ useBrowserSpeech: true, cleanText: cleanSpeechText, voice: selectedVoice });
  } catch (_err: any) {
    return res.json({ useBrowserSpeech: true, cleanText: req.body?.text || '', voice: 'Charon' });
  }
});

// Live API (gemini-3.8-live) WebSocket Bridge for Real-Time Voice Conversations
const liveWss = new WebSocketServer({ server: httpServer, path: '/live-voice' });

liveWss.on('error', (err) => {
  console.warn('[liveWss server error]:', err);
});

liveWss.on('connection', async (clientWs) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY not configured for Live API voice conversations.' }));
    return;
  }

  try {
    const session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } },
        },
        systemInstruction: 'You are Fluencis Universal Voice Academic & Peer Coach for students of ALL academic branches and disciplines (Sciences, Engineering, Business, Humanities, Medicine, Law). Speak naturally with warmth and clarity, explain concepts vividly with intuitive real-world analogies, give constructive peer feedback on answers, offer clear suggestions and follow-up discussion points, and hold engaging voice conversations in real-time.',
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            clientWs.send(JSON.stringify({ audio }));
          }
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
      },
    });

    clientWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        }
      } catch (_e) {
        // Ignore malformed client packet
      }
    });

    clientWs.on('close', () => {
      try {
        session.close();
      } catch {}
    });

    clientWs.on('error', () => {
      try {
        session.close();
      } catch {}
    });
  } catch (_err: any) {
    clientWs.send(JSON.stringify({ error: 'Live voice session currently unavailable. Please use voice explanation mode.' }));
  }
});

// Start listening immediately on PORT 3000
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Fluencis Server] Running on http://0.0.0.0:${PORT}`);
});

// Mount Vite in dev mode or static files in production
async function setupFrontend() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }
}

setupFrontend().catch((err) => {
  console.error('[Fluencis Server] Failed to setup frontend:', err);
});
