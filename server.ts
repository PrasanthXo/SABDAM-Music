import { createHash, randomBytes } from 'crypto';
import express from 'express';
import https from 'https';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import JSZip from 'jszip';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { GoogleGenAI } from '@google/genai';
import { fetchTrendingSongsFromGemini } from './src/services/geminiService';
import { youtubeConfig } from './server/youtubeConfig';
import { sendOtpEmail, sendSupportReportEmail } from './server/mailer.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { initializeApp as initializeClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { SABDHAM_DEFAULT_ARTWORK } from './src/utils/imageUtils';
import {
  getOrCreateUser,
  getUserByEmail,
  getUserFavorites,
  addUserFavorite,
  removeUserFavorite,
  getUserLibraryFromDb,
  saveUserLibraryToDb,
  deleteUserPlaylist,
  getUserByUid,
  createAuthSession,
  getAuthSession,
  touchAuthSession,
  deleteAuthSession,
  deleteAuthSessionsForUser,
} from './src/db/users.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable CORS and JSON parsing globally for all routes
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Security gate: strictly block direct HTTP access to internal data storage, secrets, and server source files
app.use((req, res, next) => {
  const cleanPath = req.path.toLowerCase().replace(/\\/g, '/');
  const normalized = path.posix.normalize(cleanPath);
  if (
    normalized === '/data' ||
    normalized.startsWith('/data/') ||
    normalized.startsWith('/.env') ||
    normalized.startsWith('/server.ts') ||
    normalized.startsWith('/..') ||
    normalized.includes('/../')
  ) {
    return res.status(403).json({ error: 'Access forbidden.' });
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Lazy initialization of Gemini client to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required for AI features');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

/**
 * Robust fetch helper that handles non-JSON responses and errors gracefully.
 */
async function robustFetchJson(url: string, options: any = {}) {
  const headers = {
    'User-Agent': 'morning-music-app/1.0',
    'Accept': 'application/json',
    ...options.headers
  };
  
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    if (!res.ok) {
      throw new Error(`API returned error ${res.status} (non-JSON): ${text.substring(0, 100)}`);
    }
    throw new Error(`API returned invalid JSON: ${text.substring(0, 100)}`);
  }
  
  if (!res.ok) {
    const errorMsg = data.error?.message || data.error_description || data.error || `API Error ${res.status}`;
    throw new Error(errorMsg);
  }
  
  return data;
}


// ==========================================
// SABDHAM ANDROID APP UPDATE CONTROL
// ==========================================
app.get('/api/app/update', (_req, res) => {
  const latestVersionCode =
    Number(process.env.ANDROID_LATEST_VERSION_CODE || '9');

  const minimumVersionCode =
    Number(process.env.ANDROID_MINIMUM_VERSION_CODE || '9');

  const latestVersionName =
    process.env.ANDROID_LATEST_VERSION_NAME || '1.2.3';

  const downloadUrl =
    process.env.ANDROID_DOWNLOAD_URL || 'https://raw.githubusercontent.com/PrasanthXo/SABDAM-Music/main/public/downloads/SABDHAM-signed.apk';

  const forceUpdate =
    String(process.env.ANDROID_FORCE_UPDATE || 'true')
      .trim()
      .toLowerCase() === 'true';

  const releaseNotes = [
    'Cleaner compact Home top bar with improved spacing and less visual clutter.',
    'Search-result playback now queues related songs by matching language and genre while excluding repeated titles.',
    'Playlist search zero-result cases fixed with stronger public YouTube playlist discovery.',
    'Playlist card tap, three-dot menu, Add to Queue and provider-specific actions are now separated and more reliable.',
    'Notification unread-count badge now stays fully visible on the Home toolbar, including compact phones.',
    'Notification badge number is larger, higher-contrast and supports multi-digit unread counts.',
    'Required update system added so future outdated SABDHAM versions can be blocked until updated.',
    'New modern SABDHAM Home top bar with greeting, profile name, notifications and MUSIC FOR EVERY MOOD branding.',
    'Smarter personalized Home catalogues based on listening interests.',
    'Larger Home catalogues with up to 50 unique songs and stronger empty-section backfill.',
    'Daily catalogue rotation improvements with better duplicate protection.',
    'Persistent full-player volume control wired to native Media3 playback.',
    'Native Audio Output routing for phone, Bluetooth and supported multi-device routes.',
    'Audio Output control moved beside the volume panel with mobile safe-area protection.',
    'Queue drag-and-drop reordering with native playback queue synchronization.',
    'Add to Queue now preserves manually added songs during background prefetch.',
    'Search now separates Songs and Playlists and opens playlist details before playback.',
    'Playlist Play All, fast first-page loading and background expansion up to full playlists.',
    'Playlist three-dot actions for Add to Library and Add to Queue.',
    'Public YouTube playlist discovery with caching, stale-search cancellation and fallback handling.',
    'Public Spotify playlist search merged into Android search with provider labels.',
    'Spotify and YouTube playlist loading now respects each provider source.',
    'Cleaner song search titles with video-style labels removed.',
    'Music-only search relevance filters news, reviews, explanations, trailers, podcasts and other non-music videos.',
    'Improved Tamil and Sinhala search matching with Unicode preserved.',
    'Faster and more reliable search playback with dead-audio validation and fallback checks.',
    'YouTube playback fallback improved, with Audius available only as a final playback fallback.',
    'Verified artwork matching improved using Apple/MusicBrainz plus TMDB and Last.fm fallbacks.',
    'Movie artwork matching now uses language/year disambiguation and ignores generic labels.',
    'Artwork provider credits added to About SABDHAM.',
    'Bottom navigation and full-player controls protected from overlap on smaller and gesture-navigation phones.'
  ];

  const message =
    process.env.ANDROID_UPDATE_MESSAGE ||
    'SABDHAM 1.2.3 is required. Update now for the cleaner Home top bar, smarter search queue, playlist discovery fixes and improved playlist click actions.';

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  return res.status(200).json({
    platform: 'android',
    latestVersionCode,
    minimumVersionCode,
    latestVersionName,
    downloadUrl,
    forceUpdate,
    message,
    releaseNotes
  });
});
// Health check endpoints for Cloud Run deployment, kubernetes probes, and load balancers
app.get(['/api/health', '/health', '/healthz'], (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// TEMP diagnostic: test JioSaavn connectivity from deployed server
app.get('/api/debug/saavn', async (_req, res) => {
  try {
    const url = 'https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&n=1&p=1&q=Perfect&_marker=0';
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    const body = await upstream.text();

    res.json({
      ok: upstream.ok,
      status: upstream.status,
      contentType: upstream.headers.get('content-type'),
      length: body.length,
      startsWithJson: body.trim().startsWith('{'),
      preview: body.substring(0, 120),
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
});
// API: Use Gemini AI to help find the exact song name from loose description or phonetic query
app.post('/api/gemini/resolve-song', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getGeminiClient();
    const systemPrompt = `You are an expert Music Recognition Assistant.
The user will describe a song, some lyrics, a scene, a movie, or a phonetic spelling (e.g., "gym tamil songs", "kavalan song", "high energy anirudh song with shilpa rao", "sad song about love").
Your goal is to identify the EXACT song name, main artist/singer, and a brief 1-sentence reason why it matches.

Return your response strictly as a JSON object with this exact structure:
{
  "exactSongName": "The exact title of the song",
  "exactArtistName": "The main artist or singer or music director",
  "explanation": "A simple 1-sentence explanation of why this song matches the user's request."
}
Do not include any markdown fences or additional explanation outside the JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt.trim(),
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json"
      }
    });

    const text = response.text || '';
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      // Fallback regex if not pure JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from Gemini');
      }
    }

    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/gemini/resolve-song:', err);
    res.status(500).json({ 
      error: 'Failed to resolve song name using Gemini AI', 
      message: err.message || 'Unknown error' 
    });
  }
});

// ==========================================
// AUTHENTICATION & USER DATA STORAGE ENGINE
// ==========================================

interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  provider: 'email' | 'google' | 'otp';
  avatarColor?: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface UserDataRecord {
  likedTrackIds: string[];
  likedTracks?: any[];
  recentlyPlayed: any[];
  customPlaylists: any[];
  customSongs: any[];
  settings?: {
    audioQuality: string;
    crossfade: boolean;
    gapless: boolean;
    autoplay: boolean;
    volumeNormalization: boolean;
    wifiOnlyDownloads: boolean;
    mobileStreaming: boolean;
    downloadQuality: string;
    themeMode: string;
    equalizerEnabled: boolean;
    equalizerPreset: string;
    eqBass: number;
    eqLowMid: number;
    eqMid: number;
    eqHighMid: number;
    eqTreble: number;
    offlineMode: boolean;
  };
}

interface OtpRecord {
  code: string;
  expiresAt: number;
  purpose: 'signin' | 'signup' | 'any';
  name?: string;
  attempts: number;
}

const AVATAR_COLORS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
  '#06B6D4', '#14B8A6', '#6366F1', '#D946EF', '#84CC16'
];

// Persistent stores
const users = new Map<string, UserRecord>(); // email -> UserRecord
const usersById = new Map<string, UserRecord>(); // id -> UserRecord
const userDataStore = new Map<string, UserDataRecord>(); // userId -> UserDataRecord
const sessions = new Map<string, { userId: string; email: string; expiresAt: number }>(); // token -> Session
const resetCodes = new Map<string, { code: string; expiresAt: number }>(); // email -> reset code
const otpStore = new Map<string, OtpRecord>(); // email/identifier -> otp record

// File storage persistence helper
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

function sanitizeUser(u: UserRecord) {
  const { passwordHash, ...safeUser } = u;
  return safeUser;
}

function loadPersistedData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.users && Array.isArray(parsed.users)) {
        parsed.users.forEach((u: UserRecord) => {
          users.set(u.email.toLowerCase(), u);
          usersById.set(u.id, u);
        });
      }
      if (parsed.userData && typeof parsed.userData === 'object') {
        Object.entries(parsed.userData).forEach(([key, data]) => {
          userDataStore.set(key, data as UserDataRecord);
        });
        // Backfill email keys for existing users
        users.forEach((u) => {
          if (u.id && userDataStore.has(u.id)) {
            const data = userDataStore.get(u.id)!;
            userDataStore.set(u.email.toLowerCase(), data);
          } else if (u.email && userDataStore.has(u.email.toLowerCase())) {
            const data = userDataStore.get(u.email.toLowerCase())!;
            userDataStore.set(u.id, data);
          }
        });
      }
      if (parsed.sessions && Array.isArray(parsed.sessions)) {
        const now = Date.now();
        parsed.sessions.forEach(([tok, sess]: [string, any]) => {
          if (sess && sess.userId && sess.expiresAt > now) {
            sessions.set(tok, sess);
          }
        });
      }
    }
  } catch (err) {
    console.warn('Could not load persisted user data:', err);
  }
}

function savePersistedData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload = {
      users: Array.from(users.values()),
      userData: Object.fromEntries(userDataStore.entries()),
      sessions: Array.from(sessions.entries()),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not save user data:', err);
  }
}

// Initial load
loadPersistedData();

// Helper to parse HTTP request cookies
function parseCookies(req: express.Request): Record<string, string> {
  const list: Record<string, string> = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      const key = parts.shift()?.trim();
      if (key) {
        list[key] = decodeURIComponent(parts.join('=').trim());
      }
    });
  }
  return list;
}

// Helper to set 7-day auth session cookie on HTTP responses
function setAuthCookie(res: express.Response, token: string, maxAgeDays = 7) {
  const maxAge = Math.floor(maxAgeDays * 24 * 60 * 60);
  res.setHeader('Set-Cookie', `mm_auth_token=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`);
}

// Helper to clear auth cookie
function clearAuthCookie(res: express.Response) {
  res.setHeader('Set-Cookie', `mm_auth_token=; Max-Age=0; Path=/; SameSite=Lax`);
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
// Helper to authenticate requests (supports Bearer headers, 7-day HTTP cookies, and Firebase ID tokens)
async function getAuthUser(req: express.Request): Promise<UserRecord | null> {
  let token: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const cookies = parseCookies(req);
    token = cookies['mm_auth_token'] || null;
  }

  if (!token) {
    return null;
  }
  // 1. Check custom SABDHAM session.
  // Memory is a cache only. PostgreSQL is the durable source of truth.
  const session = sessions.get(token);
  if (session) {
    if (Date.now() > session.expiresAt) {
      sessions.delete(token);
      await deleteAuthSession(hashSessionToken(token));
      return null;
    }

    const nextExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    session.expiresAt = nextExpiry;
    await touchAuthSession(hashSessionToken(token), new Date(nextExpiry));

    const cachedUser = usersById.get(session.userId);
    if (cachedUser) {
      return cachedUser;
    }
  }

  // SABDHAM_DB_SESSION_FALLBACK
  // Recover after Render restart directly from Supabase/PostgreSQL.
  try {
    const tokenHash = hashSessionToken(token);
    const dbSession = await getAuthSession(tokenHash);

    if (dbSession) {
      const expiryMs = dbSession.expiresAt.getTime();

      if (Date.now() > expiryMs) {
        await deleteAuthSession(tokenHash);
        return null;
      }

      const nextExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
      await touchAuthSession(tokenHash, new Date(nextExpiry));

      let dbBackedUser = usersById.get(dbSession.userUid);

      if (!dbBackedUser) {
        const dbUser = await getUserByUid(dbSession.userUid);

        if (dbUser) {
          const provider: UserRecord['provider'] =
            dbSession.provider === 'google'
              ? 'google'
              : dbSession.provider === 'email'
                ? 'email'
                : 'otp';

          dbBackedUser = {
            id: dbUser.uid,
            email: dbUser.email,
            name: dbUser.displayName || dbUser.email.split('@')[0],
            provider,
            avatarUrl: dbUser.photoUrl || undefined,
            avatarColor: '#4f46e5',
            createdAt: dbUser.createdAt
              ? dbUser.createdAt.toISOString()
              : new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          };

          users.set(dbBackedUser.email.toLowerCase(), dbBackedUser);
          usersById.set(dbBackedUser.id, dbBackedUser);
          initUserData(dbBackedUser.id, dbBackedUser.email);
        }
      }

      if (dbBackedUser) {
        sessions.set(token, {
          userId: dbBackedUser.id,
          email: dbBackedUser.email,
          expiresAt: nextExpiry,
        });
        return dbBackedUser;
      }
    }
  } catch (sessionError) {
    console.error('[Auth] PostgreSQL session recovery failed:', sessionError);
  }

  // 2. Check Firebase ID token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (decodedToken && decodedToken.uid) {
      const email = decodedToken.email?.toLowerCase();
      let user = usersById.get(decodedToken.uid) || (email ? users.get(email) : null);
      if (!user && email) {
        const dbUser = await getOrCreateUser(
          decodedToken.uid,
          email,
          decodedToken.name || email.split('@')[0],
          decodedToken.picture
        );

        user = {
          id: dbUser?.uid || decodedToken.uid,
          email,
          name: decodedToken.name || email.split('@')[0],
          provider: 'google',
          avatarUrl: decodedToken.picture,
          avatarColor: '#4f46e5',
          createdAt: dbUser?.createdAt
            ? dbUser.createdAt.toISOString()
            : new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        users.set(email, user);
        usersById.set(dbUser?.uid || decodedToken.uid, user);
        initUserData(dbUser?.uid || decodedToken.uid, email);
        savePersistedData();
      }
      return user || null;
    }
  } catch (fbErr) {
    // Not a Firebase ID token or expired
  }

  return null;
}

async function createSessionToken(user: UserRecord): Promise<string> {
  // SABDHAM_DURABLE_SESSION_CREATE
  const token = `mm_tok_${randomBytes(32).toString('hex')}`;
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

  const dbUser = await getOrCreateUser(
    user.id,
    user.email,
    user.name,
    user.avatarUrl
  );

  // Durable sessions must always reference a real PostgreSQL user.
  if (!dbUser) {
    throw new Error('AUTH_DB_USER_PERSIST_FAILED');
  }

  const canonicalUid = dbUser.uid;
  user.id = canonicalUid;

  const saved = await createAuthSession(
    hashSessionToken(token),
    canonicalUid,
    user.email,
    user.provider,
    new Date(expiresAt)
  );

  if (!saved) {
    throw new Error('AUTH_SESSION_PERSIST_FAILED');
  }

  sessions.set(token, {
    userId: canonicalUid,
    email: user.email,
    expiresAt,
  });

  return token;
}

function initUserData(userId: string, email?: string) {
  const normalizedEmail = email?.toLowerCase();
  // Check if user data already exists under either key (e.g. from another device or login session)
  const existing = userDataStore.get(userId) || (normalizedEmail ? userDataStore.get(normalizedEmail) : null);
  if (existing) {
    userDataStore.set(userId, existing);
    if (normalizedEmail) {
      userDataStore.set(normalizedEmail, existing);
    }
    return;
  }

  const initialData: UserDataRecord = {
    likedTrackIds: [],
    recentlyPlayed: [],
    customPlaylists: [],
    customSongs: [],
    settings: {
      audioQuality: 'Normal',

      crossfade: false,
      gapless: false,
      autoplay: false,
      volumeNormalization: false,

      wifiOnlyDownloads: false,
      mobileStreaming: false,

      downloadQuality: 'Normal',
      themeMode: 'Dark',

      equalizerEnabled: false,
      equalizerPreset: 'Flat',

      eqBass: 0,
      eqLowMid: 0,
      eqMid: 0,
      eqHighMid: 0,
      eqTreble: 0,

      offlineMode: false,
    },
  };

  userDataStore.set(userId, initialData);
  if (normalizedEmail) {
    userDataStore.set(normalizedEmail, initialData);
  }
}


// SABDHAM_SUPPORT_REPORT_ENDPOINT
app.post('/api/support/report', async (req, res) => {
  try {
    const user = await getAuthUser(req);

    if (!user) {
      return res.status(401).json({
        error: 'Please sign in before sending a support report.'
      });
    }

    const rawReport = req.body?.report;

    if (typeof rawReport !== 'string') {
      return res.status(400).json({
        error: 'Support report is required.'
      });
    }

    const report = rawReport.trim();
    const wordCount =
      report.length === 0
        ? 0
        : report.split(/\s+/).filter(Boolean).length;

    if (wordCount < 50) {
      return res.status(400).json({
        error: `Please provide at least 50 words. Current count: ${wordCount}.`
      });
    }

    if (report.length > 6000) {
      return res.status(400).json({
        error: 'Support reports are limited to 6000 characters.'
      });
    }

    const sensitivePatterns = [
      /\b(?:password|passwd|pwd|api[_ -]?key|secret|token|otp|passcode|verification\s*code)\s*[:=]\s*\S+/i,
      /\bbearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
      /\b(?:re_|sk_|ghp_|xox[baprs]-|AIza)[A-Za-z0-9_-]{10,}/i,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
      /(?:^|[^\d])\+?\d[\d\s()\-]{7,}\d(?:$|[^\d])/
    ];

    if (sensitivePatterns.some((pattern) => pattern.test(report))) {
      return res.status(400).json({
        error:
          'Remove passwords, OTP codes, API keys, tokens, email addresses, phone numbers or other private details before sending.'
      });
    }

    const reference =
      crypto.randomBytes(6).toString('hex').toUpperCase();

    // Deliberately send only the report text and random reference.
    const result =
      await sendSupportReportEmail(report, reference);

    if (!result.success) {
      console.error(
        '[Support] Delivery failed:',
        result.error || 'Unknown mail error'
      );

      return res.status(502).json({
        error:
          'SABDHAM Support could not receive the report right now. Please try again later.'
      });
    }

    return res.json({
      success: true,
      message: 'Report sent to SABDHAM Support.',
      reference
    });
  } catch (error) {
    console.error('[Support] Report error:', error);

    return res.status(500).json({
      error: 'Unable to send the support report right now.'
    });
  }
});

// 1. API: Create Account with Email & Password (Secure Salted Hash via bcrypt)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name: rawName, email: rawEmail, password } = req.body || {};

    if (!rawEmail || typeof rawEmail !== 'string') {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    // Password is now optional

    const email = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email format (e.g., name@example.com).' });
    }

    // Check if user already exists
    const existing = users.get(email) || await getUserByEmail(email);
    if (existing) {
      return res.status(400).json({
        error: 'An account with this email already exists. Please sign in instead.'
      });
    }

    // Secure password hashing with bcrypt (10 rounds)
    const saltRounds = 10;
    const finalPassword = password && typeof password === 'string' && password.length >= 6 ? password : 'default-password-for-no-password-signup';
    const passwordHash = await bcrypt.hash(finalPassword, saltRounds);

    const id = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    const displayName = rawName && typeof rawName === 'string' && rawName.trim().length > 0
      ? rawName.trim().slice(0, 50)
      : email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);

    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const newUser: UserRecord = {
      id,
      email,
      name: displayName,
      passwordHash,
      provider: 'email',
      avatarColor,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    // PostgreSQL user + durable session must succeed first.
    // This prevents failed registrations from creating ghost accounts.
    const token = await createSessionToken(newUser);

    // createSessionToken replaces the temporary ID with the
    // canonical PostgreSQL SABDHAM UID.
    const canonicalId = newUser.id;

    users.set(email, newUser);
    usersById.set(canonicalId, newUser);
    initUserData(canonicalId, email);
    savePersistedData();

    setAuthCookie(res, token, 7);

    console.log(`\nÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ [Auth] New account created: ${email} (${displayName}) [Email/Password]`);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to SABDHAM.',
      token,
      user: sanitizeUser(newUser),
    });
  } catch (err: any) {
    console.error('Error in /api/auth/register:', err);
    return res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// 2. API: Sign In with Email & Password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body || {};

    if (!rawEmail || typeof rawEmail !== 'string') {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const email = rawEmail.trim().toLowerCase();
    const user = users.get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email.' });
    }

    user.lastLoginAt = new Date().toISOString();
    users.set(email, user);
    usersById.set(user.id, user);
    initUserData(user.id);
    savePersistedData();
    // Synchronize with PostgreSQL Cloud SQL
    getOrCreateUser(user.id, user.email, user.name, user.avatarUrl).catch(() => {});

    const token = await createSessionToken(user);
    setAuthCookie(res, token, 7);

    console.log(`\nÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Ëœ [Auth] User signed in: ${email} (${user.name})`);

    return res.json({
      success: true,
      message: 'Welcome back!',
      token,
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error('Error in /api/auth/login:', err);
    return res.status(500).json({ error: 'Failed to log in. Please try again.' });
  }
});

// 3. API: Request Password Recovery Code
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email: rawEmail } = req.body || {};

    if (!rawEmail || typeof rawEmail !== 'string') {
      return res.status(400).json({ error: 'Please enter your registered email address.' });
    }

    const email = rawEmail.trim().toLowerCase();
    const user = users.get(email);

    if (!user) {
      // Return a safe message so account presence is not leaked
      return res.json({
        success: true,
        message: 'If an account exists with this email, a 6-digit reset code has been generated.',
      });
    }

    // Generate 6-digit reset code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins expiry

    resetCodes.set(email, { code, expiresAt });

    console.log(`\nÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â [Auth] Password Reset Code generated for ${email}: [REDACTED]`);

    // Dispatch real email to user's inbox
    await sendOtpEmail(email, code, 'signin', user.name);

    return res.json({
      success: true,
      message: `A 6-digit password reset verification code has been sent to your email (${email}). Please check your inbox or spam folder.`,
    });
  } catch (err: any) {
    console.error('Error in /api/auth/forgot-password:', err);
    return res.status(500).json({ error: 'Could not process password recovery request.' });
  }
});

// 4. API: Verify Reset Code & Set New Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email: rawEmail, code, newPassword } = req.body || {};

    if (!rawEmail || typeof rawEmail !== 'string') {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    if (!code || typeof code !== 'string' || code.trim().length !== 6) {
      return res.status(400).json({ error: 'Please enter the 6-digit reset code.' });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const email = rawEmail.trim().toLowerCase();
    const resetData = resetCodes.get(email);

    if (!resetData) {
      return res.status(400).json({ error: 'No password reset code found for this email. Please request a new one.' });
    }

    if (Date.now() > resetData.expiresAt) {
      resetCodes.delete(email);
      return res.status(400).json({ error: 'Password reset code has expired. Please request a new code.' });
    }

    if (resetData.code !== code.trim()) {
      return res.status(400).json({ error: 'Invalid 6-digit reset code. Please check and try again.' });
    }

    const user = users.get(email);
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    // Hash new password with bcrypt
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    user.lastLoginAt = new Date().toISOString();

    users.set(email, user);
    usersById.set(user.id, user);
    resetCodes.delete(email);
    savePersistedData();
    getOrCreateUser(user.id, user.email, user.name, user.avatarUrl).catch(() => {});

    const token = await createSessionToken(user);
    setAuthCookie(res, token, 7);

    console.log(`\nÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Â° [Auth] Password reset successfully for ${email}`);

    return res.json({
      success: true,
      message: 'Your password has been reset successfully! You are now logged in.',
      token,
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error('Error in /api/auth/reset-password:', err);
    return res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// 4b. API: Request One-Time Passcode (OTP) for Sign-In or Sign-Up via Email
app.post('/api/auth/otp/send', async (req, res) => {
  try {
    const { identifier: rawIdentifier, email: rawEmail, purpose = 'any', name: rawName } = req.body || {};
    const email = (rawIdentifier || rawEmail || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isEmail) {
      return res.status(400).json({ error: 'Please enter a valid email address (e.g. user@example.com).' });
    }

    let existing = users.get(email);

    // Restore persistent account information from Cloud SQL if memory cache is empty.
    if (!existing) {
      const dbUser = await getUserByEmail(email);
      if (dbUser) {
        existing = {
          id: dbUser.uid,
          email: dbUser.email,
          name: dbUser.displayName || email.split('@')[0],
          provider: 'email',
          avatarUrl: dbUser.photoUrl || undefined,
          avatarColor: '#4f46e5',
          createdAt: dbUser.createdAt
            ? dbUser.createdAt.toISOString()
            : new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        users.set(email, existing);
        usersById.set(existing.id, existing);
      }
    }

    // Enforce separate Sign In and Register flows
    if (purpose === 'signup' && existing) {
      return res.status(409).json({
        success: false,
        error: 'This account already exists. Please sign in instead.',
        code: 'ACCOUNT_EXISTS',
        action: 'signin',
      });
    }

    if (purpose === 'signin' && !existing) {
      return res.status(404).json({
        success: false,
        error: 'No account exists with this email. Please create an account first.',
        code: 'ACCOUNT_NOT_FOUND',
        action: 'signup',
      });
    }

    // Generate secure 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(email, {
      code,
      expiresAt,
      purpose,
      name: rawName && typeof rawName === 'string' ? rawName.trim() : undefined,
      attempts: 0,
    });

    console.log(`\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¨ [Auth Email OTP] Code generated for ${email}: [REDACTED] (purpose: ${purpose}, existing: ${!!existing})`);

    // Dispatch real email to user's inbox
    const mailResult = await sendOtpEmail(email, code, purpose as any, rawName);

    const isNew = !existing;

    if (!mailResult.success) {
      otpStore.delete(email);

      console.error(
        `[OTP Mailer] Delivery failed for ${email}: ${mailResult.error || 'Unknown mail error'}`
      );

      return res.status(503).json({
        success: false,
        error: 'Unable to send the verification email. Please try again.',
        code: 'OTP_DELIVERY_FAILED',
      });
    }

    return res.json({
      success: true,
      message: `A 6-digit verification code has been sent to your email (${email}). Please check your inbox or spam folder.`,
      isNewUser: isNew,
      identifier: email,
    });
  } catch (err: any) {
    console.error('Error in /api/auth/otp/send:', err);
    return res.status(500).json({ error: 'Failed to send OTP code. Please try again.' });
  }
});

// 4c. API: Verify OTP to Sign In or Create Account via Email
app.post('/api/auth/otp/verify', async (req, res) => {
  try {
    const { identifier: rawIdentifier, email: rawEmail, code: rawCode, name: rawName } = req.body || {};
    const email = (rawIdentifier || rawEmail || '').trim().toLowerCase();
    const code = (rawCode || '').trim();

    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isEmail) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Please enter the 6-digit verification code.' });
    }

    const record = otpStore.get(email);
    if (!record) {
      return res.status(400).json({ error: 'No active OTP verification code found for this email. Please request a new code.' });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ error: 'The verification code has expired. Please request a new code.' });
    }

    record.attempts = (record.attempts || 0) + 1;
    if (record.attempts > 5) {
      otpStore.delete(email);
      return res.status(429).json({ error: 'Too many failed attempts. Please request a fresh OTP code.' });
    }

    if (record.code !== code) {
      return res.status(400).json({ error: 'Invalid verification code. Please check the code and try again.' });
    }

    // Re-check account state after OTP validation to prevent flow bypass
    let existingAtVerification = users.get(email);

    // Re-check Cloud SQL so an existing persistent account is never treated as a new signup.
    if (!existingAtVerification) {
      const dbUser = await getUserByEmail(email);
      if (dbUser) {
        existingAtVerification = {
          id: dbUser.uid,
          email: dbUser.email,
          name: dbUser.displayName || email.split('@')[0],
          provider: 'email',
          avatarUrl: dbUser.photoUrl || undefined,
          avatarColor: '#4f46e5',
          createdAt: dbUser.createdAt
            ? dbUser.createdAt.toISOString()
            : new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        users.set(email, existingAtVerification);
        usersById.set(existingAtVerification.id, existingAtVerification);
      }
    }

    if (record.purpose === 'signup' && existingAtVerification) {
      otpStore.delete(email);
      return res.status(409).json({
        success: false,
        error: 'This account already exists. Please sign in instead.',
        code: 'ACCOUNT_EXISTS',
        action: 'signin',
      });
    }

    if (record.purpose === 'signin' && !existingAtVerification) {
      otpStore.delete(email);
      return res.status(404).json({
        success: false,
        error: 'No account exists with this email. Please create an account first.',
        code: 'ACCOUNT_NOT_FOUND',
        action: 'signup',
      });
    }

    // OTP verified successfully.
    // Keep the code until durable DB/session creation succeeds.
    // Fetch existing or create new account
    let user = users.get(email);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const id = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
      const assignedName = (rawName && typeof rawName === 'string' && rawName.trim()) ||
        (record.name && record.name.trim()) ||
        email.split('@')[0];
      const displayName = assignedName.charAt(0).toUpperCase() + assignedName.slice(1);
      const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

      user = {
        id,
        email,
        name: displayName,
        provider: 'otp',
        avatarColor,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      // Do not cache a brand-new OTP account locally yet.
      // createSessionToken() below must first confirm the PostgreSQL
      // user and durable authentication session.
    } else {
      user.lastLoginAt = new Date().toISOString();
      users.set(email, user);
      usersById.set(user.id, user);
      savePersistedData();

      // Synchronize with PostgreSQL Cloud SQL
      try {
        await getOrCreateUser(user.id, user.email, user.name, user.avatarUrl);
      } catch (dbErr) {
        console.warn('Cloud SQL user upsert notification (OTP login):', dbErr);
      }
    }

    const token = await createSessionToken(user);

    if (isNewUser) {
      // createSessionToken() has now replaced user.id with the
      // canonical PostgreSQL SABDHAM UID.
      users.set(email, user);
      usersById.set(user.id, user);
      initUserData(user.id, email);
      savePersistedData();
    }

    // Consume the single-use OTP only after durable auth succeeds.
    otpStore.delete(email);

    setAuthCookie(res, token, 7);

    console.log(`\nÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Â° [Auth OTP] Successful authentication: ${user.email} (${user.name}) [isNewUser: ${isNewUser}]`);

    return res.json({
      success: true,
      message: isNewUser
        ? `Account created successfully! Welcome to SABDHAM, ${user.name}.`
        : `Welcome back, ${user.name}! Signed in successfully.`,
      token,
      user: sanitizeUser(user),
      isNewUser,
    });
  } catch (err: any) {
    console.error('Error in /api/auth/otp/verify:', err);
    return res.status(500).json({
      success: false,
      error: 'Authentication service could not complete verification. Please try again.',
      code:
        err?.message === 'AUTH_DB_USER_PERSIST_FAILED' ||
        err?.message === 'AUTH_SESSION_PERSIST_FAILED'
          ? err.message
          : 'AUTH_VERIFY_FAILED',
    });
  }
});

// 5. API: Get Current Authenticated User Profile
app.get('/api/auth/me', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated or session expired.' });
  }
  return res.json({ user: sanitizeUser(user) });
});

// 6. API: Update Profile
app.patch('/api/auth/profile', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const { name, avatarColor, avatarUrl, bio } = req.body || {};
  if (name && typeof name === 'string' && name.trim().length > 0) {
    user.name = name.trim().slice(0, 50);
  }
  if (avatarColor && typeof avatarColor === 'string') {
    user.avatarColor = avatarColor;
  }
  if (avatarUrl && typeof avatarUrl === 'string') {
    user.avatarUrl = avatarUrl;
  }
  if (bio && typeof bio === 'string') {
    user.bio = bio.trim().slice(0, 200);
  }

  users.set(user.email, user);
  usersById.set(user.id, user);
  savePersistedData();

  return res.json({ success: true, user: sanitizeUser(user) });
});

// 6. API: Logout
app.post('/api/auth/logout', async (req, res) => {
  clearAuthCookie(res);
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    sessions.delete(token);
    // SABDHAM_DURABLE_LOGOUT
    await deleteAuthSession(hashSessionToken(token));
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// 7. API: Delete User Account & Associated Personal Data (Google Play Policy Mandatory Requirement)
app.delete('/api/auth/delete-account', async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required to delete account.' });
    }

    const email = user.email.toLowerCase();
    users.delete(email);
    if (user.id) {
      usersById.delete(user.id);
      userDataStore.delete(user.id);
    }
    userDataStore.delete(email);

    // Invalidate all sessions belonging to user
    for (const [tokenKey, sess] of sessions.entries()) {
      if (sess.email.toLowerCase() === email || (user.id && sess.userId === user.id)) {
        sessions.delete(tokenKey);
      }
    }

    savePersistedData();
    clearAuthCookie(res);

    return res.json({
      success: true,
      message: 'Your Sabdham account and all associated playlists, favorites, and history have been permanently deleted.',
    });
  } catch (err: any) {
    console.error('[Auth] Error deleting user account:', err);
    return res.status(500).json({ error: 'Failed to delete account', message: err.message });
  }
});

// 8. API: Web-based Data Deletion Request (Public Google Play Data Safety URL Requirement)
app.post('/api/auth/request-data-deletion', (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = users.get(cleanEmail);
    if (existing) {
      users.delete(cleanEmail);
      if (existing.id) {
        usersById.delete(existing.id);
        userDataStore.delete(existing.id);
      }
      userDataStore.delete(cleanEmail);
      for (const [tokenKey, sess] of sessions.entries()) {
        if (sess.email.toLowerCase() === cleanEmail) {
          sessions.delete(tokenKey);
        }
      }
      savePersistedData();
    }

    return res.json({
      success: true,
      message: `Account deletion request for ${cleanEmail} processed successfully. All associated records and library data have been purged from Sabdham servers.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process data deletion request', message: err.message });
  }
});

// Google Firebase Auth sync with Cloud SQL
app.post('/api/auth/google', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.user.uid || !req.user.email) {
      return res.status(401).json({ error: 'Unauthorized: Missing user details' });
    }

    const normalizedEmail = req.user.email.trim().toLowerCase();
    const { displayName, photoUrl } = req.body || {};
    const name = displayName || req.user.name || normalizedEmail.split('@')[0];
    const picture = photoUrl || req.user.picture || null;

    // One verified email = one SABDHAM account.
    // getOrCreateUser returns the existing account when this email
    // was previously registered using Email OTP.
    const dbUser = await getOrCreateUser(
      req.user.uid,
      normalizedEmail,
      name,
      picture
    );

    if (!dbUser) {
      return res.status(500).json({
        error: 'Unable to resolve SABDHAM account.'
      });
    }

    // IMPORTANT: use the canonical SABDHAM UID returned by Cloud SQL.
    // Do not replace an existing OTP account UID with the Firebase UID.
    const sabdhamUid = dbUser.uid;

    let localUser = users.get(normalizedEmail);

    if (!localUser) {
      localUser = {
        id: sabdhamUid,
        email: normalizedEmail,
        name: dbUser.displayName || name,
        provider: 'google',
        avatarUrl: dbUser.photoUrl || picture || undefined,
        avatarColor: '#4f46e5',
        createdAt: dbUser.createdAt
          ? dbUser.createdAt.toISOString()
          : new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
    } else {
      // Keep the existing SABDHAM identity and its data.
      localUser.id = sabdhamUid;
      localUser.lastLoginAt = new Date().toISOString();

      if (picture) {
        localUser.avatarUrl = picture;
      }
    }

    users.set(normalizedEmail, localUser);
    usersById.set(sabdhamUid, localUser);

    // Link the same library under both canonical UID and email.
    initUserData(sabdhamUid, normalizedEmail);

    savePersistedData();

    const token = await createSessionToken(localUser);

    return res.json({
      success: true,
      message: 'Signed in successfully via Google!',
      token,
      user: sanitizeUser(localUser),
    });
  } catch (error: any) {
    console.error('Error syncing Google user with Cloud SQL:', error);
    return res.status(500).json({
      error: 'Failed to synchronize user profile with database.'
    });
  }
});
// Cloud SQL database user endpoints
app.get('/api/db/favorites', async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const favorites = await getUserFavorites(user.id);
    res.json({ favorites });
  } catch (error: any) {
    console.error('Failed to fetch user favorites from Cloud SQL:', error);
    res.status(500).json({ error: 'Failed to retrieve favorites.' });
  }
});

app.post('/api/db/favorites', async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { trackId, trackData } = req.body || {};
    if (!trackId) {
      return res.status(400).json({ error: 'trackId is required.' });
    }

    // SABDHAM_FAVORITE_RESULT_CHECK
    const savedFavorite = await addUserFavorite(user.id, trackId, trackData);
    if (!savedFavorite.success) {
      return res.status(500).json({ error: 'Failed to save favorite.' });
    }

    // SABDHAM_FAVORITE_MEMORY_SYNC
    // Keep the in-memory library consistent with the atomic PostgreSQL write.
    // Otherwise a later full /api/user/data sync can overwrite the new like.
    const favoriteId = String(trackId).trim();

    const favoriteState: UserDataRecord =
      userDataStore.get(user.id) ||
      (user.email
        ? userDataStore.get(user.email.toLowerCase())
        : undefined) || {
        likedTrackIds: [],
        likedTracks: [],
        recentlyPlayed: [],
        customPlaylists: [],
        customSongs: [],
      };

    favoriteState.likedTrackIds = Array.from(
      new Set([
        ...(favoriteState.likedTrackIds || []),
        favoriteId,
      ])
    );

    if (
      trackData &&
      typeof trackData === 'object'
    ) {
      favoriteState.likedTracks = [
        ...(favoriteState.likedTracks || []).filter(
          (item: any) => item?.id !== favoriteId
        ),
        {
          ...trackData,
          id: favoriteId,
        },
      ];
    }

    userDataStore.set(user.id, favoriteState);

    if (user.email) {
      userDataStore.set(
        user.email.toLowerCase(),
        favoriteState
      );
    }

    savePersistedData();

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to add favorite to Cloud SQL:', error);
    res.status(500).json({ error: 'Failed to save favorite.' });
  }
});

