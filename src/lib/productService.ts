
'use server';

import { rtdb, storage } from './firebaseConfig';
import { ref as dbRef, set, get, push, child, serverTimestamp } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Product, Unit } from '@/types';

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

// Placeholder for future update and delete functions
// export async function updateProduct(uid: string, productId: string, updatedData: Partial<Product>, imageFile?: File): Promise<void> {}
// export async function deleteProduct(uid: string, productId: string): Promise<void> {}
