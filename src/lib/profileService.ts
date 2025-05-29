
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
      return null;
    }
  } catch (error) {
    console.error('Error loading profile data from RTDB:', error);
    // Return null to allow the UI to handle it, e.g., by showing an error toast
    return null; 
  }
}

// The previous import of getDatabase here was unused and potentially confusing.
// Removed: import { getDatabase } from 'firebase/database';
