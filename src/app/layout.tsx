
import type {Metadata, Viewport} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Stockflow Gatepass Generator',
  description: 'Generate gate passes for your inventory with AI assistance.',
  manifest: '/manifest.json',
  icons: {
    apple: '/icons/icon-192x192.png', // Basic apple touch icon, provide more sizes if needed
  },
};

export const viewport: Viewport = {
  themeColor: '#673ab7',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* You can add more specific PWA meta tags here if needed, 
            but manifest and theme-color cover the basics. */}
      </head>
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
