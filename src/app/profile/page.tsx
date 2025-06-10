
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
  const { user, loading, logout, updateUserState } = useAuth(); // Assuming updateUserState exists in useAuth
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
    const file = event.target.files?.[0];
    if (file && user) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newAvatar = reader.result as string;
        const updatedUser = { ...user, avatar: newAvatar };
        // This should be a function from useAuth to update user details including avatar
        // For now, directly update localStorage and user state if updateUserState handles it
        if (updateUserState) {
            updateUserState(updatedUser);
        }
        localStorage.setItem('konnectedRootsUser', JSON.stringify(updatedUser)); //
        toast({ title: "Profile Picture Updated", description: "Your new picture has been set." });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast({ variant: "destructive", title: "Error", description: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Error", description: "New password must be at least 6 characters." });
      return;
    }
    // Simulate API call
    toast({ title: "Password Changed", description: "Your password has been successfully updated (simulated)." });
    setIsChangePasswordDialogOpen(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handleDeleteAccountConfirm = async () => {
    setIsDeleteAccountDialogOpen(false);
    toast({ variant: "destructive", title: "Account Deletion Initiated", description: "Your account deletion process has started (simulated)." });
    // In a real app, call API then logout
    await logout(); // Simulate logging out after deletion
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
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
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
                    Enter your old password and a new password.
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
                    <Label htmlFor="newPassword">New Password</Label>
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
                <Button variant="destructive" className="w-full justify-start mt-2"> {/* Added mt-2 for spacing */}
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    account and all your data.
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