app.delete('/api/db/favorites/:trackId', async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { trackId } = req.params;

    const removedFavorite =
      await removeUserFavorite(user.id, trackId);

    if (!removedFavorite.success) {
      return res
        .status(500)
        .json({ error: 'Failed to remove favorite.' });
    }

    // SABDHAM_FAVORITE_MEMORY_DELETE_SYNC
    const favoriteId = String(trackId).trim();

    const favoriteState: UserDataRecord =
      userDataStore.get(user.id) ||
      (user.email
        ? userDataStore.get(user.email.toLowerCase())
        : undefined) || {
        likedTrackIds: [],
        likedTracks: [],
        recentlyPlayed: [],
        customPlaylists: [],
        customSongs: [],
      };

    favoriteState.likedTrackIds =
      (favoriteState.likedTrackIds || [])
        .filter((id) => id !== favoriteId);

    favoriteState.likedTracks =
      (favoriteState.likedTracks || [])
        .filter(
          (item: any) => item?.id !== favoriteId
        );

    userDataStore.set(user.id, favoriteState);

    if (user.email) {
      userDataStore.set(
        user.email.toLowerCase(),
        favoriteState
      );
    }

    savePersistedData();

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to remove favorite from Cloud SQL:', error);
    res.status(500).json({ error: 'Failed to remove favorite.' });
  }
});

app.delete('/api/db/playlists/:playlistId', async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { playlistId } = req.params;
    // SABDHAM_PLAYLIST_DELETE_CHECK
    const deleted =
      await deleteUserPlaylist(user.id, playlistId);

    if (!deleted) {
      return res
        .status(500)
        .json({ error: 'Failed to delete playlist.' });
    }
    const current = userDataStore.get(user.id) || userDataStore.get(user.email?.toLowerCase() || '');
    if (current && current.customPlaylists) {
      current.customPlaylists = current.customPlaylists.filter((p: any) => p.id !== playlistId);
      userDataStore.set(user.id, current);
      if (user.email) userDataStore.set(user.email.toLowerCase(), current);
      savePersistedData();
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete playlist from Cloud SQL:', error);
    res.status(500).json({ error: 'Failed to delete playlist.' });
  }
});

function isLegacyGeneratedFavoritesPlaylist(playlist: any): boolean {
  if (!playlist || typeof playlist !== 'object') {
    return false;
  }

  const id = String(playlist.id || '').trim().toLowerCase();
  const title = String(
    playlist.title || playlist.name || ''
  ).trim().toLowerCase();

  return (
    title === 'my morning favorites' &&
    id.startsWith('pl_') &&
    id.endsWith('_fav')
  );
}

// 7. API: Get User's Isolated Private Data
// PostgreSQL is the ONLY durable source of truth.
app.get('/api/user/data', async (req, res) => {
  const user = await getAuthUser(req);

  if (!user) {
    return res.status(401).json({
      error: 'Authentication required to access user data.'
    });
  }

  const dbUser = await getOrCreateUser(
    user.id,
    user.email,
    user.name,
    user.avatarUrl
  );

  if (!dbUser) {
    console.error(
      '[DB AUTHORITATIVE] Could not resolve PostgreSQL user for ' +
      user.email
    );

    return res.status(503).json({
      success: false,
      error: 'Your library is temporarily unavailable.',
      code: 'USER_DB_UNAVAILABLE'
    });
  }

  const dbLibrary = await getUserLibraryFromDb(dbUser.uid);

  if (!dbLibrary) {
    console.error(
      '[DB AUTHORITATIVE] Library read failed for ' +
      dbUser.uid
    );

    return res.status(503).json({
      success: false,
      error: 'Your library is temporarily unavailable.',
      code: 'USER_LIBRARY_DB_UNAVAILABLE'
    });
  }

  // Old generated Favorites playlists are retained in PostgreSQL for
  // recovery, but they must no longer appear as normal playlists.
  const cleanLibrary: UserDataRecord = {
    ...(dbLibrary as UserDataRecord),
    likedTrackIds: [...(dbLibrary.likedTrackIds || [])],
    likedTracks: [...(dbLibrary.likedTracks || [])],
    recentlyPlayed: [...(dbLibrary.recentlyPlayed || [])],
    customPlaylists: (dbLibrary.customPlaylists || []).filter(
      (playlist: any) =>
        !isLegacyGeneratedFavoritesPlaylist(playlist)
    ),
    customSongs: [...(dbLibrary.customSongs || [])],
  };

  // Cache receives PostgreSQL state only AFTER a successful DB read.
  userDataStore.set(dbUser.uid, cleanLibrary);
  userDataStore.set(user.id, cleanLibrary);

  if (user.email) {
    userDataStore.set(
      user.email.toLowerCase(),
      cleanLibrary
    );
  }

  savePersistedData();

  return res.json({
    data: cleanLibrary,
    source: 'postgresql'
  });
});

// 8. API: Save/Sync User's Isolated Private Data
// PostgreSQL is read first, written first, then cache is refreshed.
// Favorite mutations are exclusively handled by /api/db/favorites.
app.post('/api/user/data', async (req, res) => {
  const user = await getAuthUser(req);

  if (!user) {
    return res.status(401).json({
      error: 'Authentication required to save user data.'
    });
  }

  const dbUser = await getOrCreateUser(
    user.id,
    user.email,
    user.name,
    user.avatarUrl
  );

  if (!dbUser) {
    return res.status(503).json({
      success: false,
      error: 'Unable to access your account database.',
      code: 'USER_DB_UNAVAILABLE'
    });
  }

  // IMPORTANT:
  // Never merge a write against RAM/cache. Always start from PostgreSQL.
  const dbCurrent = await getUserLibraryFromDb(dbUser.uid);

  if (!dbCurrent) {
    console.error(
      '[DB AUTHORITATIVE] Refusing user-data write because DB read failed for ' +
      dbUser.uid
    );

    return res.status(503).json({
      success: false,
      error: 'Your library could not be loaded safely. Nothing was changed.',
      code: 'USER_LIBRARY_DB_UNAVAILABLE'
    });
  }

  const {
    likedTrackIds,
    likedTracks,
    recentlyPlayed,
    customPlaylists,
    customSongs,
    settings,
    isExplicitClear
  } = req.body || {};

  const current: UserDataRecord = {
    ...(dbCurrent as UserDataRecord),
    likedTrackIds: [...(dbCurrent.likedTrackIds || [])],
    likedTracks: [...(dbCurrent.likedTracks || [])],
    recentlyPlayed: [...(dbCurrent.recentlyPlayed || [])],
    customPlaylists: (dbCurrent.customPlaylists || []).filter(
      (playlist: any) =>
        !isLegacyGeneratedFavoritesPlaylist(playlist)
    ),
    customSongs: [...(dbCurrent.customSongs || [])],
  };

  const dbPatch: any = {};

  // ==========================================================
  // FAVORITES SAFETY
  // ==========================================================
  // Full-library snapshots are NOT allowed to add/remove favorites.
  // This prevents an old Android cache/settings sync from restoring
  // deleted likes or wiping newly-added likes.
  if (
    Array.isArray(likedTrackIds) ||
    Array.isArray(likedTracks)
  ) {
    console.log(
      '[DB AUTHORITATIVE] Ignored snapshot favorite fields for ' +
      dbUser.uid +
      '; use atomic /api/db/favorites endpoints.'
    );
  }

  // ==========================================================
  // RECENTLY PLAYED
  // ==========================================================
  if (Array.isArray(recentlyPlayed)) {
    if (
      recentlyPlayed.length > 0 ||
      isExplicitClear ||
      current.recentlyPlayed.length === 0
    ) {
      current.recentlyPlayed =
        recentlyPlayed
          .filter(
            (item: any) =>
              item &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              item.id.trim().length > 0
          )
          .slice(0, 50);

      dbPatch.recentlyPlayed =
        current.recentlyPlayed;
    }
  }

  // ==========================================================
  // PLAYLISTS
  // ==========================================================
  if (Array.isArray(customPlaylists)) {
    const playlistsById =
      new Map<string, any>();

    for (const existing of current.customPlaylists) {
      if (
        existing &&
        typeof existing.id === 'string' &&
        existing.id.trim().length > 0
      ) {
        playlistsById.set(existing.id, existing);
      }
    }

    const incoming =
      customPlaylists.filter(
        (playlist: any) =>
          playlist &&
          typeof playlist.id === 'string' &&
          playlist.id.trim().length > 0 &&
          !isLegacyGeneratedFavoritesPlaylist(playlist)
      );

    for (const playlist of incoming) {
      const existing =
        playlistsById.get(playlist.id);

      const merged = {
        ...(existing || {}),
        ...playlist,
      };

      // A stale/partial client sending an empty track array must NEVER
      // erase tracks that PostgreSQL already has.
      if (existing) {
        const existingTracks =
          Array.isArray(existing.tracks)
            ? existing.tracks
            : [];

        const existingTrackIds =
          Array.isArray(existing.trackIds)
            ? existing.trackIds
            : [];

        if (
          Array.isArray(playlist.tracks) &&
          playlist.tracks.length === 0 &&
          existingTracks.length > 0
        ) {
          merged.tracks = existingTracks;
        }

        if (
          Array.isArray(playlist.trackIds) &&
          playlist.trackIds.length === 0 &&
          existingTrackIds.length > 0
        ) {
          merged.trackIds = existingTrackIds;
        }
      }

      playlistsById.set(
        playlist.id,
        merged
      );
    }

    current.customPlaylists =
      Array.from(playlistsById.values());

    dbPatch.customPlaylists =
      current.customPlaylists;
  }

  // ==========================================================
  // CUSTOM SONGS
  // ==========================================================
  if (Array.isArray(customSongs)) {
    if (customSongs.length > 0) {
      const songsById =
        new Map<string, any>();

      for (const existing of current.customSongs) {
        if (
          existing &&
          typeof existing.id === 'string'
        ) {
          songsById.set(
            existing.id,
            existing
          );
        }
      }

      for (const song of customSongs) {
        if (
          song &&
          typeof song.id === 'string' &&
          song.id.trim().length > 0
        ) {
          songsById.set(
            song.id,
            {
              ...(songsById.get(song.id) || {}),
              ...song,
            }
          );
        }
      }

      current.customSongs =
        Array.from(songsById.values());

      dbPatch.customSongs =
        current.customSongs;
    } else if (
      current.customSongs.length === 0
    ) {
      dbPatch.customSongs = [];
    } else {
      console.warn(
        '[DB AUTHORITATIVE] Ignored empty custom-song snapshot for ' +
        dbUser.uid
      );
    }
  }

  // ==========================================================
  // SETTINGS
  // ==========================================================
  if (
    settings &&
    typeof settings === 'object'
  ) {
    current.settings = {
      ...(current.settings || {}),
      ...settings,
    } as UserDataRecord['settings'];

    dbPatch.settings = current.settings;
  }

  // PostgreSQL must succeed BEFORE RAM/JSON cache can change.
  if (Object.keys(dbPatch).length > 0) {
    const saved = await saveUserLibraryToDb(
      dbUser.uid,
      dbPatch
    );

    if (!saved) {
      console.error(
        '[DB AUTHORITATIVE] Database save failed for ' +
        dbUser.uid
      );

      return res.status(503).json({
        success: false,
        error: 'Your changes could not be saved safely. Nothing was cached.',
        code: 'USER_LIBRARY_DB_SAVE_FAILED'
      });
    }
  }

  // Re-read PostgreSQL after the write.
  const confirmed =
    await getUserLibraryFromDb(dbUser.uid);

  if (!confirmed) {
    return res.status(503).json({
      success: false,
      error: 'Changes were written but could not be verified.',
      code: 'USER_LIBRARY_DB_VERIFY_FAILED'
    });
  }

  const confirmedClean: UserDataRecord = {
    ...(confirmed as UserDataRecord),
    likedTrackIds: [...(confirmed.likedTrackIds || [])],
    likedTracks: [...(confirmed.likedTracks || [])],
    recentlyPlayed: [...(confirmed.recentlyPlayed || [])],
    customPlaylists: (confirmed.customPlaylists || []).filter(
      (playlist: any) =>
        !isLegacyGeneratedFavoritesPlaylist(playlist)
    ),
    customSongs: [...(confirmed.customSongs || [])],
  };

  userDataStore.set(
    dbUser.uid,
    confirmedClean
  );

  userDataStore.set(
    user.id,
    confirmedClean
  );

  if (user.email) {
    userDataStore.set(
      user.email.toLowerCase(),
      confirmedClean
    );
  }

  savePersistedData();

  return res.json({
    success: true,
    message: 'User data saved to PostgreSQL.',
    data: confirmedClean,
    source: 'postgresql'
  });
});

