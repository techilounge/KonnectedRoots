
"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';

const carouselImages = ['/grandparents.png', '/grandparents2.png', '/mixed-fam.png'];

export default function CallToActionSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const startCarousel = () => {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % carouselImages.length);
      }, 10000); // 10-second delay
    };

    const stopCarousel = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };

    if (!isHovered) {
      startCarousel();
    } else {
      stopCarousel();
    }

    return () => stopCarousel();
  }, [isHovered]);

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
            <div
              className="relative w-[200px] h-[200px] rounded-full shadow-lg overflow-hidden group"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {carouselImages.map((src, index) => (
                <Image
                  key={src}
                  src={src}
                  alt="A family portrait"
                  fill
                  sizes="200px"
                  style={{ objectFit: 'cover' }}
                  className={`transform group-hover:scale-105 transition-all duration-1000 ease-in-out ${
                    index === currentIndex ? 'opacity-100' : 'opacity-0'
                  }`}
                  data-ai-hint="family portrait"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
