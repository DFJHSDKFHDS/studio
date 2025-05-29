
'use client';

import { useState, useEffect, type FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as ReAuthDialogContent,
  AlertDialogDescription as ReAuthDialogDescription,
  AlertDialogFooter as ReAuthDialogFooter,
  AlertDialogHeader as ReAuthDialogHeader,
  AlertDialogTitle as ReAuthDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Added CardHeader and CardTitle
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, PlusCircle, ImagePlus, Loader2, MoreHorizontal, PackageSearch, ShieldCheck, Trash2, Edit, Eye } from 'lucide-react';
import type { Product, Unit, ProductStatus, ProfileData } from '@/types';
import { addProduct, fetchProducts, updateProduct, deleteProduct } from '@/lib/productService';
import { loadProfileData } from '@/lib/profileService';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { EmailAuthProvider, reauthenticateWithCredential, type AuthError } from 'firebase/auth';

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().min(1, "Category is required"),
  stockQuantity: z.coerce.number().min(0, "Stock quantity must be 0 or more"),
  unitId: z.string().min(1, "Unit is required"),
  piecesPerUnit: z.coerce.number().min(1, "Pieces per unit must be at least 1"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  status: z.enum(["In Stock", "Out of Stock", "Low Stock"]),
  image: z.any().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function ProductsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [userUnits, setUserUnits] = useState<Unit[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Add/Edit Dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const editImagePreviewUrlRef = useRef<string | null>(null);


  // Re-authentication Dialog
  const [isReAuthDialogOpen, setIsReAuthDialogOpen] = useState<boolean>(false);
  const [passwordForReAuth, setPasswordForReAuth] = useState<string>('');
  const [actionToConfirm, setActionToConfirm] = useState<'edit' | 'delete' | null>(null);
  const [pendingActionData, setPendingActionData] = useState<any>(null); // Store data for edit/delete

  const [searchTerm, setSearchTerm] = useState<string>('');

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '', sku: '', category: '', stockQuantity: 0, unitId: '', piecesPerUnit: 1, price: 0, status: 'In Stock', image: undefined,
    },
  });

  const editForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {},
  });


  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/dashboard/products');
      return;
    }
    if (user?.uid) {
      setIsLoadingData(true);
      Promise.all([
        fetchProducts(user.uid).then(setProducts).catch(err => {
          console.error("Failed to fetch products:", err);
          toast({ title: "Error", description: `Could not load products: ${err.message}`, variant: "destructive" });
        }),
        loadProfileData(user.uid).then(profile => {
          setUserUnits(profile?.units || []);
          if (!profile?.units?.length) {
            toast({ title: "Setup Required", description: "Please add units in your profile to select them for products.", variant: "default" });
          }
        }).catch(err => {
          console.error("Failed to load profile units:", err);
          toast({ title: "Error", description: `Could not load units: ${err.message}`, variant: "destructive" });
        })
      ]).finally(() => setIsLoadingData(false));
    }
  }, [user, authLoading, router, toast]);

  const openAddDialog = () => {
    form.reset({ name: '', sku: '', category: '', stockQuantity: 0, unitId: userUnits[0]?.id || '', piecesPerUnit: 1, price: 0, status: 'In Stock', image: undefined });
    setIsAddDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setProductToEdit(product);
    editImagePreviewUrlRef.current = product.imageUrl || null;
    editForm.reset({
      name: product.name,
      sku: product.sku,
      category: product.category,
      stockQuantity: product.stockQuantity,
      unitId: product.unitId,
      piecesPerUnit: product.piecesPerUnit,
      price: product.price,
      status: product.status,
      image: undefined, // Image is handled separately or as a FileList
    });
    setIsEditDialogOpen(true);
  };
  
  const handleAddProductSubmit: SubmitHandler<ProductFormValues> = async (values) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    setPendingActionData({ type: 'add', values });
    setActionToConfirm(null); // No re-auth for adding new product directly from here (can be added if needed)
    setIsReAuthDialogOpen(false); // Ensure re-auth is not open
    
    setIsSubmitting(true);
    try {
      const selectedUnit = userUnits.find(u => u.id === values.unitId);
      if (!selectedUnit) {
        toast({ title: "Error", description: "Selected unit not found.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      const imageFile = values.image?.[0];
      const productPayload = {
        name: values.name, sku: values.sku, category: values.category, stockQuantity: values.stockQuantity,
        unitDetails: selectedUnit, piecesPerUnit: values.piecesPerUnit, price: values.price, status: values.status as ProductStatus,
      };
      
      const newProduct = await addProduct(user.uid, productPayload, imageFile);
      setProducts(prev => [...prev, newProduct].sort((a,b) => a.name.localeCompare(b.name)));
      toast({ title: "Product Added", description: `${newProduct.name} has been successfully added.` });
      form.reset();
      setIsAddDialogOpen(false);
    } catch (error) {
      handleSubmissionError("Error Adding Product", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProductSubmit: SubmitHandler<ProductFormValues> = async (values) => {
    if (!productToEdit) return;
    setPendingActionData({ type: 'edit', values, productId: productToEdit.id, existingImageUrl: productToEdit.imageUrl });
    setActionToConfirm('edit');
    setIsReAuthDialogOpen(true);
    setIsEditDialogOpen(false); // Close edit dialog, re-auth will handle next step
  };

  const handleDeleteProduct = (product: Product) => {
    setPendingActionData({ type: 'delete', productId: product.id, imageUrl: product.imageUrl, productName: product.name });
    setActionToConfirm('delete');
    setIsReAuthDialogOpen(true);
  };
  
  const closeReAuthDialog = () => {
    setIsReAuthDialogOpen(false);
    setPasswordForReAuth('');
    setActionToConfirm(null);
    setPendingActionData(null);
    setIsSubmitting(false);
  };

  const handleSubmissionError = (title: string, error: any) => {
    console.error(title, error);
    const errorMessage = error instanceof Error ? error.message : String(error.message || "An unknown error occurred.");
    toast({ title, description: errorMessage, variant: "destructive" });
  };

  const handleReAuthenticationAndSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.email || !passwordForReAuth || !pendingActionData || !actionToConfirm) {
      toast({ title: "Error", description: "Required information for re-authentication is missing.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, passwordForReAuth);
      await reauthenticateWithCredential(user, credential);
      toast({ title: "Re-authentication Successful", description: `Proceeding to ${actionToConfirm} product...` });

      if (actionToConfirm === 'edit') {
        const { values, productId, existingImageUrl } = pendingActionData as { values: ProductFormValues, productId: string, existingImageUrl?: string };
        const selectedUnit = userUnits.find(u => u.id === values.unitId);
        if (!selectedUnit) throw new Error("Selected unit for edit not found.");

        const imageFile = values.image?.[0];
        const productPayload = {
            name: values.name, sku: values.sku, category: values.category, stockQuantity: values.stockQuantity,
            unitDetails: selectedUnit, piecesPerUnit: values.piecesPerUnit, price: values.price, status: values.status as ProductStatus,
        };
        const updated = await updateProduct(user.uid, productId, productPayload, imageFile);
        setProducts(prev => prev.map(p => p.id === updated.id ? updated : p).sort((a,b) => a.name.localeCompare(b.name)));
        toast({ title: "Product Updated", description: `${updated.name} has been successfully updated.` });

      } else if (actionToConfirm === 'delete') {
        const { productId, imageUrl, productName } = pendingActionData as { productId: string, imageUrl?: string, productName: string };
        await deleteProduct(user.uid, productId, imageUrl);
        setProducts(prev => prev.filter(p => p.id !== productId));
        toast({ title: "Product Deleted", description: `${productName} has been successfully deleted.` });
      }
      closeReAuthDialog();

    } catch (error: any) {
      console.error(`${actionToConfirm} product failed:`, error);
      let errorMessage = "An unknown error occurred.";
      if (error instanceof Error) {
         errorMessage = error.message;
      } else if (error && error.code && (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential')) {
          errorMessage = "Incorrect password. Please try again.";
      } else if (error && error.message) {
          errorMessage = String(error.message);
      }
      
      toast({ 
        title: `${actionToConfirm.charAt(0).toUpperCase() + actionToConfirm.slice(1)} Product Failed`, 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
      // Keep re-auth dialog open on error if it's a password issue, otherwise close it
      if (!(error && error.code && (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential'))) {
        // if error is not wrong password, then it could be a different issue (e.g. product service error)
        // in that case, closing the re-auth dialog makes sense.
         if (actionToConfirm) closeReAuthDialog(); // only if action was set.
      }
    }
  };


  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a,b) => a.name.localeCompare(b.name));


  if (authLoading || (isLoadingData && !products.length && !userUnits.length)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Products...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="outline" size="icon" className="mr-4" onClick={() => router.push('/dashboard/generate-gate-pass')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Manage Products</h1>
        </div>
        <Button onClick={openAddDialog}>
          <PlusCircle className="mr-2 h-5 w-5" /> Add Product
        </Button>
      </header>

      {/* Add Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>Fill in the details for the new product.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleAddProductSubmit)} className="grid gap-4 py-4">
             {/* Form fields from original dialog */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" {...form.register("name")} className="col-span-3" />
              {form.formState.errors.name && <p className="col-span-1 col-start-2 text-red-500 text-xs">{form.formState.errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sku" className="text-right">SKU</Label>
              <Input id="sku" {...form.register("sku")} className="col-span-3" />
              {form.formState.errors.sku && <p className="col-span-1 col-start-2 text-red-500 text-xs">{form.formState.errors.sku.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">Category</Label>
              <Input id="category" {...form.register("category")} className="col-span-3" />
              {form.formState.errors.category && <p className="col-span-1 col-start-2 text-red-500 text-xs">{form.formState.errors.category.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="stockQuantity" className="text-right">Stock Qty</Label>
              <Input id="stockQuantity" type="number" {...form.register("stockQuantity")} className="col-span-3" />
              {form.formState.errors.stockQuantity && <p className="col-span-1 col-start-2 text-red-500 text-xs">{form.formState.errors.stockQuantity.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unitId" className="text-right">Unit</Label>
              <Controller
                control={form.control}
                name="unitId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={userUnits.length === 0}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder={userUnits.length === 0 ? "No units defined in profile" : "Select unit"} />
                    </SelectTrigger>
                    <SelectContent>
                      {userUnits.map(unit => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name} ({unit.abbreviation || unit.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.unitId && <p className="col-span-1 col-start-2 text-red-500 text-xs">{form.formState.errors.unitId.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="piecesPerUnit" className="text-right">Pcs / Unit</Label>
              <Input id="piecesPerUnit" type="number" {...form.register("piecesPerUnit")} className="col-span-3" />
              {form.formState.errors.piecesPerUnit && <p className="col-span-1 col-start-2 text-red-500 text-xs">{form.formState.errors.piecesPerUnit.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">Price</Label>
              <Input id="price" type="number" step="0.01" {...form.register("price")} className="col-span-3" />
              {form.formState.errors.price && <p className="col-span-1 col-start-2 text-red-500 text-xs">{form.formState.errors.price.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">Status</Label>
              <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value} >
                          <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="In Stock">In Stock</SelectItem>
                              <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                              <SelectItem value="Low Stock">Low Stock</SelectItem>
                          </SelectContent>
                      </Select>
                  )}
              />
              {form.formState.errors.status && <p className="col-span-1 col-start-2 text-red-500 text-xs">{form.formState.errors.status.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="image" className="text-right flex items-center"><ImagePlus className="mr-1 h-4 w-4"/>Image</Label>
              <Input id="image" type="file" accept="image/*" {...form.register("image")} className="col-span-3 file:text-primary file:font-medium" />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Adding...' : 'Add Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product: {productToEdit?.name}</DialogTitle>
            <DialogDescription>Update the details for this product.</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEditProductSubmit)} className="grid gap-4 py-4">
            {/* Fields similar to Add Product, pre-filled */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Name</Label>
              <Input id="edit-name" {...editForm.register("name")} className="col-span-3" />
               {editForm.formState.errors.name && <p className="col-span-1 col-start-2 text-red-500 text-xs">{editForm.formState.errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-sku" className="text-right">SKU</Label>
              <Input id="edit-sku" {...editForm.register("sku")} className="col-span-3" />
              {editForm.formState.errors.sku && <p className="col-span-1 col-start-2 text-red-500 text-xs">{editForm.formState.errors.sku.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-category" className="text-right">Category</Label>
              <Input id="edit-category" {...editForm.register("category")} className="col-span-3" />
              {editForm.formState.errors.category && <p className="col-span-1 col-start-2 text-red-500 text-xs">{editForm.formState.errors.category.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-stockQuantity" className="text-right">Stock Qty</Label>
              <Input id="edit-stockQuantity" type="number" {...editForm.register("stockQuantity")} className="col-span-3" />
              {editForm.formState.errors.stockQuantity && <p className="col-span-1 col-start-2 text-red-500 text-xs">{editForm.formState.errors.stockQuantity.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-unitId" className="text-right">Unit</Label>
              <Controller
                control={editForm.control}
                name="unitId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={userUnits.length === 0}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder={userUnits.length === 0 ? "No units in profile" : "Select unit"} />
                    </SelectTrigger>
                    <SelectContent>
                      {userUnits.map(unit => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name} ({unit.abbreviation || unit.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {editForm.formState.errors.unitId && <p className="col-span-1 col-start-2 text-red-500 text-xs">{editForm.formState.errors.unitId.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-piecesPerUnit" className="text-right">Pcs / Unit</Label>
              <Input id="edit-piecesPerUnit" type="number" {...editForm.register("piecesPerUnit")} className="col-span-3" />
              {editForm.formState.errors.piecesPerUnit && <p className="col-span-1 col-start-2 text-red-500 text-xs">{editForm.formState.errors.piecesPerUnit.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-price" className="text-right">Price</Label>
              <Input id="edit-price" type="number" step="0.01" {...editForm.register("price")} className="col-span-3" />
              {editForm.formState.errors.price && <p className="col-span-1 col-start-2 text-red-500 text-xs">{editForm.formState.errors.price.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-status" className="text-right">Status</Label>
              <Controller
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="In Stock">In Stock</SelectItem>
                              <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                              <SelectItem value="Low Stock">Low Stock</SelectItem>
                          </SelectContent>
                      </Select>
                  )}
              />
              {editForm.formState.errors.status && <p className="col-span-1 col-start-2 text-red-500 text-xs">{editForm.formState.errors.status.message}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-image" className="text-right flex items-center"><ImagePlus className="mr-1 h-4 w-4"/>Image</Label>
                <div className="col-span-3">
                    {editImagePreviewUrlRef.current && !editForm.watch("image")?.[0] && (
                        <div className="mb-2">
                            <Image src={editImagePreviewUrlRef.current} alt="Current product image" width={80} height={80} className="rounded-md object-cover aspect-square" data-ai-hint="product item" />
                            <p className="text-xs text-muted-foreground mt-1">Current image. Upload a new one to replace.</p>
                        </div>
                    )}
                    <Input id="edit-image" type="file" accept="image/*" {...editForm.register("image")} className="file:text-primary file:font-medium" />
                </div>
            </div>

            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && actionToConfirm === 'edit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Re-authentication Dialog */}
      <AlertDialog open={isReAuthDialogOpen} onOpenChange={(open) => {
          if (!open) closeReAuthDialog(); else setIsReAuthDialogOpen(true);
        }}>
        <ReAuthDialogContent className="sm:max-w-md">
          <ReAuthDialogHeader>
            <ReAuthDialogTitle className="flex items-center">
              <ShieldCheck className="mr-2 h-6 w-6 text-primary"/>
              {actionToConfirm === 'edit' ? "Confirm Product Update" : "Confirm Product Deletion"}
            </ReAuthDialogTitle>
            <ReAuthDialogDescription>
              {actionToConfirm === 'edit' 
                ? `Enter your password to update ${pendingActionData?.values?.name || productToEdit?.name || 'this product'}.`
                : `Enter your password to delete ${pendingActionData?.productName || 'this product'}. This action cannot be undone.`
              }
            </ReAuthDialogDescription>
          </ReAuthDialogHeader>
          {actionToConfirm === 'edit' && pendingActionData?.values && (
            <Card className="my-2 max-h-[20vh] overflow-y-auto border shadow-inner bg-muted/30">
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-md flex items-center">
                  <Eye className="mr-2 h-4 w-4" /> Update Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1 text-xs">
                <p><strong>Name:</strong> {pendingActionData.values.name}</p>
                <p><strong>SKU:</strong> {pendingActionData.values.sku}</p>
                <p><strong>Stock:</strong> {pendingActionData.values.stockQuantity} {userUnits.find(u => u.id === pendingActionData.values.unitId)?.abbreviation || ''}</p>
                 {pendingActionData.values.image?.[0] && <p><strong>New Image:</strong> {pendingActionData.values.image[0].name}</p>}
              </CardContent>
            </Card>
          )}
          <form onSubmit={handleReAuthenticationAndSubmit}>
            <div className="space-y-2">
              <Label htmlFor="reauth-password-product">Password</Label>
              <Input 
                id="reauth-password-product" 
                type="password" 
                value={passwordForReAuth} 
                onChange={(e) => setPasswordForReAuth(e.target.value)} 
                placeholder="Enter your password" 
                required 
              />
            </div>
            <ReAuthDialogFooter className="mt-4">
              <AlertDialogCancel onClick={closeReAuthDialog} disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <Button type="submit" disabled={isSubmitting} variant={actionToConfirm === 'delete' ? 'destructive' : 'default'}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {actionToConfirm === 'edit' ? "Confirm Update" : "Confirm Delete"}
              </Button>
            </ReAuthDialogFooter>
          </form>
        </ReAuthDialogContent>
      </AlertDialog>


      <div className="mb-4">
        <Input
          placeholder="Search products by name, SKU, or category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      {isLoadingData && products.length === 0 && <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mr-2"/> <p>Loading product data...</p></div>}
      {!isLoadingData && filteredProducts.length === 0 && (
        <Card className="mt-4">
          <CardContent className="p-6 text-center">
            <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold">No Products Found</h3>
            <p className="text-muted-foreground">
              {products.length === 0 ? "Get started by adding your first product." : "No products match your search."}
            </p>
          </CardContent>
        </Card>
      )}

      {filteredProducts.length > 0 && (
        <Card className="shadow-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Pcs/Unit</TableHead>
                <TableHead>Total Pcs</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const totalPieces = product.stockQuantity * product.piecesPerUnit;
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Image
                        src={product.imageUrl || "https://placehold.co/64x64.png"}
                        alt={product.name}
                        width={48}
                        height={48}
                        className="rounded-md object-cover aspect-square"
                        data-ai-hint="product package"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.sku}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>{product.stockQuantity} {product.unitAbbreviation || product.unitName}</TableCell>
                    <TableCell>{product.piecesPerUnit}</TableCell>
                    <TableCell>{totalPieces}</TableCell>
                    <TableCell className="text-right">₹{product.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={product.status === "In Stock" ? "default" : product.status === "Out of Stock" ? "destructive" : "secondary"}>
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Product Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(product)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteProduct(product)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}