function getSpotifyRedirectUri(req: express.Request): string {
  if (req.query.redirectUri && typeof req.query.redirectUri === 'string' && req.query.redirectUri.trim().startsWith('http')) {
    return req.query.redirectUri.trim();
  }
  if (process.env.SPOTIFY_REDIRECT_URI && process.env.SPOTIFY_REDIRECT_URI.trim().startsWith('http')) {
    return process.env.SPOTIFY_REDIRECT_URI.trim();
  }
  const clientOrigin = (req.query.origin as string) || req.get('origin');
  if (clientOrigin && (clientOrigin.startsWith('http://') || clientOrigin.startsWith('https://'))) {
    return `${clientOrigin.replace(/\/$/, '')}/oauth/spotify/callback`;
  }
  if (process.env.APP_URL) {
    return `${process.env.APP_URL.replace(/\/$/, '')}/oauth/spotify/callback`;
  }
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
  const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
  return `${proto}://${host}/oauth/spotify/callback`;
}

// 9. API: Spotify OAuth Config
app.get('/api/spotify/config', (req, res) => {
  res.json({
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    redirectUri: getSpotifyRedirectUri(req)
  });
});

// 10. Spotify OAuth Callback
app.get('/oauth/spotify/callback', (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Spotify Authorization</title></head>
      <body style="background:#121212;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;padding:20px;">
          <h3 style="color:#ef4444;">Spotify Authentication Failed</h3>
          <p style="color:#a1a1aa;font-size:14px;">Error: ${error}</p>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage({ type: 'SPOTIFY_AUTH_ERROR', error: '${error}' }, '*');
              }
            } catch(e) {}
            setTimeout(() => window.close(), 1500);
          </script>
        </div>
      </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Spotify Authorization</title></head>
    <body style="background:#121212;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
      <div style="text-align:center;padding:20px;">
        <div style="width:40px;height:40px;border-radius:50%;background:#1db954;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:#000;font-weight:bold;font-size:20px;">ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“</div>
        <h3 style="margin:0 0 8px;">Spotify Connected</h3>
        <p style="color:#a1a1aa;font-size:14px;margin:0;">Returning to Sabdham...</p>
        <script>
          try {
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_CODE', code: '${code}' }, '*');
            }
          } catch(e) {}
          setTimeout(() => window.close(), 600);
        </script>
      </div>
    </body>
    </html>
  `);
});

// 11. API: Exchange Spotify Code for Token
app.post('/api/spotify/token', async (req, res) => {
  const { code, redirectUri: customRedirectUri } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });

  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = customRedirectUri || getSpotifyRedirectUri(req);

    if (!clientId || !clientSecret) {
      throw new Error('Spotify credentials not configured on server');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);

    const data = await robustFetchJson('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: params
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. API: Fetch YouTube Playlists
app.get('/api/youtube/playlists', async (req, res) => {
  const googleToken = req.headers.authorization;
  if (!googleToken) return res.status(401).json({ error: 'Google Access Token required' });

  try {
    const data = await robustFetchJson('https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50', {
      headers: {
        'Authorization': googleToken
      }
    });

    res.json(data.items || []);
  } catch (err: any) {
    console.error('YouTube playlists error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 13. API: Fetch YouTube Playlist Items
app.get('/api/youtube/playlist-items', async (req, res) => {
  const googleToken = req.headers.authorization;
  const { playlistId } = req.query;
  if (!googleToken) return res.status(401).json({ error: 'Google Access Token required' });
  if (!playlistId) return res.status(400).json({ error: 'Playlist ID required' });

  try {
    const youtubeRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50`, {
      headers: {
        'Authorization': googleToken,
        'Accept': 'application/json'
      }
    });

    const data = await youtubeRes.json();
    if (!youtubeRes.ok) {
      console.error(`[YouTube Proxy] YouTube playlist returned status ${youtubeRes.status} for playlistId: ${playlistId}. Response:`, JSON.stringify(data));
      throw new Error(data.error?.message || 'Failed to fetch YouTube playlist items');
    }

    res.json(data.items || []);
  } catch (err: any) {
    console.error('YouTube playlist items error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function fetchPublicSpotifyPlaylistEmbed(playlistId: string) {
  const res = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  if (!res.ok) throw new Error(`Spotify public embed returned HTTP ${res.status}`);
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Could not parse Spotify public embed');
  const json = JSON.parse(match[1]);
  const entity = json.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Spotify playlist data entity not found');
  return entity;
}

let spotifyAppAccessToken = '';
let spotifyAppAccessTokenExpiresAt = 0;

async function getSpotifyAppAccessToken(): Promise<string | null> {
  const now = Date.now();

  if (
    spotifyAppAccessToken &&
    spotifyAppAccessTokenExpiresAt > now + 60_000
  ) {
    return spotifyAppAccessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  try {
    const tokenResponse = await fetch(
      'https://accounts.spotify.com/api/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization':
            'Basic ' +
            Buffer.from(clientId + ':' + clientSecret).toString('base64')
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!tokenResponse.ok) {
      console.warn(
        '[Spotify Playlist Search] Token request returned',
        tokenResponse.status
      );
      return null;
    }

    const tokenData = (await tokenResponse.json()) as any;
    const token = String(tokenData?.access_token || '').trim();

    if (!token) {
      return null;
    }

    spotifyAppAccessToken = token;
    spotifyAppAccessTokenExpiresAt =
      now +
      Math.max(Number(tokenData?.expires_in || 3600) - 60, 60) * 1000;

    return token;
  } catch (err) {
    console.warn(
      '[Spotify Playlist Search] Token request failed:',
      err
    );
    return null;
  }
}

async function searchPublicSpotifyPlaylists(
  query: string,
  limit: number = 12
): Promise<any[]> {
  const cleanQuery = String(query || '').trim();

  if (!cleanQuery) {
    return [];
  }

  const token = await getSpotifyAppAccessToken();

  if (!token) {
    return [];
  }

  try {
    // Spotify's current Search API allows at most 10 items per type.
    // A client-credentials token has no user country, so provide a market
    // explicitly; otherwise catalog availability can be empty.
    const boundedLimit = Math.min(Math.max(limit, 1), 10);
    const configuredMarket =
      String(process.env.SPOTIFY_MARKET || 'LK')
        .trim()
        .toUpperCase();
    const market =
      /^[A-Z]{2}$/.test(configuredMarket)
        ? configuredMarket
        : 'LK';

    const searchUrl =
      'https://api.spotify.com/v1/search' +
      '?q=' + encodeURIComponent(cleanQuery) +
      '&type=playlist' +
      '&market=' + encodeURIComponent(market) +
      '&limit=' + boundedLimit;

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.warn(
        '[Spotify Playlist Search] Spotify returned',
        response.status
      );
      return [];
    }

    const data = (await response.json()) as any;
    const items = Array.isArray(data?.playlists?.items)
      ? data.playlists.items
      : [];

    return items
      .filter(
        (item: any) =>
          item &&
          item.id &&
          item.name &&
          item.public !== false
      )
      .map((item: any) => ({
        id: String(item.id).trim(),
        title: String(item.name).trim(),
        owner:
          String(
            item.owner?.display_name ||
              item.owner?.id ||
              'Spotify'
          ).trim(),
        itemCount:
          Number(
            item.tracks?.total ||
              item.items?.total ||
              0
          ) || 0,
        source: 'spotify'
      }))
      .filter(
        (item: any) =>
          item.id &&
          item.title
      )
      .slice(0, boundedLimit);
  } catch (err) {
    console.warn(
      '[Spotify Playlist Search] Failed:',
      err
    );
    return [];
  }
}

app.get('/api/spotify/search-playlists', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    const maxResults =
      Math.min(
        Math.max(
          parseInt(String(req.query.maxResults || '12'), 10) || 12,
          1
        ),
        20
      );

    if (!query) {
      return res.json({ playlists: [] });
    }

    const playlists =
      await searchPublicSpotifyPlaylists(
        query,
        maxResults
      );

    return res.json({ playlists });
  } catch (err) {
    console.warn(
      '[Spotify Playlist Search] Endpoint failed:',
      err
    );
    return res.json({ playlists: [] });
  }
});


// 14. API: Fetch Spotify Playlists
app.get('/api/spotify/playlists', async (req, res) => {
  let spotifyToken = req.headers.authorization; // Expecting "Bearer ACCESS_TOKEN"
  if (!spotifyToken) return res.status(401).json({ error: 'Spotify Access Token required' });
  if (!spotifyToken.startsWith('Bearer ')) {
    spotifyToken = `Bearer ${spotifyToken}`;
  }

  try {
    const data = await robustFetchJson('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: {
        'Authorization': spotifyToken
      }
    });

    res.json(data.items || []);
  } catch (err: any) {
    const message = err.message || '';
    const lower = message.toLowerCase();
    const isPremiumRequired = lower.includes('active premium subscription required') || lower.includes('premium');
    const isForbidden = lower.includes('user not registered') || lower.includes('403') || lower.includes('forbidden');

    // Return status 200 with structured info so frontend seamlessly handles this without throwing errors
    return res.json({
      items: [],
      error: null,
      premiumRequired: isPremiumRequired,
      forbidden: isForbidden,
      message: 'Could not sync Spotify library. Use link import below.'
    });
  }
});

// 15. API: Fetch Spotify Playlist Tracks
app.get('/api/spotify/playlist-tracks', async (req, res) => {
  const authHeader = req.headers.authorization;
  const { playlistId } = req.query;
  if (!playlistId) return res.status(400).json({ error: 'Playlist ID required' });

  // Clean playlist ID if passed as full URI or URL
  let cleanId = String(playlistId).trim();
  const urlMatch = cleanId.match(/playlist\/([a-zA-Z0-9]+)/);
  if (urlMatch) cleanId = urlMatch[1];
  const uriMatch = cleanId.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (uriMatch) cleanId = uriMatch[1];
  cleanId = cleanId.split('?')[0];

  try {
    let spotifyToken = authHeader;
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    // 1. Try official API if token is provided or client credentials succeed
    if (!spotifyToken || !spotifyToken.startsWith('Bearer ')) {
      if (clientId && clientSecret) {
        try {
          const tokenData = await robustFetchJson('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
            },
            body: 'grant_type=client_credentials'
          });
          spotifyToken = `Bearer ${tokenData.access_token}`;
        } catch (tokErr) {}
      }
    }

    if (spotifyToken && spotifyToken.startsWith('Bearer ')) {
      try {
        let allItems: any[] = [];
        let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${cleanId}/tracks?limit=100`;
        
        try {
          const resJson = await robustFetchJson(nextUrl, { headers: { 'Authorization': spotifyToken } });
          if (resJson && resJson.items) {
            allItems.push(...resJson.items);
            nextUrl = resJson.next;
          }
        } catch {
          nextUrl = `https://api.spotify.com/v1/playlists/${cleanId}/items?limit=100`;
          const resJson = await robustFetchJson(nextUrl, { headers: { 'Authorization': spotifyToken } });
          if (resJson && resJson.items) {
            allItems.push(...resJson.items);
            nextUrl = resJson.next;
          }
        }

        while (nextUrl && allItems.length < 500) {
          try {
            const pageData = await robustFetchJson(nextUrl, { headers: { 'Authorization': spotifyToken } });
            if (pageData && pageData.items) {
              allItems.push(...pageData.items);
              nextUrl = pageData.next;
            } else {
              break;
            }
          } catch {
            break;
          }
        }

        if (allItems.length > 0) {
          return res.json(allItems);
        }
      } catch {
        // Fallback to public embed silently
      }
    }

    // 2. Ultra-reliable fallback: Fetch from public Spotify embed (no auth or premium required!)
    const entity = await fetchPublicSpotifyPlaylistEmbed(cleanId);
    const coverUrl = entity.coverArt?.sources?.[0]?.url || '';
    const trackList = (entity.trackList || []).map((t: any) => ({
      track: {
        id: t.uid || t.uri,
        name: t.title,
        artists: [{ name: t.subtitle || 'Unknown Artist' }],
        album: {
          name: entity.title || entity.name || 'Spotify Playlist',
          images: coverUrl ? [{ url: coverUrl }] : []
        },
        duration_ms: t.duration || 180000
      }
    }));

    res.json(trackList);
  } catch (err: any) {
    res.status(500).json({ error: 'Could not fetch playlist tracks.' });
  }
});

// 15b. API: Resolve Public Spotify Playlist Info (No User Auth Required)
app.get('/api/spotify/playlist-resolve', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Playlist URL is required' });

  // Extract ID from URL or Spotify URI
  let cleanId = url.trim();
  const urlMatch = cleanId.match(/playlist\/([a-zA-Z0-9]+)/);
  if (urlMatch) cleanId = urlMatch[1];
  const uriMatch = cleanId.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (uriMatch) cleanId = uriMatch[1];
  cleanId = cleanId.split('?')[0];

  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    // 1. Try official API first if client credentials work
    if (clientId && clientSecret) {
      try {
        const tokenData = await robustFetchJson('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
          },
          body: 'grant_type=client_credentials'
        });

        const clientToken = tokenData.access_token;
        const data = await robustFetchJson(`https://api.spotify.com/v1/playlists/${cleanId}`, {
          headers: { 'Authorization': `Bearer ${clientToken}` }
        });

        return res.json({
          id: data.id,
          title: data.name,
          description: data.description || '',
          coverUrl: data.images?.[0]?.url || '',
          trackCount: data.tracks?.total || data.items?.total || 0,
          source: 'spotify'
        });
      } catch {
        // Fall back to public embed silently
      }
    }

    // 2. Fallback: Resolve via public Spotify embed (works without Spotify Developer keys/premium!)
    const entity = await fetchPublicSpotifyPlaylistEmbed(cleanId);
    const coverUrl = entity.coverArt?.sources?.[0]?.url || '';
    const trackCount = entity.trackList?.length || 0;

    return res.json({
      id: entity.id || cleanId,
      title: entity.title || entity.name || 'Spotify Playlist',
      description: entity.subtitle || '',
      coverUrl,
      trackCount,
      source: 'spotify'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Could not resolve playlist.' });
  }
});

let _clientDb: any = null;
function getClientDb() {
  if (!_clientDb) {
    try {
      const clientApp = initializeClientApp(firebaseConfig);
      _clientDb = firebaseConfig.firestoreDatabaseId
        ? getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId)
        : getClientFirestore(clientApp);
    } catch (err) {
      console.warn('[Firebase Client] Failed to initialize client Firestore in server:', err);
      return null;
    }
  }
  return _clientDb;
}

// 16. API: Refresh Trending Hits
app.post('/api/cron/refresh-trending', async (req, res) => {
  try {
    const clientDb = getClientDb();
    if (!clientDb) {
      return res.status(503).json({ error: 'Firestore database is not available' });
    }

    const geminiHits = await fetchTrendingSongsFromGemini().catch(err => { 
        console.error('Gemini error:', err); 
        throw err; 
    });

    const hits = geminiHits.map((hit: any) => ({
        id: `gemini_${hit.title.replace(/\s+/g, '_').toLowerCase()}`,
        title: hit.title,
        artist: hit.artist,
        youtubeVideoId: '', 
        releaseDate: hit.releaseDate,
        viewCount: 0,
        isTrendingNow: true,
        updatedAt: new Date().toISOString()
    })).filter((hit: any) => {
        const relDateMs = new Date(hit.releaseDate).getTime();
        const daysOld = (Date.now() - relDateMs) / (1000 * 60 * 60 * 24);
        return daysOld <= 90;
    });

    const colRef = collection(clientDb, 'trending_hits');

    // Clear existing trending hits
    const existingDocs = await getDocs(colRef);
    const deleteBatch = writeBatch(clientDb);
    existingDocs.forEach(d => deleteBatch.delete(d.ref));
    await deleteBatch.commit();

    // Add new hits
    const addBatch = writeBatch(clientDb);
    for (const hit of hits) {
      const docRef = doc(clientDb, 'trending_hits', hit.id);
      addBatch.set(docRef, hit);
    }
    await addBatch.commit();

    res.json({ success: true, message: `Updated ${hits.length} trending hits from Gemini.` });
  } catch (err: any) {
    console.error('Cron job error:', err);
    res.status(500).json({ error: err.message });
  }
});


// In-memory cache to optimize YouTube API quota and provide fast responses
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getCached(key: string) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Decode HTML entities in YouTube titles/descriptions
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

// Parse ISO 8601 duration (e.g., PT4M33S, PT1H2M15S) into seconds & formatted "m:ss"
function parseIsoDuration(duration: string): { seconds: number; formatted: string } {
  if (!duration) return { seconds: 180, formatted: '3:00' };
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return { seconds: 180, formatted: '3:00' };

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  let formatted = '';
  if (hours > 0) {
    formatted = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  return { seconds: totalSeconds, formatted };
}

// Clean up YouTube video title
function cleanYouTubeTitle(rawTitle: string): { title: string; artistSuggestion?: string } {
  let clean = decodeHtmlEntities(rawTitle || '')
    .replace(/\u00a0/g, ' ')
    .trim();

  // Remove video-platform presentation text while preserving the real
  // song title, including Tamil/Sinhala and other Unicode scripts.
  clean = clean
    .replace(
      /\s*[\(\[]\s*(?:official\s*)?(?:music\s*)?(?:video|audio|lyric(?:s)?(?:\s*video)?|visuali[sz]er|m\s*\/?\s*v|mv|hd|4k|full\s*song|full\s*video)\s*[\)\]]\s*/gi,
      ' '
    )
    .replace(
      /\s*[-|:]\s*(?:official\s*)?(?:music\s*)?(?:video|audio|lyric(?:s)?(?:\s*video)?|visuali[sz]er|m\s*\/?\s*v|mv|hd|4k|full\s*song|full\s*video)\s*$/gi,
      ' '
    )
    .replace(/\b(?:official\s+music\s+video|official\s+video|official\s+audio|lyric(?:s)?\s+video|video\s+song|full\s+video|full\s+song)\b\s*$/gi, ' ')
    .replace(/\s+\b(?:m\s*\/?\s*v|mv)\b\s*$/gi, ' ')
    .replace(/\s*\|\s*.*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-|:]+|[-|:]+$/g, '')
    .trim();

  // YouTube commonly formats music as "Artist - Song". Keep the artist
  // separately and show only the song title in SABDHAM.
  const artistSongMatch = clean.match(/^(.+?)\s+[\-–—]\s+(.+)$/u);
  if (artistSongMatch) {
    const artistSuggestion = artistSongMatch[1].trim();
    const songTitle = artistSongMatch[2].trim();

    if (artistSuggestion && songTitle) {
      return {
        artistSuggestion,
        title: songTitle
      };
    }
  }

  return {
    title: clean || decodeHtmlEntities(rawTitle || '').trim()
  };
}

function cleanYouTubeChannelArtist(rawArtist: string): string {
  return decodeHtmlEntities(rawArtist || '')
    .replace(/\s*-\s*Topic\s*$/i, '')
    .replace(/\s+VEVO\s*$/i, '')
    .replace(/\s+(?:Official\s+Channel|Official)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Ensure results are strictly popular single songs, filtering out playlists/jukeboxes
function isSingleSong(rawTitle: string, durationSeconds: number): boolean {
  const lower = rawTitle.toLowerCase();
  const forbiddenPhrases = [
    'playlist', 'jukebox', 'full album', 'all songs', 'audio jukebox',
    'mashup', 'non stop', 'nonstop', 'compilation', 'full songs',
    'top 10', 'top 20', 'top 50', 'best of', '1 hour', '2 hour', '3 hour',
    'megamix', 'collection', 'continuous', 'songs collection', 'hits collection',
    'album songs', 'dj mix'
  ];
  for (const phrase of forbiddenPhrases) {
    if (lower.includes(phrase)) return false;
  }
  // Single songs are typically between 1 minute and 9 minutes (540s)
  if (durationSeconds > 540 || (durationSeconds > 0 && durationSeconds < 50)) {
    return false;
  }
  return true;
}

// API: Health / YouTube status with secure masked diagnostics (no raw key exposure)
app.get('/api/youtube/status', (req, res) => {
  res.json(youtubeConfig.getPublicStatus());
});

// API: Resolve verified artist profile photo (TheAudioDB -> Wikidata/Wikimedia -> Default Placeholder)
app.get('/api/artist/image', async (req, res) => {
  const name = req.query.name;
  const id = req.query.id;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Artist name parameter is required' });
  }

  const artistName = name.trim();
  const artistId = (id && typeof id === 'string') ? id.trim() : `artist-${artistName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const cacheKey = `artist_profile_img_${artistId}`;

  // Check server cache first
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // 1. Try TheAudioDB API
  try {
    const audiodbUrl = `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artistName)}`;
    const audiodbRes = await fetch(audiodbUrl);
    if (audiodbRes.ok) {
      const data = await audiodbRes.json();
      if (data.artists && Array.isArray(data.artists) && data.artists.length > 0) {
        const matchedArtist = data.artists.find(
          (a: any) => a.strArtist && a.strArtist.toLowerCase() === artistName.toLowerCase()
        ) || data.artists[0];

        const thumbUrl = matchedArtist?.strArtistThumb || matchedArtist?.strArtistFanart;
        if (thumbUrl && typeof thumbUrl === 'string' && thumbUrl.startsWith('http')) {
          const result = {
            artistId,
            artistName: matchedArtist.strArtist || artistName,
            imageUrl: thumbUrl,
            source: 'theaudiodb',
          };
          setCache(cacheKey, result);
          return res.json(result);
        }
      }
    }
  } catch (err) {
    console.warn('[Artist Image Proxy] TheAudioDB error:', err);
  }

  // 2. Try Wikidata / Wikimedia Commons / Wikipedia PageImages API
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(artistName)}&prop=pageimages&pithumbsize=600&pilicense=any&format=json`;
    const wikiRes = await fetch(wikiUrl);
    if (wikiRes.ok) {
      const data = await wikiRes.json();
      if (data.query && data.query.pages) {
        const pages = Object.values(data.query.pages) as any[];
        for (const page of pages) {
          if (page.thumbnail && page.thumbnail.source) {
            const result = {
              artistId,
              artistName,
              imageUrl: page.thumbnail.source,
              source: 'wikimedia',
            };
            setCache(cacheKey, result);
            return res.json(result);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Artist Image Proxy] Wikimedia error:', err);
  }

  // 3. Fallback placeholder
  const fallbackResult = {
    artistId,
    artistName,
    imageUrl: null,
    source: 'placeholder',
  };
  setCache(cacheKey, fallbackResult);
  return res.json(fallbackResult);
});

const DARK_VINYL_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23181818"/><circle cx="150" cy="150" r="105" fill="%23262626" stroke="%23383838" stroke-width="4"/><circle cx="150" cy="150" r="85" fill="none" stroke="%23303030" stroke-width="2"/><circle cx="150" cy="150" r="65" fill="none" stroke="%23303030" stroke-width="2"/><circle cx="150" cy="150" r="45" fill="%231db954"/><circle cx="150" cy="150" r="14" fill="%23141414"/><path d="M145 138 L162 150 L145 162 Z" fill="%23ffffff"/></svg>';

// Final external artwork fallback before SABDHAM's local/default cover.
// Existing cover providers remain untouched. This fallback uses music-specific
// metadata only: Apple/iTunes first, then MusicBrainz + Cover Art Archive.
const externalArtworkCache = new Map<
  string,
  { imageUrl: string | null; timestamp: number }
>();
const EXTERNAL_ARTWORK_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EXTERNAL_ARTWORK_NEGATIVE_CACHE_TTL_MS = 30 * 60 * 1000;

function normalizeArtworkMatchText(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0B80-\u0BFF\u0D80-\u0DFF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMeaningfulArtworkLabel(value: string): boolean {
  const normalized = normalizeArtworkMatchText(value);
  if (!normalized || normalized.length < 3) return false;

  return !new Set([
    'single',
    'youtube audio',
    'youtube singles',
    'youtube playlist',
    'playlist',
    'trending release',
    'popular hits',
    'imported',
    'unknown',
    'unknown album',
    'featured hits',
    'music'
  ]).has(normalized);
}

function isBlockedArtworkHost(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return (
      host.includes('youtube.com') ||
      host.includes('youtu.be') ||
      host.includes('ytimg.com') ||
      host.includes('googleusercontent.com/youtube')
    );
  } catch {
    return true;
  }
}

async function isReachableImageUrl(rawUrl: string): Promise<boolean> {
  if (!/^https?:\/\//i.test(rawUrl) || isBlockedArtworkHost(rawUrl)) {
    return false;
  }

  try {
    const response = await fetch(rawUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'SABDHAM-Artwork-Validator/1.0',
        'Accept': 'image/*'
      },
      signal: AbortSignal.timeout(4500)
    });

    const contentType = String(response.headers.get('content-type') || '')
      .toLowerCase();

    return response.ok && contentType.startsWith('image/');
  } catch {
    return false;
  }
}

