"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';

interface Shape {
  id: number;
  type: 'circle' | 'rect';
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRotation: number;
}

const carouselImages = ['/4-Gen.png', '/3-Gen.png'];

export default function HeroSection() {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const startCarousel = () => {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % carouselImages.length);
      }, 10000);
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


  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateBounds = () => {
      if (container) {
        const rect = container.getBoundingClientRect();
        boundsRef.current = { width: rect.width, height: rect.height };
      }
    };
    
    // Run this effect only on the client
    updateBounds();

    const numShapes = 5; // Number of shapes
    const initialShapes: Shape[] = [];
    if (boundsRef.current.width > 0 && boundsRef.current.height > 0) {
      for (let i = 0; i < numShapes; i++) {
        const size = Math.random() * 20 + 20; // size between 20 and 40
        initialShapes.push({
          id: i,
          type: Math.random() > 0.5 ? 'circle' : 'rect',
          size: size,
          x: Math.random() * (boundsRef.current.width - size),
          y: Math.random() * (boundsRef.current.height - size),
          vx: (Math.random() - 0.5) * 1.0, // velocity between -0.5 and 0.5
          vy: (Math.random() - 0.5) * 1.0,
          color: Math.random() > 0.5 ? 'hsl(var(--primary))' : 'hsl(var(--accent))',
          rotation: Math.random() * 360,
          vRotation: (Math.random() - 0.5) * 0.2, // Slow rotation speed
        });
      }
      setShapes(initialShapes);
    }


    let animationFrameId: number;
    const animate = () => {
      if (boundsRef.current.width > 0 && boundsRef.current.height > 0) {
        setShapes(prevShapes =>
          prevShapes.map(shape => {
            let newX = shape.x + shape.vx;
            let newY = shape.y + shape.vy;
            let newVx = shape.vx;
            let newVy = shape.vy;
            let newRotation = shape.rotation + shape.vRotation;

            if (newX <= 0 || newX + shape.size >= boundsRef.current.width) {
              newVx = -newVx;
              newX = newX <= 0 ? 0 : boundsRef.current.width - shape.size;
            }
            if (newY <= 0 || newY + shape.size >= boundsRef.current.height) {
              newVy = -newVy;
              newY = newY <= 0 ? 0 : boundsRef.current.height - shape.size;
            }

            return { ...shape, x: newX, y: newY, vx: newVx, vy: newVy, rotation: newRotation };
          })
        );
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    if (initialShapes.length > 0) {
        animationFrameId = requestAnimationFrame(animate);
    }
    

    const handleResize = () => {
      updateBounds();
      // Adjust shape positions if they are out of new bounds
      if (boundsRef.current.width > 0 && boundsRef.current.height > 0) {
        setShapes(prevShapes => prevShapes.map(shape => ({
            ...shape,
            x: Math.max(0, Math.min(shape.x, boundsRef.current.width - shape.size)),
            y: Math.max(0, Math.min(shape.y, boundsRef.current.height - shape.size)),
        })));
      } else {
        setShapes([]); // Clear shapes if container has no dimensions
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);


  return (
    <section className="bg-background py-20 md:py-32 relative overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 z-0">
        <svg width="100%" height="100%" aria-hidden="true">
          {shapes.map(shape => (
            shape.type === 'circle' ?
              <circle 
                key={shape.id} 
                cx={shape.x + shape.size/2} 
                cy={shape.y + shape.size/2} 
                r={shape.size/2} 
                fill={shape.color} 
                opacity="0.5"
              /> :
              <rect 
                key={shape.id} 
                x={shape.x} 
                y={shape.y} 
                width={shape.size} 
                height={shape.size} 
                fill={shape.color} 
                opacity="0.5"
                transform={`rotate(${shape.rotation} ${shape.x + shape.size/2} ${shape.y + shape.size/2})`}
              />
          ))}
        </svg>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
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
        <div 
          className="relative max-w-4xl mx-auto aspect-video rounded-lg shadow-2xl overflow-hidden group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {carouselImages.map((src, index) => (
            <Image 
              key={src}
              src={src} 
              alt={`Family tree illustration ${index + 1}`} 
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority={index === 0}
              quality={75}
              style={{ objectFit: 'cover' }}
              className={`transform group-hover:scale-105 transition-all duration-1000 ease-in-out ${
                index === currentIndex ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
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
