import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
            <div className="bg-primary/10 p-4 rounded-full mb-6">
                <HelpCircle className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-3xl font-serif font-bold text-foreground mb-4">
                Page Not Found
            </h2>
            <p className="text-muted-foreground max-w-md mb-8">
                The page you are looking for doesn't exist or has been moved.
                Check the URL or verify where you wanted to go.
            </p>
            <Link href="/">
                <Button variant="default">Return Home</Button>
            </Link>
        </div>
    );
}
