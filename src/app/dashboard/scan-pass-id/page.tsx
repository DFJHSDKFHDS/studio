
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, ScanLine, CameraOff, PackageSearch, Hash, UserRound, ShoppingBag, MapPin, CalendarDays, Printer, AlertCircle, RefreshCcw } from 'lucide-react';
import type { Product, OutgoingStockLogEntry, ProfileData } from '@/types';
import { fetchProducts, fetchOutgoingStockLogs } from '@/lib/productService';
import { loadProfileData } from '@/lib/profileService';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react'; // For generating QR if needed, not for reading
import jsQR from 'jsqr';

interface EnrichedOutgoingStockLogEntryForScan extends OutgoingStockLogEntry {
  productImageUrl?: string;
  productSku?: string;
}

interface ScannedGatePassSummary {
  passNumber?: number; // Might not be available if fetching single pass
  gatePassId: string;
  loggedAt: string;
  customerName: string;
  authorizedBy: string;
  items: EnrichedOutgoingStockLogEntryForScan[];
  totalItems: number;
  rawPrintText?: string;
}

export default function ScanPassIdPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const { toast } = useToast();

  const [gatePassIdInput, setGatePassIdInput] = useState<string>('');
  const [verifiedGatePass, setVerifiedGatePass] = useState<ScannedGatePassSummary | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
   const streamRef = useRef<MediaStream | null>(null);


  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/dashboard/scan-pass-id');
    }
     // Fetch profile data once when user is available
    if (user?.uid && !profileData) {
      loadProfileData(user.uid)
        .then(setProfileData)
        .catch(err => console.warn("Could not load profile data for printing:", err));
    }
    return () => {
      stopCamera();
    };
  }, [user, authLoading, router, profileData, stopCamera]);


  const startScan = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsScanning(true);
          setError(null);
          setVerifiedGatePass(null); // Clear previous results
          setGatePassIdInput(''); // Clear manual input
          
          // Start QR detection loop
          scanIntervalRef.current = setInterval(() => {
            if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              const video = videoRef.current;
              const canvas = canvasRef.current;
              const context = canvas.getContext('2d');
              
              if (context) {
                canvas.height = video.videoHeight;
                canvas.width = video.videoWidth;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: "dontInvert",
                });

                if (code) {
                  setGatePassIdInput(code.data);
                  stopCamera();
                  handleVerifyPass(code.data); // Auto-verify after scan
                  toast({ title: "QR Code Scanned!", description: `ID: ${code.data}` });
                }
              }
            }
          }, 200); // Scan every 200ms
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setHasCameraPermission(false);
        setIsScanning(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings.',
        });
      }
    } else {
      setHasCameraPermission(false);
      toast({ variant: 'destructive', title: 'Camera Not Supported', description: 'Your browser does not support camera access.' });
    }
  };


  const handleVerifyPass = async (idToVerify?: string) => {
    const currentId = idToVerify || gatePassIdInput;
    if (!currentId.trim()) {
      setError("Please enter or scan a Gate Pass ID.");
      return;
    }
    if (!user?.uid) {
      setError("User not authenticated.");
      return;
    }

    setIsLoadingData(true);
    setError(null);
    setVerifiedGatePass(null);

    try {
      const [allProducts, allOutgoingLogs] = await Promise.all([
        fetchProducts(user.uid),
        fetchOutgoingStockLogs(user.uid)
      ]);

      const productsMap = new Map(allProducts.map(p => [p.id, p]));
      const relevantLogs = allOutgoingLogs.filter(log => log.gatePassId === currentId.trim());

      if (relevantLogs.length === 0) {
        setError(`Gate Pass ID "${currentId.trim()}" not found.`);
        setVerifiedGatePass(null);
      } else {
        const enrichedItems = relevantLogs.map(log => ({
          ...log,
          productImageUrl: productsMap.get(log.productId)?.imageUrl,
          productSku: productsMap.get(log.productId)?.sku,
        }));

        const passSummary: ScannedGatePassSummary = {
          gatePassId: currentId.trim(),
          loggedAt: relevantLogs[0].loggedAt, // Assume all items in a pass are logged around same time
          customerName: relevantLogs[0].destination || 'N/A',
          authorizedBy: relevantLogs[0].issuedTo || 'N/A',
          items: enrichedItems,
          totalItems: enrichedItems.reduce((sum, item) => sum + item.quantityRemoved, 0),
        };
        setVerifiedGatePass(passSummary);
      }
    } catch (err) {
      console.error("Error verifying gate pass:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Failed to verify gate pass: ${errorMessage}`);
      setVerifiedGatePass(null);
    } finally {
      setIsLoadingData(false);
    }
  };
  
  const generatePrintableTextForScannedPass = (pass: ScannedGatePassSummary | null, currentProfileData: ProfileData | null) => {
    if (!pass) return "";

    let text = "";
    const gatePassNumber = pass.gatePassId.substring(pass.gatePassId.lastIndexOf('-') + 1).slice(-6);
    const LINE_WIDTH = 42;

    const shopName = currentProfileData?.shopDetails?.shopName || 'YOUR SHOP NAME';
    const shopAddress = currentProfileData?.shopDetails?.address || 'YOUR SHOP ADDRESS';
    const shopContact = currentProfileData?.shopDetails?.contactNumber || 'YOUR CONTACT';
    const separator = "-".repeat(LINE_WIDTH);

    const centerText = (str: string) => {
        const padding = Math.max(0, Math.floor((LINE_WIDTH - str.length) / 2));
        return ' '.repeat(padding) + str;
    }

    text += `\n${centerText("GET PASS")}\n`;
    text += `${separator}\n`;
    text += `${centerText(shopName)}\n`;
    text += `${centerText(shopAddress)}\n`;
    text += `${centerText(`Contact: ${shopContact}`)}\n\n`;
    
    text += `Gate Pass No. : ${gatePassNumber}\n`;
    text += `Date & Time   : ${format(new Date(pass.loggedAt), "MMM dd, yyyy, p")}\n`;
    text += `Customer Name : ${pass.customerName}\n`;
    text += `Authorized By : ${pass.authorizedBy}\n`;
    text += `Gate Pass ID  : ${pass.gatePassId} (For QR)\n\n`;
    
    text += "S.N Product (SKU)            Qty Unit\n";
    text += `${separator}\n`;
    pass.items.forEach((item, index) => {
        const sn = (index + 1).toString().padStart(2);
        const nameAndSku = `${item.productName} (${item.productSku || 'N/A'})`.substring(0, 24).padEnd(24);
        const qty = item.quantityRemoved.toString().padStart(3);
        const unitDisplay = item.unitAbbreviation || item.unitName;
        const unitPadded = unitDisplay.substring(0,5).padEnd(5);
        text += `${sn}. ${nameAndSku} ${qty} ${unitPadded}\n`;
    });
    text += `${separator}\n`;
    const totalQtyStr = `Total Quantity: ${pass.items.reduce((sum, item) => sum + item.quantityRemoved, 0)}`;
    text += `${centerText(totalQtyStr)}\n`;
    text += `${separator}\n\n`;

    text += "Verified By (Store Manager):\n\n";
    text += "_____________________________\n\n";
    text += "Received By (Customer):\n\n";
    text += "_____________________________\n\n";
    text += `${centerText("Thank you!")}\n`;
    
    return text;
  };
  
  const gatePassPrintContentRef = useRef<HTMLDivElement>(null);

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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading...</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto">
      <header className="mb-8 flex items-center">
        <Button variant="outline" size="icon" className="mr-4" onClick={() => router.push('/dashboard/generate-gate-pass')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <ScanLine className="h-10 w-10 text-primary mr-3" />
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Scan Gate Pass ID</h1>
          <p className="text-muted-foreground">Scan QR code or enter ID to verify gate pass details.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              {isScanning ? <CameraOff className="mr-2 h-5 w-5 text-destructive" /> : <ScanLine className="mr-2 h-5 w-5" />}
              {isScanning ? "Scanning..." : "Scan or Enter ID"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-video bg-muted rounded-md overflow-hidden border">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              <canvas ref={canvasRef} className="hidden" /> {/* For jsQR processing */}
              {!isScanning && hasCameraPermission !== false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                  <ScanLine className="h-16 w-16 text-white/70 mb-4" />
                  <Button onClick={startScan}>Start Camera Scan</Button>
                </div>
              )}
            </div>

            {hasCameraPermission === false && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Camera Access Denied</AlertTitle>
                <AlertDescription>
                  Please enable camera permissions in your browser settings to use the scanner.
                  You can still enter the Gate Pass ID manually below.
                </AlertDescription>
              </Alert>
            )}
             {isScanning && (
                <Button onClick={stopCamera} variant="outline" className="w-full">
                    <CameraOff className="mr-2 h-4 w-4" /> Stop Scan
                </Button>
            )}


            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="gatePassIdInput">Or Enter Gate Pass ID Manually:</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="gatePassIdInput"
                  placeholder="e.g., GP-1627882822"
                  value={gatePassIdInput}
                  onChange={(e) => setGatePassIdInput(e.target.value)}
                  disabled={isLoadingData || isScanning}
                />
                <Button onClick={() => handleVerifyPass()} disabled={isLoadingData || isScanning || !gatePassIdInput.trim()}>
                  {isLoadingData ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
                <PackageSearch className="mr-2 h-5 w-5"/> Gate Pass Summary
            </CardTitle>
            <CardDescription>Details of the verified gate pass will appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData && (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Verifying ID...</p>
              </div>
            )}
            {error && !isLoadingData && (
              <Alert variant="destructive" className="h-64 flex flex-col justify-center items-center text-center">
                 <AlertCircle className="h-10 w-10 mb-3"/>
                <AlertTitle>Verification Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!isLoadingData && !error && !verifiedGatePass && (
               <div className="text-center text-muted-foreground py-8 h-64 flex flex-col justify-center items-center">
                <PackageSearch className="mx-auto h-12 w-12 mb-2"/>
                <p>Scan or enter a Gate Pass ID to view details.</p>
              </div>
            )}
            {verifiedGatePass && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-secondary/30">
                    <h3 className="text-lg font-semibold mb-2">
                        Pass ID: <Badge variant="outline" className="font-mono text-sm">{verifiedGatePass.gatePassId}</Badge>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <p><strong className="text-muted-foreground">Customer:</strong> {verifiedGatePass.customerName}</p>
                        <p><strong className="text-muted-foreground">Authorized By:</strong> {verifiedGatePass.authorizedBy}</p>
                        <p><strong className="text-muted-foreground">Date Logged:</strong> {format(new Date(verifiedGatePass.loggedAt), "MMM dd, yyyy, p")}</p>
                        <p><strong className="text-muted-foreground">Total Items:</strong> {verifiedGatePass.totalItems}</p>
                    </div>
                </div>

                <h4 className="font-semibold text-md">Items Dispatched:</h4>
                <ScrollArea className="max-h-[40vh] border rounded-md p-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="p-1.5 text-left w-[48px]">Image</th>
                        <th className="p-1.5 text-left">Product (SKU)</th>
                        <th className="p-1.5 text-center">Qty</th>
                        <th className="p-1.5 text-left">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verifiedGatePass.items.map(item => (
                        <tr key={item.id + item.productId} className="border-b last:border-b-0 hover:bg-muted/20">
                          <td className="p-1.5">
                            <Image
                              src={item.productImageUrl || "https://placehold.co/48x48.png"}
                              alt={item.productName}
                              width={36}
                              height={36}
                              className="rounded-sm object-cover aspect-square"
                              data-ai-hint={item.productSku || "product item"}
                            />
                          </td>
                          <td className="p-1.5">
                            {item.productName}
                            <span className="block text-muted-foreground text-[10px] font-mono">
                              {item.productSku || 'N/A'}
                            </span>
                          </td>
                          <td className="p-1.5 text-center">{item.quantityRemoved}</td>
                          <td className="p-1.5">{item.unitAbbreviation || item.unitName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
                 <Button 
                    onClick={() => {
                        const passText = generatePrintableTextForScannedPass(verifiedGatePass, profileData);
                        setVerifiedGatePass(prev => prev ? {...prev, rawPrintText: passText} : null);
                        setTimeout(handlePrintDialogContent, 50); 
                    }} 
                    className="w-full mt-4"
                    disabled={!verifiedGatePass}
                >
                    <Printer className="mr-2 h-4 w-4"/> Print Gate Pass
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

        {/* Hidden div for printing */}
        {verifiedGatePass?.rawPrintText && (
             <div className="hidden">
                <div ref={gatePassPrintContentRef} className="p-1">
                    <pre className="font-mono text-[10pt] whitespace-pre-wrap break-all leading-tight">
                        {verifiedGatePass.rawPrintText}
                    </pre>
                    <div className="mt-2 flex justify-center">
                        <QRCodeSVG value={verifiedGatePass.gatePassId} size={80} bgColor={"#ffffff"} fgColor={"#000000"} level={"L"} includeMargin={false} />
                    </div>
                </div>
             </div>
        )}


      <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}
