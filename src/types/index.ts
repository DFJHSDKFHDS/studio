
export interface Unit {
  id: string; // Should be unique, e.g., lowercase name or generated
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

// New types for Profile Data
export interface ShopDetails {
  shopName: string;
  contactNumber: string;
  address: string;
}

export interface ProfileData {
  shopDetails: ShopDetails;
  employees: string[];
  units: Unit[];
}
