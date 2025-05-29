
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
    throw error; // Re-throw the error to be caught by the calling function
  }
}

export async function loadProfileData(uid: string): Promise<ProfileData | null> {
  if (!uid) throw new Error('User ID is required to load profile data.');
  try {
    // Use the rtdb instance imported from firebaseConfig directly
    const profileRef = ref(rtdb, `stockflow/${uid}/profileData`);
    const snapshot = await get(profileRef);
    if (snapshot.exists()) {
      return snapshot.val() as ProfileData;
    } else {
      return null; // No data exists for this user yet, this is a normal case.
    }
  } catch (error) {
    console.error('Error loading profile data from RTDB:', error);
    throw error; // Re-throw the error so the UI can display a more specific message.
  }
}

