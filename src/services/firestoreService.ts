import {
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';

export interface FirestoreUserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  createdAt?: any;
}

export async function syncUserProfileToFirestore(profile: FirestoreUserProfile): Promise<void> {
  // Only attempt Firestore write if the client is authenticated via Firebase Auth (e.g., Google Sign-In)
  if (!auth.currentUser || auth.currentUser.uid !== profile.uid) {
    return;
  }
  const path = `users/${profile.uid}`;
  try {
    const userDocRef = doc(db, 'users', profile.uid);
    const data: Record<string, any> = {
      uid: profile.uid,
      email: profile.email,
      createdAt: serverTimestamp(),
    };
    if (profile.displayName) data.displayName = profile.displayName;
    if (profile.photoUrl) data.photoUrl = profile.photoUrl;

    await setDoc(userDocRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function addFavoriteToFirestore(userId: string, trackId: string): Promise<void> {
  const path = `users/${userId}/favorites/${trackId}`;
  try {
    const favRef = doc(db, 'users', userId, 'favorites', trackId);
    await setDoc(favRef, {
      userUid: userId,
      trackId,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeFavoriteFromFirestore(userId: string, trackId: string): Promise<void> {
  const path = `users/${userId}/favorites/${trackId}`;
  try {
    const favRef = doc(db, 'users', userId, 'favorites', trackId);
    await deleteDoc(favRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getUserFavoritesFromFirestore(userId: string): Promise<string[]> {
  const path = `users/${userId}/favorites`;
  try {
    const colRef = collection(db, 'users', userId, 'favorites');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((d) => d.id);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
