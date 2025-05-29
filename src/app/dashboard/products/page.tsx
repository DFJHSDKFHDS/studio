
'use client';

import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Though not explicitly in form, good to have
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
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, PlusCircle, ImagePlus, Loader2, MoreHorizontal, PackageSearch } from 'lucide-react';
import type { Product, Unit, ProductStatus, ProfileData } from '@/types';
import { addProduct, fetchProducts } from '@/lib/productService';
import { loadProfileData } from '@/lib/profileService'; // To fetch units
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().min(1, "Category is required"),
  stockQuantity: z.coerce.number().min(0, "Stock quantity must be 0 or more"),
  unitId: z.string().min(1, "Unit is required"),
  piecesPerUnit: z.coerce.number().min(1, "Pieces per unit must be at least 1"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  status: z.enum(["In Stock", "Out of Stock", "Low Stock"]),
  image: z.instanceof(FileList).optional(),
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
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sku: '',
      category: '',
      stockQuantity: 0,
      unitId: '',
      piecesPerUnit: 1,
      price: 0,
      status: 'In Stock',
    },
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

  const onSubmit = async (values: ProductFormValues) => {
    if (!user?.uid) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    
    const selectedUnit = userUnits.find(u => u.id === values.unitId);
    if (!selectedUnit) {
        toast({ title: "Error", description: "Selected unit not found.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    try {
      const imageFile = values.image?.[0];
      const productPayload = {
        name: values.name,
        sku: values.sku,
        category: values.category,
        stockQuantity: values.stockQuantity,
        unitDetails: selectedUnit, // Pass the whole unit object
        piecesPerUnit: values.piecesPerUnit,
        price: values.price,
        status: values.status as ProductStatus,
      };
      
      const newProduct = await addProduct(user.uid, productPayload, imageFile);
      setProducts(prev => [...prev, newProduct]);
      toast({ title: "Product Added", description: `${newProduct.name} has been successfully added.` });
      form.reset();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Failed to add product:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({ title: "Error Adding Product", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-5 w-5" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>Fill in the details for the new product.</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" {...form.register("name")} className="col-span-3" />
                {form.formState.errors.name && <p className="col-span-4 text-red-500 text-xs">{form.formState.errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sku" className="text-right">SKU</Label>
                <Input id="sku" {...form.register("sku")} className="col-span-3" />
                {form.formState.errors.sku && <p className="col-span-4 text-red-500 text-xs">{form.formState.errors.sku.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">Category</Label>
                <Input id="category" {...form.register("category")} className="col-span-3" />
                {form.formState.errors.category && <p className="col-span-4 text-red-500 text-xs">{form.formState.errors.category.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="stockQuantity" className="text-right">Stock Qty</Label>
                <Input id="stockQuantity" type="number" {...form.register("stockQuantity")} className="col-span-3" />
                {form.formState.errors.stockQuantity && <p className="col-span-4 text-red-500 text-xs">{form.formState.errors.stockQuantity.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="unitId" className="text-right">Unit</Label>
                <Controller
                  control={form.control}
                  name="unitId"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={userUnits.length === 0}>
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
                {form.formState.errors.unitId && <p className="col-span-4 text-red-500 text-xs">{form.formState.errors.unitId.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="piecesPerUnit" className="text-right">Pcs / Unit</Label>
                <Input id="piecesPerUnit" type="number" {...form.register("piecesPerUnit")} className="col-span-3" />
                {form.formState.errors.piecesPerUnit && <p className="col-span-4 text-red-500 text-xs">{form.formState.errors.piecesPerUnit.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="price" className="text-right">Price</Label>
                <Input id="price" type="number" step="0.01" {...form.register("price")} className="col-span-3" />
                {form.formState.errors.price && <p className="col-span-4 text-red-500 text-xs">{form.formState.errors.price.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Status</Label>
                <Controller
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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
                {form.formState.errors.status && <p className="col-span-4 text-red-500 text-xs">{form.formState.errors.status.message}</p>}
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
      </header>

      <div className="mb-4">
        <Input
          placeholder="Search products by name, SKU, or category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      {isLoadingData && products.length === 0 && <p>Loading product data...</p>}
      {!isLoadingData && filteredProducts.length === 0 && (
        <Card className="mt-4">
          <CardContent className="p-6 text-center">
            <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold">No Products Found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Try adjusting your search terms." : "Get started by adding your first product."}
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
                      <Button variant="ghost" size="icon" disabled> {/* Placeholder for actions */}
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
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
