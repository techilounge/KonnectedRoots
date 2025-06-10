
"use client";
import React, { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCircle, Mail, Edit2, KeyRound, Trash2, ImageUp, Eye, EyeOff } from 'lucide-react';

export default function ProfilePage() {
  const { user, loading, logout, updateUserState } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("handleProfilePictureChange triggered");
    const file = event.target.files?.[0];
    if (file && user) {
      console.log("File selected:", file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        const newAvatar = reader.result as string;
        const updatedUser = { ...user, avatar: newAvatar };
        
        if (updateUserState) {
            updateUserState(updatedUser);
             console.log("User state updated with new avatar (client-side).");
        }
        // In a real app, you would upload the file to a server here
        // and get back a URL to store.
        // For now, we just update localStorage for persistence in the demo.
        localStorage.setItem('konnectedRootsUser', JSON.stringify(updatedUser)); 
        toast({ title: "Profile Picture Updated", description: "Your new picture has been set (client-side preview)." });
      };
      reader.readAsDataURL(file);
    } else {
      console.log("No file selected or no user.");
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast({ variant: "destructive", title: "Error", description: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Error", description: "New password must be at least 6 characters." });
      return;
    }

    console.log("Attempting to change password (simulation)...");
    // TODO: Backend integration needed for real password change.
    // Example:
    // try {
    //   const response = await fetch('/api/user/change-password', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ oldPassword, newPassword }),
    //   });
    //   if (!response.ok) throw new Error('Failed to change password');
    //   const result = await response.json();
    //   toast({ title: "Password Changed", description: "Your password has been successfully updated." });
    //   setIsChangePasswordDialogOpen(false);
    // } catch (error) {
    //   toast({ variant: "destructive", title: "Error", description: error.message });
    // }
    
    // Simulate API call success for now
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({ title: "Password Changed (Simulated)", description: "Your password has been updated in this mock environment." });
    setIsChangePasswordDialogOpen(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handleDeleteAccountConfirm = async () => {
    console.log("Attempting to delete account (simulation)...");
    // TODO: Backend integration needed for real account deletion.
    // Example:
    // try {
    //   const response = await fetch('/api/user/delete-account', { method: 'POST' });
    //   if (!response.ok) throw new Error('Failed to delete account');
    //   toast({ variant: "destructive", title: "Account Deleted", description: "Your account has been permanently deleted." });
    //   await logout();
    // } catch (error) {
    //   toast({ variant: "destructive", title: "Error", description: error.message });
    // } finally {
    //   setIsDeleteAccountDialogOpen(false);
    // }

    // Simulate API call success and logout
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({ variant: "destructive", title: "Account Deletion Initiated (Simulated)", description: "Your account deletion process has started in this mock environment. You will be logged out." });
    setIsDeleteAccountDialogOpen(false);
    await logout();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-128px)]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return <div className="container py-8 text-center">Please log in to view your profile.</div>;
  }

  return (
    <div className="container py-8">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader className="text-center">
          <UserCircle className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="font-headline text-3xl">User Profile</CardTitle>
          <CardDescription>View and manage your account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.avatar || `https://placehold.co/96x96.png?text=${user.name?.[0]}`} alt={user.name} data-ai-hint="user avatar" />
              <AvatarFallback className="text-3xl">{user.name?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleProfilePictureChange}
              accept="image/*"
              className="hidden"
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                console.log("Change Picture button clicked");
                fileInputRef.current?.click();
              }}
            >
              <ImageUp className="mr-2 h-4 w-4" /> Change Picture
            </Button>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <div className="flex items-center mt-1">
                <UserCircle className="h-5 w-5 text-muted-foreground mr-2" />
                <Input id="name" defaultValue={user.name} readOnly className="bg-muted/50" />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <div className="flex items-center mt-1">
                <Mail className="h-5 w-5 text-muted-foreground mr-2" />
                <Input id="email" type="email" defaultValue={user.email} readOnly className="bg-muted/50" />
              </div>
            </div>
          </div>

          <div className="border-t pt-6 space-y-2">
            <h3 className="text-lg font-headline">Account Settings</h3>
            <Dialog open={isChangePasswordDialogOpen} onOpenChange={setIsChangePasswordDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <KeyRound className="mr-2 h-4 w-4" /> Change Password
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                  <DialogDescription>
                    Enter your old password and a new password. (This is a simulation)
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                  <div className="relative">
                    <Label htmlFor="oldPassword">Old Password</Label>
                    <Input id="oldPassword" type={showOldPassword ? "text" : "password"} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-6 h-7 w-7" onClick={() => setShowOldPassword(!showOldPassword)}>
                      {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="relative">
                    <Label htmlFor="newPassword">New Password (min. 6 characters)</Label>
                    <Input id="newPassword" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6}/>
                     <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-6 h-7 w-7" onClick={() => setShowNewPassword(!showNewPassword)}>
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="relative">
                    <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                    <Input id="confirmNewPassword" type={showConfirmNewPassword ? "text" : "password"} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required minLength={6}/>
                     <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-6 h-7 w-7" onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}>
                      {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">Save Changes</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            
            <AlertDialog open={isDeleteAccountDialogOpen} onOpenChange={setIsDeleteAccountDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full justify-start mt-4"> {/* Increased margin top */}
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will (simulate) permanently deleting your
                    account and all your data. You will be logged out.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAccountConfirm} className="bg-destructive hover:bg-destructive/90">
                    Confirm Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

