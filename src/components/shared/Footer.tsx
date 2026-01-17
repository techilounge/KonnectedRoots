
import Link from 'next/link';
import { Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';
import Logo from './Logo'; // Import the Logo component

export default function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            {/* Replace h3 with Logo component */}
            <Link href="/" aria-label="KonnectedRoots Home">
              <Logo className="h-8 w-auto text-primary" />
            </Link>
            <p className="text-muted-foreground text-sm mt-2"> {/* Added mt-2 for spacing */}
              Discover your heritage and build your family story.
            </p>
          </div>
          <div>
            <h4 className="font-headline text-lg font-semibold text-foreground mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/#features" className="text-muted-foreground hover:text-primary transition-colors">Features</Link></li>
              <li><Link href="/pricing" className="text-muted-foreground hover:text-primary transition-colors">Pricing</Link></li>
              <li><Link href="/#about" className="text-muted-foreground hover:text-primary transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</Link></li> {/* Placeholder */}
            </ul>
          </div>
          <div>
            <h4 className="font-headline text-lg font-semibold text-foreground mb-4">Connect With Us</h4>
            <div className="flex space-x-4">
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors"><Facebook size={20} /></Link>
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors"><Twitter size={20} /></Link>
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors"><Instagram size={20} /></Link>
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors"><Linkedin size={20} /></Link>
            </div>
          </div>
        </div>
        <div className="border-t border-border mt-8 pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} KonnectedRoots. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
