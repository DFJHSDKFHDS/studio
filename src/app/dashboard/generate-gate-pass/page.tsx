
'use client';

import { useState, useEffect, type ChangeEvent, type FormEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, PackageSearch, Search, Plus, Minus, Trash2, FileText as FileTextIcon, ShieldCheck, Eye, Printer } from 'lucide-react';
import type { Product, GatePassCartItem, ProfileData, Unit, OutgoingStockLogEntry } from '@/types';
import { fetchProducts, decrementProductStock, addOutgoingStockLog } from '@/lib/productService';
import { loadProfileData } from '@/lib/profileService';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { EmailAuthProvider, reauthenticateWithCredential, type AuthError } from 'firebase/auth';

export default function GenerateGatePassPage() {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const { toast } = useToast();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<GatePassCartItem[]>([]);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  
  // Form fields for gate pass details
  const [issuedTo, setIssuedTo] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  // Re-authentication and generation state
  const [isReAuthDialogOpen, setIsReAuthDialogOpen] = useState<boolean>(false);
  const [passwordForReAuth, setPasswordForReAuth] = useState<string>('');
  const [isGeneratingPass, setIsGeneratingPass] = useState<boolean>(false);
  const [generatedGatePassText, setGeneratedGatePassText] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/dashboard/generate-gate-pass');
      return;
    }
    if (user?.uid) {
      setIsLoadingData(true);
      Promise.all([
        fetchProducts(user.uid).then(setAllProducts).catch(err => {
          console.error("Failed to fetch products:", err);
          toast({ title: "Error", description: `Could not load products: ${err.message}`, variant: "destructive" });
        }),
        loadProfileData(user.uid).then(setProfileData).catch(err => {
          console.error("Failed to load profile data:", err);
          // Not critical for base functionality, but good to know
          toast({ title: "Warning", description: `Could not load shop profile data: ${err.message}`, variant: "default" });
        })
      ]).finally(() => setIsLoadingData(false));
    }
  }, [user, authLoading, router, toast]);

  useEffect(() => {
    const results = allProducts.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredProducts(results);
  }, [searchTerm, allProducts]);

  const handleAddOrUpdateCart = (product: Product) => {
    setCartItems(prevCart => {
      const existingItemIndex = prevCart.findIndex(item => item.id === product.id);
      if (existingItemIndex > -1) {
        const updatedCart = [...prevCart];
        const currentItem = updatedCart[existingItemIndex];
        const maxQty = currentItem.selectedUnitForIssuance === 'pieces' ? currentItem.stockQuantity * currentItem.piecesPerUnit : currentItem.stockQuantity;
        if (currentItem.quantityInCart < maxQty) {
          updatedCart[existingItemIndex] = { ...currentItem, quantityInCart: currentItem.quantityInCart + 1 };
        } else {
          toast({ title: "Stock Limit", description: `Maximum stock for ${currentItem.name} reached.`, variant: "default" });
        }
        return updatedCart;
      } else {
        if (product.stockQuantity > 0) {
           return [...prevCart, { ...product, quantityInCart: 1, selectedUnitForIssuance: 'main', priceInCart: product.price }];
        } else {
          toast({ title: "Out of Stock", description: `${product.name} is currently out of stock.`, variant: "destructive" });
          return prevCart;
        }
      }
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCartItems(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    setCartItems(prevCart => prevCart.map(item => {
      if (item.id === productId) {
        const maxQty = item.selectedUnitForIssuance === 'pieces' 
                       ? item.stockQuantity * item.piecesPerUnit 
                       : item.stockQuantity;
        const validatedQuantity = Math.max(1, Math.min(newQuantity, maxQty));
        if (newQuantity > maxQty) {
            toast({ title: "Stock Limit", description: `Only ${maxQty} ${item.selectedUnitForIssuance === 'pieces' ? 'pieces' : (item.unitAbbreviation || item.unitName) + 's'} of ${item.name} available.`, variant: "default" });
        }
        return { ...item, quantityInCart: validatedQuantity };
      }
      return item;
    }));
  };

  const handleUnitSelectionChange = (productId: string, unit: 'main' | 'pieces') => {
    setCartItems(prevCart => prevCart.map(item => {
      if (item.id === productId) {
        // Reset quantity to 1 when unit changes to avoid complex stock validation issues here
        // Or, implement more sophisticated validation based on new unit and current stock
        return { ...item, selectedUnitForIssuance: unit, quantityInCart: 1 };
      }
      return item;
    }));
  };
  
  const cartTotal = cartItems.reduce((total, item) => {
    const pricePerSelectedUnit = item.selectedUnitForIssuance === 'pieces' 
        ? item.price / item.piecesPerUnit  // Price per piece
        : item.price;                       // Price per main unit
    return total + (item.quantityInCart * pricePerSelectedUnit);
  }, 0);

  const handleFinalizeGatePass = () => {
    if (!issuedTo.trim()) {
        toast({ title: "Missing Information", description: "Please enter who the items are issued to.", variant: "destructive" });
        return;
    }
    if (cartItems.length === 0) {
        toast({ title: "Empty Cart", description: "Please add items to the gate pass.", variant: "destructive" });
        return;
    }
    setIsReAuthDialogOpen(true);
  };

  const closeReAuthDialog = () => {
    setIsReAuthDialogOpen(false);
    setPasswordForReAuth('');
    setIsGeneratingPass(false);
  };

  const generatePrintableGatePassText = () => {
    let text = "";
    const now = new Date();
    const gatePassId = `GP-${now.getTime()}`;

    // Shop Details
    if (profileData?.shopDetails) {
        text += `${profileData.shopDetails.shopName || 'Your Shop Name'}\n`;
        text += `${profileData.shopDetails.address || 'Your Shop Address'}\n`;
        text += `Contact: ${profileData.shopDetails.contactNumber || 'Your Contact Number'}\n`;
        text += "------------------------------------------------\n\n";
    }

    text += `GATE PASS\n`;
    text += `ID: ${gatePassId}\n`;
    text += `Date: ${format(now, "PPP")}\n`;
    text += `Time: ${format(now, "p")}\n\n`;

    text += `Issued To: ${issuedTo}\n`;
    if (destination) text += `Destination: ${destination}\n`;
    if (reason) text += `Reason: ${reason}\n\n`;
    
    text += "Items:\n";
    text += "------------------------------------------------\n";
    text += "SNo. Name                 Qty.   Unit\n";
    text += "------------------------------------------------\n";
    cartItems.forEach((item, index) => {
        const name = item.name.padEnd(20, ' ').substring(0,20);
        const qty = item.quantityInCart.toString().padStart(4, ' ');
        const unitDisplay = item.selectedUnitForIssuance === 'pieces' ? 'pcs' : (item.unitAbbreviation || item.unitName);
        const unitPadded = unitDisplay.padEnd(5, ' ').substring(0,5);
        text += `${(index + 1).toString().padStart(3,'0')}. ${name}  ${qty}   ${unitPadded}\n`;
    });
    text += "------------------------------------------------\n\n";

    text += `Total Items: ${cartItems.reduce((sum, item) => sum + item.quantityInCart, 0)}\n\n`;

    text += "Verified By (Store Manager):\n\n";
    text += "_____________________________\n\n";
    text += "Received By:\n\n";
    text += "_____________________________\n\n";
    text += "Thank you!\n";
    
    return {text, gatePassId};
  };

  const handleReAuthenticationAndSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.email || !passwordForReAuth) {
      toast({ title: "Error", description: "Password is required.", variant: "destructive" });
      return;
    }
    setIsGeneratingPass(true);

    try {
      // @ts-ignore
      const credential = EmailAuthProvider.credential(user.email, passwordForReAuth);
      // @ts-ignore
      await reauthenticateWithCredential(user, credential);
      toast({ title: "Re-authentication Successful", description: "Processing Gate Pass..." });

      const { text: passText, gatePassId } = generatePrintableGatePassText();

      // Process all stock updates and logging
      const productUpdatesPromises = cartItems.map(item => 
        decrementProductStock(user.uid, item.id, item.quantityInCart, item.selectedUnitForIssuance)
      );
      const updatedProductsFromDB = await Promise.all(productUpdatesPromises);

      const logEntriesPromises = cartItems.map(item => {
        const logEntryData: Omit<OutgoingStockLogEntry, 'id' | 'loggedAt'> = {
          productId: item.id,
          productName: item.name,
          sku: item.sku,
          quantityRemoved: item.quantityInCart,
          unitId: item.selectedUnitForIssuance === 'main' ? item.unitId : 'pcs', // Assuming 'pcs' if pieces are selected
          unitName: item.selectedUnitForIssuance === 'main' ? item.unitName : 'Piece',
          unitAbbreviation: item.selectedUnitForIssuance === 'main' ? item.unitAbbreviation : 'pcs',
          destination: destination,
          reason: reason,
          gatePassId: gatePassId,
          issuedTo: issuedTo,
        };
        return addOutgoingStockLog(user.uid, logEntryData);
      });
      await Promise.all(logEntriesPromises);

      // Update local product state
      setAllProducts(prevProducts => {
        return prevProducts.map(p => {
          const updatedVersion = updatedProductsFromDB.find(up => up.id === p.id);
          return updatedVersion ? updatedVersion : p;
        });
      });
      
      setGeneratedGatePassText(passText);
      toast({ title: "Gate Pass Generated Successfully!", description: `ID: ${gatePassId}` });

      // Clear form and cart
      setCartItems([]);
      setIssuedTo('');
      setDestination('');
      setReason('');
      closeReAuthDialog();

    } catch (error: any) {
      console.error("Gate pass generation failed:", error);
      const authError = error as AuthError;
      const errorMessage = authError.message || (error instanceof Error ? error.message : "An unknown error occurred during gate pass generation.");
      toast({ 
        title: "Gate Pass Generation Failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
      setIsGeneratingPass(false); // Keep dialog open if generation fails after re-auth
    }
    // setIsGeneratingPass(false) is handled by closeReAuthDialog on success or above on error
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write('<pre style="font-family: monospace; font-size: 10pt;">');
        printWindow.document.write(generatedGatePassText.replace(/\n/g, '<br>'));
        printWindow.document.write('</pre>');
        printWindow.document.close();
        printWindow.print();
        // printWindow.close(); // Optional: close after print dialog
    } else {
        toast({ title: "Print Error", description: "Could not open print window. Please check your browser settings.", variant: "destructive" });
    }
  };


  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Gate Pass Generator...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div className="flex items-center">
          <Button variant="outline" size="icon" className="mr-4" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Gate Pass Generator</h1>
            <p className="text-muted-foreground mt-1 md:mt-2 text-md md:text-lg">
              Efficiently create and manage outgoing item gate passes.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection Panel */}
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl"><PackageSearch className="mr-2 h-5 w-5"/>Select Products</CardTitle>
            <Input
              placeholder="Search products by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-2"
            />
          </CardHeader>
          <CardContent>
            {filteredProducts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <PackageSearch className="mx-auto h-12 w-12 mb-2"/>
                <p>{allProducts.length === 0 ? "No products found. Add products first." : "No products match your search."}</p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-450px)] pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredProducts.map(product => (
                    <Card 
                      key={product.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow flex flex-col overflow-hidden"
                      onClick={() => handleAddOrUpdateCart(product)}
                    >
                      <div className="relative w-full h-32">
                        <Image
                          src={product.imageUrl || "https://placehold.co/300x200.png"}
                          alt={product.name}
                          layout="fill"
                          objectFit="cover"
                          className="rounded-t-lg"
                          data-ai-hint={product.category || "product item"}
                        />
                      </div>
                      <CardContent className="p-3 flex-grow flex flex-col justify-between">
                        <div>
                          <p className="font-semibold text-sm truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">SKU: {product.sku || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">
                            Stock: {product.stockQuantity} {product.unitAbbreviation || product.unitName}
                            {product.piecesPerUnit > 1 && ` (${product.stockQuantity * product.piecesPerUnit} pcs)`}
                          </p>
                        </div>
                        <p className="text-sm font-medium mt-1">₹{product.price.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Cart and Form Panel */}
        <Card className="lg:col-span-1 shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center text-xl"><FileTextIcon className="mr-2 h-5 w-5"/>Gate Pass Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow space-y-4 overflow-y-auto">
            <div>
              <Label htmlFor="issuedTo">Issued To</Label>
              <Input id="issuedTo" value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} placeholder="e.g., Department Name / Person"/>
            </div>
            <div>
              <Label htmlFor="destination">Destination (Optional)</Label>
              <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g., Site B, Client Office"/>
            </div>
            <div>
              <Label htmlFor="reason">Reason for Issuing (Optional)</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g., Project X, Stock Transfer"/>
            </div>
            
            <h3 className="text-md font-semibold pt-2 border-t mt-4">Items to Issue</h3>
            {cartItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No items added yet.</p>
            ) : (
              <ScrollArea className="h-[200px] pr-2">
                <div className="space-y-3">
                  {cartItems.map(item => (
                    <div key={item.id} className="p-3 border rounded-md bg-secondary/30 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Available: {item.stockQuantity} {item.unitAbbreviation || item.unitName}
                            {item.piecesPerUnit > 1 && ` (${item.stockQuantity * item.piecesPerUnit} pcs)`}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveFromCart(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive"/>
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border rounded-md">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(item.id, item.quantityInCart - 1)}><Minus className="h-4 w-4"/></Button>
                          <Input 
                            type="number" 
                            value={item.quantityInCart} 
                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value,10) || 1)} 
                            className="w-12 h-8 text-center border-0 focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min="1"
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(item.id, item.quantityInCart + 1)}><Plus className="h-4 w-4"/></Button>
                        </div>
                        <Select 
                          value={item.selectedUnitForIssuance} 
                          onValueChange={(value: 'main' | 'pieces') => handleUnitSelectionChange(item.id, value)}
                        >
                          <SelectTrigger className="h-8 flex-grow text-xs">
                            <SelectValue placeholder="Select Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="main">{item.unitAbbreviation || item.unitName}</SelectItem>
                            {item.piecesPerUnit > 1 && <SelectItem value="pieces">Pieces (pcs)</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                       <p className="text-xs text-right">
                        Price: ₹{(
                            item.quantityInCart * 
                            (item.selectedUnitForIssuance === 'pieces' ? (item.price / item.piecesPerUnit) : item.price)
                        ).toFixed(2)}
                       </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
          <CardFooter className="flex-col items-stretch space-y-3 pt-4 border-t">
            <div className="flex justify-between font-semibold text-lg">
              <span>Total:</span>
              <span>₹{cartTotal.toFixed(2)}</span>
            </div>
            <Button 
              onClick={handleFinalizeGatePass} 
              disabled={cartItems.length === 0 || !issuedTo.trim() || isGeneratingPass}
              className="w-full"
            >
              {isGeneratingPass ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileTextIcon className="mr-2 h-4 w-4"/>}
              {isGeneratingPass ? 'Processing...' : 'Finalize Gate Pass'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Re-authentication Dialog */}
      {cartItems.length > 0 && (
        <AlertDialog open={isReAuthDialogOpen} onOpenChange={(open) => {
          if (!open) closeReAuthDialog(); else setIsReAuthDialogOpen(true);
        }}>
          <AlertDialogContent className="sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center"><ShieldCheck className="mr-2 h-6 w-6 text-primary"/>Confirm Gate Pass Generation</AlertDialogTitle>
              <AlertDialogDescription>
                Review items and enter your password to confirm and generate the gate pass.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <Card className="my-2 max-h-[30vh] overflow-y-auto border shadow-inner bg-muted/30">
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-md flex items-center">
                  <Eye className="mr-2 h-4 w-4" /> Gate Pass Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1 text-xs">
                <p><strong>Issued To:</strong> {issuedTo}</p>
                {destination && <p><strong>Destination:</strong> {destination}</p>}
                {reason && <p><strong>Reason:</strong> {reason}</p>}
                <p className="font-medium mt-1">Items:</p>
                <ul className="list-disc list-inside pl-1">
                  {cartItems.map(item => (
                    <li key={item.id}>
                      {item.name}: {item.quantityInCart} {item.selectedUnitForIssuance === 'pieces' ? 'pcs' : (item.unitAbbreviation || item.unitName)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <form onSubmit={handleReAuthenticationAndSubmit}>
              <div className="space-y-2">
                <Label htmlFor="reauth-password-gatepass">Password</Label>
                <Input 
                  id="reauth-password-gatepass" 
                  type="password" 
                  value={passwordForReAuth} 
                  onChange={(e) => setPasswordForReAuth(e.target.value)} 
                  placeholder="Enter your password" 
                  required 
                />
              </div>
              <AlertDialogFooter className="mt-4">
                <AlertDialogCancel onClick={closeReAuthDialog} disabled={isGeneratingPass}>Cancel</AlertDialogCancel>
                <Button type="submit" disabled={isGeneratingPass}>
                  {isGeneratingPass ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirm & Generate
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Generated Gate Pass Display & Print */}
      {generatedGatePassText && (
        <Card className="mt-6 shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center justify-between text-xl">
                    <span>Generated Gate Pass</span>
                    <Button onClick={handlePrint} variant="outline" size="sm">
                        <Printer className="mr-2 h-4 w-4"/> Print
                    </Button>
                </CardTitle>
                <CardDescription>Review the generated gate pass. Use the print button for thermal printer output.</CardDescription>
            </CardHeader>
            <CardContent>
                <Textarea 
                    value={generatedGatePassText} 
                    readOnly 
                    rows={20} 
                    className="font-mono text-xs bg-secondary/20"
                    aria-label="Generated Gate Pass Text"
                />
            </CardContent>
        </Card>
      )}

      <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}
