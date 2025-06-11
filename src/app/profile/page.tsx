
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCircle, Mail, Edit2, KeyRound, Trash2, ImageUp, Eye, EyeOff, Save, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user, loading, logout, updateUserState } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | undefined>(undefined);
  const [currentAvatarPreview, setCurrentAvatarPreview] = useState<string | undefined>(undefined);


  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  useEffect(() => {
    if (user) {
      console.log("Profile Page: User loaded, setting initial avatar:", user.avatar);
      setInitialAvatarUrl(user.avatar);
      setCurrentAvatarPreview(user.avatar);
    }
  }, [user]);

  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("Profile Page: handleProfilePictureChange triggered");
    const file = event.target.files?.[0];
    if (file) {
      console.log("Profile Page: File selected:", file.name, "Type:", file.type, "Size:", file.size);
      const reader = new FileReader();
      reader.onloadstart = () => console.log("Profile Page: FileReader onloadstart");
      reader.onprogress = (e) => console.log(`Profile Page: FileReader onprogress - ${e.loaded}/${e.total}`);
      reader.onloadend = () => {
        console.log("Profile Page: FileReader onloadend. Result type:", typeof reader.result);
        const newAvatarDataUrl = reader.result as string;
        if (newAvatarDataUrl) {
          setCurrentAvatarPreview(newAvatarDataUrl); 
          toast({ title: "Profile Picture Previewed", description: "Click 'Apply Changes' to save." });
          console.log("Profile Page: Avatar preview updated.");
        } else {
          console.error("Profile Page: FileReader result is null or empty.");
           toast({ variant: "destructive", title: "Error", description: "Could not read image file." });
        }
      };
      reader.onerror = (error) => {
        console.error("Profile Page: FileReader error:", error);
        toast({ variant: "destructive", title: "Error Reading File", description: "Could not process the selected image." });
      };
      reader.readAsDataURL(file);
    } else {
      console.log("Profile Page: No file selected or event.target.files is null.");
    }
     // Reset file input to allow selecting the same file again if needed
    if (event.target) {
        event.target.value = '';
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

    console.log("Attempting to change password (simulation)... Old:", oldPassword, "New:", newPassword);
    // Backend integration needed for real password change.
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    toast({ title: "Password Changed (Simulated)", description: "Your password has been updated in this mock environment." });
    setIsChangePasswordDialogOpen(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handleDeleteAccountConfirm = async () => {
    console.log("Attempting to delete account (simulation)...");
    // Backend integration needed for real account deletion.
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    toast({ variant: "destructive", title: "Account Deletion Initiated (Simulated)", description: "Your account deletion process has started. You will be logged out." });
    setIsDeleteAccountDialogOpen(false);
    await logout(); 
  };

  const handleApplyChanges = () => {
    if (user && currentAvatarPreview && currentAvatarPreview !== initialAvatarUrl) {
      const updatedUser = { ...user, avatar: currentAvatarPreview };
      if (updateUserState) {
        updateUserState(updatedUser); // This updates localStorage in the mock auth
        setInitialAvatarUrl(currentAvatarPreview); // Persist the change for current session's "initial"
      }
      console.log("Profile Page: User state updated with new avatar (client-side persisted).");
      toast({ title: "Profile Updated", description: "Your changes have been applied." });
    } else {
      toast({ title: "No Changes Detected", description: "No new changes to apply to profile picture." });
    }
    router.push('/dashboard');
  };

  const handleCancelChanges = () => {
    if (initialAvatarUrl) {
      setCurrentAvatarPreview(initialAvatarUrl); // Revert preview to the initial state
    }
    toast({ title: "Changes Discarded", description: "Any pending changes were not applied." });
    router.push('/dashboard');
  };


  if (loading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-128px)]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    router.push('/login');
    return <div className="container py-8 text-center">Redirecting to login...</div>;
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
              <AvatarImage src={currentAvatarPreview || `https://placehold.co/96x96.png?text=${user.name?.[0]}`} alt={user.name} data-ai-hint="user avatar" />
              <AvatarFallback className="text-3xl">{user.name?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleProfilePictureChange}
              accept="image/png, image/jpeg, image/gif"
              className="hidden"
              aria-hidden="true"
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                console.log("Profile Page: Change Picture button clicked. File input ref current:", fileInputRef.current);
                fileInputRef.current?.click();
              }}
              aria-label="Change profile picture"
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

          <div className="border-t pt-6 space-y-4"> {/* Increased spacing */}
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
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-6 h-7 w-7" onClick={() => setShowOldPassword(!showOldPassword)} aria-label={showOldPassword ? "Hide old password" : "Show old password"}>
                      {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="relative">
                    <Label htmlFor="newPassword">New Password (min. 6 characters)</Label>
                    <Input id="newPassword" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6}/>
                     <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-6 h-7 w-7" onClick={() => setShowNewPassword(!showNewPassword)} aria-label={showNewPassword ? "Hide new password" : "Show new password"}>
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="relative">
                    <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                    <Input id="confirmNewPassword" type={showConfirmNewPassword ? "text" : "password"} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required minLength={6}/>
                     <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-6 h-7 w-7" onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)} aria-label={showConfirmNewPassword ? "Hide confirm new password" : "Show confirm new password"}>
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
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-6 border-t">
            <Button variant="outline" onClick={handleCancelChanges}>
              <XCircle className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <AlertDialog open={isDeleteAccountDialogOpen} onOpenChange={setIsDeleteAccountDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
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
            <Button onClick={handleApplyChanges} className="bg-primary hover:bg-primary/90">
              <Save className="mr-2 h-4 w-4" /> Apply Changes
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
