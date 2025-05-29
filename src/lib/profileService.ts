
'use server';

import { rtdb } from './firebaseConfig';
import { ref, set, get, child } from 'firebase/database';
import type { ProfileData } from '@/types';

export async function saveProfileData(uid: string, data: ProfileData): Promise<void> {
  if (!uid) throw new Error('User ID is required to save profile data.');
  try {
    const profileRef = ref(rtdb, `stockflow/${uid}/profileData`);
    await set(profileRef, data);
  } catch (error) {
    console.error('Error saving profile data to RTDB:', error);
    throw error;
  }
}

export async function loadProfileData(uid: string): Promise<ProfileData | null> {
  if (!uid) throw new Error('User ID is required to load profile data.');
  try {
    const dbRef = ref(getDatabase());
    const snapshot = await get(child(dbRef, `stockflow/${uid}/profileData`));
    if (snapshot.exists()) {
      return snapshot.val() as ProfileData;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error loading profile data from RTDB:', error);
    // It's often better not to throw here but return null and let UI handle it
    // unless it's a critical error that should halt execution.
    return null;
  }
}

// Helper to get the RTDB instance, used by loadProfileData
// This is because getDatabase() needs to be called on the client or in an environment where firebase/app is initialized.
// However, since we are in a 'use server' file, rtdb from firebaseConfig should already be initialized.
// For consistency with Firebase modular SDK:
import { getDatabase } from 'firebase/database';
