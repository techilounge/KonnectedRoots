"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { db, functions } from '@/lib/firebase/clients';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TreeDeciduous, Check, X, LogIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface Invitation {
    id: string;
    treeId: string;
    treeName: string;
    inviterUid: string;
    inviterName: string;
    inviteeEmail: string;
    inviteeUid?: string;
    role: 'viewer' | 'editor' | 'manager';
    status: 'pending' | 'accepted' | 'declined';
}

interface InvitePageProps {
    params: Promise<{ inviteId: string }>;
}

export default function InvitePage({ params }: InvitePageProps) {
    const { inviteId } = use(params);
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [invitation, setInvitation] = useState<Invitation | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchInvitation = async () => {
            try {
                const inviteDoc = await getDoc(doc(db, 'invitations', inviteId));
                if (!inviteDoc.exists()) {
                    setError('Invitation not found');
                    setLoading(false);
                    return;
                }

                const data = inviteDoc.data() as Omit<Invitation, 'id'>;
                setInvitation({ id: inviteDoc.id, ...data });

                if (data.status !== 'pending') {
                    setError(`This invitation has already been ${data.status}`);
                }
            } catch (err) {
                console.error('Error fetching invitation:', err);
                setError('Failed to load invitation');
            } finally {
                setLoading(false);
            }
        };

        fetchInvitation();
    }, [inviteId]);

    const handleAccept = async () => {
        if (!user || !invitation) return;

        // Verify the user email matches
        if (user.email?.toLowerCase() !== invitation.inviteeEmail.toLowerCase()) {
            setError(`This invitation was sent to ${invitation.inviteeEmail}. Please sign in with that email.`);
            return;
        }

        setProcessing(true);
        try {
            // Call the Cloud Function to accept the invitation
            const acceptfn = httpsCallable(functions, 'acceptInvitation');
            await acceptfn({ invitationId: invitation.id });

            // Redirect to the tree
            router.push(`/tree/${invitation.treeId}`);
        } catch (err: any) {
            console.error('Error accepting invitation:', err);
            setError(err.message || 'Failed to accept invitation');
            setProcessing(false);
        }
    };

    const handleDecline = async () => {
        if (!invitation) return;

        setProcessing(true);
        try {
            await deleteDoc(doc(db, 'invitations', invitation.id));
            router.push('/dashboard');
        } catch (err) {
            console.error('Error declining invitation:', err);
            setError('Failed to decline invitation');
            setProcessing(false);
        }
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>{error}</p>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TreeDeciduous className="h-6 w-6 text-primary" />
                            Tree Invitation
                        </CardTitle>
                        <CardDescription>
                            You&apos;ve been invited to collaborate on &quot;{invitation?.treeName}&quot;
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-muted rounded-lg p-4">
                            <p className="text-sm text-muted-foreground">Invited by</p>
                            <p className="font-medium">{invitation?.inviterName}</p>
                            <p className="text-sm text-muted-foreground mt-2">Role</p>
                            <Badge variant="secondary" className="mt-1 capitalize">{invitation?.role}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Please sign in with <strong>{invitation?.inviteeEmail}</strong> to accept this invitation.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <Button asChild className="w-full">
                            <Link href={`/login?redirect=/invite/${inviteId}`}>
                                <LogIn className="mr-2 h-4 w-4" />
                                Sign In to Accept
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TreeDeciduous className="h-6 w-6 text-primary" />
                        Tree Invitation
                    </CardTitle>
                    <CardDescription>
                        You&apos;ve been invited to collaborate on a family tree
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-muted rounded-lg p-4 space-y-3">
                        <div>
                            <p className="text-sm text-muted-foreground">Tree</p>
                            <p className="font-medium text-lg">{invitation?.treeName}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Invited by</p>
                            <p className="font-medium">{invitation?.inviterName}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Your Role</p>
                            <Badge variant="secondary" className="mt-1 capitalize">{invitation?.role}</Badge>
                        </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {invitation?.role === 'viewer' && (
                            <p>As a <strong>Viewer</strong>, you can browse the family tree but cannot make changes.</p>
                        )}
                        {invitation?.role === 'editor' && (
                            <p>As an <strong>Editor</strong>, you can add, edit, and remove people from the tree.</p>
                        )}
                        {invitation?.role === 'manager' && (
                            <p>As a <strong>Manager</strong>, you can edit the tree and manage other collaborators.</p>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={handleDecline}
                        disabled={processing}
                        className="flex-1"
                    >
                        <X className="mr-2 h-4 w-4" />
                        Decline
                    </Button>
                    <Button
                        onClick={handleAccept}
                        disabled={processing}
                        className="flex-1"
                    >
                        {processing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Check className="mr-2 h-4 w-4" />
                        )}
                        Accept
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
