export interface UserPracticeMetrics {
  totalPracticeMinutes: number;
  totalSessionsCount: number;
  currentStreakDays: number;
  lastPracticedDate?: string; // YYYY-MM-DD
  historyDates?: string[];
}

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role?: 'admin' | 'student';
  isOwner?: boolean;
  course: string;
  branch: string;
  year: string;
  level: string; // 'Beginner' | 'Intermediate' | 'Advanced'
  goal: string;
  interests?: string;
  preferredPracticeModes?: string;
  createdAt?: string;
  updatedAt?: string;
  profileCompleted?: boolean;
  availabilityStatus?: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  emailVerified?: boolean;
  practiceMetrics?: UserPracticeMetrics;
}

export interface PublicProfile {
  uid: string;
  displayName: string;
  course: string;
  branch: string;
  year: string;
  communicationLevel: string;
  practiceModes?: string;
  interests?: string;
  availabilityStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  updatedAt?: string;
}

export type PracticeMode =
  | 'General Communication'
  | 'Interview Practice'
  | 'Technical Interview'
  | 'HR & Behavioral Interview'
  | 'Technical Discussion'
  | 'Group Discussion'
  | 'Casual Chit-Chat'
  | 'Debate'
  | 'Presentation'
  | 'Team Meeting'
  | 'Brainstorming';

export type SessionFormat = 'one-to-one' | 'small-group' | 'team';

export interface RoomParticipant {
  socketId: string;
  name: string;
  initial: string;
  role: 'Host' | 'Participant' | 'Invited';
  level: string;
  goal: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isHandRaised?: boolean;
  isScreenSharing?: boolean;
  joinedAt?: number;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[]; // usernames of students who reacted
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderId: string;
  initial: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
  type?: 'message' | 'prompt' | 'system' | 'question';
  channelId?: string; // 'room' | 'community' | 'direct'
  reactions?: MessageReaction[];
}

export interface RoomData {
  id: string;
  type: 'public' | 'private';
  mode: string;
  host: string;
  capacity: number;
  participants: RoomParticipant[];
  createdAt: string;
  chatMessages: ChatMessage[];
  locked?: boolean;
}

export interface OnlineStudent {
  socketId?: string;
  name: string;
  mode: string;
  level: string;
  goal: string;
  status: 'AVAILABLE' | 'IN_ROOM';
}

export type ThemeMode = 'dark' | 'midnight' | 'ocean' | 'studio';

export interface AchievementBadge {
  id: string;
  title: string;
  icon: string;
  category: 'Consistency' | 'Skill' | 'Milestone' | 'Leadership';
  description: string;
  requirement: string;
  progress: number;
  maxProgress: number;
  unlocked: boolean;
  unlockedAt?: string;
  xpReward: number;
  perk: string;
}

export interface PeerRatings {
  clarity: number; // 1-5
  confidence: number; // 1-5
  listening: number; // 1-5
  structure: number; // 1-5
  overall: number; // 1-5
}

export interface PeerFeedback {
  id: string;
  sessionId?: string;
  roomId: string;
  fromStudent: string;
  fromInitial?: string;
  toStudent: string;
  toInitial?: string;
  practiceMode: string;
  durationFormatted: string;
  ratings: PeerRatings;
  tags: string[];
  constructiveNotes: string;
  encouragement: string;
  aiPolishedNotes?: string;
  createdAt: string;
}
