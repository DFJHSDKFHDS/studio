
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard, LogOut, FileText, PlusCircle, MinusCircle, Package, QrCode, ArrowDownToLine, ArrowUpFromLine, Boxes, ScanLine, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { fetchProducts, fetchIncomingStockLogs, fetchOutgoingStockLogs } from '@/lib/productService';
import type { Product, IncomingStockLogEntry, OutgoingStockLogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const { toast } = useToast();

  const [totalProductsCount, setTotalProductsCount] = useState<number | null>(null);
  const [totalIncomingItems, setTotalIncomingItems] = useState<number | null>(null);
  const [totalOutgoingItems, setTotalOutgoingItems] = useState<number | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && !authLoading) {
      setIsLoadingStats(true);
      Promise.all([
        fetchProducts(user.uid).then(products => setTotalProductsCount(products.length)).catch(err => {
          console.error("Failed to fetch products count:", err);
          toast({ title: "Error", description: "Could not load total products.", variant: "destructive" });
          setTotalProductsCount(0);
        }),
        fetchIncomingStockLogs(user.uid).then(logs => {
          const incomingSum = logs.reduce((sum, log) => sum + log.quantityAdded, 0);
          setTotalIncomingItems(incomingSum);
        }).catch(err => {
          console.error("Failed to fetch incoming stock:", err);
          toast({ title: "Error", description: "Could not load incoming stock data.", variant: "destructive" });
          setTotalIncomingItems(0);
        }),
        fetchOutgoingStockLogs(user.uid).then(logs => {
          const outgoingSum = logs.reduce((sum, log) => sum + log.quantityRemoved, 0);
          setTotalOutgoingItems(outgoingSum);
        }).catch(err => {
          console.error("Failed to fetch outgoing stock:", err);
          toast({ title: "Error", description: "Could not load outgoing stock data.", variant: "destructive" });
          setTotalOutgoingItems(0);
        })
      ]).finally(() => {
        setIsLoadingStats(false);
      });
    }
  }, [user, authLoading, toast]);


  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <LayoutDashboard className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto">
      <header className="mb-8">
        <div className="flex items-center">
          <LayoutDashboard className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-4xl font-bold text-primary tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-lg">Welcome, {user.email}!</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Boxes className="mr-2 h-6 w-6 text-accent" /> Total Products
            </CardTitle>
            <CardDescription>Overview of your current inventory.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            ) : (
              <p className="text-4xl font-bold">{totalProductsCount ?? 'N/A'}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">Registered product types</p>
             <Button className="mt-4 w-full" asChild variant="outline">
                <Link href="/dashboard/products">View Products</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <ArrowDownToLine className="mr-2 h-6 w-6 text-green-500" /> Incoming Stock
            </CardTitle>
            <CardDescription>Log new product arrivals.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            ) : (
                <p className="text-4xl font-bold">{totalIncomingItems ?? 'N/A'}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">Total items received</p>
            <Button className="mt-4 w-full" asChild>
                <Link href="/dashboard/incoming-stock/history">Log Incoming</Link>
            </Button>
          </CardContent>
        </Card>

         <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <ArrowUpFromLine className="mr-2 h-6 w-6 text-red-500" /> Outgoing Stock
            </CardTitle>
            <CardDescription>Track products leaving inventory.</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoadingStats ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            ) : (
                <p className="text-4xl font-bold">{totalOutgoingItems ?? 'N/A'}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">Total items dispatched</p>
             <Button className="mt-4 w-full" asChild>
                <Link href="/dashboard/outgoing-stock">Log Outgoing</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
              <CardTitle className="flex items-center text-xl">
                  <FileText className="mr-2 h-6 w-6 text-blue-500" /> Gate Pass
              </CardTitle>
              <CardDescription>Create and manage gate passes.</CardDescription>
          </CardHeader>
          <CardContent>
              <p className="text-muted-foreground mb-4">Generate gate passes for items leaving your inventory.</p>
              <Button asChild className="w-full">
                  <Link href="/dashboard/generate-gate-pass">
                      <FileText className="mr-2 h-5 w-5" /> Generate Pass
                  </Link>
              </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <ScanLine className="mr-2 h-6 w-6 text-purple-500" /> Scan Pass ID
            </CardTitle>
            <CardDescription>Quickly scan and verify gate passes.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Use a scanner or enter ID to check pass details.</p>
            <Button className="mt-4 w-full" asChild>
                <Link href="/dashboard/scan-pass-id">Scan Pass</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}
