
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
import { Loader2, UserCircle, Mail, Edit2, KeyRound, Trash2, ImageUp, Eye, EyeOff, Save, XCircle, Download, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AICreditUsageCard } from '@/components/billing/AICreditUsageCard';

export default function ProfilePage() {
  const { user, userProfile, loading, logout, updateUserProfile, reauthenticate, updateUserPassword, deleteUserAccount } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);


  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setAvatarPreview(user.photoURL || null);
    }
  }, [user]);

  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleApplyChanges = async () => {
    if (!user) return;
    setIsUpdating(true);
    try {
      await updateUserProfile(displayName, avatarFile);
      toast({ title: "Profile Updated", description: "Your changes have been saved." });
      setAvatarFile(null); // Reset file after upload
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelChanges = () => {
    if (user) {
      setDisplayName(user.displayName || '');
      setAvatarPreview(user.photoURL || null);
      setAvatarFile(null);
    }
    router.push('/dashboard');
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

    setIsUpdating(true);
    try {
      await reauthenticate(oldPassword);
      await updateUserPassword(newPassword);
      toast({ title: "Password Changed", description: "Your password has been updated." });
      setIsChangePasswordDialogOpen(false);
      setOldPassword(''); setNewPassword(''); setConfirmNewPassword('');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccountConfirm = async () => {
    try {
      await deleteUserAccount();
      toast({ variant: "destructive", title: "Account Deleted", description: "Your account has been permanently deleted." });
      // The useAuth hook will redirect on auth state change
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: `Failed to delete account: ${error.message}` });
      setIsDeleteAccountDialogOpen(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-128px)]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const hasChanges = (user.displayName !== displayName) || (avatarFile !== null);

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
              <AvatarImage src={avatarPreview || `https://placehold.co/96x96.png?text=${displayName?.[0]}`} alt={displayName} data-ai-hint="user avatar" />
              <AvatarFallback className="text-3xl">{displayName?.[0]?.toUpperCase()}</AvatarFallback>
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
              onClick={() => fileInputRef.current?.click()}
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
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <div className="flex items-center mt-1">
                <Mail className="h-5 w-5 text-muted-foreground mr-2" />
                <Input id="email" type="email" defaultValue={user.email!} readOnly className="bg-muted/50" />
              </div>
            </div>
          </div>

          <AICreditUsageCard usage={userProfile?.usage} className="bg-muted/10 border-primary/20" />

          {/* GDPR: Your Data & Privacy Section */}
          <div className="border-t pt-6 space-y-4">
            <h3 className="text-lg font-headline flex items-center">
              <Shield className="mr-2 h-5 w-5 text-primary" />
              Your Data & Privacy
            </h3>
            <p className="text-sm text-muted-foreground">
              You have the right to access, export, and delete your personal data under GDPR and other privacy regulations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  toast({
                    title: "Export Requested",
                    description: "Your data export is being prepared. You'll receive an email with a download link within 24 hours.",
                  });
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export My Data
              </Button>
              <Button variant="ghost" asChild>
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                  <Shield className="mr-2 h-4 w-4" />
                  Privacy Policy
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              For GEDCOM exports of your family trees, use the Export feature in each tree's settings.
            </p>
          </div>

          <div className="border-t pt-6 space-y-4">
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
                    Enter your current password and a new password.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                  <div className="relative">
                    <Label htmlFor="oldPassword">Current Password</Label>
                    <Input id="oldPassword" type={showOldPassword ? "text" : "password"} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-6 h-7 w-7" onClick={() => setShowOldPassword(!showOldPassword)} aria-label={showOldPassword ? "Hide old password" : "Show old password"}>
                      {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="relative">
                    <Label htmlFor="newPassword">New Password (min. 6 characters)</Label>
                    <Input id="newPassword" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-6 h-7 w-7" onClick={() => setShowNewPassword(!showNewPassword)} aria-label={showNewPassword ? "Hide new password" : "Show new password"}>
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="relative">
                    <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                    <Input id="confirmNewPassword" type={showConfirmNewPassword ? "text" : "password"} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required minLength={6} />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-6 h-7 w-7" onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)} aria-label={showConfirmNewPassword ? "Hide confirm new password" : "Show confirm new password"}>
                      {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline" disabled={isUpdating}>Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteAccountDialogOpen} onOpenChange={setIsDeleteAccountDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full justify-start">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
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
        <CardFooter className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-6 border-t">
          <Button variant="outline" onClick={handleCancelChanges} disabled={isUpdating}>
            <XCircle className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleApplyChanges} className="bg-primary hover:bg-primary/90" disabled={!hasChanges || isUpdating}>
            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Apply Changes
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

