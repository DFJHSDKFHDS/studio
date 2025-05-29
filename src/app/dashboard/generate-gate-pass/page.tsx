
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import OutgoingForm from '@/components/inventory/OutgoingForm';
import InventoryHistorySummarizer from '@/components/gatepass/InventoryHistorySummarizer';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Loader2, ArrowLeft } from 'lucide-react';

export default function GenerateGatePassPage() {
  const { user, loading } = useAuthContext(); // logOut removed as it's in sidebar
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/dashboard/generate-gate-pass');
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
    return null;
  }

  return (
    <div className="container mx-auto"> {/* Removed p-4 md:p-8 min-h-screen */}
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
         {/* Buttons moved to sidebar or a top app bar if needed globally
         <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
            </Button>
            <Button onClick={logOut} variant="destructive">
              <LogOut className="mr-2 h-4 w-4" /> Log Out
            </Button>
          </div>
          */}
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
