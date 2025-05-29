
'use client';

import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, UserRoundCog, Store, Users, Baseline, PlusCircle, Trash2, Save, Loader2 } from 'lucide-react';
import type { ProfileData, ShopDetails, Unit } from '@/types';
import { saveProfileData, loadProfileData } from '@/lib/profileService';
import { EmailAuthProvider, reauthenticateWithCredential, type AuthError } from 'firebase/auth';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const { toast } = useToast();

  const [shopDetails, setShopDetails] = useState<ShopDetails>({ shopName: '', contactNumber: '', address: '' });
  const [employees, setEmployees] = useState<string[]>([]);
  const [newEmployee, setNewEmployee] = useState<string>('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [newUnitName, setNewUnitName] = useState<string>('');
  const [newUnitAbbreviation, setNewUnitAbbreviation] = useState<string>('');
  
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isReAuthDialogOpen, setIsReAuthDialogOpen] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/dashboard/profile');
      return;
    }
    if (user?.uid) {
      setIsLoadingData(true);
      loadProfileData(user.uid)
        .then((data) => {
          if (data) {
            setShopDetails(data.shopDetails || { shopName: '', contactNumber: '', address: '' });
            setEmployees(data.employees || []);
            setUnits(data.units || []);
          }
        })
        .catch(error => {
          console.error("Failed to load profile data:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          toast({ title: "Error Loading Profile", description: `Could not load profile data. ${errorMessage || 'Please try again.'}`, variant: "destructive" });
        })
        .finally(() => setIsLoadingData(false));
    }
  }, [user, authLoading, toast, router]);

  const handleShopDetailsChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setShopDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleAddEmployee = () => {
    if (newEmployee.trim() && !employees.includes(newEmployee.trim())) {
      setEmployees(prev => [...prev, newEmployee.trim()]);
      setNewEmployee('');
    } else if (employees.includes(newEmployee.trim())) {
        toast({ title: "Duplicate Employee", description: "This employee name already exists.", variant: "destructive"});
    }
  };

  const handleRemoveEmployee = (employeeToRemove: string) => {
    setEmployees(prev => prev.filter(emp => emp !== employeeToRemove));
  };

  const handleAddUnit = () => {
    if (newUnitName.trim()) {
      const unitExists = units.some(unit => unit.name.toLowerCase() === newUnitName.trim().toLowerCase());
      if (unitExists) {
        toast({ title: "Duplicate Unit", description: "A unit with this name already exists.", variant: "destructive"});
        return;
      }
      const newUnit: Unit = { 
        id: newUnitName.trim().toLowerCase().replace(/\s+/g, '-'), // simple ID generation
        name: newUnitName.trim(), 
        abbreviation: newUnitAbbreviation.trim() || undefined 
      };
      setUnits(prev => [...prev, newUnit]);
      setNewUnitName('');
      setNewUnitAbbreviation('');
    }
  };

  const handleRemoveUnit = (unitIdToRemove: string) => {
    setUnits(prev => prev.filter(unit => unit.id !== unitIdToRemove));
  };

  const handleSaveProfile = async () => {
    if (!user || !user.email) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    setIsReAuthDialogOpen(true);
  };

  const performSaveAfterReauth = async () => {
    if (!user?.uid) {
      toast({ title: "Error", description: "User ID not available for saving.", variant: "destructive" });
      setIsSaving(false);
      setIsReAuthDialogOpen(false);
      setPassword('');
      return;
    }
    
    const profileData: ProfileData = { shopDetails, employees, units };
    try {
      await saveProfileData(user.uid, profileData);
      toast({ title: "Profile Saved", description: "Your profile data has been updated." });
      setIsReAuthDialogOpen(false); // Close dialog on successful save
      setPassword(''); // Clear password on successful save
    } catch (error) {
      let errorMessage = 'An unknown error occurred while saving.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string') {
        errorMessage = (error as any).message;
      } else {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = String(error);
        }
      }
      console.error("Failed to save profile. Full error object:", error);
      console.error("Failed to save profile. Extracted/stringified error message:", errorMessage);

      toast({ 
        title: "Error Saving Profile", 
        description: `Could not save profile data: ${errorMessage || 'Please try again.'}`, 
        variant: "destructive" 
      });
      // Keep dialog open on save error to allow retry or cancellation. Password remains.
    } finally {
      setIsSaving(false); // Reset saving state regardless of save outcome (success handled above)
    }
  };

  const handleReAuthentication = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.email || !password) {
      toast({ title: "Error", description: "Password is required for re-authentication.", variant: "destructive" });
      return;
    }
    setIsSaving(true); 
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      toast({ title: "Re-authentication Successful", description: "Proceeding to save profile."});
      await performSaveAfterReauth(); 
    } catch (error: any) {
      console.error("Re-authentication failed:", error);
      const authError = error as AuthError;
      toast({ 
        title: "Re-authentication Failed", 
        description: authError.message || "Incorrect password or an error occurred.", 
        variant: "destructive" 
      });
      setIsSaving(false); 
      // Do not close dialog or clear password if re-auth fails, let user try again or cancel.
    }
    // setIsSaving(false) is handled by performSaveAfterReauth's finally for the save part,
    // or here if re-auth itself fails.
  };
  
  const closeReAuthDialog = () => {
    setIsReAuthDialogOpen(false);
    setPassword('');
    setIsSaving(false); // Ensure saving state is reset if dialog is cancelled
  };

  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Profile...</p>
      </div>
    );
  }

  if (!user && !authLoading) {
    // This case should be handled by the useEffect redirect, but as a fallback:
    return <p>User not authenticated. Redirecting to login...</p>;
  }


  return (
    <div className="container mx-auto max-w-4xl">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="outline" size="icon" className="mr-4" onClick={() => router.push('/dashboard/generate-gate-pass')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <UserRoundCog className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">User Profile</h1>
            <p className="text-muted-foreground">Manage shop details, employees, and units of measurement.</p>
          </div>
        </div>
      </header>

      <div className="space-y-8">
        {/* Shop Details Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl"><Store className="mr-2 h-6 w-6 text-accent" />Shop Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="shopName">Client / Shop Name</Label>
              <Input id="shopName" name="shopName" value={shopDetails.shopName} onChange={handleShopDetailsChange} placeholder="e.g., Sagar Paint House" />
            </div>
            <div>
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input id="contactNumber" name="contactNumber" value={shopDetails.contactNumber} onChange={handleShopDetailsChange} placeholder="e.g., 9075117961" />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" value={shopDetails.address} onChange={handleShopDetailsChange} placeholder="e.g., In front of State Bank of India" rows={3}/>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Manage Employees Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl"><Users className="mr-2 h-6 w-6 text-accent" />Manage Employees</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input value={newEmployee} onChange={(e) => setNewEmployee(e.target.value)} placeholder="New employee name" className="flex-grow" />
              <Button onClick={handleAddEmployee} size="icon" variant="outline"><PlusCircle className="h-5 w-5" /></Button>
            </div>
            {employees.length > 0 ? (
              <ul className="space-y-2">
                {employees.map(emp => (
                  <li key={emp} className="flex items-center justify-between p-2 border rounded-md bg-secondary/20">
                    <span>{emp}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveEmployee(emp)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No employees added yet.</p>}
          </CardContent>
        </Card>

        <Separator />

        {/* Manage Units of Measurement Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl"><Baseline className="mr-2 h-6 w-6 text-accent" />Manage Units of Measurement</CardTitle>
            <CardDescription>Define common units for your products (e.g., pieces, kilograms, liters, meters).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <Input value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} placeholder="Unit name (e.g., Box)" />
              <Input value={newUnitAbbreviation} onChange={(e) => setNewUnitAbbreviation(e.target.value)} placeholder="Abbreviation (e.g., bx)" />
              <Button onClick={handleAddUnit} size="icon" variant="outline" className="w-full md:w-auto mt-2 md:mt-0"><PlusCircle className="h-5 w-5" /></Button>
            </div>
            {units.length > 0 ? (
              <ul className="space-y-2">
                {units.map(unit => (
                  <li key={unit.id} className="flex items-center justify-between p-2 border rounded-md bg-secondary/20">
                    <span>{unit.name}{unit.abbreviation ? ` (${unit.abbreviation})` : ''}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveUnit(unit.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </li>
                ))}
              </ul>
            ): <p className="text-sm text-muted-foreground">No units added yet.</p>}
          </CardContent>
        </Card>

        <CardFooter className="flex justify-end mt-8">
          <Button onClick={handleSaveProfile} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Profile
          </Button>
        </CardFooter>
      </div>

      {/* Re-authentication Dialog */}
      <AlertDialog open={isReAuthDialogOpen} onOpenChange={(open) => {
        if (!open) { // If dialog is closed (e.g. by clicking cancel or outside without submit)
          closeReAuthDialog();
        } else {
            setIsReAuthDialogOpen(true);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-authenticate to Save Changes</AlertDialogTitle>
            <AlertDialogDescription>
              For your security, please enter your password to confirm changes to your profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form onSubmit={handleReAuthentication}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="reauth-password">Password</Label>
                <Input 
                  id="reauth-password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Enter your password" 
                  required 
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={closeReAuthDialog} disabled={isSaving}>Cancel</AlertDialogCancel>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm & Save
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      
      <footer className="mt-12 pt-8 border-t text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Stockflow. All rights reserved.</p>
      </footer>
    </div>
  );
}

    