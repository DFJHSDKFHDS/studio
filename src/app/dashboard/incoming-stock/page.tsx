
'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function IncomingStockPage() {
  const router = useRouter();
  return (
    <div className="container mx-auto">
      <header className="mb-8 flex items-center">
         <Button variant="outline" size="icon" className="mr-4" onClick={() => router.push('/dashboard/generate-gate-pass')}>
            <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-4xl font-bold text-primary tracking-tight">Log Incoming Stock</h1>
      </header>
      <div className="bg-card p-6 rounded-lg shadow-lg">
        <p className="text-muted-foreground">Form and listing for logging incoming stock will be here.</p>
        {/* Placeholder for incoming stock form */}
      </div>
       <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}
