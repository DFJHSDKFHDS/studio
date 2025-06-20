
'use client';

import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, PackageSearch, Search, CalendarIcon, ReceiptText, Warehouse, ShieldCheck, Eye } from 'lucide-react';
import type { Product, IncomingStockLogEntry } from '@/types';
import { fetchProducts, updateProductStock, addIncomingStockLog } from '@/lib/productService';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { EmailAuthProvider, reauthenticateWithCredential, type AuthError } from 'firebase/auth';


const restockSchema = z.object({
  quantityAdded: z.coerce.number().min(1, "Quantity to add must be at least 1"),
  arrivalDate: z.date({ required_error: "Arrival date is required." }),
  poNumber: z.string().optional(),
  supplier: z.string().optional(),
});

type RestockFormValues = z.infer<typeof restockSchema>;

export default function IncomingStockPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const { toast } = useToast();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Re-authentication state
  const [isReAuthDialogOpen, setIsReAuthDialogOpen] = useState<boolean>(false);
  const [passwordForReAuth, setPasswordForReAuth] = useState<string>('');
  const [pendingRestockData, setPendingRestockData] = useState<RestockFormValues | null>(null);


  const form = useForm<RestockFormValues>({
    resolver: zodResolver(restockSchema),
    defaultValues: {
      quantityAdded: 1,
      arrivalDate: new Date(),
      poNumber: '',
      supplier: '',
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/dashboard/incoming-stock');
      return;
    }
    if (user?.uid) {
      setIsLoadingProducts(true);
      fetchProducts(user.uid)
        .then((fetchedProducts) => {
          setAllProducts(fetchedProducts);
          setFilteredProducts(fetchedProducts);
        })
        .catch(err => {
          console.error("Failed to fetch products:", err);
          toast({ title: "Error", description: `Could not load products: ${err.message}`, variant: "destructive" });
        })
        .finally(() => setIsLoadingProducts(false));
    }
  }, [user, authLoading, router, toast]);

  useEffect(() => {
    const results = allProducts.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredProducts(results);
  }, [searchTerm, allProducts]);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    form.reset({
      quantityAdded: 1,
      arrivalDate: new Date(),
      poNumber: '',
      supplier: '',
    });
  };

  const processRestockSubmission = async (values: RestockFormValues) => {
    if (!user?.uid || !selectedProduct) {
      toast({ title: "Error", description: "User or product not available.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const updatedProduct = await updateProductStock(user.uid, selectedProduct.id, values.quantityAdded);
      
      const logEntryData: Omit<IncomingStockLogEntry, 'id' | 'loggedAt'> = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.sku,
        quantityAdded: values.quantityAdded,
        unitId: selectedProduct.unitId,
        unitName: selectedProduct.unitName,
        unitAbbreviation: selectedProduct.unitAbbreviation,
        arrivalDate: values.arrivalDate.toISOString(),
        poNumber: values.poNumber,
        supplier: values.supplier,
      };
      await addIncomingStockLog(user.uid, logEntryData);

      toast({ title: "Stock Updated", description: `${values.quantityAdded} ${selectedProduct.unitAbbreviation || selectedProduct.unitName}(s) of ${selectedProduct.name} added.` });
      
      setAllProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
      setSelectedProduct(updatedProduct); 
      form.reset({
        quantityAdded: 1,
        arrivalDate: new Date(),
        poNumber: '', // Clear PO and supplier for next entry
        supplier: '',
      });

    } catch (error) {
      console.error("Failed to update stock:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({ title: "Error Updating Stock", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setIsReAuthDialogOpen(false);
      setPasswordForReAuth('');
      setPendingRestockData(null);
    }
  };

  const onSubmit = async (values: RestockFormValues) => {
    if (!user?.uid || !selectedProduct) {
      toast({ title: "Error", description: "User or product not selected.", variant: "destructive" });
      return;
    }
    setPendingRestockData(values);
    setIsReAuthDialogOpen(true);
  };
  
  const handleReAuthenticationAndSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.email || !passwordForReAuth || !pendingRestockData) {
      toast({ title: "Error", description: "Password and pending data are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true); 
    try {
      // @ts-ignore
      const credential = EmailAuthProvider.credential(user.email, passwordForReAuth);
      // @ts-ignore
      await reauthenticateWithCredential(user, credential);
      toast({ title: "Re-authentication Successful", description: "Proceeding to log stock."});
      await processRestockSubmission(pendingRestockData); 
    } catch (error: any) {
      console.error("Re-authentication failed:", error);
      const authError = error as AuthError;
      toast({ 
        title: "Re-authentication Failed", 
        description: authError.message || "Incorrect password or an error occurred.", 
        variant: "destructive" 
      });
      setIsSubmitting(false); 
    }
  };

  const closeReAuthDialog = () => {
    setIsReAuthDialogOpen(false);
    setPasswordForReAuth('');
    setPendingRestockData(null);
    setIsSubmitting(false); 
  };


  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Incoming Stock...</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto">
      <header className="mb-8 flex items-center">
        <Button variant="outline" size="icon" className="mr-4" onClick={() => router.push('/dashboard/generate-gate-pass')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Warehouse className="h-10 w-10 text-primary mr-3"/>
        <div>
            <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Log Incoming Stock</h1>
            <p className="text-muted-foreground">Update inventory by logging new arrivals.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl"><Search className="mr-2 h-5 w-5"/>Select Product to Restock</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search products by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-4"
            />
            {isLoadingProducts ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <PackageSearch className="mx-auto h-12 w-12 mb-2"/>
                <p>{allProducts.length === 0 ? "No products found. Add products first." : "No products match your search."}</p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-400px)] pr-3">
                <div className="space-y-3">
                  {filteredProducts.map(product => (
                    <Card 
                      key={product.id} 
                      className={cn(
                        "cursor-pointer hover:shadow-md transition-shadow",
                        selectedProduct?.id === product.id && "ring-2 ring-primary shadow-md"
                      )}
                      onClick={() => handleProductSelect(product)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <Image
                          src={product.imageUrl || "https://placehold.co/80x80.png"}
                          alt={product.name}
                          width={60}
                          height={60}
                          className="rounded-md object-cover aspect-square"
                          data-ai-hint={product.category || "product item"}
                        />
                        <div className="flex-grow">
                          <p className="font-semibold text-md">{product.name}</p>
                          <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                          <p className="text-xs text-muted-foreground">
                            Stock: {product.stockQuantity} {product.unitAbbreviation || product.unitName}
                          </p>
                          <p className="text-sm font-medium">₹{product.price.toFixed(2)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <ReceiptText className="mr-2 h-5 w-5"/>
              {selectedProduct ? `Restock: ${selectedProduct.name}` : "Restock Details"}
            </CardTitle>
            <CardDescription>
              {selectedProduct ? "Enter restock details for the selected product." : "Select a product from the left to begin."}
            </CardDescription>
          </CardHeader>
          {selectedProduct ? (
            <CardContent>
              <div className="flex items-center gap-4 mb-6 p-4 border rounded-lg bg-secondary/20">
                  <Image
                    src={selectedProduct.imageUrl || "https://placehold.co/80x80.png"}
                    alt={selectedProduct.name}
                    width={70}
                    height={70}
                    className="rounded-lg object-cover aspect-square"
                    data-ai-hint={selectedProduct.category || "product item"}
                  />
                  <div>
                    <h3 className="text-lg font-semibold">{selectedProduct.name}</h3>
                    <p className="text-sm text-muted-foreground">SKU: {selectedProduct.sku}</p>
                    <p className="text-sm text-muted-foreground">
                      Current Stock: {selectedProduct.stockQuantity} {selectedProduct.unitAbbreviation || selectedProduct.unitName}
                    </p>
                  </div>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <Label htmlFor="quantityAdded">Quantity to Add ({selectedProduct.unitAbbreviation || selectedProduct.unitName})</Label>
                  <Input
                    id="quantityAdded"
                    type="number"
                    {...form.register("quantityAdded")}
                    min="1"
                  />
                  {form.formState.errors.quantityAdded && <p className="text-red-500 text-xs mt-1">{form.formState.errors.quantityAdded.message}</p>}
                </div>
                
                <div>
                  <Label htmlFor="arrivalDate">Date of Arrival</Label>
                  <Controller
                    control={form.control}
                    name="arrivalDate"
                    render={({ field }) => (
                       <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Time of arrival will be the current time on submission.</p>
                  {form.formState.errors.arrivalDate && <p className="text-red-500 text-xs mt-1">{form.formState.errors.arrivalDate.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="poNumber">PO # (Optional)</Label>
                        <Input id="poNumber" {...form.register("poNumber")} placeholder="e.g., PO-12345" />
                    </div>
                    <div>
                        <Label htmlFor="supplier">Supplier (Optional)</Label>
                        <Input id="supplier" {...form.register("supplier")} placeholder="e.g., Global Supplies Ltd." />
                    </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Processing...' : 'Log Incoming Stock'}
                </Button>
              </form>
            </CardContent>
          ) : (
            <CardContent className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <PackageSearch className="h-16 w-16 mb-4"/>
                <p>Please select a product from the list to enter restock details.</p>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Re-authentication Dialog */}
      {selectedProduct && pendingRestockData && (
        <AlertDialog open={isReAuthDialogOpen} onOpenChange={(open) => {
          if (!open) closeReAuthDialog(); else setIsReAuthDialogOpen(true);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center"><ShieldCheck className="mr-2 h-6 w-6 text-primary"/>Confirm Stock Entry</AlertDialogTitle>
              <AlertDialogDescription>
                Review the details below and enter your password to confirm logging this incoming stock.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <Card className="my-4 border shadow-inner bg-muted/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Eye className="mr-2 h-5 w-5" /> Restock Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-3 mb-3">
                    <Image
                        src={selectedProduct.imageUrl || "https://placehold.co/60x60.png"}
                        alt={selectedProduct.name}
                        width={50}
                        height={50}
                        className="rounded-md object-cover aspect-square"
                        data-ai-hint={selectedProduct.category || "product item"}
                    />
                    <div>
                        <p><strong>Product:</strong> {selectedProduct.name}</p>
                        <p className="text-xs text-muted-foreground">SKU: {selectedProduct.sku}</p>
                    </div>
                </div>
                <p><strong>Quantity to Add:</strong> {pendingRestockData.quantityAdded} {selectedProduct.unitAbbreviation || selectedProduct.unitName}</p>
                <p><strong>Arrival Date:</strong> {format(pendingRestockData.arrivalDate, "PPP")}</p>
                {pendingRestockData.poNumber && <p><strong>PO Number:</strong> {pendingRestockData.poNumber}</p>}
                {pendingRestockData.supplier && <p><strong>Supplier:</strong> {pendingRestockData.supplier}</p>}
                <p className="text-xs text-muted-foreground pt-2">
                  Current Stock: {selectedProduct.stockQuantity} {selectedProduct.unitAbbreviation || selectedProduct.unitName}
                  <br />
                  New Stock After Update: {selectedProduct.stockQuantity + pendingRestockData.quantityAdded} {selectedProduct.unitAbbreviation || selectedProduct.unitName}
                </p>
              </CardContent>
            </Card>

            <form onSubmit={handleReAuthenticationAndSubmit}>
              <div className="space-y-2">
                <Label htmlFor="reauth-password-stock">Password</Label>
                <Input 
                  id="reauth-password-stock" 
                  type="password" 
                  value={passwordForReAuth} 
                  onChange={(e) => setPasswordForReAuth(e.target.value)} 
                  placeholder="Enter your password" 
                  required 
                />
              </div>
              <AlertDialogFooter className="mt-4">
                <AlertDialogCancel onClick={closeReAuthDialog} disabled={isSubmitting}>Cancel</AlertDialogCancel>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirm & Log Stock
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}

