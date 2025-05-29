
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, LogIn, UserPlus, LayoutDashboard, FileText } from 'lucide-react'; // Added FileText
import { useAuthContext } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';


export default function HomePage() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  // Optional: Redirect to dashboard if already logged in
  // useEffect(() => {
  //   if (!loading && user) {
  //     router.push('/dashboard/generate-gate-pass'); // Updated redirect
  //   }
  // }, [user, loading, router]);

  // if (loading) {
  //   return (
  //     <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-gradient-to-br from-background to-secondary">
  //        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-6 animate-pulse">
  //         <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
  //         <polyline points="14 2 14 8 20 8"></polyline>
  //         <line x1="16" y1="13" x2="8" y2="13"></line>
  //         <line x1="16" y1="17" x2="8" y2="17"></line>
  //         <polyline points="10 9 9 9 8 9"></polyline>
  //       </svg>
  //       <p className="text-lg text-muted-foreground">Loading...</p>
  //     </main>
  //   );
  // }


  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-gradient-to-br from-background to-secondary">
      <div className="text-center max-w-2xl">
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-6">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <h1 className="text-5xl font-extrabold tracking-tight text-primary sm:text-6xl md:text-7xl">
          Stockflow
        </h1>
        <p className="mt-4 text-xl text-foreground/80 sm:mt-6 sm:text-2xl">
          Inventory & Gate Pass Management
        </p>
        <p className="mt-3 text-md text-muted-foreground max-w-md mx-auto">
          Streamline your inventory with AI-assisted gate pass creation.
          Easily track items, assign responsibility, and get insights.
        </p>
        <div className="mt-10 space-y-4 md:space-y-0 md:space-x-4">
          {loading ? (
             <Button size="lg" className="shadow-lg hover:shadow-xl transition-shadow duration-300" disabled>
                Loading...
            </Button>
          ) : user ? (
            <Button asChild size="lg" className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <Link href="/dashboard/generate-gate-pass"> {/* Updated link */}
                Generate Gate Pass <FileText className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                <Link href="/login">
                  Log In <LogIn className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                <Link href="/signup">
                  Sign Up <UserPlus className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </>
          )}
        </div>
         <p className="mt-12 text-sm text-muted-foreground">
          Powered by Next.js, Firebase & ShadCN UI
        </p>
      </div>
    </main>
  );
}