function artworkTextMatches(candidate: string, expected: string): boolean {
  const a = normalizeArtworkMatchText(candidate);
  const b = normalizeArtworkMatchText(expected);

  if (!a || !b) return false;
  if (a === b) return true;

  // Only allow containment for meaningful multi-word labels. This handles
  // soundtrack suffixes without accepting generic one-word false positives.
  if (b.length >= 8 && b.includes(' ')) {
    return a.includes(b) || b.includes(a);
  }

  return false;
}

function artworkArtistMatches(candidate: string, expected: string): boolean {
  const a = normalizeArtworkMatchText(candidate);
  const firstExpectedArtist = normalizeArtworkMatchText(
    String(expected || '').split(',')[0]
  );

  if (!a || !firstExpectedArtist) return false;

  return (
    a === firstExpectedArtist ||
    a.includes(firstExpectedArtist) ||
    firstExpectedArtist.includes(a)
  );
}

function highResolutionAppleArtwork(rawUrl: string): string {
  return String(rawUrl || '')
    .replace(/\/100x100bb\.(jpg|png)$/i, '/600x600bb.$1')
    .replace(/100x100bb/gi, '600x600bb');
}

async function findVerifiedAppleArtwork(params: {
  title: string;
  artist: string;
  album: string;
  movie: string;
}): Promise<string | null> {
  const target =
    isMeaningfulArtworkLabel(params.movie)
      ? params.movie.trim()
      : isMeaningfulArtworkLabel(params.album)
        ? params.album.trim()
        : '';

  const titleNormalized = normalizeArtworkMatchText(params.title);

  const songQuery =
    [params.title, params.artist, target]
      .filter(Boolean)
      .join(' ')
      .trim();

  try {
    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', songQuery);
    url.searchParams.set('entity', 'song');
    url.searchParams.set('limit', '12');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'SABDHAM-Music/1.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (response.ok) {
      const data = (await response.json()) as any;

      for (const item of data.results || []) {
        const trackName = String(item?.trackName || '');
        const artistName = String(item?.artistName || '');
        const collectionName = String(item?.collectionName || '');
        const rawArtwork = String(item?.artworkUrl100 || '').trim();

        if (!rawArtwork) continue;

        const exactTitle =
          normalizeArtworkMatchText(trackName) === titleNormalized;

        const artistMatch =
          artworkArtistMatches(artistName, params.artist);

        const targetMatch =
          target
            ? artworkTextMatches(collectionName, target)
            : false;

        // Strong acceptance gate:
        // 1) matching album/movie plus title or artist evidence, OR
        // 2) exact song title + matching artist.
        if (
          !(
            (targetMatch && (exactTitle || artistMatch)) ||
            (exactTitle && artistMatch)
          )
        ) {
          continue;
        }

        const imageUrl = highResolutionAppleArtwork(rawArtwork);

        if (await isReachableImageUrl(imageUrl)) {
          return imageUrl;
        }
      }
    }
  } catch (err) {
    console.warn('[Artwork] Apple song lookup failed:', err);
  }

  if (!target) return null;

  // Album lookup is intentionally stricter than song lookup because there is
  // no track title to help disambiguate a similarly named release.
  try {
    const albumQuery =
      [target, params.artist]
        .filter(Boolean)
        .join(' ')
        .trim();

    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', albumQuery);
    url.searchParams.set('entity', 'album');
    url.searchParams.set('limit', '8');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'SABDHAM-Music/1.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (response.ok) {
      const data = (await response.json()) as any;

      for (const item of data.results || []) {
        const collectionName = String(item?.collectionName || '');
        const artistName = String(item?.artistName || '');
        const rawArtwork = String(item?.artworkUrl100 || '').trim();

        if (!rawArtwork) continue;
        if (!artworkTextMatches(collectionName, target)) continue;

        // If we know the artist, require artist evidence too.
        if (
          params.artist.trim() &&
          !artworkArtistMatches(artistName, params.artist)
        ) {
          continue;
        }

        const imageUrl = highResolutionAppleArtwork(rawArtwork);

        if (await isReachableImageUrl(imageUrl)) {
          return imageUrl;
        }
      }
    }
  } catch (err) {
    console.warn('[Artwork] Apple album lookup failed:', err);
  }

  return null;
}


function artworkLanguageToIso6391(language: string): string {
  const normalized = normalizeArtworkMatchText(language);

  const map: Record<string, string> = {
    tamil: 'ta',
    english: 'en',
    sinhala: 'si',
    sinhalese: 'si',
    hindi: 'hi',
    telugu: 'te',
    malayalam: 'ml',
    kannada: 'kn',
    bengali: 'bn',
    punjabi: 'pa'
  };

  return map[normalized] || '';
}

async function findVerifiedTmdbArtwork(params: {
  title: string;
  artist: string;
  album: string;
  movie: string;
  language?: string;
  year?: number;
}): Promise<string | null> {
  const movie = params.movie.trim();

  if (!isMeaningfulArtworkLabel(movie)) {
    return null;
  }

  const bearerToken =
    process.env.TMDB_READ_ACCESS_TOKEN ||
    process.env.TMDB_API_READ_ACCESS_TOKEN ||
    '';

  const apiKey =
    process.env.TMDB_API_KEY ||
    '';

  if (!bearerToken && !apiKey) {
    return null;
  }

  try {
    const url = new URL(
      'https://api.themoviedb.org/3/search/movie'
    );
    url.searchParams.set('query', movie);
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('page', '1');

    if (!bearerToken && apiKey) {
      url.searchParams.set('api_key', apiKey);
    }

    const headers: Record<string, string> = {
      'User-Agent': 'SABDHAM-Music/1.0',
      'Accept': 'application/json'
    };

    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }

    const response = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(4500)
    });

    if (!response.ok) {
      throw new Error(
        `TMDB returned ${response.status}`
      );
    }

    const data = (await response.json()) as any;
    const wantedMovie = normalizeArtworkMatchText(movie);
    const wantedLanguage =
      artworkLanguageToIso6391(params.language || '');
    const wantedYear =
      Number.isFinite(Number(params.year))
        ? Number(params.year)
        : 0;

    const exactTitleCandidates =
      (data.results || [])
        .filter((item: any) => {
          const title =
            normalizeArtworkMatchText(item?.title || '');
          const originalTitle =
            normalizeArtworkMatchText(
              item?.original_title || ''
            );

          return (
            title === wantedMovie ||
            originalTitle === wantedMovie
          );
        })
        .filter((item: any) =>
          String(item?.poster_path || '').startsWith('/')
        );

    // Same-title films are common. If TMDB has an exact-title candidate in
    // the requested song language, restrict to that language. This prevents
    // Tamil "Beast" from selecting the unrelated English "Beast".
    const languageMatched =
      wantedLanguage
        ? exactTitleCandidates.filter(
            (item: any) =>
              String(item?.original_language || '')
                .toLowerCase() === wantedLanguage
          )
        : [];

    const candidatePool =
      languageMatched.length > 0
        ? languageMatched
        : exactTitleCandidates;

    const candidates =
      candidatePool.sort((a: any, b: any) => {
        const yearScore = (item: any) => {
          if (!wantedYear) return 0;

          const releaseYear =
            parseInt(
              String(item?.release_date || '').slice(0, 4),
              10
            );

          if (!Number.isFinite(releaseYear)) return 0;
          if (releaseYear === wantedYear) return 3;
          if (Math.abs(releaseYear - wantedYear) === 1) return 1;
          return 0;
        };

        return (
          yearScore(b) - yearScore(a) ||
          Number(b?.vote_count || 0) -
            Number(a?.vote_count || 0) ||
          Number(b?.popularity || 0) -
            Number(a?.popularity || 0)
        );
      });

    for (const item of candidates) {
      const posterPath =
        String(item.poster_path || '').trim();

      if (!posterPath) continue;

      const imageUrl =
        `https://image.tmdb.org/t/p/w500${posterPath}`;

      if (await isReachableImageUrl(imageUrl)) {
        return imageUrl;
      }
    }
  } catch (err) {
    console.warn('[Artwork] TMDB lookup failed:', err);
  }

  return null;
}

function largestLastFmImage(images: any): string {
  if (!Array.isArray(images)) return '';

  const preferredSizes = [
    'mega',
    'extralarge',
    'large',
    'medium',
    'small'
  ];

  for (const size of preferredSizes) {
    const hit = images.find(
      (entry: any) =>
        String(entry?.size || '').toLowerCase() === size &&
        String(entry?.['#text'] || '').trim()
    );

    if (hit) {
      return String(hit['#text']).trim();
    }
  }

  for (let i = images.length - 1; i >= 0; i--) {
    const url = String(images[i]?.['#text'] || '').trim();
    if (url) return url;
  }

  return '';
}

async function findVerifiedLastFmArtwork(params: {
  title: string;
  artist: string;
  album: string;
  movie: string;
}): Promise<string | null> {
  const apiKey =
    process.env.LASTFM_API_KEY ||
    process.env.LAST_FM_API_KEY ||
    '';

  if (!apiKey) {
    return null;
  }

  const title = params.title.trim();
  const artist = params.artist.split(',')[0].trim();
  const target =
    isMeaningfulArtworkLabel(params.album)
      ? params.album.trim()
      : isMeaningfulArtworkLabel(params.movie)
        ? params.movie.trim()
        : '';

  if (title && artist) {
    try {
      const url = new URL('https://ws.audioscrobbler.com/2.0/');
      url.searchParams.set('method', 'track.getInfo');
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('artist', artist);
      url.searchParams.set('track', title);
      url.searchParams.set('autocorrect', '1');
      url.searchParams.set('format', 'json');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'SABDHAM-Music/1.0',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(4500)
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const track = data?.track;

        if (track) {
          const returnedTitle =
            String(track?.name || '').trim();

          const returnedArtist =
            String(
              track?.artist?.name ||
              track?.artist ||
              ''
            ).trim();

          const returnedAlbum =
            String(track?.album?.title || '').trim();

          const exactTitle =
            normalizeArtworkMatchText(returnedTitle) ===
            normalizeArtworkMatchText(title);

          const artistMatch =
            artworkArtistMatches(
              returnedArtist,
              artist
            );

          const targetMatch =
            !target ||
            artworkTextMatches(
              returnedAlbum,
              target
            );

          if (exactTitle && artistMatch && targetMatch) {
            const imageUrl =
              largestLastFmImage(
                track?.album?.image
              );

            if (
              imageUrl &&
              await isReachableImageUrl(imageUrl)
            ) {
              return imageUrl;
            }
          }
        }
      }
    } catch (err) {
      console.warn(
        '[Artwork] Last.fm track lookup failed:',
        err
      );
    }
  }

  if (!target || !artist) {
    return null;
  }

  try {
    const url = new URL('https://ws.audioscrobbler.com/2.0/');
    url.searchParams.set('method', 'album.getInfo');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('artist', artist);
    url.searchParams.set('album', target);
    url.searchParams.set('autocorrect', '1');
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'SABDHAM-Music/1.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as any;
    const album = data?.album;

    if (!album) {
      return null;
    }

    const returnedAlbum =
      String(album?.name || '').trim();

    const returnedArtist =
      String(album?.artist || '').trim();

    if (
      !artworkTextMatches(returnedAlbum, target) ||
      !artworkArtistMatches(returnedArtist, artist)
    ) {
      return null;
    }

    const imageUrl =
      largestLastFmImage(album?.image);

    if (
      imageUrl &&
      await isReachableImageUrl(imageUrl)
    ) {
      return imageUrl;
    }
  } catch (err) {
    console.warn(
      '[Artwork] Last.fm album lookup failed:',
      err
    );
  }

  return null;
}

let musicBrainzArtworkQueue: Promise<void> = Promise.resolve();
let lastMusicBrainzArtworkRequestAt = 0;

function escapeMusicBrainzArtworkQueryValue(value: string): string {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .trim();
}

function enqueueMusicBrainzArtworkRequest<T>(
  task: () => Promise<T>
): Promise<T> {
  const run = musicBrainzArtworkQueue.then(async () => {
    const waitMs = Math.max(
      0,
      1100 - (Date.now() - lastMusicBrainzArtworkRequestAt)
    );

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    lastMusicBrainzArtworkRequestAt = Date.now();
    return task();
  });

  musicBrainzArtworkQueue = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}

async function findVerifiedMusicBrainzArtwork(params: {
  title: string;
  artist: string;
  album: string;
  movie: string;
}): Promise<string | null> {
  const title = params.title.trim();
  const artist = params.artist.split(',')[0].trim();
  const target =
    isMeaningfulArtworkLabel(params.movie)
      ? params.movie.trim()
      : isMeaningfulArtworkLabel(params.album)
        ? params.album.trim()
        : '';

  if (!title) return null;

  const safeTitle = escapeMusicBrainzArtworkQueryValue(title);
  const safeArtist = escapeMusicBrainzArtworkQueryValue(artist);

  const query =
    safeArtist
      ? `recording:"${safeTitle}" AND artist:"${safeArtist}"`
      : `recording:"${safeTitle}"`;

  try {
    const data = await enqueueMusicBrainzArtworkRequest(async () => {
      const url = new URL(
        'https://musicbrainz.org/ws/2/recording/'
      );
      url.searchParams.set('query', query);
      url.searchParams.set('fmt', 'json');
      url.searchParams.set('limit', '5');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent':
            'SABDHAM-Music/1.0 (https://sabdham.cyou)',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(
          `MusicBrainz returned ${response.status}`
        );
      }

      return (await response.json()) as any;
    });

    const wantedTitle = normalizeArtworkMatchText(title);

    for (const recording of data.recordings || []) {
      const recordingTitle =
        normalizeArtworkMatchText(recording?.title || '');

      if (recordingTitle !== wantedTitle) continue;

      const artistCredit =
        (recording?.['artist-credit'] || [])
          .map((credit: any) =>
            typeof credit === 'string'
              ? credit
              : credit?.name || credit?.artist?.name || ''
          )
          .join(' ');

      if (
        artist &&
        !artworkArtistMatches(artistCredit, artist)
      ) {
        continue;
      }

      const releases = Array.isArray(recording?.releases)
        ? recording.releases
        : [];

      const orderedReleases =
        target
          ? [
              ...releases.filter((release: any) =>
                artworkTextMatches(
                  String(release?.title || ''),
                  target
                )
              ),
              ...releases.filter((release: any) =>
                !artworkTextMatches(
                  String(release?.title || ''),
                  target
                )
              )
            ]
          : releases;

      for (const release of orderedReleases) {
        const releaseId = String(release?.id || '').trim();
        const releaseTitle = String(release?.title || '');

        if (!releaseId) continue;

        // When movie/album metadata exists, do not accept an unrelated release.
        if (
          target &&
          !artworkTextMatches(releaseTitle, target)
        ) {
          continue;
        }

        const imageUrl =
          `https://coverartarchive.org/release/${releaseId}/front-500`;

        if (await isReachableImageUrl(imageUrl)) {
          return imageUrl;
        }
      }
    }
  } catch (err) {
    console.warn('[Artwork] MusicBrainz fallback failed:', err);
  }

  return null;
}

async function findStrictExternalArtwork(params: {
  title: string;
  artist: string;
  album: string;
  movie: string;
  language?: string;
  year?: number;
}): Promise<string | null> {
  const target =
    isMeaningfulArtworkLabel(params.movie)
      ? params.movie.trim()
      : isMeaningfulArtworkLabel(params.album)
        ? params.album.trim()
        : '';

  const cacheKey =
    normalizeArtworkMatchText(
      [
        params.title,
        params.artist,
        target,
        params.language || '',
        String(params.year || '')
      ].join('|')
    );

  const cached = externalArtworkCache.get(cacheKey);
  if (cached) {
    const ttl =
      cached.imageUrl
        ? EXTERNAL_ARTWORK_CACHE_TTL_MS
        : EXTERNAL_ARTWORK_NEGATIVE_CACHE_TTL_MS;

    if (Date.now() - cached.timestamp < ttl) {
      return cached.imageUrl;
    }
  }

  const providers: Array<{
    name: string;
    lookup: () => Promise<string | null>;
  }> = [
    {
      name: 'apple',
      lookup: () => findVerifiedAppleArtwork(params)
    },
    {
      name: 'tmdb',
      lookup: () => findVerifiedTmdbArtwork(params)
    },
    {
      name: 'lastfm',
      lookup: () => findVerifiedLastFmArtwork(params)
    },
    {
      name: 'musicbrainz',
      lookup: () => findVerifiedMusicBrainzArtwork(params)
    }
  ];

  for (const provider of providers) {
    try {
      const imageUrl = await provider.lookup();

      if (!imageUrl) continue;

      externalArtworkCache.set(cacheKey, {
        imageUrl,
        timestamp: Date.now()
      });

      console.log(
        `[Artwork] provider=${provider.name} hit`
      );

      return imageUrl;
    } catch (err) {
      console.warn(
        `[Artwork] provider=${provider.name} failed`,
        err
      );
    }
  }

  externalArtworkCache.set(cacheKey, {
    imageUrl: null,
    timestamp: Date.now()
  });

  return null;
}

app.get(
  [
    '/api/artwork/verified',
    // Compatibility alias for APKs built before the Google fallback was
    // replaced. It now uses the same multi-provider artwork implementation.
    '/api/artwork/google-verified'
  ],
  async (req, res) => {
    const title = String(req.query.title || '').trim();
    const artist = String(req.query.artist || '').trim();
    const album = String(req.query.album || '').trim();
    const movie = String(req.query.movie || '').trim();
    const language = String(req.query.language || '').trim();
    const year =
      parseInt(String(req.query.year || '0'), 10) || 0;

    if (!title) {
      return res.status(404).end();
    }

    const imageUrl = await findStrictExternalArtwork({
      title,
      artist,
      album,
      movie,
      language,
      year
    });

    if (!imageUrl) {
      // Client keeps SABDHAM's unchanged local default as the final fallback.
      return res.status(404).end();
    }

    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, stale-while-revalidate=604800'
    );

    return res.redirect(302, imageUrl);
  }
);

async function fetchExternalMetadata(title: string, artist: string): Promise<{ coverUrl: string; album: string; year?: number }> {
  try {
    const cleanT = title
      .replace(/\(From "[^"]*"\)/gi, '')
      .replace(/\(Official Video\)/gi, '')
      .replace(/\(Lyrical Video\)/gi, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/ft\..*/gi, '')
      .trim();
    const cleanA = artist.split(',')[0].trim();
    const query = `${cleanT} ${cleanA}`.trim();

    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        const rawCover = item.artworkUrl100;
        const highResCover = rawCover ? rawCover.replace('100x100bb', '600x600bb') : DARK_VINYL_PLACEHOLDER;
        return {
          coverUrl: highResCover,
          album: item.collectionName || 'Single',
          year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
        };
      }
    }
  } catch (err) {
    // Ignore error
  }
  return { coverUrl: DARK_VINYL_PLACEHOLDER, album: 'Single' };
}

// Curated Modular Creative Commons / Public Domain Track Catalog (Fallback layer)
interface MusicTrack {
  id: string;
  audio_source_id: string;
  youtubeVideoId?: string;
  title: string;
  artist: string;
  album: string;
  movie?: string;
  duration: number;
  durationFormatted: string;
  coverUrl: string;
  audioUrl: string;
  language: string;
  genre: string;
  source: string;
}

