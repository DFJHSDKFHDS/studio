
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, PackageSearch, Eye, ArrowUpFromLine, FileText as FileTextIcon, UserRound, Hash, Printer, ShoppingBag, Users, MapPin, CalendarDays, X as CloseIcon, Bluetooth } from 'lucide-react';
import type { Product, OutgoingStockLogEntry, ProfileData } from '@/types';
import { fetchProducts, fetchOutgoingStockLogs } from '@/lib/productService';
import { loadProfileData } from '@/lib/profileService';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';

interface EnrichedOutgoingStockLogEntry extends OutgoingStockLogEntry {
  productImageUrl?: string;
  productSku?: string;
}

interface GatePassSummary {
  passNumber: number;
  gatePassId: string;
  loggedAt: string;
  customerName: string;
  totalItems: number;
  authorizedBy: string;
  items: EnrichedOutgoingStockLogEntry[];
  rawPrintText?: string; 
}

export default function OutgoingStockPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const { toast } = useToast();

  const [gatePassSummaries, setGatePassSummaries] = useState<GatePassSummary[]>([]);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [selectedGatePass, setSelectedGatePass] = useState<GatePassSummary | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState<boolean>(false);
  const gatePassPrintContentRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/dashboard/outgoing-stock');
      return;
    }
    if (user?.uid) {
      setIsLoadingData(true);
      Promise.all([
        fetchProducts(user.uid),
        fetchOutgoingStockLogs(user.uid),
        loadProfileData(user.uid)
      ]).then(([fetchedProducts, stockLogs, fetchedProfileData]) => {
        setProfileData(fetchedProfileData);
        const productsMap = new Map(fetchedProducts.map(p => [p.id, p]));
        
        const groupedByGatePassId = stockLogs.reduce((acc, log) => {
          const enrichedLog: EnrichedOutgoingStockLogEntry = {
            ...log,
            productImageUrl: productsMap.get(log.productId)?.imageUrl,
            productSku: productsMap.get(log.productId)?.sku,
          };
          if (!acc[log.gatePassId!]) {
            acc[log.gatePassId!] = {
              gatePassId: log.gatePassId!,
              loggedAt: log.loggedAt,
              customerName: log.destination || 'N/A',
              authorizedBy: log.issuedTo || 'N/A',
              items: [],
              totalItems: 0,
              passNumber: 0, 
            };
          }
          acc[log.gatePassId!].items.push(enrichedLog);
          acc[log.gatePassId!].totalItems += enrichedLog.quantityRemoved;
          if (new Date(log.loggedAt) < new Date(acc[log.gatePassId!].loggedAt)) {
            acc[log.gatePassId!].loggedAt = log.loggedAt;
          }
          return acc;
        }, {} as Record<string, Omit<GatePassSummary, 'passNumber'>>);

        const summariesArray = Object.values(groupedByGatePassId)
          .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
          .map((summary, index, array) => ({
            ...summary,
            passNumber: array.length - index, 
          }));
        
        setGatePassSummaries(summariesArray);
      }).catch(err => {
        console.error("Failed to load data:", err);
        toast({ title: "Error", description: `Could not load outgoing stock data: ${err.message}`, variant: "destructive" });
      }).finally(() => setIsLoadingData(false));
    }
  }, [user, authLoading, router, toast]);

  const generatePrintableTextForSelectedPass = (pass: GatePassSummary | null, currentProfileData: ProfileData | null) => {
    if (!pass) return "";

    let text = "";
    const gatePassNumber = pass.gatePassId.substring(pass.gatePassId.lastIndexOf('-') + 1).slice(-6);
    const LINE_WIDTH = 42; 

    const shopName = currentProfileData?.shopDetails?.shopName || 'YOUR SHOP NAME';
    const shopAddress = currentProfileData?.shopDetails?.address || 'YOUR SHOP ADDRESS';
    const shopContact = currentProfileData?.shopDetails?.contactNumber || 'YOUR CONTACT';
    
    const centerText = (str: string) => {
        const len = str.length;
        if (len >= LINE_WIDTH) return str.substring(0, LINE_WIDTH);
        const padding = Math.floor((LINE_WIDTH - len) / 2);
        return ' '.repeat(padding) + str + ' '.repeat(LINE_WIDTH - len - padding);
    };
    
    const headerSeparator = "=".repeat(LINE_WIDTH);

    text += `\n${centerText("GATE PASS")}\n`;
    text += `${headerSeparator}\n`;
    text += `${centerText(shopName)}\n`;
    if (shopAddress) text += `${centerText(shopAddress)}\n`;
    if (shopContact) text += `${centerText(`Contact: ${shopContact}`)}\n`;
    text += `${headerSeparator}\n\n`;
    
    text += `Gate Pass No. : ${gatePassNumber}\n`;
    text += `Date & Time   : ${format(new Date(pass.loggedAt), "MMM dd, yyyy, p")}\n`;
    text += `Customer Name : ${pass.customerName}\n`;
    text += `Authorized By : ${pass.authorizedBy}\n`;
    text += `Gate Pass ID  : ${pass.gatePassId} (For QR)\n\n`;
    
    const snColW = 4;
    const productColW = 20;
    const qtyColW = 5;
    const unitColW = 8;

    const padCenterCol = (str: string, width: number) => {
        const len = str.length;
        if (len >= width) return str.substring(0, width);
        const leftPadding = Math.floor((width - len) / 2);
        const rightPadding = width - len - leftPadding;
        return ' '.repeat(leftPadding) + str + ' '.repeat(rightPadding);
    };
    
    const topBorder = '+' + '-'.repeat(snColW) + '+' + '-'.repeat(productColW) + '+' + '-'.repeat(qtyColW) + '+' + '-'.repeat(unitColW) + '+';
    const middleTableBorder = '+' + '-'.repeat(snColW) + '+' + '-'.repeat(productColW) + '+' + '-'.repeat(qtyColW) + '+' + '-'.repeat(unitColW) + '+';
    const bottomBorder = '+' + '-'.repeat(snColW) + '+' + '-'.repeat(productColW) + '+' + '-'.repeat(qtyColW) + '+' + '-'.repeat(unitColW) + '+';

    text += topBorder + "\n";

    let headerRow = "|";
    headerRow += "S.N".padEnd(snColW) + "|"; 
    headerRow += "Product (SKU)".padEnd(productColW) + "|";
    headerRow += padCenterCol("Qty", qtyColW) + "|";
    headerRow += padCenterCol("Unit", unitColW) + "|";
    text += headerRow + "\n";
    text += middleTableBorder + "\n";

    pass.items.forEach((item, index) => {
        const snStr = (index + 1).toString() + ".";
        const nameAndSku = `${item.productName}${item.productSku ? ` (${item.productSku})` : ''}`;
        const qtyStr = item.quantityRemoved.toString();
        const unitDisplay = item.unitAbbreviation || item.unitName;

        const nameAndSkuChunks = [];
        for (let i = 0; i < nameAndSku.length; i += productColW) {
            nameAndSkuChunks.push(nameAndSku.substring(i, i + productColW));
        }
        if (nameAndSkuChunks.length === 0) {
            nameAndSkuChunks.push(''); 
        }

        nameAndSkuChunks.forEach((chunk, chunkIndex) => {
            let itemRowText = "|";
            if (chunkIndex === 0) { 
                itemRowText += snStr.padEnd(snColW) + "|";
                itemRowText += chunk.padEnd(productColW) + "|"; 
                itemRowText += padCenterCol(qtyStr, qtyColW) + "|"; 
                itemRowText += padCenterCol(unitDisplay.substring(0, unitColW), unitColW) + "|"; 
            } else { 
                itemRowText += " ".repeat(snColW) + "|"; 
                itemRowText += chunk.padEnd(productColW) + "|"; 
                itemRowText += " ".repeat(qtyColW) + "|"; 
                itemRowText += " ".repeat(unitColW) + "|"; 
            }
            text += itemRowText + "\n";
        });
        if (index < pass.items.length -1) {
            text += middleTableBorder + "\n";
        }
    });
    text += bottomBorder + "\n"; 

    const totalQty = pass.items.reduce((sum, item) => sum + item.quantityRemoved, 0);
    const totalQtyStr = `Total Quantity: ${totalQty}`;
    text += "\n" + centerText(totalQtyStr) + "\n";
    text += "=".repeat(LINE_WIDTH) + "\n\n";

    text += "Verified By (Store Manager):\n\n";
    text += "_____________________________\n\n";
    text += "Received By (Customer):\n\n";
    text += "_____________________________\n\n";
    text += `${centerText("Thank you!")}\n`;
    
    return text;
  };

  const handleOpenDetailsDialog = (gatePass: GatePassSummary) => {
    const passText = generatePrintableTextForSelectedPass(gatePass, profileData);
    setSelectedGatePass({ ...gatePass, rawPrintText: passText });
    setIsDetailsDialogOpen(true);
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

  const handleNativeAppPrintFromHistory = () => {
    if (!selectedGatePass?.rawPrintText) {
        toast({title: "Error", description: "No gate pass text available to print.", variant: "destructive"});
        return;
    }
    const encodedText = encodeURIComponent(selectedGatePass.rawPrintText);
    const intentUrl = `intent://print?text=${encodedText}#Intent;scheme=stockflowprint;package=com.example.stockflowprintapp;end`;
    
    window.location.href = intentUrl;

    toast({
        title: "Attempting Native Print",
        description: "If your Stockflow Print App is installed, it should open.",
        duration: 7000,
    });
  };


  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading Outgoing Stock History...</p>
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
          <ArrowUpFromLine className="h-10 w-10 text-primary mr-3"/>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Outgoing Stock</h1>
            <p className="text-muted-foreground">History of all generated gate passes and outgoing product movements.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dashboard/generate-gate-pass">
            <FileTextIcon className="mr-2 h-5 w-5" /> Generate Gate Pass
          </Link>
        </Button>
      </header>
      
      {gatePassSummaries.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-6 text-center">
            <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold">No Outgoing Stock Logs</h3>
            <p className="text-muted-foreground">
              No gate passes have been generated yet. Items will appear here after a gate pass is created.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pass No.</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Gate Pass ID</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead className="text-center">Total Items</TableHead>
                <TableHead>Authorized By</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gatePassSummaries.map((summary) => (
                <TableRow key={summary.gatePassId}
                ><TableCell className="font-medium">{summary.passNumber}</TableCell
                ><TableCell>{format(new Date(summary.loggedAt), "MMM dd, yyyy, p")}</TableCell
                ><TableCell className="font-mono text-xs">{summary.gatePassId.substring(0, 12)}...</TableCell
                ><TableCell>{summary.customerName}</TableCell
                ><TableCell className="text-center">{summary.totalItems}</TableCell
                ><TableCell>{summary.authorizedBy}</TableCell
                ><TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDetailsDialog(summary)}>
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View Gate Pass Details</span>
                    </Button>
                  </TableCell></TableRow
                >
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {selectedGatePass && (
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader className="flex flex-row justify-between items-center pr-6">
                <DialogTitle>Gate Pass Details: #{selectedGatePass.gatePassId.substring(selectedGatePass.gatePassId.lastIndexOf('-') + 1).slice(-6)}</DialogTitle>
                <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2">
                        <CloseIcon className="h-5 w-5" />
                    </Button>
                </DialogClose>
            </DialogHeader>
            <DialogDescription>
                Logged: {format(new Date(selectedGatePass.loggedAt), "MMMM dd, yyyy, p")}
            </DialogDescription>

            <div className="my-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="flex items-center">
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Customer:</span>
                    <strong className="ml-auto">{selectedGatePass.customerName}</strong>
                </div>
                <div className="flex items-center">
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Authorized By:</span>
                    <strong className="ml-auto">{selectedGatePass.authorizedBy}</strong>
                </div>
                <div className="flex items-center">
                    <Hash className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Gate Pass ID:</span>
                    <Badge variant="outline" className="ml-auto font-mono text-xs">{selectedGatePass.gatePassId}</Badge>
                </div>
                 <div className="flex items-center">
                    <ShoppingBag className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Total Quantity:</span>
                    <strong className="ml-auto">{selectedGatePass.totalItems}</strong>
                </div>
            </div>
            
            <h4 className="font-semibold mb-2 text-md">Items Dispatched:</h4>
            <ScrollArea className="max-h-[30vh] border rounded-md p-1">
                <Table className="text-xs">
                    <TableHeader>
                        <TableRow
                        ><TableHead className="w-[60px] h-8 px-2">Image</TableHead
                        ><TableHead className="h-8 px-2">Product (SKU)</TableHead
                        ><TableHead className="h-8 px-2 text-center">Qty</TableHead
                        ><TableHead className="h-8 px-2">Unit</TableHead></TableRow
                        >
                    </TableHeader>
                    <TableBody>
                        {selectedGatePass.items.map(item => (
                            <TableRow key={item.id + item.productId} className="hover:bg-muted/30"
                            ><TableCell className="p-1.5">
                                    <Image
                                      src={item.productImageUrl || "https://placehold.co/48x48.png"}
                                      alt={item.productName}
                                      width={36}
                                      height={36}
                                      className="rounded-sm object-cover aspect-square"
                                      data-ai-hint="product item"
                                    />
                                </TableCell><TableCell className="p-1.5">
                                    {item.productName}
                                    <span className="block text-muted-foreground text-[10px] font-mono">
                                        {item.productSku || 'N/A'}
                                    </span>
                                </TableCell><TableCell className="p-1.5 text-center">{item.quantityRemoved}</TableCell
                                ><TableCell className="p-1.5">{item.unitAbbreviation || item.unitName}</TableCell></TableRow
                            >
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
            
            <DialogFooter className="mt-6 gap-2 sm:justify-end flex-wrap">
              <DialogClose asChild>
                <Button type="button" variant="outline">Close</Button>
              </DialogClose>
              <Button variant="outline" onClick={handleNativeAppPrintFromHistory} disabled={!selectedGatePass?.rawPrintText}>
                  <Bluetooth className="mr-2 h-4 w-4" /> Print via App (Android)
              </Button>
              <Button onClick={handlePrintDialogContent} disabled={!selectedGatePass?.rawPrintText}>
                  <Printer className="mr-2 h-4 w-4"/> Print (Standard)
              </Button>
            </DialogFooter>

            {selectedGatePass?.rawPrintText && (
                 <div className="hidden">
                    <div ref={gatePassPrintContentRef} className="p-1">
                        <pre className="font-mono text-[10pt] whitespace-pre-wrap break-all leading-tight">
                            {selectedGatePass.rawPrintText}
                        </pre>
                        <div className="mt-2 flex justify-center">
                            <QRCodeSVG value={selectedGatePass.gatePassId} size={80} bgColor={"#ffffff"} fgColor={"#000000"} level={"L"} includeMargin={false} />
                        </div>
                    </div>
                 </div>
            )}

          </DialogContent>
        </Dialog>
      )}

      <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}

    
