import type { GatePass } from '@/types';

const GATEPASS_STORAGE_KEY = 'stockflow_gatepasses';

export function saveGatePassToLocalStorage(gatePass: GatePass): void {
  try {
    const existingPasses = getAllGatePassesFromLocalStorage();
    const updatedPasses = [...existingPasses, gatePass];
    localStorage.setItem(GATEPASS_STORAGE_KEY, JSON.stringify(updatedPasses));
  } catch (error) {
    console.error("Error saving gate pass to local storage:", error);
    // Optionally, inform the user via a toast notification
  }
}

export function getAllGatePassesFromLocalStorage(): GatePass[] {
  try {
    const rawData = localStorage.getItem(GATEPASS_STORAGE_KEY);
    return rawData ? JSON.parse(rawData) : [];
  } catch (error) {
    console.error("Error retrieving gate passes from local storage:", error);
    return [];
  }
}

// Example of how you might load a specific gate pass if needed
export function getGatePassByIdFromLocalStorage(id: string): GatePass | undefined {
  const passes = getAllGatePassesFromLocalStorage();
  return passes.find(pass => pass.id === id);
}
