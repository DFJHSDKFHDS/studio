
'use client';

import { useState, useEffect, type ChangeEvent, type FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as ReAuthAlertDialogContent, AlertDialogDescription as ReAuthAlertDialogDescription, AlertDialogFooter as ReAuthAlertDialogFooter, AlertDialogHeader as ReAuthAlertDialogHeader, AlertDialogTitle as ReAuthAlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, PackageSearch, Search, Plus, Minus, Trash2, FileText as FileTextIcon, ShieldCheck, Eye, Printer, CalendarIcon, X as CloseIcon, Bluetooth } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { Product, GatePassCartItem, ProfileData, Unit, OutgoingStockLogEntry } from '@/types';
import { fetchProducts, decrementProductStock, addOutgoingStockLog } from '@/lib/productService';
import { loadProfileData } from '@/lib/profileService';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { EmailAuthProvider, reauthenticateWithCredential, type AuthError } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import { Badge } from '@/components/ui/badge';

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
  
  const [createdByEmployee, setCreatedByEmployee] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [dispatchDate, setDispatchDate] = useState<Date | undefined>(new Date());
  const [reason, setReason] = useState<string>(''); 

  const [isReAuthDialogOpen, setIsReAuthDialogOpen] = useState<boolean>(false);
  const [passwordForReAuth, setPasswordForReAuth] = useState<string>('');
  const [isGeneratingPass, setIsGeneratingPass] = useState<boolean>(false);
  
  const [showGeneratedPassDialog, setShowGeneratedPassDialog] = useState<boolean>(false);
  const [generatedGatePassText, setGeneratedGatePassText] = useState<string>('');
  const [generatedGatePassId, setGeneratedGatePassId] = useState<string>('');
  const gatePassPrintContentRef = useRef<HTMLDivElement>(null);


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
        loadProfileData(user.uid).then(data => {
            setProfileData(data);
            if (data?.employees && data.employees.length > 0 && !createdByEmployee) {
                setCreatedByEmployee(data.employees[0]); 
            }
        }).catch(err => {
          console.error("Failed to load profile data:", err);
          toast({ title: "Warning", description: `Could not load shop profile data: ${err.message}`, variant: "default" });
        })
      ]).finally(() => setIsLoadingData(false));
    }
  }, [user, authLoading, router, toast, createdByEmployee]);

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
        const maxQty = currentItem.selectedUnitForIssuance === 'pieces' && currentItem.piecesPerUnit > 0 
                        ? currentItem.stockQuantity * currentItem.piecesPerUnit 
                        : currentItem.stockQuantity;
        if (currentItem.quantityInCart < maxQty) {
          updatedCart[existingItemIndex] = { ...currentItem, quantityInCart: currentItem.quantityInCart + 1 };
        } else {
          toast({ title: "Stock Limit", description: `Maximum stock for ${currentItem.name} reached.`, variant: "default" });
        }
        return updatedCart;
      } else {
         if (product.stockQuantity <= 0) { 
           toast({ title: "Out of Stock", description: `${product.name} is currently out of stock. Cannot add to cart.`, variant: "destructive" });
           return prevCart;
         }
        const newItem: GatePassCartItem = { 
            ...product, 
            quantityInCart: 1, 
            selectedUnitForIssuance: product.piecesPerUnit > 0 ? 'main' : 'main', 
            priceInCart: product.price 
        };
        return [...prevCart, newItem];
      }
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCartItems(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    setCartItems(prevCart => prevCart.map(item => {
      if (item.id === productId) {
        const maxQty = item.selectedUnitForIssuance === 'pieces' && item.piecesPerUnit > 0
                       ? item.stockQuantity * item.piecesPerUnit 
                       : item.stockQuantity;
        const validatedQuantity = Math.max(1, Math.min(newQuantity, maxQty));
        if (newQuantity > maxQty && newQuantity > 0) { 
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
        let newPriceInCart = item.price; 
        if (unit === 'pieces' && item.piecesPerUnit > 0) {
            newPriceInCart = item.price / item.piecesPerUnit;
        }
        
        const maxQtyForNewUnit = unit === 'pieces' && item.piecesPerUnit > 0
                               ? item.stockQuantity * item.piecesPerUnit
                               : item.stockQuantity;
        let newQuantityInCart = 1; 
        
        if (maxQtyForNewUnit <= 0 ) {
             toast({ title: "Out of Stock", description: `${item.name} is out of stock for the selected unit.`, variant: "default" });
             return item; 
        }

        return { ...item, quantityInCart: newQuantityInCart, selectedUnitForIssuance: unit, priceInCart: newPriceInCart };
      }
      return item;
    }));
  };
  
  const cartTotal = cartItems.reduce((total, item) => {
    return total + (item.quantityInCart * item.priceInCart);
  }, 0);

  const handleFinalizeGatePass = () => {
    if (!createdByEmployee.trim()) {
        toast({ title: "Missing Information", description: "Please select who created the pass.", variant: "destructive" });
        return;
    }
    if (!customerName.trim()) {
        toast({ title: "Missing Information", description: "Please enter the customer name.", variant: "destructive" });
        return;
    }
    if (!dispatchDate) {
        toast({ title: "Missing Information", description: "Please select the dispatch date.", variant: "destructive" });
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

  const generatePrintableGatePassText = (passId: string) => {
    let text = "";
    const now = new Date(); 
    const gatePassNumber = passId.substring(passId.lastIndexOf('-') + 1).slice(-6); 
    const LINE_WIDTH = 42; 

    const shopName = profileData?.shopDetails?.shopName || 'YOUR SHOP NAME';
    const shopAddress = profileData?.shopDetails?.address || 'YOUR SHOP ADDRESS';
    const shopContact = profileData?.shopDetails?.contactNumber || 'YOUR CONTACT';
    const separator = "-".repeat(LINE_WIDTH); 

    const centerText = (str: string) => {
        const padding = Math.max(0, Math.floor((LINE_WIDTH - str.length) / 2));
        return ' '.repeat(padding) + str;
    }

    text += `\n${centerText("GATE PASS")}\n`;
    text += `${separator}\n`;
    text += `${centerText(shopName)}\n`;
    text += `${centerText(shopAddress)}\n`;
    text += `${centerText(`Contact: ${shopContact}`)}\n\n`;
    
    text += `Gate Pass No. : ${gatePassNumber}\n`;
    text += `Date & Time   : ${format(now, "MMM dd, yyyy, p")}\n`;
    text += `Customer Name : ${customerName}\n`;
    text += `Authorized By : ${createdByEmployee}\n`;
    text += `Gate Pass ID  : ${passId} (For QR)\n\n`;
    
    text += "S.N Product (SKU)            Qty Unit\n"; 
    text += `${separator}\n`;
    cartItems.forEach((item, index) => {
        const sn = (index + 1).toString().padStart(2);
        const nameAndSku = `${item.name} (${item.sku || 'N/A'})`.substring(0, 24).padEnd(24);
        const qty = item.quantityInCart.toString().padStart(3);
        const unitDisplay = item.selectedUnitForIssuance === 'pieces' ? 'pcs' : (item.unitAbbreviation || item.unitName);
        const unitPadded = unitDisplay.substring(0,5).padEnd(5);
        text += `${sn}. ${nameAndSku} ${qty} ${unitPadded}\n`;
    });
    text += `${separator}\n`;
    const totalQtyStr = `Total Quantity: ${cartItems.reduce((sum, item) => sum + item.quantityInCart, 0)}`;
    text += `${centerText(totalQtyStr)}\n`; 
    text += `${separator}\n\n`;

    text += "Verified By (Store Manager):\n\n";
    text += "_____________________________\n\n";
    text += "Received By (Customer):\n\n";
    text += "_____________________________\n\n";
    text += `${centerText("Thank you!")}\n`;
    
    return text;
  };

  const handleReAuthenticationAndSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.email || !passwordForReAuth) {
      toast({ title: "Error", description: "Password is required.", variant: "destructive" });
      return;
    }
    setIsGeneratingPass(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, passwordForReAuth);
      await reauthenticateWithCredential(user, credential);
      toast({ title: "Re-authentication Successful", description: "Processing Gate Pass..." });
      
      const currentGatePassId = `GP-${new Date().getTime()}`;
      
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
          unitId: item.selectedUnitForIssuance === 'main' ? item.unitId : 'pcs', 
          unitName: item.selectedUnitForIssuance === 'main' ? item.unitName : 'Piece',
          unitAbbreviation: item.selectedUnitForIssuance === 'main' ? item.unitAbbreviation : 'pcs',
          destination: customerName, 
          reason: dispatchDate ? `Dispatched on ${format(dispatchDate, "MMM dd, yyyy")}` : 'General Dispatch',
          gatePassId: currentGatePassId,
          issuedTo: createdByEmployee, 
        };
        return addOutgoingStockLog(user.uid, logEntryData);
      });
      await Promise.all(logEntriesPromises);

      setAllProducts(prevProducts => {
        return prevProducts.map(p => {
          const updatedVersion = updatedProductsFromDB.find(up => up.id === p.id);
          return updatedVersion ? updatedVersion : p;
        });
      });
      
      const passText = generatePrintableGatePassText(currentGatePassId);
      setGeneratedGatePassId(currentGatePassId);
      setGeneratedGatePassText(passText);
      setShowGeneratedPassDialog(true);

      toast({ title: "Gate Pass Generated Successfully!", description: `ID: ${currentGatePassId}` });

      setCartItems([]);
      setCustomerName('');
      setDispatchDate(new Date());
      setCreatedByEmployee(profileData?.employees?.[0] || '');
      setReason(''); 
      closeReAuthDialog();

    } catch (error: any) {
      console.error("Gate pass generation failed:", error);
      const authError = error as AuthError;
      let errorMessage = "An unknown error occurred during gate pass generation.";
       if (error instanceof Error) {
         errorMessage = error.message;
       } else if (authError && authError.code) {
          errorMessage = authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential' 
           ? "Incorrect password. Please try again." 
           : `Authentication error: ${authError.message || authError.code}`;
       } else {
          errorMessage = String(error); 
       }
      
      toast({ 
        title: "Gate Pass Generation Failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
       setIsGeneratingPass(false); 
    }
  };

  const handlePrintDialogContent = () => {
    const content = gatePassPrintContentRef.current;
    if (content) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Gate Pass</title>');
            printWindow.document.write('<style> pre { font-family: "Consolas", "Menlo", "Courier New", monospace; font-size: 10pt; white-space: pre-wrap; word-break: keep-all; line-height: 1.2; } .qr-code { margin-top: 10px; text-align: center; } body { margin: 2mm; padding: 0; } @page { size: 80mm auto; margin: 0; } </style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(content.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            
            setTimeout(() => { 
                printWindow.print();
            }, 250); 
        } else {
            toast({ title: "Print Error", description: "Could not open print window. Check pop-up blocker.", variant: "destructive" });
        }
    }
  };
  
  const handleNativeAppPrint = () => {
    if (!generatedGatePassText) {
        toast({title: "Error", description: "No gate pass text generated to print.", variant: "destructive"});
        return;
    }
    const encodedText = encodeURIComponent(generatedGatePassText);
    // Ensure the scheme matches what's configured in the native Android app
    const intentUrl = `intent://print?text=${encodedText}#Intent;scheme=stockflowprint;package=com.example.stockflowprintapp;end`;
    
    window.location.href = intentUrl;

    toast({
        title: "Attempting Native Print",
        description: "If your Stockflow Print App is installed, it should open. Ensure it's configured for the 'stockflowprint://print' scheme.",
        duration: 7000,
    });
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
          <Button variant="outline" size="icon" className="mr-4 hidden md:flex" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
           <SidebarTrigger className="md:hidden mr-2" /> 
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Gate Pass Generator</h1>
            <p className="text-muted-foreground mt-1 md:mt-2 text-md md:text-lg">
              Efficiently create and manage outgoing item gate passes.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center text-xl"><PackageSearch className="mr-2 h-5 w-5"/>Select Products</CardTitle>
            <Input
              placeholder="Search products by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-2"
            />
          </CardHeader>
          <CardContent className="flex flex-col flex-1 p-6 pt-4 overflow-hidden">
            {isLoadingData && allProducts.length === 0 ? (
               <div className="flex items-center justify-center h-full">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 <p className="ml-3 text-muted-foreground">Loading products...</p>
               </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 h-full flex flex-col justify-center items-center">
                <PackageSearch className="mx-auto h-12 w-12 mb-2"/>
                <p>{allProducts.length === 0 ? "No products found. Add products first." : "No products match your search."}</p>
              </div>
            ) : (
              <ScrollArea className="h-[60vh] pr-2 flex-1 min-h-0"> 
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProducts.map(product => {
                    const itemInCart = cartItems.find(item => item.id === product.id);
                    const quantityInCart = itemInCart ? itemInCart.quantityInCart : 0;
                    const unitInCart = itemInCart?.selectedUnitForIssuance === 'pieces' ? 'pcs' : (itemInCart?.unitAbbreviation || itemInCart?.unitName || 'units');
                    const isEffectivelyOutOfStock = product.stockQuantity <= 0;
                    const isLowStock = !isEffectivelyOutOfStock && product.status === 'Low Stock';
                    
                    return (
                    <Card 
                      key={product.id} 
                      className={cn(
                        "cursor-pointer hover:shadow-md transition-shadow flex flex-col overflow-hidden",
                        isEffectivelyOutOfStock && "opacity-60 grayscale cursor-not-allowed"
                      )}
                      onClick={() => {
                        if (isEffectivelyOutOfStock) {
                          toast({ title: "Out of Stock", description: `${product.name} is currently out of stock.`, variant: "destructive" });
                          return;
                        }
                        handleAddOrUpdateCart(product);
                      }}
                    >
                      <div className="relative w-full h-32">
                        <Image
                          src={product.imageUrl || "https://placehold.co/300x200.png"}
                          alt={product.name}
                          fill={true} 
                          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw"
                          style={{objectFit: "cover"}} 
                          className="rounded-t-lg"
                          data-ai-hint={product.category || "product item"}
                        />
                        {quantityInCart > 0 && (
                          <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full shadow-md z-10">
                            {quantityInCart} {unitInCart}
                          </Badge>
                        )}
                        {isEffectivelyOutOfStock && (
                           <Badge className="absolute top-2 left-2 shadow-md z-10 bg-red-600 text-white hover:bg-red-700">
                             Out of Stock
                           </Badge>
                         )}
                         {isLowStock && (
                           <Badge className="absolute top-2 left-2 shadow-md z-10 bg-green-600 text-white hover:bg-green-700">
                             Low Stock
                           </Badge>
                         )}
                      </div>
                      <CardContent className="p-3 flex-grow flex flex-col justify-between">
                        <div>
                          <p className="font-semibold text-sm truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">SKU: {product.sku || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">
                            Stock: {product.stockQuantity} {product.unitAbbreviation || product.unitName}
                            {product.piecesPerUnit > 0 && ` (${product.stockQuantity * product.piecesPerUnit} pcs)`}
                          </p>
                        </div>
                        <p className="text-sm font-medium mt-1">₹{product.price.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center text-xl"><FileTextIcon className="mr-2 h-5 w-5"/>Gate Pass Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-grow space-y-4 overflow-hidden p-6 pt-0">
            <div>
              <Label htmlFor="createdByEmployee">Created by:</Label>
              <Select value={createdByEmployee} onValueChange={setCreatedByEmployee} disabled={!profileData?.employees?.length}>
                <SelectTrigger id="createdByEmployee">
                  <SelectValue placeholder={profileData?.employees?.length ? "Select employee" : "No employees in profile"} />
                </SelectTrigger>
                <SelectContent>
                  {profileData?.employees?.map(emp => (
                    <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="customerName">Customer Name</Label>
              <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g., Customer X, Retail Partner Y"/>
            </div>
            <div>
              <Label htmlFor="dispatchDate">Date of Dispatch</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dispatchDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dispatchDate ? format(dispatchDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dispatchDate}
                    onSelect={setDispatchDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <h3 className="text-md font-semibold pt-2 border-t mt-2">Items to Issue</h3>
            {cartItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No items added yet.</p>
            ) : (
              <ScrollArea className="flex-1 min-h-[150px] md:min-h-[200px] pr-2">
                <div className="space-y-3">
                  {cartItems.map(item => (
                    <div key={item.id} className="p-3 border rounded-md bg-secondary/30 space-y-2">
                      <div className="flex items-start gap-3">
                         <Image
                            src={item.imageUrl || "https://placehold.co/48x48.png"}
                            alt={item.name}
                            width={40}
                            height={40}
                            className="rounded-md object-cover aspect-square mt-1"
                            data-ai-hint={item.category || "product item"}
                          />
                        <div className="flex-grow">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Available: {item.stockQuantity} {item.unitAbbreviation || item.unitName}
                                {item.piecesPerUnit > 0 && ` (${item.stockQuantity * item.piecesPerUnit} pcs)`}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1" onClick={() => handleRemoveFromCart(item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive"/>
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
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
                              disabled={!(item.piecesPerUnit > 0)}
                            >
                              <SelectTrigger className="h-8 flex-grow text-xs">
                                <SelectValue placeholder="Select Unit" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="main">{item.unitAbbreviation || item.unitName}</SelectItem>
                                {item.piecesPerUnit > 0 && <SelectItem value="pieces">Pieces (pcs)</SelectItem>}
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="text-xs text-right mt-1">
                            Price: ₹{(item.quantityInCart * item.priceInCart).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
          <CardFooter className="flex-col items-stretch space-y-3 pt-4 border-t">
            <Button 
              onClick={handleFinalizeGatePass} 
              disabled={cartItems.length === 0 || !createdByEmployee.trim() || !customerName.trim() || !dispatchDate || isGeneratingPass}
              className="w-full"
            >
              {isGeneratingPass ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileTextIcon className="mr-2 h-4 w-4"/>}
              {isGeneratingPass ? 'Processing...' : 'Log Outgoing & Generate Pass'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Re-authentication Dialog */}
      <AlertDialog open={isReAuthDialogOpen} onOpenChange={(open) => {
          if (!open) closeReAuthDialog(); else setIsReAuthDialogOpen(true);
        }}>
          <ReAuthAlertDialogContent className="sm:max-w-lg">
            <ReAuthAlertDialogHeader>
              <ReAuthAlertDialogTitle className="flex items-center"><ShieldCheck className="mr-2 h-6 w-6 text-primary"/>Confirm Gate Pass Generation</ReAuthAlertDialogTitle>
              <ReAuthAlertDialogDescription>
                Review items and enter your password to confirm and generate the gate pass.
              </ReAuthAlertDialogDescription>
            </ReAuthAlertDialogHeader>
            
            <Card className="my-2 max-h-[30vh] overflow-y-auto border shadow-inner bg-muted/30">
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-md flex items-center">
                  <Eye className="mr-2 h-4 w-4" /> Gate Pass Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1 text-xs">
                <p><strong>Created By:</strong> {createdByEmployee}</p>
                <p><strong>Customer Name:</strong> {customerName}</p>
                {dispatchDate && <p><strong>Date of Dispatch:</strong> {format(dispatchDate, "PPP")}</p>}
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
              <ReAuthAlertDialogFooter className="mt-4">
                <AlertDialogCancel onClick={closeReAuthDialog} disabled={isGeneratingPass}>Cancel</AlertDialogCancel>
                <Button type="submit" disabled={isGeneratingPass}>
                  {isGeneratingPass ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirm & Generate
                </Button>
              </ReAuthAlertDialogFooter>
            </form>
          </ReAuthAlertDialogContent>
        </AlertDialog>

      {/* Generated Gate Pass Dialog */}
      <Dialog open={showGeneratedPassDialog} onOpenChange={setShowGeneratedPassDialog}>
        <DialogContent className="sm:max-w-md md:max-w-lg">
            <DialogHeader className="flex flex-row justify-between items-center">
                <DialogTitle>Generated Gate Pass</DialogTitle>
                <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                        <CloseIcon className="h-5 w-5" />
                    </Button>
                </DialogClose>
            </DialogHeader>
            <DialogDescription>
                This gate pass is formatted for thermal printer output. Review and print/share.
            </DialogDescription>
            <ScrollArea className="max-h-[60vh] my-4">
              <div ref={gatePassPrintContentRef} className="p-4 border rounded-md bg-background">
                  <pre className="font-mono text-xs whitespace-pre-wrap break-all leading-tight">
                      {generatedGatePassText}
                  </pre>
                  {generatedGatePassId && (
                      <div className="mt-4 flex justify-center">
                          <QRCodeSVG value={generatedGatePassId} size={100} bgColor={"#ffffff"} fgColor={"#000000"} level={"L"} includeMargin={false} />
                      </div>
                  )}
              </div>
            </ScrollArea>
            <DialogFooter className="gap-2 sm:justify-end flex-wrap">
                <Button variant="outline" onClick={handleNativeAppPrint}>
                    <Bluetooth className="mr-2 h-4 w-4" /> Print via App (Android)
                </Button>
                <Button onClick={handlePrintDialogContent}>
                    <Printer className="mr-2 h-4 w-4"/> Print (Standard)
                </Button>
                 <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>


      <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}


    

    