const MODULAR_CATALOG: MusicTrack[] = [
  {
    id: "tamil-mutta-kalakki",
    audio_source_id: "jZEA2mMwL1k",
    youtubeVideoId: "jZEA2mMwL1k",
    title: "Mutta Kalakki (Manja Balloon)",
    artist: "Ken Karunaas, G.V. Prakash Kumar",
    album: "Youth",
    movie: "Youth",
    duration: 170,
    durationFormatted: "2:50",
    coverUrl: SABDHAM_DEFAULT_ARTWORK,
    audioUrl: "yt:jZEA2mMwL1k",
    language: "tamil",
    genre: "Kuthu / Pop Single",
    source: "youtube"
  },
  {
    id: "tamil-katchi-sera",
    audio_source_id: "bhU9E7kj1oo",
    youtubeVideoId: "bhU9E7kj1oo",
    title: "Katchi Sera",
    artist: "Sai Abhyankkar",
    album: "Katchi Sera Single",
    duration: 195,
    durationFormatted: "3:15",
    coverUrl: SABDHAM_DEFAULT_ARTWORK,
    audioUrl: "yt:bhU9E7kj1oo",
    language: "tamil",
    genre: "Indie Pop",
    source: "youtube"
  },
  {
    id: "tamil-aasa-kooda",
    audio_source_id: "NCIMPzFSQjU",
    youtubeVideoId: "NCIMPzFSQjU",
    title: "Aasa Kooda",
    artist: "Sai Abhyankkar, Sai Smriti",
    album: "Aasa Kooda Single",
    duration: 215,
    durationFormatted: "3:35",
    coverUrl: SABDHAM_DEFAULT_ARTWORK,
    audioUrl: "yt:NCIMPzFSQjU",
    language: "tamil",
    genre: "Indie Pop",
    source: "youtube"
  },
  {
    id: "tamil-golden-sparrow",
    audio_source_id: "AAq06bS8UZM",
    youtubeVideoId: "AAq06bS8UZM",
    title: "Golden Sparrow",
    artist: "Sublahshini, G.V. Prakash Kumar, Dhanush",
    album: "Nilavuku En Mel Ennadi Kobam",
    duration: 204,
    durationFormatted: "3:24",
    coverUrl: SABDHAM_DEFAULT_ARTWORK,
    audioUrl: "yt:AAq06bS8UZM",
    language: "tamil",
    genre: "Pop / Dance",
    source: "youtube"
  },
  {
    id: "tamil-matta",
    audio_source_id: "8bfH0EYn0Pg",
    youtubeVideoId: "8bfH0EYn0Pg",
    title: "Matta",
    artist: "Yuvan Shankar Raja, Thalapathy Vijay",
    album: "The Greatest Of All Time",
    duration: 210,
    durationFormatted: "3:30",
    coverUrl: SABDHAM_DEFAULT_ARTWORK,
    audioUrl: "yt:8bfH0EYn0Pg",
    language: "tamil",
    genre: "Kuthu",
    source: "youtube"
  },
  {
    id: "tamil-chuttamalle",
    audio_source_id: "9jY8PItvMxo",
    youtubeVideoId: "9jY8PItvMxo",
    title: "Chuttamalle",
    artist: "Shilpa Rao, Anirudh Ravichander",
    album: "Devara",
    duration: 220,
    durationFormatted: "3:40",
    coverUrl: SABDHAM_DEFAULT_ARTWORK,
    audioUrl: "yt:9jY8PItvMxo",
    language: "tamil",
    genre: "Romantic Melody",
    source: "youtube"
  },
  {
    id: "hindi-tauba-tauba",
    audio_source_id: "3YQKuAP79Q8",
    youtubeVideoId: "3YQKuAP79Q8",
    title: "Tauba Tauba",
    artist: "Karan Aujla",
    album: "Bad Newz",
    duration: 215,
    durationFormatted: "3:35",
    coverUrl: SABDHAM_DEFAULT_ARTWORK,
    audioUrl: "yt:3YQKuAP79Q8",
    language: "hindi",
    genre: "Punjabi Pop",
    source: "youtube"
  },
  {
    id: "tamil-illuminati",
    audio_source_id: "JqMZFeG-bYk",
    youtubeVideoId: "JqMZFeG-bYk",
    title: "Illuminati",
    artist: "Sushin Shyam, Dabzee",
    album: "Aavesham",
    duration: 185,
    durationFormatted: "3:05",
    coverUrl: SABDHAM_DEFAULT_ARTWORK,
    audioUrl: "yt:JqMZFeG-bYk",
    language: "tamil",
    genre: "Club Rap",
    source: "youtube"
  },
  {
    id: "sinhala-1",
    audio_source_id: "Gw-kiVGfoHo",
    youtubeVideoId: "Gw-kiVGfoHo",
    title: "Manike Mage Hithe",
    artist: "Yohani, Satheeshan, Chamath Sangeeth",
    album: "Manike Mage Hithe Single",
    duration: 198,
    durationFormatted: "3:18",
    coverUrl: SABDHAM_DEFAULT_ARTWORK,
    audioUrl: "yt:Gw-kiVGfoHo",
    language: "sinhala",
    genre: "Sinhala Pop",
    source: "youtube"
  },
  {
    id: "tamil-rowdy-baby",
    audio_source_id: "SaNC4NKco8k",
    youtubeVideoId: "SaNC4NKco8k",
    title: "Rowdy Baby",
    artist: "Dhanush, Dhee, Yuvan Shankar Raja",
    album: "Maari 2",
    duration: 284,
    durationFormatted: "4:44",
    coverUrl: SABDHAM_DEFAULT_ARTWORK,
    audioUrl: "yt:SaNC4NKco8k",
    language: "tamil",
    genre: "Dance Beat",
    source: "youtube"
  },
  {
    id: "tamil-vaathi-coming",
    audio_source_id: "vxzfsBDx590",
    youtubeVideoId: "vxzfsBDx590",
    title: "Vaathi Coming",
    artist: "Anirudh Ravichander",
    album: "Master",
    duration: 230,
    durationFormatted: "3:50",
    coverUrl: SABDHAM_DEFAULT_ARTWORK,
    audioUrl: "yt:vxzfsBDx590",
    language: "tamil",
    genre: "Kuthu",
    source: "youtube"
  },
  {
    id: "tamil-kanmani-anbodu",
    audio_source_id: "T5S8I8d8yuo",
    youtubeVideoId: "T5S8I8d8yuo",
    title: "Kanmani Anbodu Kaadhalan",
    artist: "S. P. Balasubrahmanyam, S. Janaki, Ilaiyaraaja",
    album: "Gunaa / Manjummel Boys",
    duration: 330,
    durationFormatted: "5:30",
    coverUrl: SABDHAM_DEFAULT_ARTWORK,
    audioUrl: "yt:T5S8I8d8yuo",
    language: "tamil",
    genre: "Classic",
    source: "youtube"
  },
  {
    id: "track-1",
    audio_source_id: "track-1",
    title: "Theerthakkaraiyinile",
    artist: "K. J. Yesudas",
    album: "Classic Carnatic Hits",
    duration: 278,
    durationFormatted: "4:38",
    coverUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600",
    audioUrl: "https://archive.org/download/Theerthakkaraiyinile_201511/Theerthakkaraiyinile.mp3",
    language: "tamil",
    genre: "Carnatic",
    source: "archive"
  },
  {
    id: "track-2",
    audio_source_id: "track-2",
    title: "Aagaya Thamarai",
    artist: "Ilaiyaraaja, S. Janaki",
    album: "Ilayaraja Golden Melodies",
    duration: 295,
    durationFormatted: "4:55",
    coverUrl: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600",
    audioUrl: "https://archive.org/download/IlayarajaMelodies/Aagaya%20Thamarai.mp3",
    language: "tamil",
    genre: "Retro Melodies",
    source: "archive"
  },
  {
    id: "track-3",
    audio_source_id: "track-3",
    title: "Aasai Oru Pulveli",
    artist: "A. R. Rahman, Sujatha",
    album: "Poo Pookum Oosai",
    duration: 219,
    durationFormatted: "3:39",
    coverUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600",
    audioUrl: "https://archive.org/download/PooPookumOssai_201701/AASAI%20ORU%20PULVELI.mp3",
    language: "tamil",
    genre: "Melody",
    source: "archive"
  },
  {
    id: "track-4",
    audio_source_id: "track-4",
    title: "Sunrise Horizon",
    artist: "The Midnight Groove",
    album: "Chilled Dawn Sessions",
    duration: 372,
    durationFormatted: "6:12",
    coverUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    language: "english",
    genre: "Chillout",
    source: "soundhelix"
  },
  {
    id: "track-5",
    audio_source_id: "track-5",
    title: "Velvet Skyline",
    artist: "Acoustic Ember",
    album: "Echoes in the Light",
    duration: 423,
    durationFormatted: "7:03",
    coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    language: "english",
    genre: "Acoustic",
    source: "soundhelix"
  },
  {
    id: "track-6",
    audio_source_id: "track-6",
    title: "Echoes of Eternity",
    artist: "Symphony of Silence",
    album: "Timeless Pathways",
    duration: 302,
    durationFormatted: "5:02",
    coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    language: "english",
    genre: "Ambient",
    source: "soundhelix"
  },
  {
    id: "track-7",
    audio_source_id: "track-7",
    title: "Whistle of Wind",
    artist: "Nature Calm",
    album: "Therapeutic Waves",
    duration: 250,
    durationFormatted: "4:10",
    coverUrl: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=600",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    language: "english",
    genre: "Therapeutic",
    source: "soundhelix"
  }
];

// Helper to parse ISO 8601 duration format from YouTube Data API (e.g. PT4M12S)
function parseISO8601Duration(durationStr: string): number {
  if (!durationStr) return 180;
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = durationStr.match(regex);
  if (!matches) return 180;
  const hours = parseInt(matches[1] || '0', 10);
  const minutes = parseInt(matches[2] || '0', 10);
  const seconds = parseInt(matches[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// Cache resolved audio streams in memory with 2 hour TTL to ensure instant playback
const streamCache = new Map<string, { url: string; coverUrl?: string; duration?: number; videoId?: string; expiresAt: number }>();

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

interface StreamInfo {
  url: string | null;
  coverUrl?: string;
  duration?: number;
  videoId?: string;
  source: 'saavn' | 'youtube' | 'audius' | 'cache' | 'catalog';
}

// Helper to decrypt Saavn media URLs (using DES-EDE3)
function decryptSaavnMediaUrl(encUrl: string): string | null {
  try {
    const key = Buffer.from('383465913834659138346591');
    const decipher = crypto.createDecipheriv('des-ede3', key, Buffer.alloc(0));
    let dec = decipher.update(encUrl, 'base64', 'utf8') + decipher.final('utf8');
    // Prefer 320kbps full studio master audio stream
    return dec.replace(/_96\.(mp4|m4a)$/, '_320.$1');
  } catch (e) {
    return null;
  }
}

// Clean string for normalized comparison
function cleanMatchingText(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/\(from.*?\)|\[.*?\]|\(official.*?\)|official music video|official video|video song|lyrical video|full video song|hd song|full song/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Strict validator to ensure candidate match from JioSaavn is actually the requested song
function isValidSaavnMatch(targetTitle: string, targetArtist: string, match: any): boolean {
  if (!match) return false;
  const songName = cleanMatchingText(match.song || match.title || '');
  const primaryArtists = cleanMatchingText(match.primary_artists || '');
  const singers = cleanMatchingText(match.singers || '');
  const allArtists = `${primaryArtists} ${singers}`;

  const tTitle = cleanMatchingText(targetTitle);
  const tArtist = cleanMatchingText(targetArtist);

  if (!songName || !tTitle) return false;

  // Discard unwanted versions (karaoke, tribute, covers, remixes, etc.)
  // unless the user explicitly requested that version. Inspect all metadata,
  // not only the song title: many bad matches hide "Instrumental" in the
  // album/language or "Remixed" in the artist while keeping an exact title.
  const candidateVersionText = cleanMatchingText(
    [
      match.song || match.title || '',
      match.primary_artists || '',
      match.singers || '',
      match.album || '',
      match.language || '',
      match.more_info?.album || '',
      match.more_info?.music || ''
    ].join(' ')
  );

  const forbiddenTerms = [
    'karaoke',
    'tribute',
    'originally performed',
    'ringtone',
    'instrumental',
    'phonk',
    'sped up'
  ];
  if (!tTitle.includes('remix')) {
    forbiddenTerms.push('remix', 'remixed');
  }
  if (!tTitle.includes('nightcore')) forbiddenTerms.push('nightcore');
  if (!tTitle.includes('cover')) forbiddenTerms.push('cover');
  if (!tTitle.includes('ambient')) forbiddenTerms.push('ambient');
  if (!tTitle.includes('slowed')) forbiddenTerms.push('slowed', 'reverb');
  if (!tTitle.includes('techno')) forbiddenTerms.push('techno');

  for (const term of forbiddenTerms) {
    if (candidateVersionText.includes(term) && !tTitle.includes(term)) {
      return false;
    }
  }

  // Check title similarity: compare significant words
  const tWords = tTitle.split(' ').filter((w) => w.length > 2);
  if (tWords.length === 0) return false;

  const matchedTitleWords = tWords.filter((w) => songName.includes(w));
  const ratio = matchedTitleWords.length / tWords.length;
  const isTitleMatch = ratio >= 0.7 || songName.includes(tTitle) || tTitle.includes(songName);

  if (!isTitleMatch) return false;

  // Check artist if target artist is specified and not generic
  if (tArtist && tArtist !== 'unknown artist' && tArtist !== 'various artists') {
    const aWords = tArtist.split(' ').filter((w) => w.length > 2 && w !== 'the' && w !== 'and');
    if (aWords.length > 0) {
      const matchedArtistWords = aWords.filter((w) => allArtists.includes(w));
      if (matchedArtistWords.length === 0) {
        return false;
      }
    }
  }

  // Ensure duration is reasonable for a single song (not a 30s sample or 1hr mix)
  const duration = match.more_info?.duration
    ? parseInt(match.more_info.duration, 10)
    : match.duration
      ? parseInt(match.duration, 10)
      : undefined;

  if (duration !== undefined && (duration < 50 || duration > 650)) {
    return false;
  }

  return true;
}

// Search and extract verified lossless/320kbps audio streams from JioSaavn
async function resolveFromJioSaavn(
  query: string,
  targetTitle?: string,
  targetArtist?: string
): Promise<StreamInfo | null> {
  if (!query || query.trim().length === 0) return null;
  try {
    const cleanQuery = cleanMatchingText(query);
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&n=10&p=1&q=${encodeURIComponent(cleanQuery)}&_marker=0`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as any;
    if (!data.results || data.results.length === 0) return null;

    for (const match of data.results) {
      // Validate that this candidate actually matches the requested song title and artist!
      if (targetTitle && !isValidSaavnMatch(targetTitle, targetArtist || '', match)) {
        continue;
      }

      const enc = match.encrypted_media_url || match.more_info?.encrypted_media_url;
      if (enc) {
        const fullUrl = decryptSaavnMediaUrl(enc);
        if (fullUrl) {
          const duration = match.duration
            ? parseInt(match.duration, 10)
            : match.more_info?.duration
              ? parseInt(match.more_info.duration, 10)
              : undefined;

          const rawImage = match.image || match.more_info?.image;
          const coverUrl = rawImage ? rawImage.replace(/150x150|50x50/, '500x500') : undefined;

          return {
            url: fullUrl,
            coverUrl,
            duration: duration && duration > 0 ? duration : undefined,
            source: 'saavn',
          };
        }
      }
    }
  } catch (err) {
    console.warn('[Saavn Resolver] Search failed for:', query, err);
  }
  return null;
}


/**
 * Final audio fallback for SABDHAM search playback.
 *
 * Audius is intentionally NOT part of normal search ranking. Android calls
 * /api/audius/resolve only after the existing direct/JioSaavn/YouTube paths
 * have failed. The API key stays on the backend and is used only for Audius
 * request attribution/rate limits.
 */
async function resolveFromAudius(
  query: string,
  targetTitle: string,
  targetArtist?: string
): Promise<StreamInfo | null> {
  const cleanQuery = cleanMatchingText(query);
  const cleanTargetTitle = cleanMatchingText(targetTitle);
  const cleanTargetArtist = cleanMatchingText(targetArtist || '');

  if (!cleanQuery || !cleanTargetTitle) return null;

  try {
    const params = new URLSearchParams({
      query: cleanQuery,
      limit: '10',
      app_name: 'SABDHAM'
    });

    const audiusApiKey = String(process.env.AUDIUS_API_KEY || '').trim();
    if (audiusApiKey) {
      params.set('api_key', audiusApiKey);
    }

    const response = await fetch(
      `https://api.audius.co/v1/tracks/search?${params.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SABDHAM/1.0'
        },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      console.warn('[Audius Resolver] Search failed:', response.status);
      return null;
    }

    const payload = (await response.json()) as any;
    const tracks = Array.isArray(payload?.data) ? payload.data : [];
    if (tracks.length === 0) return null;

    const targetWords = cleanTargetTitle
      .split(' ')
      .filter((word) => word.length > 2);

    const artistWords = cleanTargetArtist
      .split(' ')
      .filter(
        (word) =>
          word.length > 2 &&
          word !== 'the' &&
          word !== 'and' &&
          word !== 'unknown'
      );

    const requestedVersionText =
      `${cleanTargetTitle} ${cleanTargetArtist}`;

    const forbiddenTerms = [
      'karaoke',
      'instrumental',
      'tribute',
      'ringtone',
      'nightcore',
      'slowed',
      'reverb',
      '8d audio',
      'remix',
      'remixed',
      'phonk',
      'sped up',
      'cover'
    ];

    let bestTrack: any | null = null;
    let bestScore = -1;

    for (const track of tracks) {
      if (!track?.id || !track?.title) continue;
      if (track.is_stream_gated === true || track.isStreamGated === true) continue;

      const candidateTitle = cleanMatchingText(track.title || '');
      const candidateArtist = cleanMatchingText(
        track.user?.name ||
        track.user?.handle ||
        track.artist_name ||
        track.artistName ||
        ''
      );
      const candidateText = cleanMatchingText(
        [
          track.title || '',
          track.user?.name || '',
          track.user?.handle || '',
          track.genre || '',
          track.description || ''
        ].join(' ')
      );

      const hasUnrequestedVersion =
        forbiddenTerms.some(
          (term) =>
            candidateText.includes(term) &&
            !requestedVersionText.includes(term)
        );

      if (hasUnrequestedVersion) continue;

      if (targetWords.length > 0) {
        const matchedTitleWords =
          targetWords.filter((word) => candidateTitle.includes(word));
        const titleRatio = matchedTitleWords.length / targetWords.length;

        if (
          titleRatio < 0.7 &&
          !candidateTitle.includes(cleanTargetTitle) &&
          !cleanTargetTitle.includes(candidateTitle)
        ) {
          continue;
        }
      }

      if (artistWords.length > 0) {
        const matchedArtistWords =
          artistWords.filter((word) => candidateArtist.includes(word));
        if (matchedArtistWords.length === 0) continue;
      }

      const duration =
        Number(track.duration || track.duration_seconds || 0) || 0;
      if (duration > 0 && (duration < 50 || duration > 650)) continue;

      let score = 0;
      if (candidateTitle === cleanTargetTitle) score += 100;
      else if (candidateTitle.includes(cleanTargetTitle)) score += 60;

      if (cleanTargetArtist) {
        if (candidateArtist === cleanTargetArtist) score += 80;
        else if (
          candidateArtist.includes(cleanTargetArtist) ||
          cleanTargetArtist.includes(candidateArtist)
        ) {
          score += 45;
        }
      }

      score += Math.min(
        Number(track.play_count || track.playCount || 0) / 100000,
        20
      );

      if (score > bestScore) {
        bestScore = score;
        bestTrack = track;
      }
    }

    if (!bestTrack) return null;

    const streamParams = new URLSearchParams({
      app_name: 'SABDHAM'
    });

    // Audius read-only streaming works without exposing our API key in the APK.
    const streamUrl =
      `https://api.audius.co/v1/tracks/${encodeURIComponent(bestTrack.id)}/stream?` +
      streamParams.toString();

    const artwork = bestTrack.artwork || {};
    const coverUrl =
      artwork['1000x1000'] ||
      artwork['480x480'] ||
      artwork['150x150'] ||
      artwork._1000x1000 ||
      artwork._480x480 ||
      artwork._150x150 ||
      undefined;

    const duration =
      Number(bestTrack.duration || bestTrack.duration_seconds || 0) || undefined;

    console.log(
      '[Audius Resolver] Match:',
      targetTitle,
      '-',
      targetArtist || '',
      '=>',
      bestTrack.title,
      '-',
      bestTrack.user?.name || bestTrack.user?.handle || ''
    );

    return {
      url: streamUrl,
      coverUrl,
      duration,
      source: 'audius'
    };
  } catch (err) {
    console.warn('[Audius Resolver] Failed for:', query, err);
    return null;
  }
}

// Search and extract live YouTube videos using structured ytInitialData parser
function extractYouTubeInitialData(html: string): any | null {
  const markers = [
    'var ytInitialData =',
    'ytInitialData =',
    'window["ytInitialData"] =',
    "window['ytInitialData'] =",
    '"ytInitialData":'
  ];

  const extractBalancedObject = (start: number): string | null => {
    const open = html.indexOf('{', start);
    if (open < 0) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = open; i < html.length; i++) {
      const ch = html[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          return html.slice(open, i + 1);
        }
      }
    }

    return null;
  };

  for (const marker of markers) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex < 0) continue;

    const raw = extractBalancedObject(markerIndex + marker.length);
    if (!raw) continue;

    try {
      return JSON.parse(raw);
    } catch {
      // Try the next known YouTube bootstrap shape.
    }
  }

  return null;
}

async function scrapeYouTubeVideos(query: string, limit: number = 15): Promise<any[]> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];
    const html = await res.text();
    const data = extractYouTubeInitialData(html);
    if (!data) return [];
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
    const tracks: any[] = [];

    if (Array.isArray(contents)) {
      for (const section of contents) {
        const itemContents = section.itemSectionRenderer?.contents;
        if (Array.isArray(itemContents)) {
          for (const item of itemContents) {
            if (item.videoRenderer) {
              const vr = item.videoRenderer;
              const videoId = vr.videoId;
              if (!videoId || videoId.length !== 11) continue;

              let title = vr.title?.runs?.map((r: any) => r.text).join('') || vr.title?.simpleText || 'Unknown Title';
              let artist = vr.ownerText?.runs?.map((r: any) => r.text).join('') || vr.ownerText?.simpleText || 'Unknown Artist';
              const durText = vr.lengthText?.simpleText || '3:30';
              // SABDHAM artwork policy: never use YouTube thumbnails.
              const coverUrl = '';

              // Parse duration
              const parts = durText.split(':').map((p: string) => parseInt(p, 10));
              let duration = 210;
              if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                duration = parts[0] * 60 + parts[1];
              } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
              }

              // Skip short clips / reels < 25s
              if (duration < 25) continue;

              // Clean video-style titles before SABDHAM displays them.
              const cleaned = cleanYouTubeTitle(title);
              const cleanedTitle = cleaned.title || title;
              const cleanedArtist =
                cleaned.artistSuggestion ||
                cleanYouTubeChannelArtist(artist) ||
                artist;

              let trackLang = 'english';
              const textToScan = `${cleanedTitle} ${cleanedArtist} ${query}`.toLowerCase();
              if (textToScan.includes('tamil') || /[\u0B80-\u0BFF]/.test(title)) {
                trackLang = 'tamil';
              } else if (textToScan.includes('sinhala') || textToScan.includes('sinhalese') || /[\u0D80-\u0DFF]/.test(title)) {
                trackLang = 'sinhala';
              }

              tracks.push({
                id: `yt-${videoId}`,
                audio_source_id: videoId,
                youtubeVideoId: videoId,
                title: cleanedTitle || title,
                artist: cleanedArtist,
                album: 'YouTube Audio',
                duration,
                durationFormatted: durText,
                coverUrl,
                audioUrl: `yt:${videoId}`,
                language: trackLang,
                genre: 'Music',
                source: 'youtube',
              });

              if (tracks.length >= limit) break;
            }
          }
        }
        if (tracks.length >= limit) break;
      }
    }

    return tracks;
  } catch (err) {
    console.warn('[YouTube Scraper] Error querying YouTube:', err);
    return [];
  }
}


