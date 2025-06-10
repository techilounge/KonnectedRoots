
"use client";
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, UserCircle, Mail, Edit2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    // This case should ideally be handled by layout redirecting to login
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
            <Button variant="outline" size="sm">
              <Edit2 className="mr-2 h-4 w-4" /> Change Picture (Placeholder)
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
            <Button variant="outline" className="w-full justify-start">
              Change Password (Placeholder)
            </Button>
            <Button variant="destructive" className="w-full justify-start">
              Delete Account (Placeholder)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
