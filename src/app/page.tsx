import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function HomePage() {
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
          Gate Pass Generator
        </p>
        <p className="mt-3 text-md text-muted-foreground max-w-md mx-auto">
          Streamline your inventory management with AI-assisted gate pass creation.
          Easily track items, assign responsibility, and get insights from your inventory history.
        </p>
        <div className="mt-10">
          <Button asChild size="lg" className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <Link href="/generate-gate-pass">
              Create Gate Pass <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
         <p className="mt-12 text-sm text-muted-foreground">
          Powered by Next.js & ShadCN UI
        </p>
      </div>
    </main>
  );
}
