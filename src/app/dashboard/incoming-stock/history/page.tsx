
'use client';

import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, PlusCircle, Loader2, PackageSearch, Eye, ShoppingCart, Box, CalendarDays, FileText as FileTextIcon, UserRound, Hash } from 'lucide-react';
import type { Product, IncomingStockLogEntry } from '@/types';
import { fetchProducts, fetchIncomingStockLogs } from '@/lib/productService';
import { format } from 'date-fns';

interface EnrichedIncomingStockLogEntry extends IncomingStockLogEntry {
  productImageUrl?: string;
  productSku?: string;
}

export default function IncomingStockHistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const { toast } = useToast();

  const [logs, setLogs] = useState<EnrichedIncomingStockLogEntry[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [selectedLogEntry, setSelectedLogEntry] = useState<EnrichedIncomingStockLogEntry | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/dashboard/incoming-stock/history');
      return;
    }
    if (user?.uid) {
      setIsLoadingData(true);
      Promise.all([
        fetchProducts(user.uid),
        fetchIncomingStockLogs(user.uid)
      ]).then(([products, stockLogs]) => {
        const productsMap = new Map(products.map(p => [p.id, p]));
        const enrichedLogs = stockLogs.map(log => ({
          ...log,
          productImageUrl: productsMap.get(log.productId)?.imageUrl,
          productSku: productsMap.get(log.productId)?.sku,
        }));
        setLogs(enrichedLogs);
      }).catch(err => {
        console.error("Failed to load data:", err);
        toast({ title: "Error", description: `Could not load data: ${err.message}`, variant: "destructive" });
      }).finally(() => setIsLoadingData(false));
    }
  }, [user, authLoading, router, toast]);

  const handleOpenDetailsDialog = (logEntry: EnrichedIncomingStockLogEntry) => {
    setSelectedLogEntry(logEntry);
    setIsDetailsDialogOpen(true);
  };

  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Incoming Stock History...</p>
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
          <ShoppingCart className="h-10 w-10 text-primary mr-3"/>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Incoming Stock</h1>
            <p className="text-muted-foreground">History of all received stock and inventory updates.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dashboard/incoming-stock">
            <PlusCircle className="mr-2 h-5 w-5" /> Add Restock
          </Link>
        </Button>
      </header>
      
      {logs.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-6 text-center">
            <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold">No Incoming Stock Logs</h3>
            <p className="text-muted-foreground">
              No stock has been logged as incoming yet. Click "Add Restock" to start.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead>Date & Time Logged</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>PO #</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Image
                      src={log.productImageUrl || "https://placehold.co/64x64.png"}
                      alt={log.productName}
                      width={48}
                      height={48}
                      className="rounded-md object-cover aspect-square"
                      data-ai-hint="product package"
                    />
                  </TableCell>
                  <TableCell>{format(new Date(log.loggedAt), "MMM dd, yyyy, p")}</TableCell>
                  <TableCell className="font-medium">{log.productName}</TableCell>
                  <TableCell>{log.quantityAdded} {log.unitAbbreviation || log.unitName}</TableCell>
                  <TableCell>{log.supplier || 'N/A'}</TableCell>
                  <TableCell>{log.poNumber || 'N/A'}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDetailsDialog(log)}>
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View Log Details</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {selectedLogEntry && (
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Incoming Stock Log Details</DialogTitle>
              <DialogDescription>
                Logged: {format(new Date(selectedLogEntry.loggedAt), "MMM dd, yyyy, p")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Card className="overflow-hidden shadow-none border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Image
                      src={selectedLogEntry.productImageUrl || "https://placehold.co/80x80.png"}
                      alt={selectedLogEntry.productName}
                      width={60}
                      height={60}
                      className="rounded-md object-cover aspect-square"
                      data-ai-hint="product item"
                    />
                    <div>
                      <h3 className="text-lg font-semibold">{selectedLogEntry.productName}</h3>
                      <p className="text-sm text-muted-foreground">SKU: {selectedLogEntry.productSku || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center">
                      <Box className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Quantity Received:</span>
                      <Badge variant="secondary" className="ml-auto">{selectedLogEntry.quantityAdded} {selectedLogEntry.unitAbbreviation || selectedLogEntry.unitName}</Badge>
                    </div>
                    <div className="flex items-center">
                      <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Date Received (Arrival):</span>
                      <span className="ml-auto">{format(new Date(selectedLogEntry.arrivalDate), "MMMM dd, yyyy")}</span>
                    </div>
                    <div className="flex items-center">
                      <FileTextIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Purchase Order #:</span>
                      <span className="ml-auto">{selectedLogEntry.poNumber || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <UserRound className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Supplier:</span>
                      <span className="ml-auto">{selectedLogEntry.supplier || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <Hash className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Log ID:</span>
                      <span className="ml-auto truncate max-w-[150px]">{selectedLogEntry.id}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}
