
'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ScanPassIdPage() {
  const router = useRouter();
  return (
    <div className="container mx-auto">
      <header className="mb-8 flex items-center">
         <Button variant="outline" size="icon" className="mr-4" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-4xl font-bold text-primary tracking-tight">Scan Gate Pass ID</h1>
      </header>
      <div className="bg-card p-6 rounded-lg shadow-lg">
        <p className="text-muted-foreground">Interface for scanning or entering a Gate Pass ID to verify details will be here.</p>
        {/* Placeholder for scanning/input functionality */}
      </div>
       <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}
