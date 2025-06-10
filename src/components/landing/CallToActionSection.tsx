
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function CallToActionSection() {
  return (
    <section id="pricing" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-primary to-accent p-8 md:p-12 rounded-lg shadow-xl text-center md:text-left flex flex-col md:flex-row items-center justify-between">
          <div className="md:w-2/3 mb-8 md:mb-0">
            <h2 className="text-3xl sm:text-4xl font-headline font-bold text-primary-foreground mb-4">
              Ready to Discover Your Story?
            </h2>
            <p className="text-lg text-primary-foreground/90 mb-6 max-w-xl">
              Join KonnectedRoots today and start building your family legacy. It's free to get started!
            </p>
            <Button size="lg" variant="secondary" asChild className="bg-card text-card-foreground hover:bg-card/90 shadow-md transform hover:scale-105 transition-transform">
              <Link href="/signup">Create Your Family Tree Now</Link>
            </Button>
          </div>
          <div className="md:w-1/3 flex justify-center md:justify-end">
            <Image 
              src="https://placehold.co/300x300.png" 
              alt="Decorative family seal" 
              width={200} 
              height={200} 
              className="rounded-full shadow-lg"
              data-ai-hint="family seal"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
