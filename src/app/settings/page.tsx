
"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, SettingsIcon, Bell, Palette, Mail, Save, CreditCard, ChevronRight } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/clients';
import { useToast } from '@/hooks/use-toast';

interface EmailPreferences {
  marketing: boolean;
  treeActivity: boolean;
  reminders: boolean;
}

export default function SettingsPage() {
  const { user, userProfile, loading } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Email preferences state
  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences>({
    marketing: true,
    treeActivity: true,
    reminders: true
  });

  // Load email preferences from user profile
  useEffect(() => {
    if (userProfile?.emailPreferences) {
      setEmailPrefs({
        marketing: userProfile.emailPreferences.marketing ?? true,
        treeActivity: userProfile.emailPreferences.treeActivity ?? true,
        reminders: userProfile.emailPreferences.reminders ?? true
      });
    }
  }, [userProfile]);

  const handleSavePreferences = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        emailPreferences: {
          marketing: emailPrefs.marketing,
          transactional: true, // Always true - can't opt out
          treeActivity: emailPrefs.treeActivity,
          reminders: emailPrefs.reminders
        }
      });

      toast({
        title: "Preferences saved",
        description: "Your email preferences have been updated."
      });
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

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

          {/* Billing & Subscription Quick Link */}
          <div className="p-4 bg-muted/30 border rounded-lg flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-headline font-semibold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" /> Billing & Subscription
              </h3>
              <p className="text-xs text-muted-foreground">
                Manage your plan, check AI credits and export allowances, or view receipts.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="gap-1">
              <Link href="/settings/billing">
                Manage <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Email Preferences Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-headline flex items-center">
              <Mail className="mr-2 h-5 w-5 text-muted-foreground" /> Email Notifications
            </h3>

            <div className="flex items-center justify-between p-3 border rounded-md">
              <Label htmlFor="tree-activity" className="flex flex-col space-y-1 cursor-pointer">
                <span>Tree Activity</span>
                <span className="font-normal leading-snug text-muted-foreground text-sm">
                  Get notified when collaborators accept invitations or make changes.
                </span>
              </Label>
              <Switch
                id="tree-activity"
                checked={emailPrefs.treeActivity}
                onCheckedChange={(checked) => setEmailPrefs(prev => ({ ...prev, treeActivity: checked }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-md">
              <Label htmlFor="weekly-digest" className="flex flex-col space-y-1 cursor-pointer">
                <span>Weekly Activity Digest</span>
                <span className="font-normal leading-snug text-muted-foreground text-sm">
                  Receive a weekly summary of your family tree activity.
                </span>
              </Label>
              <Switch
                id="weekly-digest"
                checked={emailPrefs.marketing}
                onCheckedChange={(checked) => setEmailPrefs(prev => ({ ...prev, marketing: checked }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-md">
              <Label htmlFor="reminders" className="flex flex-col space-y-1 cursor-pointer">
                <span>Reminders</span>
                <span className="font-normal leading-snug text-muted-foreground text-sm">
                  Inactivity reminders and subscription expiration alerts.
                </span>
              </Label>
              <Switch
                id="reminders"
                checked={emailPrefs.reminders}
                onCheckedChange={(checked) => setEmailPrefs(prev => ({ ...prev, reminders: checked }))}
              />
            </div>

            <p className="text-xs text-muted-foreground px-1">
              Transaction emails (payment receipts, security alerts) are always sent and cannot be disabled.
            </p>
          </div>

          {/* In-App Notifications Section */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-headline flex items-center"><Bell className="mr-2 h-5 w-5 text-muted-foreground" /> In-App Notifications</h3>
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

          {/* Appearance Section */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-headline flex items-center"><Palette className="mr-2 h-5 w-5 text-muted-foreground" /> Appearance</h3>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                <span>Dark Mode</span>
                <span className="font-normal leading-snug text-muted-foreground text-sm">
                  Toggle between light and dark themes.
                </span>
              </Label>
              <Switch id="dark-mode" disabled /> {/* Dark mode toggle not fully implemented */}
            </div>
          </div>

          {/* Save Button */}
          <div className="border-t pt-6">
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              onClick={handleSavePreferences}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Preferences
                </>
              )}
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