async function scrapeYouTubePlaylists(
  query: string,
  limit: number = 12
): Promise<any[]> {
  try {
    // Force YouTube's PLAYLIST result filter. Searching only for the word
    // "playlist" can still return mostly videos and caused zero playlist cards.
    const searchUrl =
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAw%3D%3D`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) return [];

    const html = await res.text();
    const jsonMatch =
      html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);

    if (!jsonMatch) return [];

    const data = JSON.parse(jsonMatch[1]);
    const results: any[] = [];
    const seen = new Set<string>();

    const textFrom = (value: any): string => {
      if (!value) return '';
      if (typeof value.simpleText === 'string') {
        return value.simpleText.trim();
      }
      if (Array.isArray(value.runs)) {
        return value.runs
          .map((run: any) => String(run?.text || ''))
          .join('')
          .trim();
      }
      return '';
    };

    const parseCount = (value: any): number => {
      const text = textFrom(value) || String(value || '');
      const match = text.replace(/,/g, '').match(/(\d+)/);
      return match ? Math.max(parseInt(match[1], 10) || 0, 0) : 0;
    };

    const visit = (node: any) => {
      if (
        !node ||
        typeof node !== 'object' ||
        results.length >= limit
      ) {
        return;
      }

      const renderer = node.playlistRenderer;

      if (renderer) {
        const id = String(renderer.playlistId || '').trim();
        const title = textFrom(renderer.title);
        const owner =
          textFrom(renderer.longBylineText) ||
          textFrom(renderer.shortBylineText) ||
          'YouTube';

        const itemCount =
          parseCount(renderer.videoCountText) ||
          Math.max(Number(renderer.videoCount || 0) || 0, 0);

        if (id && title && !seen.has(id)) {
          seen.add(id);
          results.push({
            id,
            title: decodeHtmlEntities(title),
            owner: decodeHtmlEntities(owner),
            itemCount,
            source: 'youtube'
          });
        }
      }

      // Newer YouTube search pages increasingly render playlists as
      // lockupViewModel instead of playlistRenderer.
      const lockup = node.lockupViewModel;
      if (lockup) {
        const contentType =
          String(lockup.contentType || '').toUpperCase();
        const id =
          String(
            lockup.contentId ||
            lockup.playlistId ||
            ''
          ).trim();

        const metadata =
          lockup.metadata?.lockupMetadataViewModel || {};

        const title =
          String(
            metadata.title?.content ||
            lockup.title?.content ||
            ''
          ).trim();

        const metadataText =
          JSON.stringify(metadata);

        const countMatch =
          metadataText
            .replace(/\\u0026/g, '&')
            .match(/(\\d[\\d,]*)\\s+(?:videos?|songs?)/i);

        const itemCount =
          countMatch
            ? Math.max(
                parseInt(
                  countMatch[1].replace(/,/g, ''),
                  10
                ) || 0,
                0
              )
            : 0;

        const looksLikePlaylist =
          contentType.includes('PLAYLIST') ||
          /^(PL|OLAK5uy_|RD|UU|FL)[A-Za-z0-9_-]+$/.test(id);

        if (
          looksLikePlaylist &&
          id &&
          title &&
          !seen.has(id)
        ) {
          seen.add(id);
          results.push({
            id,
            title: decodeHtmlEntities(title),
            owner: 'YouTube',
            itemCount,
            source: 'youtube'
          });
        }
      }

      if (Array.isArray(node)) {
        for (const child of node) {
          visit(child);
          if (results.length >= limit) break;
        }
      } else {
        for (const value of Object.values(node)) {
          visit(value);
          if (results.length >= limit) break;
        }
      }
    };

    visit(data);
    return results.slice(0, limit);
  } catch (err) {
    console.warn(
      '[SABDHAM Playlist Search] Public scraper failed:',
      err
    );
    return [];
  }
}

function isAuthenticYouTubeVideoId(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  const clean = id.replace(/^yt-/, '').replace(/^yt:/, '').trim();
  if (clean.length !== 11) return false;
  if (/^[a-z]7_8/i.test(clean)) return false;
  if (/^[a-z]1M_f_/i.test(clean)) return false;
  if (/_8W|_f5w|_3Zk|6W8W|76YyY|6aXk|_nSg|V607fM|_AkyM|3xo|_8v0W|^W7_8|^0Y_f5|^h7W_|^f5W_3|^r5Zz|^K56m|^x_H4L|^H_O1g|^r_nSg|^Y_X8z|^V8MAt/i.test(clean)) {
    return false;
  }
  return /^[A-Za-z0-9_-]{11}$/.test(clean);
}

// Strictly resolves a Song (Title + Artist) to the most authentic verified YouTube video
async function resolveYouTubeVideoBySong(
  title: string,
  artist?: string,
  excludeVideoIds: string[] = []
): Promise<{ videoId: string; title: string; artist: string; duration: number; durationFormatted: string; coverUrl: string } | null> {
  const cleanTitle = (title || '').replace(/\(from.*?\)|\[.*?\]/gi, '').trim();
  const cleanArtist = (artist && artist !== 'Unknown Artist' ? artist : '').trim();
  const q = cleanArtist ? `${cleanTitle} ${cleanArtist}` : cleanTitle;

  const searchQueries = [
    `${q} official audio`,
    `${q} official lyric video`,
    `${q} full song`,
    `${q} video song`,
    q,
  ];

  const excludedSet = new Set(excludeVideoIds.map((id) => id.trim()).filter(Boolean));

  for (const query of searchQueries) {
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(4500),
      });

      if (!res.ok) continue;
      const html = await res.text();
      const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
      if (!jsonMatch) continue;

      const data = JSON.parse(jsonMatch[1]);
      const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
      if (!Array.isArray(contents)) continue;

      const candidates: any[] = [];
      for (const section of contents) {
        const itemContents = section.itemSectionRenderer?.contents;
        if (Array.isArray(itemContents)) {
          for (const item of itemContents) {
            if (item.videoRenderer) {
              const vr = item.videoRenderer;
              const videoId = vr.videoId;
              if (!videoId || videoId.length !== 11 || excludedSet.has(videoId)) continue;
              if (!isAuthenticYouTubeVideoId(videoId)) continue;

              const vTitle = vr.title?.runs?.map((r: any) => r.text).join('') || vr.title?.simpleText || '';
              const channel = vr.ownerText?.runs?.map((r: any) => r.text).join('') || vr.ownerText?.simpleText || '';
              const durText = vr.lengthText?.simpleText || '3:30';
              const thumbs = vr.thumbnail?.thumbnails || [];
              const coverUrl = thumbs[thumbs.length - 1]?.url || '';

              const parts = durText.split(':').map((p: string) => parseInt(p, 10));
              let duration = 210;
              if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                duration = parts[0] * 60 + parts[1];
              } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
              }

              candidates.push({ videoId, title: vTitle, artist: channel, duration, durationFormatted: durText, coverUrl });
            }
          }
        }
      }

      if (candidates.length === 0) continue;

      // Score candidates to select authentic official video/audio
      const tLow = cleanTitle.toLowerCase();
      const aLow = cleanArtist.toLowerCase();

      let bestCandidate = candidates[0];
      let bestScore = -100;

      for (const c of candidates) {
        let score = 0;
        const vtLow = c.title.toLowerCase();
        const chLow = c.artist.toLowerCase();

        // Title match
        if (vtLow.includes(tLow)) score += 50;
        // Artist match in title or channel
        if (aLow && (vtLow.includes(aLow) || chLow.includes(aLow))) score += 40;
        // Official indicators
        if (vtLow.includes('official audio') || vtLow.includes('official video') || vtLow.includes('lyric video') || vtLow.includes('official music video')) {
          score += 25;
        }
        // Penalize live / reaction / hour mixes / karaoke / cover unless explicitly in title
        if (vtLow.includes('reaction') || vtLow.includes('1 hour') || vtLow.includes('live in concert') || vtLow.includes('karaoke')) {
          score -= 60;
        }
        if (!tLow.includes('cover') && vtLow.includes('cover')) {
          score -= 30;
        }

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = c;
        }
      }

      return bestCandidate;
    } catch {
      // Try next query
    }
  }

  return null;
}

// Helper to resolve direct background-friendly audio stream from public Invidious instances
async function resolveYouTubeAudioUrl(videoId: string): Promise<string | null> {
  const instances = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.privacyredirect.com',
    'https://invidious.tiekoetter.com',
    'https://invidious.no-logs.com',
    'https://invidious.projectsegfau.lt',
    'https://invidious.f5.si',
    'https://yewtu.be'
  ];

  // Distribute requests across different highly-reliable public Invidious instances.
  // This completely bypasses server-side Cloudflare blocks (which restrict Google Cloud IPs)
  // because the client browser/ExoPlayer will perform the direct stream fetch from their residential IP.
  // This also provides instantaneous 0ms response time as no server-side fetching is needed.
  const randomInstance = instances[Math.floor(Math.random() * instances.length)];
  return `${randomInstance}/latest_version?id=${videoId}&itag=140&local=true`;
}

// Strict stream resolver: only returns verified direct streams or authentic YouTube IDs
async function resolveAudioStreamInfo(
  videoId?: string,
  title?: string,
  artist?: string,
  query?: string,
  excludeVideoIds: string[] = []
): Promise<StreamInfo> {
  let rawVideoId = videoId ? videoId.replace('yt-', '').replace('yt:', '').trim() : '';
  let activeVideoId = isAuthenticYouTubeVideoId(rawVideoId) && !excludeVideoIds.includes(rawVideoId) ? rawVideoId : '';

  // If we already have a verified 11-char YouTube Video ID not excluded, resolve its direct audio URL!
  if (false && activeVideoId && activeVideoId.length === 11) {
    const audioUrl = await resolveYouTubeAudioUrl(activeVideoId);
    return {
      url: audioUrl,
      videoId: activeVideoId,
            source: 'youtube',
    };
  }

  const cacheKey = (activeVideoId || `${title || ''}_${artist || ''}` || query || 'track').trim();
  const cached = streamCache.get(cacheKey);
  if (cached && cached.coverUrl && cached.expiresAt > Date.now() && (!cached.videoId || !excludeVideoIds.includes(cached.videoId))) {
    return { url: cached.url, coverUrl: cached.coverUrl, duration: cached.duration, videoId: activeVideoId || cached.videoId, source: 'cache' };
  }

  let activeTitle = title ? title.trim() : '';
  let activeArtist = artist && artist !== 'Unknown Artist' ? artist.trim() : '';

  // Clean YouTube-style titles before looking up the real song on JioSaavn.
  // Example:
  // "Aathi - Video Song | Kaththi | Vijay | ..." -> "Aathi"
  let saavnTitle = activeTitle
    .split('|')[0]
    .replace(/\s*[-Ã¢â‚¬â€œÃ¢â‚¬â€]\s*(official\s*)?(music\s*)?(video|audio|lyric(s)?\s*video).*$/i, '')
    .replace(/\s*\((official\s*)?(music\s*)?(video|audio|lyrics?).*?\)\s*/gi, ' ')
    .replace(/\s*\[(official\s*)?(music\s*)?(video|audio|lyrics?).*?\]\s*/gi, ' ')
    .replace(/\b(official\s+video|official\s+audio|video\s+song|lyric\s+video|lyrics\s+video)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!saavnTitle) saavnTitle = activeTitle;

  // Prefer title + artist to prevent unrelated same-title matches.
  if (saavnTitle && activeArtist) {
    const saavnStream = await resolveFromJioSaavn(
      `${saavnTitle} ${activeArtist}`,
      saavnTitle,
      activeArtist
    );

    if (saavnStream && saavnStream.url) {
      streamCache.set(cacheKey, {
        url: saavnStream.url,
        coverUrl: saavnStream.coverUrl,
        duration: saavnStream.duration,
        videoId: activeVideoId,
        expiresAt: Date.now() + 6 * 3600 * 1000
      });
      return saavnStream;
    }
  }

  // Use title-only matching only when no usable artist was supplied.
  if (saavnTitle && !activeArtist) {
    const saavnStream = await resolveFromJioSaavn(
      saavnTitle,
      saavnTitle
    );

    if (saavnStream && saavnStream.url) {
      streamCache.set(cacheKey, {
        url: saavnStream.url,
        coverUrl: saavnStream.coverUrl,
        duration: saavnStream.duration,
        videoId: activeVideoId,
        expiresAt: Date.now() + 6 * 3600 * 1000
      });
      return saavnStream;
    }
  }
  // Do not retry title-only when a real artist is known.
  // Same-title covers/remixes are common and can otherwise replace the
  // requested recording (for example, "Gangnam Style" by another artist).
  // Tier 2: Dynamically resolve to YouTube video ID
  if ((!activeVideoId || excludeVideoIds.includes(activeVideoId)) && activeTitle) {
    const resolvedYt = await resolveYouTubeVideoBySong(activeTitle, activeArtist, excludeVideoIds);
    if (resolvedYt && resolvedYt.videoId) {
      activeVideoId = resolvedYt.videoId;
    }
  }

  // Return authentic YouTube stream
  let audioUrl: string | null = null;
  if (activeVideoId && activeVideoId.length === 11) {
    audioUrl = await resolveYouTubeAudioUrl(activeVideoId);
  }
  return {
    url: audioUrl,
    videoId: activeVideoId,
        source: 'youtube',
  };
}

// API: Search real music metadata using JioSaavn
app.get('/api/music/search', async (req, res) => {
  try {
    const query = (req.query.q as string || '').trim();
    const language = (req.query.language as string || 'all').toLowerCase();
    const page = Math.min(
      Math.max(parseInt(req.query.page as string || '1', 10), 1),
      100
    );
    const maxResults = Math.min(
      Math.max(parseInt(req.query.maxResults as string || '15', 10), 1),
      25
    );

    if (!query) {
      return res.json({ tracks: [] });
    }

    let searchQuery = query;

    if (language === 'tamil' && !query.toLowerCase().includes('tamil')) {
      searchQuery += ' tamil';
    } else if (
      language === 'sinhala' &&
      !query.toLowerCase().includes('sinhala')
    ) {
      searchQuery += ' sinhala';
    }

    const searchUrl =
      `https://www.jiosaavn.com/api.php?__call=search.getResults` +
      `&_format=json&n=${maxResults}&p=${page}` +
      `&q=${encodeURIComponent(searchQuery)}&_marker=0`;

    const upstream = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      throw new Error(`Music metadata upstream returned ${upstream.status}`);
    }

    // JioSaavn sometimes labels its JSON response as text/html.
    const body = await upstream.text();
    const data = JSON.parse(body);

    const tracks = (data.results || [])
      .filter((item: any) => item && item.id && item.song)
      .map((item: any) => {
        const duration = parseInt(item.duration || '0', 10) || 0;
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;

        const rawImage = item.image || '';
        const coverUrl = rawImage
          ? rawImage.replace(/150x150|50x50/g, '500x500')
          : '';

        return {
          id: `saavn-${item.id}`,
          audio_source_id: item.id,

          title: item.song,
          artist:
            item.primary_artists ||
            item.singers ||
            'Unknown Artist',

          album: item.album || 'Single',

          coverUrl,
          duration,
          durationFormatted:
            `${mins}:${secs < 10 ? '0' : ''}${secs}`,

          language: item.language || 'unknown',
          genre: 'Music',

          year: item.year || null,
          label: item.label || null,

          source: 'saavn'
        };
      });

    return res.json({ tracks });

  } catch (err) {
    console.error('[Music Search] JioSaavn search failed:', err);

    return res.status(502).json({
      error: 'Music search temporarily unavailable',
      tracks: []
    });
  }
});
// API: Search YouTube songs securely proxying requests with the server-side API Key
app.get('/api/youtube/search', async (req, res) => {
  try {
    const query = (req.query.q as string || '').trim();
    const language = (req.query.language as string || 'all').toLowerCase();
    const maxResults = Math.min(parseInt(req.query.maxResults as string || '15', 10), 25);

    if (!query) {
      return res.json({ tracks: MODULAR_CATALOG });
    }

    // SABDHAM SEARCH:
    // Prefer real music metadata + direct playable audio.
    // YouTube is fallback only. This avoids karaoke / lyric / 4K video
    // clutter and avoids relying on YouTube extraction for normal search.
    try {
      let saavnQuery = query;

      if (language === 'tamil' && !query.toLowerCase().includes('tamil')) {
        saavnQuery += ' tamil';
      } else if (
        language === 'sinhala' &&
        !query.toLowerCase().includes('sinhala')
      ) {
        saavnQuery += ' sinhala';
      }

      const saavnUrl =
        `https://www.jiosaavn.com/api.php?__call=search.getResults` +
        `&_format=json&n=${maxResults}&p=1` +
        `&q=${encodeURIComponent(saavnQuery)}&_marker=0`;

      const saavnResponse = await fetch(saavnUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (saavnResponse.ok) {
        const saavnBody = await saavnResponse.text();
        const saavnData = JSON.parse(saavnBody);

        const musicOnly = (saavnData.results || [])
          .filter((item: any) => {
            if (!item || !item.id || !item.song) return false;

            const requested = String(query || '').toLowerCase();
            const candidateText = [
              item.song,
              item.primary_artists,
              item.singers,
              item.album,
              item.language,
              item.more_info?.album
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            const badTerms = [
              'karaoke',
              'instrumental',
              'ringtone',
              'tribute',
              'originally performed',
              'nightcore',
              'slowed',
              'reverb',
              '8d audio',
              'status',
              'remix',
              'remixed',
              'phonk',
              'sped up',
              'cover song'
            ];

            if (
              badTerms.some(
                (term) =>
                  candidateText.includes(term) &&
                  !requested.includes(term)
              )
            ) {
              return false;
            }

            // Require the meaningful query words to actually be represented.
            // This blocks near-spelling/unrelated results such as
            // "Ganganam Style" for a "Gangnam Style" search.
            const queryTokens = requested
              .replace(
                /\b(songs?|music|mp3|video|audio|track|lyrics?|official|hd|4k)\b/g,
                ' '
              )
              .split(/\s+/)
              .map((token) => token.trim())
              .filter((token) => token.length >= 3);

            // Match against real music metadata, including the provider's
            // language field. This is important for broad searches such as
            // "tamil" or "sinhala", where the language normally is not part
            // of the song title or artist name.
            return (
              queryTokens.length === 0 ||
              queryTokens.every((token) => candidateText.includes(token))
            );
          })
          .map((item: any) => {
            const encrypted =
              item.encrypted_media_url ||
              item.more_info?.encrypted_media_url ||
              '';

            const audioUrl =
              encrypted ? decryptSaavnMediaUrl(encrypted) : null;

            if (!audioUrl) return null;

            const duration =
              parseInt(
                item.duration ||
                item.more_info?.duration ||
                '0',
                10
              ) || 0;

            if (duration > 0 && (duration < 50 || duration > 650)) {
              return null;
            }

            const rawImage =
              item.image ||
              item.more_info?.image ||
              '';

            const coverUrl = rawImage
              ? rawImage.replace(/150x150|50x50/g, '500x500')
              : SABDHAM_DEFAULT_ARTWORK;

            const mins = Math.floor(duration / 60);
            const secs = duration % 60;

            return {
              id: `saavn-${item.id}`,
              audio_source_id: item.id,
              title: item.song,
              artist:
                item.primary_artists ||
                item.singers ||
                'Unknown Artist',
              album: item.album || 'Single',
              duration,
              durationFormatted:
                `${mins}:${secs < 10 ? '0' : ''}${secs}`,
              coverUrl,
              audioUrl,
              language:
                item.language ||
                (language === 'all' ? 'unknown' : language),
              genre: 'Music',
              year: item.year || null,
              source: 'saavn'
            };
          })
          .filter(Boolean);

        if (musicOnly.length > 0) {
          return res.json({ tracks: musicOnly });
        }
      }
    } catch (err) {
      console.warn(
        '[SABDHAM Search] Saavn-first search failed, using YouTube fallback:',
        err
      );
    }

    // Use clean search terms without arbitrary replacements. For a broad
    // language-only query, explicitly ask the fallback provider for music so
    // generic news/review/documentary videos do not dominate the results.
    let searchTerms = query;
    const broadLanguageQuery =
      query.toLowerCase().replace(/\s+/g, ' ').trim();

    if (
      [
        'tamil',
        'sinhala',
        'sinhalese',
        'english',
        'hindi',
        'telugu',
        'malayalam',
        'kannada'
      ].includes(broadLanguageQuery)
    ) {
      searchTerms = `${query} hit songs music`;
    }

    if (language === 'tamil' && !query.toLowerCase().includes('tamil')) {
      searchTerms += ' tamil song';
    } else if (language === 'sinhala' && !query.toLowerCase().includes('sinhala')) {
      searchTerms += ' sinhala song';
    }

    // 1. Try YouTube Data API if configured
    if (youtubeConfig.isConfigured()) {
      try {
        const searchUrl = youtubeConfig.buildApiUrl('search', {
          part: 'snippet',
          type: 'video',
          videoCategoryId: '10',
          safeSearch: 'moderate',
          q: searchTerms,
          maxResults: maxResults,
        });

        const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(4000) });
        if (searchRes.ok) {
          const searchData = (await searchRes.json()) as any;
          const items = searchData.items || [];

          if (items.length > 0) {
            const videoIds = items.map((i: any) => i.id?.videoId).filter(Boolean).join(',');
            let durationsMap: Record<string, number> = {};

            if (videoIds) {
              try {
                const detailsUrl = youtubeConfig.buildApiUrl('videos', {
                  part: 'contentDetails',
                  id: videoIds,
                });
                const detailsRes = await fetch(detailsUrl, { signal: AbortSignal.timeout(3000) });
                if (detailsRes.ok) {
                  const detailsData = (await detailsRes.json()) as any;
                  (detailsData.items || []).forEach((item: any) => {
                    durationsMap[item.id] = parseISO8601Duration(item.contentDetails?.duration || 'PT3M00S');
                  });
                }
              } catch {}
            }

            const tracks = items
              .map((item: any) => {
                const videoId = item.id?.videoId;
                if (!videoId) return null;

                const rawTrackName = item.snippet?.title || 'Unknown Track';
                const rawChannelTitle = item.snippet?.channelTitle || 'Unknown Artist';
                const cleaned = cleanYouTubeTitle(rawTrackName);
                const trackName = cleaned.title || rawTrackName;
                const channelArtist = cleanYouTubeChannelArtist(rawChannelTitle);
                const displayArtist =
                  cleaned.artistSuggestion ||
                  channelArtist ||
                  'Unknown Artist';
                const durationSec = durationsMap[videoId] || 180;
                const mins = Math.floor(durationSec / 60);
                const secs = durationSec % 60;
                const durationFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

                // SABDHAM artwork policy: never return YouTube thumbnails.
                const coverUrl = '';

                let trackLang = 'english';
                const textToScan = `${trackName} ${displayArtist} ${query}`.toLowerCase();
                if (textToScan.includes('tamil') || /[\u0B80-\u0BFF]/.test(trackName)) {
                  trackLang = 'tamil';
                } else if (textToScan.includes('sinhala') || /[\u0D80-\u0DFF]/.test(trackName)) {
                  trackLang = 'sinhala';
                }

                return {
                  id: `yt-${videoId}`,
                  audio_source_id: videoId,
                  youtubeVideoId: videoId,
                  title: trackName,
                  artist: displayArtist,
                  album: 'YouTube Audio',
                  duration: durationSec,
                  durationFormatted: durationFormatted,
                  coverUrl: coverUrl,
                  audioUrl: `yt:${videoId}`,
                  language: trackLang,
                  genre: 'Music',
                  source: 'youtube',
                };
              })
              .filter(Boolean)
              .filter((track: any) => {
                const text = String(track?.title || '').toLowerCase();
                const badTerms = [
                  'karaoke',
                  'teaser',
                  'trailer',
                  'reaction',
                  'interview',
                  'behind the scenes',
                  'making of',
                  'shorts',
                  'status',
                  'instrumental',
                  'slowed',
                  'reverb',
                  'lyric',
                  'lyrical',
                  'video song',
                  'full video',
                  '4k',
                  'remix',
                  'cover song',
                  'live news',
                  'breaking news',
                  'news today',
                  'review',
                  'movie explanation',
                  'movie explained',
                  'explanation',
                  'explained',
                  'recap',
                  'podcast',
                  'speech',
                  'debate',
                  'tutorial',
                  'episode',
                  'press meet',
                  'press conference',
                  'movie scene',
                  'comedy scene',
                  'vlog'
                ];
                return (
                  isSingleSong(String(track?.title || ''), Number(track?.duration || 0)) &&
                  !badTerms.some((term) => text.includes(term))
                );
              });

            return res.json({ tracks });
          }
        }
      } catch (err) {
        console.warn('[YouTube Search] YouTube API failed, using structured scraper:', err);
      }
    }

    // 2. Structured YouTube Scraper fallback (returns accurate live YouTube videos)
    const scrapedTracks = await scrapeYouTubeVideos(searchTerms, maxResults);
    if (scrapedTracks.length > 0) {
      const cleanScrapedTracks = scrapedTracks.filter((track: any) => {
        const text = String(track?.title || '').toLowerCase();
        const badTerms = [
          'karaoke',
          'teaser',
          'trailer',
          'reaction',
          'interview',
          'behind the scenes',
          'making of',
          'shorts',
          'status',
          'instrumental',
          'slowed',
          'reverb',
          'lyric',
          'lyrical',
          'video song',
          'full video',
          '4k',
          'remix',
          'cover song',
          'live news',
          'breaking news',
          'news today',
          'review',
          'movie explanation',
          'movie explained',
          'explanation',
          'explained',
          'recap',
          'podcast',
          'speech',
          'debate',
          'tutorial',
          'episode',
          'press meet',
          'press conference',
          'movie scene',
          'comedy scene',
          'vlog'
        ];

        return (
          isSingleSong(String(track?.title || ''), Number(track?.duration || 0)) &&
          !badTerms.some((term) => text.includes(term))
        );
      });

      if (cleanScrapedTracks.length > 0) {
        return res.json({ tracks: cleanScrapedTracks });
      }
    }

    // 3. Fallback: filter local catalog by search tokens
    const qLower = query.toLowerCase();
    const cleanQ = qLower.replace(/\b(songs?|music|mp3|video|audio|track|lyrics?)\b/gi, '').replace(/\s+/g, ' ').trim() || qLower;
    const searchTokens = cleanQ.split(/\s+/).filter((t) => t.length > 0);

    const filtered = MODULAR_CATALOG.filter((track) => {
      const titleL = track.title.toLowerCase();
      const artistL = track.artist.toLowerCase();
      const movieL = (track.movie || '').toLowerCase();
      const albumL = (track.album || '').toLowerCase();

      const allTokensMatch =
        searchTokens.length > 0 &&
        searchTokens.every(
          (token) =>
            titleL.includes(token) ||
            artistL.includes(token) ||
            movieL.includes(token) ||
            albumL.includes(token)
        );

      const titleMatch = titleL.includes(cleanQ) || cleanQ.includes(titleL);
      const artistMatch = artistL.includes(cleanQ) || cleanQ.includes(artistL);

      const matches = allTokensMatch || titleMatch || artistMatch;
      return language === 'all' ? matches : matches && track.language === language;
    });

    return res.json({ tracks: filtered });
  } catch (err: any) {
    console.error('[YouTube Search] Error handling search query:', err);
    res.status(500).json({ error: 'Failed to search YouTube', tracks: [] });
  }
});

