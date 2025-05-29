
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

// Profile Data types
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

// Product type
export type ProductStatus = "In Stock" | "Out of Stock" | "Low Stock";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  stockQuantity: number; // Quantity of the main unit (e.g., 10 for "10 Boxes")
  unitId: string; // ID of the main unit used for stockQuantity
  unitName: string; // Name of the main unit (e.g., "Box")
  unitAbbreviation?: string; // Abbreviation of the main unit (e.g., "bx")
  piecesPerUnit: number; // How many individual pieces are in one main unit (e.g., 10 pieces per box)
  price: number; // Price per main unit or per piece, clarify based on business logic (assuming per main unit for now)
  status: ProductStatus;
  imageUrl?: string;
  createdAt: string; // ISO date string
  // totalPieces can be derived: stockQuantity * piecesPerUnit
}
