
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function GenerateGatePassPage() {
  const { user, loading } = useAuthContext();
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
    <div className="container mx-auto">
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
      </header>

      <Card className="shadow-lg">
        <CardContent className="p-6">
          <p className="text-muted-foreground">Gate pass generation functionality will be implemented here.</p>
        </CardContent>
      </Card>

       <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}