// API: Fetch fresh matching songs from YouTube by genre, language, and artist (No duplicates)
app.get('/api/youtube/recommendations', async (req, res) => {
  try {
    const title = (req.query.title as string || '').trim();
    const artist = (req.query.artist as string || '').trim();
    const genre = (req.query.genre as string || '').trim();
    const language = (req.query.language as string || 'all').toLowerCase();
    const excludeIdsRaw = (req.query.excludeIds as string || '').trim();
    const excludeIds = new Set<string>(
      excludeIdsRaw
        ? excludeIdsRaw
            .split(',')
            .map((s) => s.trim().replace(/^yt-/, '').replace(/^yt:/, ''))
            .filter(Boolean)
        : []
    );
    const count = Math.min(parseInt(req.query.count as string || '15', 10), 30);

    // Formulate intelligent search queries based on the playing song's metadata
    const queries: string[] = [];

    if (language === 'tamil') {
      if (artist && artist !== 'Unknown Artist') {
        queries.push(`${artist} tamil hit songs`);
      }
      if (genre) {
        queries.push(`${genre} tamil songs`);
      }
      queries.push('tamil top hit songs');
      queries.push('latest tamil melody songs');
      queries.push('tamil trending songs');
    } else if (language === 'sinhala') {
      if (artist && artist !== 'Unknown Artist') {
        queries.push(`${artist} sinhala songs`);
      }
      if (genre) {
        queries.push(`${genre} sinhala songs`);
      }
      queries.push('sinhala new songs');
      queries.push('sinhala trending hits');
      queries.push('best sinhala acoustic songs');
    } else {
      if (artist && artist !== 'Unknown Artist') {
        queries.push(`${artist} top songs`);
      }
      if (genre) {
        queries.push(`${genre} hit songs`);
      }
      queries.push('popular music hits');
      queries.push('trending songs acoustic pop');
    }

    const collectedTracks: any[] = [];
    const seenTitles = new Set<string>();
    if (title) {
      seenTitles.add(title.toLowerCase().replace(/[^\w\s]/g, '').trim());
    }

    for (const q of queries) {
      if (collectedTracks.length >= count) break;

      let scraped: any[] = [];

      // Try YouTube Data API if configured
      if (youtubeConfig.isConfigured()) {
        try {
          const searchUrl = youtubeConfig.buildApiUrl('search', {
            part: 'snippet',
            type: 'video',
            videoCategoryId: '10',
            q,
            maxResults: '15',
          });
          const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(4000) });
          if (searchRes.ok) {
            const data = await searchRes.json() as any;
            const items = data.items || [];
            scraped = items.map((item: any) => {
              const videoId = item.id?.videoId;
              if (!videoId) return null;
              const trackName = cleanYouTubeTitle(item.snippet?.title || '').title;
              const channelTitle = item.snippet?.channelTitle || 'Unknown Artist';
              const coverUrl = item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url;
              return {
                id: `yt-${videoId}`,
                audio_source_id: videoId,
                youtubeVideoId: videoId,
                title: trackName,
                artist: channelTitle,
                album: 'YouTube Audio',
                duration: 210,
                durationFormatted: '3:30',
                coverUrl,
                audioUrl: `yt:${videoId}`,
                language: language === 'all' ? 'english' : language,
                genre: genre || 'Music',
                source: 'youtube',
              };
            }).filter(Boolean);
          }
        } catch (apiErr) {
          // Fall back to scraper
        }
      }

      if (scraped.length === 0) {
        scraped = await scrapeYouTubeVideos(q, 15);
      }

      for (const track of scraped) {
        if (!track || !track.youtubeVideoId) continue;
        const vid = track.youtubeVideoId.replace(/^yt-/, '').replace(/^yt:/, '');
        if (excludeIds.has(vid) || excludeIds.has(track.id)) continue;

        const normTitle = track.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
        if (seenTitles.has(normTitle)) continue;

        // Skip non-single audio compilations/full albums
        if (!isSingleSong(track.title, track.duration || 210)) continue;

        seenTitles.add(normTitle);
        excludeIds.add(vid);
        excludeIds.add(track.id);

        collectedTracks.push({
          ...track,
          language: language === 'all' ? track.language || 'english' : language,
          genre: genre || track.genre || 'Music',
        });

        if (collectedTracks.length >= count) break;
      }
    }

    return res.json({
      tracks: collectedTracks,
      count: collectedTracks.length,
      language,
      genre,
    });
  } catch (err: any) {
    console.error('[YouTube Recommendations] Error fetching recommendations:', err);
    return res.status(500).json({ error: 'Failed to fetch recommendations', tracks: [] });
  }
});

// API: Trending / Popular songs dynamically resolved from YouTube Data API
app.get('/api/youtube/trending', async (req, res) => {
  try {
    const language = (req.query.language as string || 'all').toLowerCase();

    let trendingSearch = 'trending music hits';
    if (language === 'tamil') {
      trendingSearch = 'tamil latest hit songs 2026';
    } else if (language === 'sinhala') {
      trendingSearch = 'sinhala latest hit songs 2026';
    }

    // Calculate ISO date string for 60 days (2 months) ago
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const publishedAfter = sixtyDaysAgo.toISOString();

    console.log(`[YouTube Proxy] Fetching recent 2-month hits for "${trendingSearch}" (publishedAfter: ${publishedAfter})`);
    const searchUrl = youtubeConfig.buildApiUrl('search', {
      part: 'snippet',
      type: 'video',
      videoCategoryId: '10',
      q: trendingSearch,
      publishedAfter: publishedAfter,
      order: 'viewCount',
      maxResults: '12',
    });
    
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      const errStatus = searchRes.status;
      const isQuota = youtubeConfig.isQuotaError(errStatus);
      console.warn(`[YouTube Proxy] YouTube trending returned status ${errStatus}${isQuota ? ' (Quota/Rate Limit Exceeded)' : ''}. Falling back to local catalog.`);
      const filtered = MODULAR_CATALOG.filter(track => language === 'all' ? true : track.language === language);
      return res.json({ tracks: filtered });
    }

    const searchData = await searchRes.json() as any;
    const items = searchData.items || [];

    const videoIds = items.map((i: any) => i.id?.videoId).filter(Boolean).join(',');
    let durationsMap: Record<string, number> = {};

    if (videoIds) {
      try {
        const detailsUrl = youtubeConfig.buildApiUrl('videos', {
          part: 'contentDetails',
          id: videoIds,
        });
        const detailsRes = await fetch(detailsUrl);
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json() as any;
          (detailsData.items || []).forEach((item: any) => {
            durationsMap[item.id] = parseISO8601Duration(item.contentDetails?.duration || 'PT3M00S');
          });
        }
      } catch (err) {
        console.error('[YouTube Trending] Failed resolving video durations:', err);
      }
    }

    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

    const tracks = items.map((item: any) => {
      const videoId = item.id?.videoId;
      if (!videoId) return null;

      const trackName = item.snippet?.title || 'Unknown Track';
      const channelTitle = item.snippet?.channelTitle || 'Unknown Artist';
      const durationSec = durationsMap[videoId] || 180;
      const mins = Math.floor(durationSec / 60);
      const secs = durationSec % 60;
      const durationFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

      const coverUrl = item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600';

      return {
        id: `yt-${videoId}`,
        audio_source_id: videoId,
        youtubeVideoId: videoId,
        title: trackName,
        artist: channelTitle,
        album: 'Trending Release',
        duration: durationSec,
        durationFormatted: durationFormatted,
        coverUrl: coverUrl,
        audioUrl: `${appUrl}/api/youtube/stream?id=${videoId}`,
        language: language === 'all' ? 'english' : language,
        genre: 'Pop',
        source: 'youtube'
      };
    }).filter(Boolean);

    res.json({ tracks });
  } catch (err: any) {
    console.error('[YouTube Trending] Error fetching trending music:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// API: Search public YouTube playlists for SABDHAM Search.
// Playlist thumbnails are intentionally not returned; Android uses SABDHAM's
// own playlist artwork so YouTube imagery never becomes app cover art.
app.get('/api/youtube/search-playlists', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    const maxResults =
      Math.min(
        Math.max(
          parseInt(String(req.query.maxResults || '12'), 10) || 12,
          1
        ),
        20
      );

    if (!query) {
      return res.json({ playlists: [] });
    }

    const cacheKey =
      `youtube-playlist-search:${query.toLowerCase()}:${maxResults}`;

    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let playlists: any[] = [];

    // Preferred path: official YouTube Data API.
    if (youtubeConfig.isConfigured()) {
      try {
        const searchUrl = youtubeConfig.buildApiUrl('search', {
          part: 'snippet',
          type: 'playlist',
          q: query,
          maxResults: maxResults.toString(),
          safeSearch: 'moderate'
        });

        const searchResponse = await fetch(searchUrl, {
          headers: {
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(4500)
        });

        if (searchResponse.ok) {
          const searchData = (await searchResponse.json()) as any;
          const searchItems = Array.isArray(searchData.items)
            ? searchData.items
            : [];

          const ids =
            searchItems
              .map((item: any) =>
                String(item?.id?.playlistId || '').trim()
              )
              .filter(Boolean);

          let itemCounts = new Map<string, number>();

          if (ids.length > 0) {
            try {
              const detailsUrl =
                youtubeConfig.buildApiUrl('playlists', {
                  part: 'contentDetails',
                  id: ids.join(',')
                });

              const detailsResponse = await fetch(detailsUrl, {
                headers: {
                  'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(3500)
              });

              if (detailsResponse.ok) {
                const detailsData =
                  (await detailsResponse.json()) as any;

                itemCounts = new Map(
                  (detailsData.items || []).map((item: any) => [
                    String(item?.id || ''),
                    Number(
                      item?.contentDetails?.itemCount || 0
                    )
                  ])
                );
              }
            } catch (err) {
              console.warn(
                '[SABDHAM Playlist Search] Count lookup failed:',
                err
              );
            }
          }

          playlists =
            searchItems
              .map((item: any) => {
                const id =
                  String(item?.id?.playlistId || '').trim();

                const title =
                  String(item?.snippet?.title || '').trim();

                if (!id || !title) return null;

                return {
                  id,
                  title: decodeHtmlEntities(title),
                  owner: decodeHtmlEntities(
                    String(
                      item?.snippet?.channelTitle || 'YouTube'
                    ).trim()
                  ),
                  itemCount: itemCounts.get(id) || 0,
                  source: 'youtube'
                };
              })
              .filter(Boolean);
        } else {
          console.warn(
            '[SABDHAM Playlist Search] YouTube API returned',
            searchResponse.status,
            '- using public-search fallback'
          );
        }
      } catch (err) {
        console.warn(
          '[SABDHAM Playlist Search] YouTube API failed, using public-search fallback:',
          err
        );
      }
    }

    // Quota/key/network-safe fallback. This keeps playlist search visible
    // even when YouTube Data API search is unavailable.
    if (playlists.length === 0) {
      playlists = await scrapeYouTubePlaylists(
        `${query} music`,
        maxResults
      );
    }

    if (playlists.length === 0) {
      playlists = await scrapeYouTubePlaylists(
        query,
        maxResults
      );
    }

    const payload = {
      playlists:
        playlists
          .filter(
            (playlist: any) =>
              playlist &&
              String(playlist.id || '').trim() &&
              String(playlist.title || '').trim()
          )
          .filter(
            (playlist: any, index: number, all: any[]) =>
              all.findIndex(
                (candidate: any) =>
                  String(candidate.id) === String(playlist.id)
              ) === index
          )
          .slice(0, maxResults)
    };

    // Avoid caching an empty transient failure for a long period.
    if (payload.playlists.length > 0) {
      setCache(cacheKey, payload);
    }

    return res.json(payload);
  } catch (err) {
    console.warn('[SABDHAM Playlist Search] Failed:', err);

    // Final best-effort fallback before returning empty.
    try {
      const query = String(req.query.q || '').trim();
      const maxResults =
        Math.min(
          Math.max(
            parseInt(
              String(req.query.maxResults || '12'),
              10
            ) || 12,
            1
          ),
          20
        );

      let playlists =
        query
          ? await scrapeYouTubePlaylists(
              `${query} music`,
              maxResults
            )
          : [];

      if (query && playlists.length === 0) {
        playlists =
          await scrapeYouTubePlaylists(
            query,
            maxResults
          );
      }

      return res.json({ playlists });
    } catch {
      return res.json({ playlists: [] });
    }
  }
});

// API: Fetch songs from a specific YouTube Playlist with pagination support
app.get('/api/youtube/playlist', async (req, res) => {
  try {
    const playlistId = req.query.id as string;
    const requestedMax = parseInt(req.query.maxResults as string || '50', 10);
    const targetCount = Math.min(Math.max(requestedMax, 20), 100);

    if (!playlistId) {
      return res.status(400).json({ error: 'Playlist ID is required' });
    }

    console.log(`[YouTube Proxy] Fetching playlist items for ID: ${playlistId} (Target count: ${targetCount})`);
    
    let allItems: any[] = [];
    let pageToken = '';

    while (allItems.length < targetCount) {
      const fetchCount = Math.min(50, targetCount - allItems.length);
      const params: Record<string, string> = {
        part: 'snippet,contentDetails',
        playlistId: playlistId,
        maxResults: fetchCount.toString(),
      };
      if (pageToken) {
        params.pageToken = pageToken;
      }

      const playlistUrl = youtubeConfig.buildApiUrl('playlistItems', params);
      const playlistRes = await fetch(playlistUrl);
      if (!playlistRes.ok) {
        const errStatus = playlistRes.status;
        const isQuota = youtubeConfig.isQuotaError(errStatus);
        console.warn(`[YouTube Proxy] YouTube playlist returned status ${errStatus}${isQuota ? ' (Quota/Rate Limit Exceeded)' : ''}. Returning collected items (${allItems.length}).`);
        break;
      }

      const playlistData = await playlistRes.json() as any;
      const items = playlistData.items || [];
      if (items.length === 0) break;

      allItems.push(...items);
      pageToken = playlistData.nextPageToken || '';
      if (!pageToken) break;
    }

    if (allItems.length === 0) {
      return res.json({ tracks: [] });
    }

    // Process all collected items
    const videoIds = allItems.map((i: any) => i.contentDetails?.videoId).filter(Boolean).slice(0, 100).join(',');
    let durationsMap: Record<string, number> = {};

    if (videoIds) {
      try {
        const detailsUrl = youtubeConfig.buildApiUrl('videos', {
          part: 'contentDetails',
          id: videoIds,
        });
        const detailsRes = await fetch(detailsUrl);
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json() as any;
          (detailsData.items || []).forEach((item: any) => {
            durationsMap[item.id] = parseISO8601Duration(item.contentDetails?.duration || 'PT3M00S');
          });
        }
      } catch (err) {
        console.error('[YouTube Playlist] Failed resolving video durations:', err);
      }
    }

    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

    const tracks = allItems.map((item: any) => {
      const videoId = item.contentDetails?.videoId;
      if (!videoId) return null;

      const trackName = item.snippet?.title || 'Unknown Track';
      if (trackName.toLowerCase().includes('private video') || trackName.toLowerCase().includes('deleted video')) {
        return null;
      }

      const channelTitle = item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || 'YouTube Artist';
      const durationSeconds = durationsMap[videoId] || 210;
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = Math.floor(durationSeconds % 60);
      const durationFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

      const highResArt = SABDHAM_DEFAULT_ARTWORK;

      return {
        id: `yt-${videoId}`,
        audio_source_id: videoId,
        title: trackName.replace(/[\(\[\{].*?official.*?[\)\]\}]/gi, '').replace(/\s*\|\s*.*/, '').trim(),
        artist: channelTitle.replace(/Topic|VEVO|Official/gi, '').trim() || 'Sabdham Artist',
        album: 'YouTube Singles',
        duration: durationSeconds,
        durationFormatted: durationFormatted,
        coverUrl: highResArt,
        audioUrl: `yt:${videoId}`,
        youtubeVideoId: videoId,
        language: 'all',
        genre: 'Popular Hits',
        year: 2024,
        releaseDate: item.snippet?.publishedAt ? item.snippet.publishedAt.split('T')[0] : '2024-01-01',
        popularityScore: 88,
        streamCount: 50000000,
        viewCount: 120000000,
        isTrendingNow: true,
      };
    }).filter(Boolean);

    res.json({ tracks });
  } catch (err: any) {
    console.error('Error in /api/youtube/playlist:', err);
    res.status(500).json({ error: 'Failed to fetch playlist', message: err.message });
  }
});

// Helper to normalize query string for iTunes Search API match accuracy
function cleanQueryForSearch(str: string): string {
  if (!str) return '';
  return str
    .replace(/VEVO\b|- Topic\b|Official Channel\b/gi, '')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/\b(official|video|audio|lyric|lyrical|hd|4k|full song|movie|soundtrack|remix|single|feat|ft|music video|visualizer|audio song)\b/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// API: Free metadata lookup from iTunes Search API (no API key required)
app.get('/api/music/free-metadata', async (req, res) => {
  try {
    const rawQuery = (req.query.q as string || '').trim();
    if (!rawQuery) {
      return res.status(400).json({ error: 'Query param "q" is required' });
    }

    const cleanedQuery = cleanQueryForSearch(rawQuery) || rawQuery;

    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanedQuery)}&entity=song&limit=5`;
    const itunesRes = await fetch(itunesUrl);
    if (!itunesRes.ok) {
      return res.status(502).json({ error: 'Failed to reach iTunes metadata service' });
    }

    const data = await itunesRes.json();
    if (!data.results || data.results.length === 0) {
      // If cleaned query returned nothing, try with primary word or raw query if different
      if (cleanedQuery !== rawQuery) {
        const rawRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(rawQuery)}&entity=song&limit=5`);
        if (rawRes.ok) {
          const rawData = await rawRes.json();
          if (rawData.results && rawData.results.length > 0) {
            const item = rawData.results.find((r: any) => r.artworkUrl100) || rawData.results[0];
            const rawArtwork = item.artworkUrl100 || item.artworkUrl60;
            const artwork = rawArtwork ? rawArtwork.replace(/100x100bb|60x60bb/, '1000x1000bb') : null;
            return res.json({
              title: item.trackName,
              artist: item.artistName,
              album: item.collectionName,
              coverUrl: artwork,
              coverArtUrl: artwork,
              releaseDate: item.releaseDate,
              genre: item.primaryGenreName,
              previewUrl: item.previewUrl,
              trackViewUrl: item.trackViewUrl,
            });
          }
        }
      }
      return res.status(404).json({ error: 'No metadata found' });
    }

    // Find best match with artwork
    const item = data.results.find((r: any) => r.artworkUrl100) || data.results[0];
    const rawArtwork = item.artworkUrl100 || item.artworkUrl60;
    const artwork = rawArtwork
      ? rawArtwork.replace(/100x100bb|60x60bb/, '1000x1000bb')
      : null;

    res.json({
      title: item.trackName,
      artist: item.artistName,
      album: item.collectionName,
      coverUrl: artwork,
      coverArtUrl: artwork,
      releaseDate: item.releaseDate,
      genre: item.primaryGenreName,
      previewUrl: item.previewUrl,
      trackViewUrl: item.trackViewUrl,
    });
  } catch (err: any) {
    console.error('[Free Metadata] Error fetching iTunes metadata:', err);
    res.status(500).json({ error: 'Failed to fetch metadata', message: err.message });
  }
});

// API: Free metadata lookup from MusicBrainz + Cover Art Archive (secondary fallback)
app.get('/api/music/musicbrainz-metadata', async (req, res) => {
  try {
    const title = (req.query.title as string || '').trim();
    const artist = (req.query.artist as string || '').trim();
    
    if (!title) {
      return res.status(400).json({ error: 'Title parameter is required' });
    }

    const mbQuery = artist
      ? `recording:"${title}" AND artist:"${artist}"`
      : `recording:"${title}"`;

    const mbUrl = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(mbQuery)}&fmt=json&limit=5`;
    const mbRes = await fetch(mbUrl, {
      headers: {
        'User-Agent': 'SabdhamMusicApp/1.0.0 (contact@sabdham.app)',
        'Accept': 'application/json',
      },
    });

    if (!mbRes.ok) {
      return res.status(502).json({ error: 'MusicBrainz API unavailable' });
    }

    const mbData = await mbRes.json();
    if (!mbData.recordings || mbData.recordings.length === 0) {
      return res.status(404).json({ error: 'No MusicBrainz recording found' });
    }

    // Iterate through recordings to find a release ID with cover art from Cover Art Archive
    let coverArtUrl: string | null = null;
    let matchedRelease: any = null;

    for (const recording of mbData.recordings) {
      const releases = recording.releases || [];
      for (const rel of releases) {
        if (!rel.id) continue;
        try {
          const caaUrl = `https://coverartarchive.org/release/${rel.id}`;
          const caaRes = await fetch(caaUrl, { method: 'GET' });
          if (caaRes.ok) {
            const caaData = await caaRes.json();
            if (caaData.images && caaData.images.length > 0) {
              const frontImg = caaData.images.find((img: any) => img.front) || caaData.images[0];
              coverArtUrl = frontImg.image || frontImg.thumbnails?.large || frontImg.thumbnails?.['500'];
              if (coverArtUrl) {
                matchedRelease = rel;
                break;
              }
            }
          }
        } catch {
          // ignore individual CAA lookup failures
        }
      }
      if (coverArtUrl) break;
    }

    if (!coverArtUrl) {
      return res.status(404).json({ error: 'No Cover Art Archive image found' });
    }

    res.json({
      title: mbData.recordings[0].title,
      artist: mbData.recordings[0]['artist-credit']?.[0]?.name || artist,
      album: matchedRelease?.title || null,
      coverUrl: coverArtUrl,
      coverArtUrl: coverArtUrl,
      source: 'musicbrainz',
    });
  } catch (err: any) {
    console.error('[MusicBrainz Metadata] Error:', err);
    res.status(500).json({ error: 'MusicBrainz lookup failed', message: err.message });
  }
});

// API: Stream redirection & MP3 playback proxy endpoint
app.get(['/api/youtube/stream', '/api/youtube/mp3'], async (req, res) => {
  try {
    const videoId = (req.query.id as string || '').replace('yt-', '').trim();
    const title = (req.query.title as string || '').trim();
    const artist = (req.query.artist as string || '').trim();

    if (!videoId && !title) {
      return res.status(400).json({ error: 'Missing video id or title parameter' });
    }

    const streamInfo = await resolveAudioStreamInfo(videoId, title, artist);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Accept-Ranges', 'bytes');

    if (!streamInfo || !streamInfo.url) {
      return res.status(404).json({
        error: 'Direct audio stream not available. Use YouTube player.',
        useYouTube: true,
        videoId: streamInfo?.videoId || videoId,
      });
    }

    if (!streamInfo.url.startsWith('http')) {
      return res.redirect(302, streamInfo.url);
    }

    const requestHeaders: Record<string, string> = {
      'user-agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36',
      'accept': '*/*',
      'accept-encoding': 'identity',
    };

    if (req.headers.range) {
      requestHeaders['range'] = req.headers.range;
    }

    const proxyFinalAudio = (targetUrl: string, redirectsLeft: number) => {
      let parsed: URL;
      try {
        parsed = new URL(targetUrl);
      } catch {
        if (!res.headersSent) {
          res.status(502).json({ error: 'Invalid upstream audio URL' });
        }
        return;
      }

      if (parsed.protocol !== 'https:') {
        if (!res.headersSent) {
          res.status(502).json({ error: 'Unsupported upstream audio protocol' });
        }
        return;
      }

      const upstreamReq = https.request(
        parsed,
        {
          method: 'GET',
          headers: requestHeaders,
        },
        (upstreamRes) => {
          const statusCode = upstreamRes.statusCode || 500;

          if (statusCode >= 300 && statusCode < 400) {
            const location = upstreamRes.headers.location;
            upstreamRes.resume();

            if (!location) {
              console.error(
                '[YouTube Stream Proxy] Redirect missing Location',
                { statusCode, videoId, targetUrl }
              );
              if (!res.headersSent) {
                res.status(502).json({
                  error: 'Invalid upstream audio redirect',
                  retryable: true,
                });
              }
              return;
            }

            if (redirectsLeft <= 0) {
              if (!res.headersSent) {
                res.status(502).json({
                  error: 'Too many upstream audio redirects',
                  retryable: true,
                });
              }
              return;
            }

            let nextUrl: string;
            try {
              nextUrl = new URL(location, parsed).toString();
            } catch {
              if (!res.headersSent) {
                res.status(502).json({
                  error: 'Invalid upstream redirect URL',
                  retryable: true,
                });
              }
              return;
            }

            return proxyFinalAudio(nextUrl, redirectsLeft - 1);
          }

          if (statusCode < 200 || statusCode >= 300) {
            console.error(
              '[YouTube Stream Proxy] Upstream audio request failed',
              { statusCode, videoId, targetUrl }
            );
            upstreamRes.resume();
            if (!res.headersSent) {
              res.status(502).json({
                error: 'Upstream audio request failed',
                upstreamStatus: statusCode,
                retryable: true,
              });
            }
            return;
          }

          const contentType =
            String(upstreamRes.headers['content-type'] || '')
              .toLowerCase();

          const isPlayableMedia =
            contentType.startsWith('audio/') ||
            contentType.startsWith('video/') ||
            contentType.startsWith('application/octet-stream');

          if (!isPlayableMedia) {
            console.error(
              '[YouTube Stream Proxy] Rejected non-media upstream response',
              { statusCode, videoId, contentType, targetUrl }
            );
            upstreamRes.resume();
            if (!res.headersSent) {
              res.status(502).json({
                error: 'Upstream did not return playable audio',
                contentType,
                retryable: true,
              });
            }
            return;
          }

          res.setHeader('Content-Type', contentType);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Access-Control-Allow-Origin', '*');

          if (upstreamRes.headers['content-range']) {
            res.setHeader(
              'Content-Range',
              upstreamRes.headers['content-range']
            );
          }

          if (upstreamRes.headers['content-length']) {
            res.setHeader(
              'Content-Length',
              upstreamRes.headers['content-length']
            );
          }

          res.status(statusCode);
          upstreamRes.pipe(res);
        }
      );

      upstreamReq.setTimeout(20000, () => {
        upstreamReq.destroy(new Error('Upstream audio request timed out'));
      });

      upstreamReq.on('error', (e) => {
        console.error('[YouTube Stream Proxy] Request error:', e);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Failed to stream audio from source',
            retryable: true,
          });
        }
      });

      req.on('close', () => {
        upstreamReq.destroy();
      });

      upstreamReq.end();
    };

    proxyFinalAudio(streamInfo.url, 5);
  } catch (err: any) {
    console.error('[YouTube Stream] Error in streaming endpoint:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream audio' });
    }
  }
});

