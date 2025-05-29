
export interface Unit {
  id: string;
  name: string;
  abbreviation?: string;
}

export interface CartItem {
  id: string;
  name: string;
  quantity: number;
  selectedUnitId?: string;
  unitName?: string; // For display and storage after selection
}

export interface GatePass {
  id: string;
  responsibleParty: string;
  items: CartItem[];
  createdAt: string; // ISO date string
  generatedText: string;
}

// Keep existing types and add auth types if not in a separate file
// For this example, auth types are in src/types/auth.ts
// If you had other general types, they would remain here.
