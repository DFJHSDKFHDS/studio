

export interface Unit {
  id: string; // Should be unique, e.g., lowercase name or generated
  name: string;
  abbreviation?: string;
}

export interface CartItem { // This type seems to be from an older iteration and might not be directly used by GatePassCartItem
  id: string;
  name: string;
  quantity: number;
  selectedUnitId?: string;
  unitName?: string; // For display and storage after selection
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
  stockQuantity: number; 
  unitId: string; 
  unitName: string; 
  unitAbbreviation?: string; 
  piecesPerUnit: number; 
  price: number; 
  status: ProductStatus;
  imageUrl?: string;
  createdAt: string; // ISO date string
}

// Specific type for items in the gate pass generation cart
export interface GatePassCartItem extends Product {
  quantityInCart: number;
  selectedUnitForIssuance: 'main' | 'pieces'; // 'main' refers to the product's primary unit, 'pieces' for individual pieces
  priceInCart: number; // Price per selectedUnitForIssuance
}

// Gate Pass structure (if you decide to save the entire pass object)
export interface GatePass {
  id: string; // The unique gatePassId
  issuedTo: string; // Employee who created/authorized
  destination: string; // Customer name or where it's going
  reason?: string; // Optional reason, might be derived from dispatch date now
  dispatchDate: string; // ISO date string for dispatch
  items: OutgoingStockLogEntry[]; // References to the logged items
  createdAt: string; // ISO date string when the pass was generated
  generatedText?: string; // The actual text of the pass, if stored
}


// Incoming Stock Log Entry
export interface IncomingStockLogEntry {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  quantityAdded: number;
  unitId: string; 
  unitName: string;
  unitAbbreviation?: string;
  arrivalDate: string; // ISO string for the selected date
  poNumber?: string;
  supplier?: string;
  loggedAt: string; // ISO string for when the log entry was created (submission time)
}

// Outgoing Stock Log Entry
export interface OutgoingStockLogEntry {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  quantityRemoved: number;
  unitId: string; // Can be product's main unitId or 'pcs'
  unitName: string; // Name of the unit removed (e.g., "Box" or "Piece")
  unitAbbreviation?: string; // Abbreviation of unit removed (e.g., "bx" or "pcs")
  loggedAt: string; // ISO string for when the log entry was created (e.g., gate pass generation time)
  destination?: string; // Customer name
  reason?: string; // Optional - e.g., "Dispatched on MMM dd, yyyy" or custom reason
  gatePassId?: string; // To link to the actual gate pass document/entry
  issuedTo?: string; // Employee name who authorized/created the pass
}

// For displaying product list in Generate Gate Pass (could be simpler than full Product if needed)
export interface ProductListItem extends Pick<Product, 'id' | 'name' | 'sku' | 'imageUrl' | 'category' | 'stockQuantity' | 'unitName' | 'unitAbbreviation' | 'price' | 'piecesPerUnit'> {}

