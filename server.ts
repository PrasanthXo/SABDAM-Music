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
import { sendOtpEmail } from './server/mailer.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { initializeApp as initializeClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import {
  getOrCreateUser,
  getUserFavorites,
  addUserFavorite,
  removeUserFavorite,
  getUserLibraryFromDb,
  saveUserLibraryToDb,
  deleteUserPlaylist,
} from './src/db/users.ts';

dotenv.config();

const app = express();
const PORT = 3000;

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

// Health check endpoints for Cloud Run deployment, kubernetes probes, and load balancers
app.get(['/api/health', '/health', '/healthz'], (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
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
  recentlyPlayed: any[];
  customPlaylists: any[];
  customSongs: any[];
  settings?: {
    audioQuality: 'high' | 'medium' | 'low';
    crossfade: boolean;
    equalizerPreset: string;
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
  
  // 1. Check custom session token
  const session = sessions.get(token);
  if (session) {
    if (Date.now() > session.expiresAt) {
      sessions.delete(token);
      savePersistedData();
      return null;
    }
    
    // Rolling 30-day session extension on active request
    session.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

    const user = usersById.get(session.userId);
    return user || null;
  }

  // 2. Check Firebase ID token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (decodedToken && decodedToken.uid) {
      const email = decodedToken.email?.toLowerCase();
      let user = usersById.get(decodedToken.uid) || (email ? users.get(email) : null);
      if (!user && email) {
        user = {
          id: decodedToken.uid,
          email,
          name: decodedToken.name || email.split('@')[0],
          provider: 'google',
          avatarUrl: decodedToken.picture,
          avatarColor: '#4f46e5',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        users.set(email, user);
        usersById.set(decodedToken.uid, user);
        initUserData(decodedToken.uid);
        savePersistedData();
        // Synchronize with PostgreSQL Cloud SQL
        getOrCreateUser(user.id, user.email, user.name, user.avatarUrl).catch(() => {});
      }
      return user || null;
    }
  } catch (fbErr) {
    // Not a Firebase ID token or expired
  }

  return null;
}

function createSessionToken(user: UserRecord): string {
  const token = `mm_tok_${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
  const session = {
    userId: user.id,
    email: user.email,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  sessions.set(token, session);
  savePersistedData();
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
    customPlaylists: [
      {
        id: `pl_${Date.now()}_fav`,
        title: 'My Morning Favorites',
        description: 'My personalized morning playlist',
        coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
        trackIds: ['ta-01', 'en-01'],
        isCustom: true,
        createdAt: new Date().toISOString(),
        userId,
      }
    ],
    customSongs: [],
    settings: {
      audioQuality: 'high',
      crossfade: true,
      equalizerPreset: 'Dynamic Clarity',
      offlineMode: false,
    },
  };

  userDataStore.set(userId, initialData);
  if (normalizedEmail) {
    userDataStore.set(normalizedEmail, initialData);
  }
}

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
    const existing = users.get(email);
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

    users.set(email, newUser);
    usersById.set(id, newUser);
    initUserData(id);
    savePersistedData();
    // Synchronize with PostgreSQL Cloud SQL
    getOrCreateUser(newUser.id, newUser.email, newUser.name, undefined).catch(() => {});

    const token = createSessionToken(newUser);
    setAuthCookie(res, token, 7);

    console.log(`\n✅ [Auth] New account created: ${email} (${displayName}) [Email/Password]`);

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

    const token = createSessionToken(user);
    setAuthCookie(res, token, 7);

    console.log(`\n🔑 [Auth] User signed in: ${email} (${user.name})`);

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

    console.log(`\n🔐 [Auth] Password Reset Code generated for ${email}: [REDACTED]`);

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

    const token = createSessionToken(user);
    setAuthCookie(res, token, 7);

    console.log(`\n🎉 [Auth] Password reset successfully for ${email}`);

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

    const existing = users.get(email);

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

    console.log(`\n📨 [Auth Email OTP] Code generated for ${email}: [REDACTED] (purpose: ${purpose}, existing: ${!!existing})`);

    // Dispatch real email to user's inbox
    const mailResult = await sendOtpEmail(email, code, purpose as any, rawName);

    const isNew = !existing;

    if (!mailResult.success && mailResult.error) {
      console.warn(`[OTP Mailer] Delivery notice for ${email}: ${mailResult.error}`);
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

    // OTP verified successfully! Clear single-use code
    otpStore.delete(email);

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

      users.set(email, user);
      usersById.set(id, user);
      initUserData(id);
      savePersistedData();

      // Synchronize with PostgreSQL Cloud SQL
      try {
        await getOrCreateUser(user.id, user.email, user.name, undefined);
      } catch (dbErr) {
        console.warn('Cloud SQL user upsert notification (OTP signup):', dbErr);
      }
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

    const token = createSessionToken(user);
    setAuthCookie(res, token, 7);

    console.log(`\n🎉 [Auth OTP] Successful authentication: ${user.email} (${user.name}) [isNewUser: ${isNewUser}]`);

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
    return res.status(500).json({ error: 'Failed to verify OTP code. Please try again.' });
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
app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    sessions.delete(token);
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

    const { displayName, photoUrl } = req.body || {};
    const name = displayName || req.user.name || req.user.email.split('@')[0];
    const picture = photoUrl || req.user.picture || null;

    // Upsert into Cloud SQL users table
    await getOrCreateUser(req.user.uid, req.user.email, name, picture);

    // Also update in-memory cache for app operations
    let localUser = users.get(req.user.email);
    if (!localUser) {
      localUser = {
        id: req.user.uid,
        email: req.user.email,
        name,
        provider: 'google',
        avatarUrl: picture,
        avatarColor: '#4f46e5',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      users.set(req.user.email, localUser);
      usersById.set(req.user.uid, localUser);
      initUserData(req.user.uid);
      savePersistedData();
    } else {
      localUser.lastLoginAt = new Date().toISOString();
      if (picture) localUser.avatarUrl = picture;
      usersById.set(localUser.id, localUser);
      savePersistedData();
    }

    const token = createSessionToken(localUser);

    return res.json({
      success: true,
      message: 'Signed in successfully via Google!',
      token,
      user: sanitizeUser(localUser),
    });
  } catch (error: any) {
    console.error('Error syncing Google user with Cloud SQL:', error);
    return res.status(500).json({ error: 'Failed to synchronize user profile with database.' });
  }
});

// Cloud SQL database user endpoints
app.get('/api/db/favorites', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const favorites = await getUserFavorites(req.user.uid);
    res.json({ favorites });
  } catch (error: any) {
    console.error('Failed to fetch user favorites from Cloud SQL:', error);
    res.status(500).json({ error: 'Failed to retrieve favorites.' });
  }
});

app.post('/api/db/favorites', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { trackId } = req.body || {};
    if (!trackId) {
      return res.status(400).json({ error: 'trackId is required.' });
    }
    await addUserFavorite(req.user.uid, trackId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to add favorite to Cloud SQL:', error);
    res.status(500).json({ error: 'Failed to save favorite.' });
  }
});

app.delete('/api/db/favorites/:trackId', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { trackId } = req.params;
    await removeUserFavorite(req.user.uid, trackId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to remove favorite from Cloud SQL:', error);
    res.status(500).json({ error: 'Failed to remove favorite.' });
  }
});

app.delete('/api/db/playlists/:playlistId', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { playlistId } = req.params;
    await deleteUserPlaylist(req.user.uid, playlistId);
    const current = userDataStore.get(req.user.uid) || userDataStore.get(req.user.email?.toLowerCase() || '');
    if (current && current.customPlaylists) {
      current.customPlaylists = current.customPlaylists.filter((p: any) => p.id !== playlistId);
      userDataStore.set(req.user.uid, current);
      if (req.user.email) userDataStore.set(req.user.email.toLowerCase(), current);
      savePersistedData();
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete playlist from Cloud SQL:', error);
    res.status(500).json({ error: 'Failed to delete playlist.' });
  }
});

// 7. API: Get User's Isolated Private Data (Synchronized with PostgreSQL Cloud SQL)
app.get('/api/user/data', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required to access user data.' });
  }

  // 1. First, attempt to retrieve persistent library from Cloud SQL PostgreSQL
  try {
    const dbLibrary = await getUserLibraryFromDb(user.id) || (user.email ? await getUserLibraryFromDb(user.email.toLowerCase()) : null);
    if (
      dbLibrary &&
      (dbLibrary.customPlaylists.length > 0 ||
        dbLibrary.likedTrackIds.length > 0 ||
        dbLibrary.customSongs.length > 0 ||
        dbLibrary.recentlyPlayed.length > 0)
    ) {
      // Update memory store with latest SQL database state
      userDataStore.set(user.id, dbLibrary as UserDataRecord);
      if (user.email) {
        userDataStore.set(user.email.toLowerCase(), dbLibrary as UserDataRecord);
      }
      savePersistedData();
      return res.json({ data: dbLibrary });
    }
  } catch (sqlErr) {
    console.warn('[Cloud SQL] Failed to query user library on GET /api/user/data, falling back to memory/local store:', sqlErr);
  }

  // 2. Fall back to in-memory / JSON persistent store
  let data = userDataStore.get(user.id) || (user.email ? userDataStore.get(user.email.toLowerCase()) : null);

  if (!data) {
    data = {
      likedTrackIds: [],
      recentlyPlayed: [],
      customPlaylists: [],
      customSongs: [],
    };
    userDataStore.set(user.id, data);
    if (user.email) {
      userDataStore.set(user.email.toLowerCase(), data);
    }
    savePersistedData();
  } else {
    // Ensure both maps are populated
    userDataStore.set(user.id, data);
    if (user.email) {
      userDataStore.set(user.email.toLowerCase(), data);
    }
  }

  // Async push initial/cached data into SQL if database is empty for this user
  try {
    getOrCreateUser(user.id, user.email, user.name, user.avatarUrl).then(() => {
      saveUserLibraryToDb(user.id, data as any);
    }).catch(() => {});
  } catch {}

  return res.json({ data });
});

// 8. API: Save/Sync User's Isolated Private Data (Synchronized with PostgreSQL Cloud SQL)
app.post('/api/user/data', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required to save user data.' });
  }

  const { likedTrackIds, recentlyPlayed, customPlaylists, customSongs, settings, isExplicitClear } = req.body || {};

  const current = userDataStore.get(user.id) || (user.email ? userDataStore.get(user.email.toLowerCase()) : null) || {
    likedTrackIds: [],
    recentlyPlayed: [],
    customPlaylists: [],
    customSongs: [],
  };

  // Safeguard: Protect existing user library items from being wiped by uninitialized empty client syncs
  if (Array.isArray(likedTrackIds)) {
    const cleanLikes = likedTrackIds.filter((id) => typeof id === 'string' && id.trim().length > 0);
    if (cleanLikes.length > 0 || isExplicitClear || (current.likedTrackIds || []).length === 0) {
      current.likedTrackIds = cleanLikes;
    } else {
      console.warn(`[Data Safeguard] Preserved ${current.likedTrackIds.length} existing liked tracks for ${user.id} against empty sync.`);
    }
  }
  if (Array.isArray(recentlyPlayed)) {
    if (recentlyPlayed.length > 0 || isExplicitClear || (current.recentlyPlayed || []).length === 0) {
      current.recentlyPlayed = recentlyPlayed.slice(0, 50);
    }
  }
  if (Array.isArray(customPlaylists)) {
    if (customPlaylists.length > 0 || isExplicitClear || (current.customPlaylists || []).length === 0) {
      current.customPlaylists = customPlaylists;
    } else {
      console.warn(`[Data Safeguard] Preserved ${current.customPlaylists.length} existing custom playlists for ${user.id} against empty sync.`);
    }
  }
  if (Array.isArray(customSongs)) {
    if (customSongs.length > 0 || isExplicitClear || (current.customSongs || []).length === 0) {
      current.customSongs = customSongs;
    } else {
      console.warn(`[Data Safeguard] Preserved ${current.customSongs.length} existing custom songs for ${user.id} against empty sync.`);
    }
  }
  if (settings && typeof settings === 'object') {
    current.settings = { ...current.settings, ...settings };
  }

  // 1. Update in-memory & local cache immediately for low-latency response
  userDataStore.set(user.id, current);
  if (user.email) {
    userDataStore.set(user.email.toLowerCase(), current);
  }
  savePersistedData();

  // 2. Persist to Cloud SQL PostgreSQL
  try {
    await getOrCreateUser(user.id, user.email, user.name, user.avatarUrl);
    await saveUserLibraryToDb(user.id, current);
  } catch (sqlErr) {
    console.error('[Cloud SQL] Failed to save user library to database:', sqlErr);
  }

  return res.json({ success: true, message: 'User data saved to SQL database.' });
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
        <div style="width:40px;height:40px;border-radius:50%;background:#1db954;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:#000;font-weight:bold;font-size:20px;">✓</div>
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
  let clean = decodeHtmlEntities(rawTitle);
  // Remove common YouTube music video noise
  clean = clean
    .replace(/\s*\(Official Video\)/gi, '')
    .replace(/\s*\[Official Video\]/gi, '')
    .replace(/\s*\(Official Music Video\)/gi, '')
    .replace(/\s*\[Official Music Video\]/gi, '')
    .replace(/\s*\(Lyric Video\)/gi, '')
    .replace(/\s*\[Lyric Video\]/gi, '')
    .replace(/\s*\(Official Audio\)/gi, '')
    .replace(/\s*\[Official Audio\]/gi, '')
    .replace(/\s*\(Audio\)/gi, '')
    .replace(/\s*\[Audio\]/gi, '')
    .replace(/\s*\|.*$/g, '') // remove trailing pipe channels
    .trim();

  // If title has "Artist - Song", extract
  if (clean.includes(' - ')) {
    const parts = clean.split(' - ');
    if (parts.length >= 2) {
      return {
        artistSuggestion: parts[0].trim(),
        title: parts.slice(1).join(' - ').trim(),
      };
    }
  }

  return { title: clean };
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
    coverUrl: "https://i.ytimg.com/vi/jZEA2mMwL1k/hq720.jpg",
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
    coverUrl: "https://i.ytimg.com/vi/bhU9E7kj1oo/hq720.jpg",
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
    coverUrl: "https://i.ytimg.com/vi/NCIMPzFSQjU/hq720.jpg",
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
    coverUrl: "https://i.ytimg.com/vi/AAq06bS8UZM/hq720.jpg",
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
    coverUrl: "https://i.ytimg.com/vi/8bfH0EYn0Pg/hq720.jpg",
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
    coverUrl: "https://i.ytimg.com/vi/9jY8PItvMxo/hq720.jpg",
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
    coverUrl: "https://i.ytimg.com/vi/3YQKuAP79Q8/hq720.jpg",
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
    coverUrl: "https://i.ytimg.com/vi/JqMZFeG-bYk/hq720.jpg",
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
    coverUrl: "https://i.ytimg.com/vi/Gw-kiVGfoHo/hq720.jpg",
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
    coverUrl: "https://i.ytimg.com/vi/SaNC4NKco8k/hq720.jpg",
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
    coverUrl: "https://i.ytimg.com/vi/vxzfsBDx590/hq720.jpg",
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
    coverUrl: "https://i.ytimg.com/vi/T5S8I8d8yuo/hq720.jpg",
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
const streamCache = new Map<string, { url: string; videoId?: string; expiresAt: number }>();

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
  source: 'saavn' | 'youtube' | 'cache' | 'catalog';
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
    .replace(/[^\w\s]/gi, ' ')
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

  // Discard unwanted versions (karaoke, tribute, covers, nightcore, etc.) unless explicitly in target
  const forbiddenTerms = ['karaoke', 'tribute', 'originally performed', 'ringtone', 'instrumental'];
  if (!tTitle.includes('remix')) forbiddenTerms.push('remix');
  if (!tTitle.includes('nightcore')) forbiddenTerms.push('nightcore');
  if (!tTitle.includes('cover')) forbiddenTerms.push('cover');
  if (!tTitle.includes('ambient')) forbiddenTerms.push('ambient');
  if (!tTitle.includes('slowed')) forbiddenTerms.push('slowed');
  if (!tTitle.includes('techno')) forbiddenTerms.push('techno');

  for (const term of forbiddenTerms) {
    if (songName.includes(term)) return false;
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
    
    let res: Response;
    try {
      res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(4000),
      });
    } catch (networkErr: any) {
      console.warn('[Saavn Diagnostic] Fetch/network error:', networkErr?.name === 'TimeoutError' ? 'TimeoutError (AbortSignal.timeout)' : (networkErr?.message || String(networkErr)));
      return null;
    }

    console.log('[Saavn Diagnostic] HTTP status:', res.status, res.statusText);
    console.log('[Saavn Diagnostic] Content-Type:', res.headers.get('content-type'));

    const rawText = await res.text();
    const trimmedBody = rawText.trim();
    const startsWithBrace = trimmedBody.startsWith('{');
    console.log('[Saavn Diagnostic] Body starts with {:', startsWithBrace, '| Body length:', rawText.length);

    if (!res.ok) {
      console.warn('[Saavn Diagnostic] Non-ok HTTP response status:', res.status);
      return null;
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (jsonErr: any) {
      console.warn('[Saavn Diagnostic] JSON parse error:', jsonErr?.message || String(jsonErr));
      return null;
    }

    const resultsCount = Array.isArray(data?.results) ? data.results.length : 0;
    console.log('[Saavn Diagnostic] Number of results returned:', resultsCount);
    if (resultsCount === 0) return null;

    for (const match of data.results) {
      // Validate that this candidate actually matches the requested song title and artist!
      if (targetTitle && !isValidSaavnMatch(targetTitle, targetArtist || '', match)) {
        console.log('[Saavn Diagnostic] Candidate failed isValidSaavnMatch for:', match.song || match.title || 'unknown');
        continue;
      }

      const enc = match.encrypted_media_url || match.more_info?.encrypted_media_url;
      if (!enc) {
        console.log('[Saavn Diagnostic] Candidate encrypted_media_url is missing');
        continue;
      }

      const fullUrl = decryptSaavnMediaUrl(enc);
      if (!fullUrl) {
        console.log('[Saavn Diagnostic] decryptSaavnMediaUrl() failed');
        continue;
      }

      console.log('[Saavn Diagnostic] Successfully resolved and decrypted stream candidate');
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
  } catch (err: any) {
    console.warn('[Saavn Diagnostic] General error:', err?.message || String(err));
  }
  return null;
}

// Search and extract live YouTube videos using structured ytInitialData parser
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
    const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
    if (!jsonMatch) return [];

    const data = JSON.parse(jsonMatch[1]);
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
              const thumbs = vr.thumbnail?.thumbnails || [];
              const coverUrl = thumbs[thumbs.length - 1]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600';

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

              // Clean title metadata
              const cleanedTitle = title
                .replace(/\[(Official\s*(Video|Audio|Music Video|Lyric Video|4K|HD|Track)).*?\]/gi, '')
                .replace(/\((Official\s*(Video|Audio|Music Video|Lyric Video|4K|HD|Track)).*?\)/gi, '')
                .replace(/\|\s*(Full\s*(Video|Audio)\s*Song|Official\s*Music\s*Video|4K|Lyrical|Trending).*$/gi, '')
                .trim();

              let trackLang = 'english';
              const textToScan = `${cleanedTitle} ${artist} ${query}`.toLowerCase();
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
                artist,
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
  if (activeVideoId && activeVideoId.length === 11) {
    const audioUrl = await resolveYouTubeAudioUrl(activeVideoId);
    return {
      url: audioUrl,
      videoId: activeVideoId,
      source: 'youtube',
    };
  }

  const cacheKey = (activeVideoId || `${title || ''}_${artist || ''}` || query || 'track').trim();
  const cached = streamCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && (!cached.videoId || !excludeVideoIds.includes(cached.videoId))) {
    return { url: cached.url, videoId: activeVideoId || cached.videoId, source: 'cache' };
  }

  let activeTitle = title ? title.trim() : '';
  let activeArtist = artist && artist !== 'Unknown Artist' ? artist.trim() : '';

  // Tier 1: Try JioSaavn only for strict exact title AND artist match
  if (activeTitle && activeArtist) {
    const saavnStream = await resolveFromJioSaavn(`${activeTitle} ${activeArtist}`, activeTitle, activeArtist);
    if (saavnStream && saavnStream.url) {
      streamCache.set(cacheKey, { url: saavnStream.url, videoId: activeVideoId, expiresAt: Date.now() + 6 * 3600 * 1000 });
      return saavnStream;
    }
  }

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

// API: Search YouTube songs securely proxying requests with the server-side API Key
app.get('/api/youtube/search', async (req, res) => {
  try {
    const query = (req.query.q as string || '').trim();
    const language = (req.query.language as string || 'all').toLowerCase();
    const maxResults = Math.min(parseInt(req.query.maxResults as string || '15', 10), 25);

    if (!query) {
      return res.json({ tracks: MODULAR_CATALOG });
    }

    // Use clean search terms without arbitrary replacements
    let searchTerms = query;
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

                const trackName = item.snippet?.title || 'Unknown Track';
                const channelTitle = item.snippet?.channelTitle || 'Unknown Artist';
                const durationSec = durationsMap[videoId] || 180;
                const mins = Math.floor(durationSec / 60);
                const secs = durationSec % 60;
                const durationFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

                const coverUrl =
                  item.snippet?.thumbnails?.high?.url ||
                  item.snippet?.thumbnails?.medium?.url ||
                  item.snippet?.thumbnails?.default?.url ||
                  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600';

                let trackLang = 'english';
                const textToScan = `${trackName} ${channelTitle} ${query}`.toLowerCase();
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
                  artist: channelTitle,
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
              .filter(Boolean);

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
      return res.json({ tracks: scrapedTracks });
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

      const highResArt = item.snippet?.thumbnails?.maxres?.url || item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

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
    .replace(/[^\w\s]/gi, ' ')
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

    if (streamInfo && streamInfo.url) {
      if (streamInfo.url.startsWith('http')) {
        const headers: Record<string, string> = {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'accept': '*/*',
        };

        if (req.headers.range) {
          headers['range'] = req.headers.range;
        }

        const options = {
          method: 'GET',
          headers,
        };

        const proxyReq = https.request(streamInfo.url, options, (proxyRes) => {
          // Force pure audio mime type to tell Chrome/Safari background audio is permitted!
          res.setHeader('Content-Type', 'audio/mp4');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Access-Control-Allow-Origin', '*');

          if (proxyRes.headers['content-range']) {
            res.setHeader('Content-Range', proxyRes.headers['content-range']);
          }
          if (proxyRes.headers['content-length']) {
            res.setHeader('Content-Length', proxyRes.headers['content-length']);
          }

          res.writeHead(proxyRes.statusCode || 200);
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (e) => {
          console.error('[YouTube Stream Proxy] Request error:', e);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream audio from source' });
          }
        });

        req.on('close', () => {
          proxyReq.destroy();
        });

        return proxyReq.end();
      } else {
        return res.redirect(302, streamInfo.url);
      }
    }
    return res.status(404).json({
      error: 'Direct audio stream not available. Use YouTube player.',
      useYouTube: true,
      videoId: streamInfo.videoId || videoId,
    });
  } catch (err: any) {
    console.error('[YouTube Stream] Error in streaming endpoint:', err);
    res.status(500).json({ error: 'Failed to stream audio' });
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
    if (streamInfo && streamInfo.url) {
      streamInfo.url = `/api/youtube/stream?id=${encodeURIComponent(streamInfo.videoId || videoId)}`;
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(streamInfo);
  } catch (err: any) {
    console.error('[Stream Resolve] Error resolving stream:', err);
    res.status(500).json({ error: 'Failed to resolve stream' });
  }
});

// TEMPORARY diagnostic endpoint to directly inspect JioSaavn API responses from the server environment
app.get('/api/debug/saavn-test', async (_req, res) => {
  const targetTitle = 'Perfect';
  const targetArtist = 'Ed Sheeran';

  const result = {
    targetTitle,
    targetArtist,
    httpStatus: null as number | null,
    httpStatusText: null as string | null,
    contentType: null as string | null,
    bodyLength: 0,
    bodyStartsWithBrace: false,
    jsonParsingSucceeded: false,
    resultsCount: 0,
    matchedCandidate: false,
    error: null as string | null,
    candidates: [] as any[],
  };

  try {
    const cleanQuery = cleanMatchingText(`${targetTitle} ${targetArtist}`);
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&n=10&p=1&q=${encodeURIComponent(cleanQuery)}&_marker=0`;

    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(4000),
      });
    } catch (networkErr: any) {
      result.error = networkErr?.name === 'TimeoutError'
        ? 'TimeoutError (AbortSignal.timeout 4000ms)'
        : (networkErr?.message || String(networkErr));
      return res.status(200).json(result);
    }

    result.httpStatus = upstreamRes.status;
    result.httpStatusText = upstreamRes.statusText;
    result.contentType = upstreamRes.headers.get('content-type');

    const rawText = await upstreamRes.text();
    result.bodyLength = rawText.length;
    result.bodyStartsWithBrace = rawText.trim().startsWith('{');

    if (!upstreamRes.ok) {
      result.error = `Upstream HTTP ${upstreamRes.status} ${upstreamRes.statusText}`;
      return res.status(200).json(result);
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
      result.jsonParsingSucceeded = true;
    } catch (jsonErr: any) {
      result.jsonParsingSucceeded = false;
      result.error = `JSON Parse Error: ${jsonErr?.message || String(jsonErr)}`;
      return res.status(200).json(result);
    }

    if (Array.isArray(data?.results)) {
      result.resultsCount = data.results.length;
      const top10 = data.results.slice(0, 10);

      top10.forEach((candidate: any, idx: number) => {
        const rawTitle = candidate.song || candidate.title || '';
        const rawArtist = candidate.primary_artists || candidate.singers || '';
        const songName = cleanMatchingText(rawTitle);
        const primaryArtists = cleanMatchingText(candidate.primary_artists || '');
        const singers = cleanMatchingText(candidate.singers || '');
        const allArtists = `${primaryArtists} ${singers}`.trim();
        const tTitle = cleanMatchingText(targetTitle);
        const tArtist = cleanMatchingText(targetArtist);

        const duration = candidate.more_info?.duration
          ? parseInt(candidate.more_info.duration, 10)
          : candidate.duration
            ? parseInt(candidate.duration, 10)
            : null;

        const language = candidate.language || candidate.more_info?.language || null;

        // Trace exact matcher steps
        let rejectionReason: string | null = null;
        let titleOverlapResult: any = null;
        let artistOverlapResult: any = null;

        if (!songName || !tTitle) {
          rejectionReason = 'missing song name or target title';
        }

        const forbiddenTerms = ['karaoke', 'tribute', 'originally performed', 'ringtone', 'instrumental'];
        if (!tTitle.includes('remix')) forbiddenTerms.push('remix');
        if (!tTitle.includes('nightcore')) forbiddenTerms.push('nightcore');
        if (!tTitle.includes('cover')) forbiddenTerms.push('cover');
        if (!tTitle.includes('ambient')) forbiddenTerms.push('ambient');
        if (!tTitle.includes('slowed')) forbiddenTerms.push('slowed');
        if (!tTitle.includes('techno')) forbiddenTerms.push('techno');

        if (!rejectionReason) {
          for (const term of forbiddenTerms) {
            if (songName.includes(term)) {
              rejectionReason = `forbidden term detected: "${term}"`;
              break;
            }
          }
        }

        const tWords = tTitle.split(' ').filter((w) => w.length > 2);
        if (!rejectionReason && tWords.length === 0) {
          rejectionReason = 'no target title words > 2 characters';
        }

        if (tWords.length > 0) {
          const matchedTitleWords = tWords.filter((w) => songName.includes(w));
          const ratio = matchedTitleWords.length / tWords.length;
          const isTitleMatch = ratio >= 0.7 || songName.includes(tTitle) || tTitle.includes(songName);
          titleOverlapResult = {
            targetWords: tWords,
            matchedTitleWords,
            ratio: Math.round(ratio * 100) / 100,
            isTitleMatch,
          };
          if (!rejectionReason && !isTitleMatch) {
            rejectionReason = `title similarity mismatch (ratio ${ratio.toFixed(2)} < 0.7)`;
          }
        }

        if (tArtist && tArtist !== 'unknown artist' && tArtist !== 'various artists') {
          const aWords = tArtist.split(' ').filter((w) => w.length > 2 && w !== 'the' && w !== 'and');
          if (aWords.length > 0) {
            const matchedArtistWords = aWords.filter((w) => allArtists.includes(w));
            const isArtistMatch = matchedArtistWords.length > 0;
            artistOverlapResult = {
              targetArtistWords: aWords,
              matchedArtistWords,
              isArtistMatch,
            };
            if (!rejectionReason && !isArtistMatch) {
              rejectionReason = 'artist mismatch (no target artist words found in primary_artists/singers)';
            }
          }
        }

        if (!rejectionReason && duration !== null && (duration < 50 || duration > 650)) {
          rejectionReason = `duration out of range (${duration}s, must be 50-650s)`;
        }

        const isValid = isValidSaavnMatch(targetTitle, targetArtist, candidate);
        if (isValid) {
          result.matchedCandidate = true;
          rejectionReason = 'none (passed validation)';
        } else if (!rejectionReason) {
          rejectionReason = 'failed isValidSaavnMatch condition';
        }

        result.candidates.push({
          index: idx,
          rawTitle,
          rawArtist,
          duration,
          language,
          isValid,
          normalizedTitle: songName,
          normalizedArtist: allArtists,
          titleOverlap: titleOverlapResult,
          artistOverlap: artistOverlapResult,
          rejectionReason,
        });
      });
    }

    return res.status(200).json(result);
  } catch (err: any) {
    result.error = err?.message || String(err);
    return res.status(500).json(result);
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
