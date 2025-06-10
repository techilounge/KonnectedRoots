
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function HeroSection() {
  return (
    <section className="bg-background py-20 md:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-bold text-foreground mb-6 leading-tight">
          Uncover Your Roots, Weave Your Story
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          KonnectedRoots helps you explore your ancestry, build your family tree, and connect with your heritage like never before.
        </p>
        <div className="flex justify-center space-x-4 mb-16">
          <Button size="lg" asChild className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg transform hover:scale-105 transition-transform">
            <Link href="/signup">Get Started Free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="shadow-lg transform hover:scale-105 transition-transform">
            <Link href="#features">Learn More</Link>
          </Button>
        </div>
        <div className="relative max-w-4xl mx-auto aspect-video rounded-lg shadow-2xl overflow-hidden group">
          <Image 
            src="https://placehold.co/1200x675.png" 
            alt="Family tree illustration" 
            layout="fill"
            objectFit="cover"
            className="transform group-hover:scale-105 transition-transform duration-500 ease-in-out"
            data-ai-hint="family tree"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
           <div className="absolute bottom-6 left-6 text-left">
            <h3 className="text-white text-2xl font-headline">Visualize Your Lineage</h3>
            <p className="text-gray-200 text-sm">Interactive and beautifully designed family trees.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
