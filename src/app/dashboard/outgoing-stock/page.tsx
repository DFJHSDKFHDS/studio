
'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function OutgoingStockPage() {
  const router = useRouter();
  return (
    <div className="container mx-auto">
      <header className="mb-8 flex items-center">
         <Button variant="outline" size="icon" className="mr-4" onClick={() => router.push('/dashboard/generate-gate-pass')}>
            <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-4xl font-bold text-primary tracking-tight">Log Outgoing Stock</h1>
      </header>
      <div className="bg-card p-6 rounded-lg shadow-lg">
        <p className="text-muted-foreground">Form and listing for logging outgoing stock (before gate pass generation, or independent of it) will be here.</p>
        {/* Placeholder for outgoing stock form */}
      </div>
      <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}
