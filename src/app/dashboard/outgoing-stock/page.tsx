
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
import { ArrowLeft, PlusCircle, Loader2, PackageSearch, Eye, ArrowUpFromLine, Box, CalendarDays, FileText as FileTextIcon, UserRound, Hash, MapPin, Tags, Edit3, ExternalLink } from 'lucide-react';
import type { Product, OutgoingStockLogEntry } from '@/types';
import { fetchProducts, fetchOutgoingStockLogs } from '@/lib/productService';
import { format } from 'date-fns';

interface EnrichedOutgoingStockLogEntry extends OutgoingStockLogEntry {
  productImageUrl?: string;
  productSku?: string;
}

export default function OutgoingStockPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const { toast } = useToast();

  const [logs, setLogs] = useState<EnrichedOutgoingStockLogEntry[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [selectedLogEntry, setSelectedLogEntry] = useState<EnrichedOutgoingStockLogEntry | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/dashboard/outgoing-stock');
      return;
    }
    if (user?.uid) {
      setIsLoadingData(true);
      Promise.all([
        fetchProducts(user.uid),
        fetchOutgoingStockLogs(user.uid)
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
        toast({ title: "Error", description: `Could not load outgoing stock data: ${err.message}`, variant: "destructive" });
      }).finally(() => setIsLoadingData(false));
    }
  }, [user, authLoading, router, toast]);

  const handleOpenDetailsDialog = (logEntry: EnrichedOutgoingStockLogEntry) => {
    setSelectedLogEntry(logEntry);
    setIsDetailsDialogOpen(true);
  };

  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Outgoing Stock History...</p>
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
            <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Outgoing Stock History</h1>
            <p className="text-muted-foreground">Record of all items dispatched from inventory.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dashboard/generate-gate-pass">
            <FileTextIcon className="mr-2 h-5 w-5" /> Generate Gate Pass
          </Link>
        </Button>
      </header>
      
      {logs.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-6 text-center">
            <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold">No Outgoing Stock Logs</h3>
            <p className="text-muted-foreground">
              No stock has been logged as outgoing yet. Items will appear here after a gate pass is generated.
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
                <TableHead>Qty Removed</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Gate Pass ID</TableHead>
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
                  <TableCell>{log.quantityRemoved} {log.unitAbbreviation || log.unitName}</TableCell>
                  <TableCell>{log.destination || 'N/A'}</TableCell>
                  <TableCell>{log.gatePassId || 'N/A'}</TableCell>
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
              <DialogTitle>Outgoing Stock Log Details</DialogTitle>
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
                      <span>Quantity Removed:</span>
                      <Badge variant="secondary" className="ml-auto">{selectedLogEntry.quantityRemoved} {selectedLogEntry.unitAbbreviation || selectedLogEntry.unitName}</Badge>
                    </div>
                     <div className="flex items-center">
                      <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Destination:</span>
                      <span className="ml-auto">{selectedLogEntry.destination || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <Tags className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Reason:</span>
                      <span className="ml-auto">{selectedLogEntry.reason || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <UserRound className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Issued To:</span>
                      <span className="ml-auto">{selectedLogEntry.issuedTo || 'N/A'}</span>
                    </div>
                     <div className="flex items-center">
                      <ExternalLink className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Gate Pass ID:</span>
                      <span className="ml-auto">{selectedLogEntry.gatePassId || 'N/A'}</span>
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
