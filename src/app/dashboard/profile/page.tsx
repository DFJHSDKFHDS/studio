
'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';


export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuthContext();

  return (
    <div className="container mx-auto">
      <header className="mb-8 flex items-center">
         <Button variant="outline" size="icon" className="mr-4" onClick={() => router.push('/dashboard/generate-gate-pass')}>
            <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-4xl font-bold text-primary tracking-tight">User Profile</h1>
      </header>
      <Card className="max-w-md mx-auto shadow-lg">
        <CardHeader className="items-center text-center">
            <Avatar className="h-24 w-24 mb-4">
                {/* Placeholder for AvatarImage if user.photoURL exists */}
                <AvatarFallback className="text-4xl">
                    <User className="h-12 w-12"/>
                </AvatarFallback>
            </Avatar>
          <CardTitle className="text-2xl">{user?.displayName || 'User Profile'}</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold">Email Verified:</h3>
            <p className="text-muted-foreground">{user?.emailVerified ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <h3 className="font-semibold">Account Created:</h3>
            <p className="text-muted-foreground">
              {user?.metadata?.creationTime 
                ? new Date(user.metadata.creationTime).toLocaleDateString()
                : 'N/A'}
            </p>
          </div>
           <div>
            <h3 className="font-semibold">Last Signed In:</h3>
            <p className="text-muted-foreground">
                {user?.metadata?.lastSignInTime
                ? new Date(user.metadata.lastSignInTime).toLocaleString()
                : 'N/A'}
            </p>
          </div>
          <Button className="w-full" variant="outline" onClick={() => alert('Edit profile functionality to be implemented.')}>
            Edit Profile
          </Button>
        </CardContent>
      </Card>
       <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}
