
'use server';

import { rtdb, storage } from './firebaseConfig';
import { ref as dbRef, set, get, push, child, serverTimestamp, update, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { Product, Unit, ProductStatus, IncomingStockLogEntry, OutgoingStockLogEntry } from '@/types';

export async function addProduct(
  uid: string,
  productData: Omit<Product, 'id' | 'createdAt' | 'imageUrl' | 'unitName' | 'unitAbbreviation'> & { unitDetails: Unit },
  imageFile?: File
): Promise<Product> {
  if (!uid) throw new Error('User ID is required to add a product.');

  let imageUrl: string | undefined = undefined;

  if (imageFile) {
    const imagePath = `stockflow/${uid}/product_images/${Date.now()}_${imageFile.name}`;
    const imageStorageRefInstance = storageRef(storage, imagePath);
    await uploadBytes(imageStorageRefInstance, imageFile);
    imageUrl = await getDownloadURL(imageStorageRefInstance);
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

export async function updateProduct(
  uid: string,
  productId: string,
  productUpdateData: Partial<Omit<Product, 'id' | 'createdAt' | 'unitName' | 'unitAbbreviation'>> & { unitDetails?: Unit },
  newImageFile?: File
): Promise<Product> {
  if (!uid) throw new Error('User ID is required to update a product.');
  if (!productId) throw new Error('Product ID is required.');

  const productRef = dbRef(rtdb, `stockflow/${uid}/products/${productId}`);
  const snapshot = await get(productRef);
  if (!snapshot.exists()) {
    throw new Error('Product not found.');
  }
  const existingProduct = snapshot.val() as Product;
  let newImageUrl = existingProduct.imageUrl;

  // Handle image update
  if (newImageFile) {
    // Delete old image if it exists
    if (existingProduct.imageUrl) {
      try {
        const oldImageStorageRef = storageRef(storage, existingProduct.imageUrl);
        await deleteObject(oldImageStorageRef);
      } catch (error) {
        // Log error but don't block update if old image deletion fails
        console.warn(`Failed to delete old image for product ${productId}:`, error);
      }
    }
    // Upload new image
    const imagePath = `stockflow/${uid}/product_images/${Date.now()}_${newImageFile.name}`;
    const newImageStorageRefInstance = storageRef(storage, imagePath);
    await uploadBytes(newImageStorageRefInstance, newImageFile);
    newImageUrl = await getDownloadURL(newImageStorageRefInstance);
  }

  const { unitDetails, ...restOfUpdateData } = productUpdateData;
  const finalUpdateData: Partial<Product> = {
    ...restOfUpdateData,
    imageUrl: newImageUrl, // Use the new or existing image URL
  };

  if (unitDetails) {
    finalUpdateData.unitId = unitDetails.id;
    finalUpdateData.unitName = unitDetails.name;
    finalUpdateData.unitAbbreviation = unitDetails.abbreviation;
  }
  
  // Ensure stock quantity changes update status
  if (finalUpdateData.stockQuantity !== undefined) {
    if (finalUpdateData.stockQuantity <= 0) {
        finalUpdateData.status = "Out of Stock";
    } else if (existingProduct.status === "Out of Stock" && finalUpdateData.stockQuantity > 0) {
        finalUpdateData.status = "In Stock";
    } // Note: Low stock logic might need specific thresholds not covered here
  }


  await update(productRef, finalUpdateData);
  return { ...existingProduct, ...finalUpdateData } as Product;
}

export async function deleteProduct(uid: string, productId: string, imageUrl?: string): Promise<void> {
  if (!uid) throw new Error('User ID is required to delete a product.');
  if (!productId) throw new Error('Product ID is required.');

  // Delete image from storage if URL is provided
  if (imageUrl) {
    try {
      const imageStorageRef = storageRef(storage, imageUrl);
      await deleteObject(imageStorageRef);
    } catch (error) {
      // Log error but proceed with deleting database entry
      console.warn(`Failed to delete image for product ${productId} from storage:`, error);
    }
  }

  // Delete product from RTDB
  const productRef = dbRef(rtdb, `stockflow/${uid}/products/${productId}`);
  await remove(productRef);
}


export async function fetchProducts(uid: string): Promise<Product[]> {
  if (!uid) throw new Error('User ID is required to fetch products.');
  try {
    const productsPath = `stockflow/${uid}/products`;
    const productsRef = dbRef(rtdb, productsPath);
    const snapshot = await get(productsRef);
    if (snapshot.exists()) {
      const productsData = snapshot.val();
      return Object.keys(productsData).map(key => ({
        ...productsData[key],
        id: key 
      }));
    }
    return []; 
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
      newStatus = "In Stock"; 
    }
    
    const updates: Partial<Product> = {
      stockQuantity: newStockQuantity,
      status: newStatus,
    };

    await update(productRef, updates);
    return { ...product, ...updates }; 

  } catch (error) {
    console.error('Error updating product stock:', error);
    throw error;
  }
}

export async function decrementProductStock(
  uid: string,
  productId: string,
  quantityToDecrement: number,
  unit: 'main' | 'pieces'
): Promise<Product> {
  if (!uid) throw new Error('User ID is required.');
  if (!productId) throw new Error('Product ID is required.');
  if (quantityToDecrement <= 0) throw new Error('Quantity to decrement must be positive.');

  const productRef = dbRef(rtdb, `stockflow/${uid}/products/${productId}`);
  
  try {
    const snapshot = await get(productRef);
    if (!snapshot.exists()) {
      throw new Error(`Product with ID ${productId} not found.`);
    }

    const product = snapshot.val() as Product;
    let newStockQuantity: number;

    if (unit === 'main') {
      newStockQuantity = (product.stockQuantity || 0) - quantityToDecrement;
    } else { 
      if (!product.piecesPerUnit || product.piecesPerUnit <= 0) {
        throw new Error(`Product ${product.name} (ID: ${productId}) has an invalid 'piecesPerUnit' configuration: ${product.piecesPerUnit}. It must be a positive number to decrement by pieces.`);
      }
      const currentStockInPieces = (product.stockQuantity || 0) * product.piecesPerUnit;
      const newStockInPieces = currentStockInPieces - quantityToDecrement;

      if (newStockInPieces < 0) {
        throw new Error(`Not enough stock for ${product.name}. Requested to remove ${quantityToDecrement} pieces, but only ${currentStockInPieces} pieces available.`);
      }
      newStockQuantity = newStockInPieces / product.piecesPerUnit;
    }

    if (newStockQuantity < 0 && unit === 'main') { 
         throw new Error(`Not enough stock for ${product.name}. Requested to remove ${quantityToDecrement} ${product.unitName || 'main units'}, leading to negative stock.`);
    }
    
    newStockQuantity = Math.max(0, newStockQuantity); 


    let newStatus: ProductStatus = product.status;
    if (newStockQuantity <= 0) {
      newStatus = "Out of Stock";
      newStockQuantity = 0;
    } else { 
      newStatus = "In Stock";
    }
    
    const updates: Partial<Product> = {
      stockQuantity: newStockQuantity,
      status: newStatus,
    };

    await update(productRef, updates);
    return { ...product, ...updates };

  } catch (error) {
    console.error(`Error decrementing product stock for ${productId}:`, error);
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

export async function fetchIncomingStockLogs(uid: string): Promise<IncomingStockLogEntry[]> {
  if (!uid) throw new Error('User ID is required to fetch incoming stock logs.');
  try {
    const logsPath = `stockflow/${uid}/incomingStockLog`;
    const logsRef = dbRef(rtdb, logsPath);
    const snapshot = await get(logsRef);
    if (snapshot.exists()) {
      const logsData = snapshot.val();
      return Object.keys(logsData)
        .map(key => ({
          ...logsData[key],
          id: key,
        }))
        .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
    }
    return []; 
  } catch (error) {
    console.error('Error fetching incoming stock logs from RTDB:', error);
    throw error;
  }
}

export async function addOutgoingStockLog(uid: string, logEntryData: Omit<OutgoingStockLogEntry, 'id' | 'loggedAt'>): Promise<OutgoingStockLogEntry> {
  if (!uid) throw new Error('User ID is required to log outgoing stock.');

  const logRef = dbRef(rtdb, `stockflow/${uid}/outgoingStockLog`);
  const newLogRef = push(logRef);
  const logId = newLogRef.key;

  if (!logId) throw new Error('Failed to generate log ID.');

  const finalLogEntry: OutgoingStockLogEntry = {
    ...logEntryData,
    id: logId,
    loggedAt: new Date().toISOString(),
  };

  await set(newLogRef, finalLogEntry);
  return finalLogEntry;
}

export async function fetchOutgoingStockLogs(uid: string): Promise<OutgoingStockLogEntry[]> {
  if (!uid) throw new Error('User ID is required to fetch outgoing stock logs.');
  try {
    const logsPath = `stockflow/${uid}/outgoingStockLog`;
    const logsRef = dbRef(rtdb, logsPath);
    const snapshot = await get(logsRef);
    if (snapshot.exists()) {
      const logsData = snapshot.val();
      return Object.keys(logsData)
        .map(key => ({
          ...logsData[key],
          id: key,
        }))
        .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
    }
    return [];
  } catch (error) {
    console.error('Error fetching outgoing stock logs from RTDB:', error);
    throw error;
  }
}
