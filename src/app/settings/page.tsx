
"use client";
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, SettingsIcon, Bell, Palette } from 'lucide-react';

export default function SettingsPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return <div className="container py-8 text-center">Please log in to view settings.</div>;
  }

  return (
    <div className="container py-8">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader className="text-center">
          <SettingsIcon className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="font-headline text-3xl">Application Settings</CardTitle>
          <CardDescription>Customize your KonnectedRoots experience.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-headline flex items-center"><Bell className="mr-2 h-5 w-5 text-muted-foreground" /> Notifications</h3>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <Label htmlFor="email-notifications" className="flex flex-col space-y-1">
                <span>Email Notifications</span>
                <span className="font-normal leading-snug text-muted-foreground text-sm">
                  Receive updates about your family tree and collaborations.
                </span>
              </Label>
              <Switch id="email-notifications" defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <Label htmlFor="ai-hints-notifications" className="flex flex-col space-y-1">
                <span>AI Hint Notifications</span>
                <span className="font-normal leading-snug text-muted-foreground text-sm">
                  Get notified when AI finds potential matches or suggestions.
                </span>
              </Label>
              <Switch id="ai-hints-notifications" />
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-headline flex items-center"><Palette className="mr-2 h-5 w-5 text-muted-foreground" /> Appearance</h3>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                <span>Dark Mode</span>
                <span className="font-normal leading-snug text-muted-foreground text-sm">
                  Toggle between light and dark themes.
                </span>
              </Label>
              <Switch id="dark-mode" disabled /> {/* Dark mode toggle not fully implemented in this scaffold */}
            </div>
          </div>
          
          <div className="border-t pt-6">
             <Button className="w-full bg-primary hover:bg-primary/90">Save Preferences (Placeholder)</Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
