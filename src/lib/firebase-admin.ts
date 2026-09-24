import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

let adminAuthInstance: Auth | null = null;

export function getAdminAuth(): Auth | null {
  if (adminAuthInstance) {
    return adminAuthInstance;
  }
  try {
    if (!getApps().length) {
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
    const app = getApps()[0];
    adminAuthInstance = getAuth(app);
    return adminAuthInstance;
  } catch (err) {
    console.warn('[Firebase Admin] Notice: Firebase Admin Auth not initialized (will operate in standard auth mode):', err);
    return null;
  }
}

export const adminAuth = {
  verifyIdToken: async (token: string) => {
    const auth = getAdminAuth();
    if (!auth) {
      throw new Error('Firebase Admin Auth is not initialized');
    }
    return auth.verifyIdToken(token);
  },
};
