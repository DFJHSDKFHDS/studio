
'use server';

import { rtdb, storage } from './firebaseConfig';
import { ref as dbRef, set, get, push, child, serverTimestamp, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Product, Unit, ProductStatus, IncomingStockLogEntry } from '@/types';

export async function addProduct(
  uid: string,
  productData: Omit<Product, 'id' | 'createdAt' | 'imageUrl' | 'unitName' | 'unitAbbreviation'> & { unitDetails: Unit },
  imageFile?: File
): Promise<Product> {
  if (!uid) throw new Error('User ID is required to add a product.');

  let imageUrl: string | undefined = undefined;

  if (imageFile) {
    const imagePath = `stockflow/${uid}/product_images/${Date.now()}_${imageFile.name}`;
    const imageStorageRef = storageRef(storage, imagePath);
    await uploadBytes(imageStorageRef, imageFile);
    imageUrl = await getDownloadURL(imageStorageRef);
  }

  const productsRef = dbRef(rtdb, `stockflow/${uid}/products`);
  const newProductRef = push(productsRef);
  const productId = newProductRef.key;

  if (!productId) throw new Error('Failed to generate product ID.');
  
  const { unitDetails, ...restOfProductData } = productData;

  const finalProductData: Product = {
    ...restOfProductData,
    id: productId,
    unitId: unitDetails.id,
    unitName: unitDetails.name,
    unitAbbreviation: unitDetails.abbreviation,
    imageUrl,
    createdAt: new Date().toISOString(), 
  };

  await set(newProductRef, finalProductData);
  return finalProductData;
}

export async function fetchProducts(uid: string): Promise<Product[]> {
  if (!uid) throw new Error('User ID is required to fetch products.');
  try {
    const productsPath = `stockflow/${uid}/products`;
    const productsRef = dbRef(rtdb, productsPath);
    const snapshot = await get(productsRef);
    if (snapshot.exists()) {
      const productsData = snapshot.val();
      // Convert products object into an array
      return Object.keys(productsData).map(key => ({
        ...productsData[key],
        id: key // Ensure the id is part of the product object
      }));
    }
    return []; // No products found
  } catch (error) {
    console.error('Error fetching products from RTDB:', error);
    throw error;
  }
}

export async function updateProductStock(uid: string, productId: string, quantityToAdd: number): Promise<Product> {
  if (!uid) throw new Error('User ID is required.');
  if (!productId) throw new Error('Product ID is required.');
  if (quantityToAdd <= 0) throw new Error('Quantity to add must be positive.');

  const productRef = dbRef(rtdb, `stockflow/${uid}/products/${productId}`);
  
  try {
    const snapshot = await get(productRef);
    if (!snapshot.exists()) {
      throw new Error('Product not found.');
    }

    const product = snapshot.val() as Product;
    const newStockQuantity = (product.stockQuantity || 0) + quantityToAdd;

    let newStatus: ProductStatus = product.status;
    if (newStockQuantity <= 0) {
      newStatus = "Out of Stock";
    } else {
      // Basic logic: if it was out of stock or low stock, and now has items, it's "In Stock".
      // More complex "Low Stock" logic would require a threshold.
      newStatus = "In Stock"; 
    }
    
    const updates: Partial<Product> = {
      stockQuantity: newStockQuantity,
      status: newStatus,
    };

    await update(productRef, updates);
    return { ...product, ...updates }; // Return the updated product object

  } catch (error) {
    console.error('Error updating product stock:', error);
    throw error;
  }
}

export async function addIncomingStockLog(uid: string, logEntryData: Omit<IncomingStockLogEntry, 'id' | 'loggedAt'>): Promise<IncomingStockLogEntry> {
  if (!uid) throw new Error('User ID is required to log incoming stock.');

  const logRef = dbRef(rtdb, `stockflow/${uid}/incomingStockLog`);
  const newLogRef = push(logRef);
  const logId = newLogRef.key;

  if (!logId) throw new Error('Failed to generate log ID.');

  const finalLogEntry: IncomingStockLogEntry = {
    ...logEntryData,
    id: logId,
    loggedAt: new Date().toISOString(),
  };

  await set(newLogRef, finalLogEntry);
  return finalLogEntry;
}
