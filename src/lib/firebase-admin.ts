import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let androidAdminAuthInstance: Auth | null = null;

function getAndroidFirebaseApp(): App {
  const appName = 'sabdham-android';

  const existing = getApps().find(app => app.name === appName);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_ANDROID_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ANDROID_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_ANDROID_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      'Android Firebase Admin credentials are not configured.'
    );
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  return initializeApp(
    {
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    },
    appName
  );
}

export function getAdminAuth(): Auth | null {
  if (androidAdminAuthInstance) {
    return androidAdminAuthInstance;
  }

  try {
    const app = getAndroidFirebaseApp();
    androidAdminAuthInstance = getAuth(app);
    return androidAdminAuthInstance;
  } catch (err) {
    console.warn(
      '[Firebase Admin] Android Firebase Auth initialization failed:',
      err
    );
    return null;
  }
}

export const adminAuth = {
  verifyIdToken: async (token: string) => {
    const auth = getAdminAuth();

    if (!auth) {
      throw new Error('Android Firebase Admin Auth is not initialized');
    }

    return auth.verifyIdToken(token);
  },
};
