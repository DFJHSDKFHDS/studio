import type { Unit } from '@/types';

// In a real application, you would fetch this from Firebase:
// import { collection, getDocs } from "firebase/firestore";
// import { db } from "./firebaseConfig"; // Assuming db is exported from firebaseConfig after initialization

const MOCK_USER_ID = "testUser"; // Placeholder

export async function fetchUnits(userId: string = MOCK_USER_ID): Promise<Unit[]> {
  console.log(`Fetching units for userId: ${userId}`);
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));

  // Mock data - In a real app, this would come from:
  // const unitsCollectionRef = collection(db, `Stockflow/${userId}/profileData/units`);
  // const querySnapshot = await getDocs(unitsCollectionRef);
  // const units = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
  // return units;

  // For now, return mock units
  return [
    { id: 'kg', name: 'Kilogram', abbreviation: 'kg' },
    { id: 'pcs', name: 'Pieces', abbreviation: 'pcs' },
    { id: 'ltr', name: 'Liter', abbreviation: 'ltr' },
    { id: 'box', name: 'Box', abbreviation: 'box' },
    { id: 'mtr', name: 'Meter', abbreviation: 'm' },
  ];
}
