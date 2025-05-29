
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard, LogOut, FileText, PlusCircle, MinusCircle, Package } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, loading, logOut } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LayoutDashboard className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Or a message, but useEffect should redirect
  }

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen">
      <header className="mb-8 flex justify-between items-center">
        <div className="flex items-center">
          <LayoutDashboard className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-4xl font-bold text-primary tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-lg">Welcome, {user.email}!</p>
          </div>
        </div>
        <Button onClick={logOut} variant="outline">
          <LogOut className="mr-2 h-4 w-4" /> Log Out
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Package className="mr-2 h-6 w-6 text-accent" /> Total Products
            </CardTitle>
            <CardDescription>Overview of your current inventory.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">0</p> {/* Placeholder */}
            <p className="text-sm text-muted-foreground mt-1">Items in stock</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <PlusCircle className="mr-2 h-6 w-6 text-green-500" /> Incoming Products
            </CardTitle>
            <CardDescription>Log new product arrivals.</CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-4xl font-bold">0</p> {/* Placeholder */}
            <p className="text-sm text-muted-foreground mt-1">Items received recently</p>
            <Button className="mt-4 w-full" asChild>
                <Link href="#">Log Incoming</Link>
            </Button>
          </CardContent>
        </Card>
         <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <MinusCircle className="mr-2 h-6 w-6 text-red-500" /> Outgoing Products
            </CardTitle>
            <CardDescription>Track products leaving inventory.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">0</p> {/* Placeholder */}
            <p className="text-sm text-muted-foreground mt-1">Items dispatched recently</p>
             <Button className="mt-4 w-full" asChild>
                <Link href="#">Log Outgoing</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <Card className="shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader>
            <CardTitle className="flex items-center text-xl">
                <FileText className="mr-2 h-6 w-6 text-blue-500" /> Gate Pass Management
            </CardTitle>
            <CardDescription>Create and manage gate passes for outgoing items.</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground mb-4">Efficiently generate gate passes for items leaving your inventory. Track responsibility and maintain records.</p>
            <Button asChild className="w-full md:w-auto">
                <Link href="/generate-gate-pass">
                    <FileText className="mr-2 h-5 w-5" /> Generate New Gate Pass
                </Link>
            </Button>
        </CardContent>
      </Card>

      <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}
