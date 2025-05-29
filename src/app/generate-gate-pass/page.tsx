
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import OutgoingForm from '@/components/inventory/OutgoingForm';
import InventoryHistorySummarizer from '@/components/gatepass/InventoryHistorySummarizer';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Loader2 } from 'lucide-react';

export default function GenerateGatePassPage() {
  const { user, loading, logOut } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/generate-gate-pass');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Gate Pass Generator...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Or a message, but useEffect should redirect
  }

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen">
      <header className="mb-8 flex justify-between items-center">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-primary tracking-tight">Gate Pass Generator</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Efficiently create and manage outgoing item gate passes.
          </p>
        </div>
         <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
            </Button>
            <Button onClick={logOut} variant="destructive">
              <LogOut className="mr-2 h-4 w-4" /> Log Out
            </Button>
          </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <OutgoingForm />
        </div>
        <div className="lg:col-span-1">
          <InventoryHistorySummarizer />
        </div>
      </div>
       <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}
