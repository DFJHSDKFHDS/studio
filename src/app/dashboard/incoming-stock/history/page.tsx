
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
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, PlusCircle, Loader2, PackageSearch, Eye, ShoppingCart } from 'lucide-react';
import type { Product, IncomingStockLogEntry } from '@/types';
import { fetchProducts, fetchIncomingStockLogs } from '@/lib/productService';
import { format } from 'date-fns';

interface EnrichedIncomingStockLogEntry extends IncomingStockLogEntry {
  productImageUrl?: string;
}

export default function IncomingStockHistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const { toast } = useToast();

  const [logs, setLogs] = useState<EnrichedIncomingStockLogEntry[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

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
        }));
        setLogs(enrichedLogs);
      }).catch(err => {
        console.error("Failed to load data:", err);
        toast({ title: "Error", description: `Could not load data: ${err.message}`, variant: "destructive" });
      }).finally(() => setIsLoadingData(false));
    }
  }, [user, authLoading, router, toast]);

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
                <TableHead>Date Received</TableHead>
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
                  <TableCell>{format(new Date(log.arrivalDate), "MMM dd, yyyy")}</TableCell>
                  <TableCell className="font-medium">{log.productName}</TableCell>
                  <TableCell>{log.quantityAdded} {log.unitAbbreviation || log.unitName}</TableCell>
                  <TableCell>{log.supplier || 'N/A'}</TableCell>
                  <TableCell>{log.poNumber || 'N/A'}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" disabled> {/* Placeholder for view action */}
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
      <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}