// API: Stream resolution endpoint returning direct audio stream URL and metadata
app.get('/api/stream/resolve', async (req, res) => {
  try {
    const videoId = (req.query.id as string || '').replace('yt-', '').trim();
    const title = (req.query.title as string || '').trim();
    const artist = (req.query.artist as string || '').trim();
    const query = (req.query.q as string || '').trim();
    const excludeParam = (req.query.excludeId as string || '').trim();
    const excludeVideoIds = excludeParam ? excludeParam.split(',').map((s) => s.trim()).filter(Boolean) : [];

    const streamInfo = await resolveAudioStreamInfo(videoId, title, artist, query, excludeVideoIds);

    const directClientStream = String(req.query.direct || '') === '1';

    if (
      streamInfo &&
      streamInfo.url &&
      streamInfo.source === 'youtube' &&
      !directClientStream
    ) {
      streamInfo.url = `/api/youtube/stream?id=${encodeURIComponent(streamInfo.videoId || videoId)}`;
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(streamInfo);
  } catch (err: any) {
    console.error('[Stream Resolve] Error resolving stream:', err);
    res.status(500).json({ error: 'Failed to resolve stream' });
  }
});


/**
 * Explicit last-resort resolver used by the Android client only after all
 * existing playback sources have failed.
 */
app.get('/api/audius/resolve', async (req, res) => {
  try {
    const title = String(req.query.title || '').trim();
    const artist = String(req.query.artist || '').trim();

    if (!title) {
      return res.status(400).json({ error: 'Missing title' });
    }

    const query = artist ? `${title} ${artist}` : title;
    const streamInfo = await resolveFromAudius(query, title, artist);

    res.setHeader('Access-Control-Allow-Origin', '*');

    if (!streamInfo || !streamInfo.url) {
      return res.status(404).json({
        error: 'Audius fallback unavailable',
        source: 'audius'
      });
    }

    return res.json(streamInfo);
  } catch (err) {
    console.error('[Audius Resolver] Endpoint failed:', err);
    return res.status(500).json({
      error: 'Audius fallback failed',
      source: 'audius'
    });
  }
});

// Cache for query suggestions (30 mins TTL)
const suggestionsCache = new Map<string, { data: any; timestamp: number }>();

// Helper to backfill suggestions to guarantee at least 5 similar words/results are returned when typing
function backfillSuggestions(query: string, currentSuggestions: string[]): string[] {
  const result = [...currentSuggestions];
  if (result.length >= 5) return result;

  const qLower = query.toLowerCase().trim();
  if (!qLower) return result;
  
  // Collect all unique, clean, non-trivial words/phrases from MODULAR_CATALOG track titles, artists, movies
  const wordsSet = new Set<string>();
  for (const t of MODULAR_CATALOG) {
    if (t.title) wordsSet.add(t.title);
    if (t.artist) wordsSet.add(t.artist);
    if (t.movie && t.movie !== 'Single') wordsSet.add(t.movie);
    if (t.album && t.album !== 'Single') wordsSet.add(t.album);
    
    // Also extract individual words of length > 2
    const parts = `${t.title} ${t.artist} ${t.movie || ''} ${t.album || ''}`
      .split(/[\s(),\-:._+]+/g)
      .map(w => w.trim())
      .filter(w => w.length > 2);
    for (const p of parts) {
      wordsSet.add(p);
    }
  }

  const allWords = Array.from(wordsSet);

  // 1. Prefix matches on full titles or individual words
  const startMatches = allWords.filter(w => w.toLowerCase().startsWith(qLower));
  for (const w of startMatches) {
    if (result.length >= 5) break;
    if (!result.some(s => s.toLowerCase() === w.toLowerCase())) {
      result.push(w);
    }
  }

  // 2. Substring matches
  if (result.length < 5) {
    const containMatches = allWords.filter(w => w.toLowerCase().includes(qLower));
    for (const w of containMatches) {
      if (result.length >= 5) break;
      if (!result.some(s => s.toLowerCase() === w.toLowerCase())) {
        result.push(w);
      }
    }
  }

  // 3. Partial prefix matches (first 1-2 chars)
  if (result.length < 5 && qLower.length >= 1) {
    const prefix = qLower.slice(0, Math.min(2, qLower.length));
    const prefixMatches = allWords.filter(w => w.toLowerCase().startsWith(prefix));
    for (const w of prefixMatches) {
      if (result.length >= 5) break;
      if (!result.some(s => s.toLowerCase() === w.toLowerCase())) {
        result.push(w);
      }
    }
  }

  // 4. Fallback to curated popular searches
  const defaultPopular = [
    'Manja Balloon',
    'Kaavaalaa',
    'Hukum',
    'Chuttamalle',
    'Katchi Sera',
    'Aasa Kooda',
    'Golden Sparrow',
    'Manike Mage Hithe',
    'Tauba Tauba',
    'Rowdy Baby'
  ];
  if (result.length < 5) {
    for (const s of defaultPopular) {
      if (result.length >= 5) break;
      if (!result.some(x => x.toLowerCase() === s.toLowerCase())) {
        result.push(s);
      }
    }
  }

  return result;
}

// API: Search suggestions when typing (Live YouTube/Google music suggest + local catalog tracks & artists)
app.get('/api/search/suggestions', async (req, res) => {
  try {
    const rawQuery = (req.query.q as string || '').trim();
    const cacheKey = rawQuery.toLowerCase();

    // Return cached if fresh
    const cached = suggestionsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 1800000) {
      return res.json(cached.data);
    }

    if (!rawQuery) {
      const defaultSuggestions = [
        'Mutta Kalakki (Manja Balloon)',
        'Kaavaalaa (Jailer Song)',
        'Hukum (Jailer Song)',
        'Chuttamalle (Devara Song)',
        'Katchi Sera',
        'Aasa Kooda',
        'Golden Sparrow',
        'Manike Mage Hithe',
        'Tauba Tauba',
        'Rowdy Baby',
        'Vaathi Coming',
        'Espresso',
      ];
      const defaultTracks = MODULAR_CATALOG.slice(0, 4);
      const payload = {
        query: '',
        suggestions: defaultSuggestions,
        tracks: defaultTracks,
        artists: [
          { name: 'Anirudh Ravichander', trackCount: 6 },
          { name: 'A.R. Rahman', trackCount: 4 },
          { name: 'Taylor Swift', trackCount: 3 },
          { name: 'Yohani', trackCount: 2 },
        ],
      };
      return res.json(payload);
    }

    const qLower = rawQuery.toLowerCase();

    // 1. Live Google/YouTube suggest queries filtered strictly for songs
    let querySuggestions: string[] = [];
    try {
      const suggestUrl = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(rawQuery)}`;
      const suggestRes = await fetch(suggestUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(3000),
      });
      if (suggestRes.ok) {
        const suggestData = await suggestRes.json() as any;
        if (Array.isArray(suggestData) && Array.isArray(suggestData[1])) {
          const nonSongKeywords = [
            'trailer', 'teaser', 'full movie', 'movie review', 'interview', 'scene', 'scenes',
            'comedy', 'box office', 'status', 'reaction', 'vlog', 'gameplay', 'live', 'speech',
            'press meet', 'leaked', 'episode', 'cast', 'review', 'unboxing', 'dialogue'
          ];
          querySuggestions = suggestData[1]
            .map((s: any) => String(s).trim())
            .filter((s: string) => {
              if (!s) return false;
              const lower = s.toLowerCase();
              return !nonSongKeywords.some((kw) => lower.includes(kw));
            })
            .slice(0, 6);
        }
      }
    } catch (e) {
      // Fallback silently if external suggest is unavailable
    }

    // 2. Filter matching catalog tracks (title, artist, album, movie, phonetic)
    const cleanTokens = qLower
      .replace(/\b(songs?|singing|music|mp3|video|audio|track|lyrics?|full|official|hd|4k|status|bgm|remix|lofi|movie|film|original|single)\b/gi, '')
      .split(/\s+/)
      .filter((w) => w.length > 0);

    const matchingTracks = MODULAR_CATALOG.filter((t) => {
      const tTitle = t.title.toLowerCase();
      const tArtist = t.artist.toLowerCase();
      const tAlbum = (t.album || '').toLowerCase();
      const tMovie = (t.movie || '').toLowerCase();

      // Direct substring match
      if (
        tTitle.includes(qLower) ||
        tArtist.includes(qLower) ||
        tAlbum.includes(qLower) ||
        tMovie.includes(qLower)
      ) {
        return true;
      }

      // Token-based matching if multi-word
      if (cleanTokens.length > 0) {
        const matchTokens = cleanTokens.every(
          (tok) =>
            tTitle.includes(tok) ||
            tArtist.includes(tok) ||
            tAlbum.includes(tok) ||
            tMovie.includes(tok) ||
            t.language.toLowerCase().includes(tok)
        );
        if (matchTokens) return true;
      }
      return false;
    }).slice(0, 5);

    // Complement query suggestions with matching track titles & variations
    for (const t of matchingTracks) {
      if (!querySuggestions.some((s) => s.toLowerCase() === t.title.toLowerCase())) {
        querySuggestions.push(t.title);
      }
      // If title has parentheses (e.g. "Mutta Kalakki (Manja Balloon)"), add parenthesized name
      const parenMatch = t.title.match(/\((.*?)\)/);
      if (parenMatch && parenMatch[1]) {
        const sub = parenMatch[1].trim();
        if (sub.length > 2 && !querySuggestions.some((s) => s.toLowerCase() === sub.toLowerCase())) {
          querySuggestions.push(sub);
        }
      }
      const combo = `${t.title} - ${t.artist}`;
      if (querySuggestions.length < 8 && !querySuggestions.some((s) => s.toLowerCase() === combo.toLowerCase())) {
        querySuggestions.push(combo);
      }
    }

    // 3. Extract unique matching artist names from catalog for artist card matches
    const seenArtists = new Set<string>();
    const matchingArtists: { name: string; trackCount: number }[] = [];
    for (const t of MODULAR_CATALOG) {
      const aLower = t.artist.toLowerCase();
      if (aLower.includes(qLower) && !seenArtists.has(aLower)) {
        seenArtists.add(aLower);
        const count = MODULAR_CATALOG.filter((x) => x.artist.toLowerCase() === aLower).length;
        matchingArtists.push({ name: t.artist, trackCount: count });
        if (matchingArtists.length >= 3) break;
      }
    }

    const finalSuggestions = backfillSuggestions(rawQuery, querySuggestions);

    const payload = {
      query: rawQuery,
      suggestions: finalSuggestions.slice(0, 8),
      tracks: matchingTracks,
      artists: matchingArtists,
    };

    suggestionsCache.set(cacheKey, { data: payload, timestamp: Date.now() });
    res.json(payload);
  } catch (err: any) {
    console.error('[Search Suggestions] Error fetching suggestions:', err);
    res.status(500).json({ error: 'Failed to fetch suggestions', suggestions: [], tracks: [], artists: [] });
  }
});

// Cache for MusicBrainz search queries (1 hour TTL)
const mbCache = new Map<string, { tracks: any[]; total: number; timestamp: number }>();

// API: Search MusicBrainz API for song titles, artists, and release artwork
app.get('/api/musicbrainz/search', async (req, res) => {
  try {
    const rawQuery = (req.query.q as string || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit as string || '20', 10), 1), 50);

    if (!rawQuery) {
      return res.json({ tracks: [], total: 0, source: 'musicbrainz' });
    }

    const cacheKey = `${rawQuery.toLowerCase()}_${limit}`;
    const cached = mbCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      return res.json({ tracks: cached.tracks, total: cached.total, source: 'musicbrainz', query: rawQuery });
    }

    // Clean query for search syntax
    const cleanQ = rawQuery.replace(/[+\-&|!(){}[\]^"~*?:\\\/]/g, ' ').trim();
    const mbUrl = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(cleanQ)}&fmt=json&limit=${limit}`;

    let recordings: any[] = [];
    let totalCount = 0;

    // Concurrently query iTunes (fast 100-250ms, resilient global CDN) and MusicBrainz (1500ms timeout)
    const itunesPromise = (async () => {
      try {
        const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&entity=song&limit=${limit}`;
        const itRes = await fetch(itunesUrl, { signal: AbortSignal.timeout(2500) });
        if (itRes.ok) {
          const itData = (await itRes.json()) as any;
          return itData.results || [];
        }
      } catch {}
      return [];
    })();

    const mbPromise = (async () => {
      try {
        const mbRes = await fetch(mbUrl, {
          headers: {
            'User-Agent': 'MorningMusicApp/1.0.0 ( contact@morningmusic.app )',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(1800),
        });

        if (mbRes.ok) {
          const data = (await mbRes.json()) as any;
          return {
            recordings: data.recordings || [],
            count: data.count || (data.recordings || []).length,
          };
        }
      } catch {
        // MusicBrainz rate-limited, unreachable, or timed out; gracefully proceed to fast fallback
      }
      return { recordings: [], count: 0 };
    })();

    // Await both results
    const [itunesResults, mbData] = await Promise.all([itunesPromise, mbPromise]);
    recordings = mbData.recordings;
    totalCount = mbData.count;

    // Clean, merge, and rank results from iTunes and MusicBrainz
    const combinedTracks: any[] = [];
    const seen = new Set<string>();

    const addUniqueTrack = (track: any) => {
      const key = `${track.title.toLowerCase().trim()}_${track.artist.toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        combinedTracks.push(track);
      }
    };

    // 1. Process iTunes results (high metadata quality and beautiful high-res artwork)
    const itunesTracks = itunesResults.map((it: any) => {
      const title = it.trackName || cleanQ;
      const artist = it.artistName || 'Unknown Artist';
      const album = it.collectionName || 'Single';
      const lengthMs = it.trackTimeMillis || 180000;
      const duration = Math.round(lengthMs / 1000);
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const durationFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

      let language: 'tamil' | 'sinhala' | 'english' = 'english';
      const checkText = `${title} ${artist} ${album}`.toLowerCase();
      if (checkText.includes('tamil') || /[\u0B80-\u0BFF]/.test(checkText)) {
        language = 'tamil';
      } else if (checkText.includes('sinhala') || /[\u0D80-\u0DFF]/.test(checkText)) {
        language = 'sinhala';
      }

      return {
        id: `mb-it-${it.trackId}`,
        audio_source_id: `mb-it-${it.trackId}`,
        mbid: String(it.trackId),
        releaseId: String(it.collectionId || ''),
        title,
        artist,
        album,
        duration,
        durationFormatted,
        coverUrl: it.artworkUrl100 ? it.artworkUrl100.replace('100x100bb', '600x600bb') : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
        audioUrl: '', // resolved to YouTube stream when user taps song
        language,
        year: it.releaseDate ? parseInt(it.releaseDate.substring(0, 4), 10) : undefined,
        source: 'musicbrainz',
      };
    });

    // 2. Process MusicBrainz recordings
    const mbTracks = recordings.map((r: any) => {
      const title = r.title || 'Unknown Title';
      const artist = (r['artist-credit'] || [])
        .map((a: any) => (typeof a === 'string' ? a : a.name || a.artist?.name || ''))
        .join('')
        .trim() || 'Unknown Artist';

      const release = (r.releases || [])[0];
      const album = release?.title || 'Single';
      const releaseId = release?.id;
      const lengthMs = r.length || 180000;
      const duration = Math.round(lengthMs / 1000);
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const durationFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      const year = release?.date ? parseInt(release.date.substring(0, 4), 10) || undefined : undefined;

      const coverUrl = releaseId
        ? `https://coverartarchive.org/release/${releaseId}/front-250.jpg`
        : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600';

      let language: 'tamil' | 'sinhala' | 'english' = 'english';
      const checkText = `${title} ${artist} ${album}`.toLowerCase();
      if (checkText.includes('tamil') || /[\u0B80-\u0BFF]/.test(checkText)) {
        language = 'tamil';
      } else if (checkText.includes('sinhala') || /[\u0D80-\u0DFF]/.test(checkText)) {
        language = 'sinhala';
      }

      return {
        id: `mb-${r.id}`,
        audio_source_id: `mb-${r.id}`,
        mbid: r.id,
        releaseId,
        title,
        artist,
        album,
        duration,
        durationFormatted,
        coverUrl,
        audioUrl: '', // resolved to YouTube stream when user taps song
        language,
        year,
        source: 'musicbrainz',
      };
    });

    // Add iTunes tracks first (highly likely to be actual commercial master tracks)
    itunesTracks.forEach(addUniqueTrack);
    mbTracks.forEach(addUniqueTrack);

    if (combinedTracks.length > 0) {
      // Sort combinedTracks so exact match is strictly positioned first
      const qCleaned = rawQuery.toLowerCase().replace(/\b(songs?|music|mp3|video|audio|track|lyrics?)\b/gi, '').replace(/\s+/g, ' ').trim() || rawQuery.toLowerCase();
      
      combinedTracks.sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const aArtist = a.artist.toLowerCase();
        const bArtist = b.artist.toLowerCase();

        const aExactTitle = aTitle === qCleaned ? 1 : 0;
        const bExactTitle = bTitle === qCleaned ? 1 : 0;
        if (aExactTitle !== bExactTitle) return bExactTitle - aExactTitle;

        const aStartsTitle = aTitle.startsWith(qCleaned) ? 1 : 0;
        const bStartsTitle = bTitle.startsWith(qCleaned) ? 1 : 0;
        if (aStartsTitle !== bStartsTitle) return bStartsTitle - aStartsTitle;

        const aExactArtist = aArtist === qCleaned ? 1 : 0;
        const bExactArtist = bArtist === qCleaned ? 1 : 0;
        if (aExactArtist !== bExactArtist) return bExactArtist - aExactArtist;

        const aContains = aTitle.includes(qCleaned) || aArtist.includes(qCleaned) ? 1 : 0;
        const bContains = bTitle.includes(qCleaned) || bArtist.includes(qCleaned) ? 1 : 0;
        if (aContains !== bContains) return bContains - aContains;

        return 0;
      });

      mbCache.set(cacheKey, { tracks: combinedTracks, total: combinedTracks.length, timestamp: Date.now() });
      return res.json({ tracks: combinedTracks, total: combinedTracks.length, source: 'musicbrainz', query: rawQuery });
    }

    // If both return empty, return clean empty result with HTTP 200
    res.json({ tracks: [], total: 0, source: 'musicbrainz', query: rawQuery });
  } catch (err: any) {
    // Fail gracefully with HTTP 200 and empty track list so UI never breaks
    res.json({ tracks: [], total: 0, source: 'musicbrainz', query: req.query.q || '' });
  }
});

// API: Resolve a song (Title + Artist) to the matching full YouTube video stream
app.get('/api/youtube/resolve-track', async (req, res) => {
  try {
    const title = (req.query.title as string || '').trim();
    const artist = (req.query.artist as string || '').trim();
    const query = (req.query.query as string || `${title} ${artist}`).trim();
    const excludeParam = (req.query.excludeId as string || '').trim();
    const excludeVideoIds = excludeParam ? excludeParam.split(',').map((s) => s.trim()).filter(Boolean) : [];

    if (!query && !title) {
      return res.status(400).json({ error: 'Missing title or query parameter' });
    }

    const searchQuery = title ? `${title} ${artist}`.trim() : query;
    console.log(`[YouTube Resolver] Resolving YouTube video for: "${searchQuery}" (excluded: ${excludeVideoIds.length})`);

    // 1. Try structured song resolver (matches official audio/video)
    const resolved = await resolveYouTubeVideoBySong(title || query, artist, excludeVideoIds);
    if (resolved && resolved.videoId) {
      return res.json({
        youtubeVideoId: resolved.videoId,
        title: resolved.title || title || searchQuery,
        artist: resolved.artist || artist,
        duration: resolved.duration,
        durationFormatted: resolved.durationFormatted,
        coverUrl: resolved.coverUrl,
        audioUrl: `yt:${resolved.videoId}`,
        youtubeUrl: `https://www.youtube.com/watch?v=${resolved.videoId}`,
        source: 'youtube_structured',
      });
    }

    // 2. Try YouTube Data API if configured
    if (youtubeConfig.isConfigured()) {
      try {
        const searchUrl = youtubeConfig.buildApiUrl('search', {
          part: 'snippet',
          type: 'video',
          q: `${searchQuery} official audio`,
          maxResults: 6,
        });
        const ytRes = await fetch(searchUrl, { signal: AbortSignal.timeout(4000) });
        if (ytRes.ok) {
          const ytData = (await ytRes.json()) as any;
          const items = ytData.items || [];
          for (const item of items) {
            const videoId = item.id?.videoId;
            if (videoId && !excludeVideoIds.includes(videoId) && isAuthenticYouTubeVideoId(videoId)) {
              return res.json({
                youtubeVideoId: videoId,
                title: item.snippet?.title || title,
                artist: item.snippet?.channelTitle || artist,
                coverUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
                audioUrl: `yt:${videoId}`,
                youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
                source: 'youtube_api',
              });
            }
          }
        }
      } catch (err) {
        console.warn('[YouTube Resolver] YouTube API attempt failed:', err);
      }
    }

    res.status(404).json({ error: 'No matching YouTube video found for track' });
  } catch (err: any) {
    console.error('[YouTube Resolver] Error resolving YouTube track:', err);
    res.status(500).json({ error: 'Failed to resolve YouTube track', message: err.message });
  }
});

// API: Export Web APK ZIP containing index.html at root (for apkbuild.org / Web-to-APK converters)
app.get('/api/export/web-apk-zip', async (req, res) => {
  try {
    const distPath = path.join(process.cwd(), 'dist');
    const zip = new JSZip();

    function addDirToZip(currentDir: string, zipFolder: JSZip) {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          const subFolder = zipFolder.folder(entry.name);
          if (subFolder) {
            addDirToZip(fullPath, subFolder);
          }
        } else if (entry.isFile()) {
          // Exclude server-only node bundle
          if (entry.name.startsWith('server.cjs')) continue;
          const content = fs.readFileSync(fullPath);
          zipFolder.file(entry.name, content);
        }
      }
    }

    if (fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'))) {
      addDirToZip(distPath, zip);























    } else {
      return res.status(404).json({ error: 'Web build assets not found. Run build first.' });
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="MorningMusic-WebAPK-RootIndex.zip"');
    res.send(zipBuffer);
  } catch (err: any) {
    console.error('Error creating Web APK ZIP:', err);
    res.status(500).json({ error: 'Failed to create Web APK ZIP', message: err.message });
  }
});

// Public APK download: serve the signed Android package directly.
// This bypasses Vite/static SPA fallback and forces a real file download.
app.get('/downloads/SABDHAM-signed.apk', (req, res) => {
  const sourceApk = path.join(process.cwd(), 'public', 'downloads', 'SABDHAM-signed.apk');
  const builtApk = path.join(process.cwd(), 'dist', 'downloads', 'SABDHAM-signed.apk');
  const apkPath = fs.existsSync(sourceApk) ? sourceApk : builtApk;

  if (!fs.existsSync(apkPath)) {
    return res.status(404).type('text/plain').send('SABDHAM APK not found.');
  }

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="SABDHAM-signed.apk"');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.sendFile(apkPath);
});

// Public legal page: serve directly from source so SPA fallback/PWA routing
// cannot swallow the privacy-policy URL on the live custom domain.
app.get(['/privacy-policy', '/privacy-policy.html'], (req, res) => {
  const sourcePolicy = path.join(process.cwd(), 'public', 'privacy-policy.html');
  const builtPolicy = path.join(process.cwd(), 'dist', 'privacy-policy.html');
  const policyPath = fs.existsSync(sourcePolicy) ? sourcePolicy : builtPolicy;

  if (!fs.existsSync(policyPath)) {
    return res.status(404).type('text/plain').send('SABDHAM Privacy Policy not found.');
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.sendFile(policyPath);
});

// Mount Vite middleware for dev or serve dist in production
async function startServer() {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (typeof __filename !== 'undefined' && __filename.endsWith('.cjs'));

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Graceful process error handlers to prevent unhandled crash in container
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception thrown:', err);
});

startServer();

























// force render redeploy 2026-09-28T19:56:35




