
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah L.",
    role: "Genealogy Enthusiast",
    avatar: "https://placehold.co/80x80.png",
    aiHint: "person portrait",
    quote: "KonnectedRoots made it so easy to visualize my family's history. The AI name suggestions were surprisingly accurate and helpful!",
    rating: 5,
  },
  {
    name: "Michael B.",
    role: "Family Historian",
    avatar: "https://placehold.co/80x80.png",
    aiHint: "person portrait",
    quote: "I've tried many platforms, but the interactive tree builder here is top-notch. Collaborating with my cousins has been a breeze.",
    rating: 5,
  },
  {
    name: "Linda K.",
    role: "New to Ancestry",
    avatar: "https://placehold.co/80x80.png",
    aiHint: "person portrait",
    quote: "As a beginner, I found KonnectedRoots very intuitive. I've already discovered so much about my ancestors!",
    rating: 4,
  },
];

export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-16 md:py-24 bg-secondary">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-headline font-bold text-foreground mb-4">
            Loved by Families Worldwide
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Hear what our users are saying about their journey with KonnectedRoots.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col bg-card">
              <CardContent className="p-6 flex-grow flex flex-col">
                <div className="flex items-center mb-4">
                  <Avatar className="h-12 w-12 mr-4">
                    <AvatarImage src={testimonial.avatar} alt={testimonial.name} data-ai-hint={testimonial.aiHint} />
                    <AvatarFallback>{testimonial.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-headline text-md font-semibold text-foreground">{testimonial.name}</h4>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
                <blockquote className="text-muted-foreground text-sm italic mb-4 flex-grow">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <div className="flex items-center mt-auto">
                  {Array(testimonial.rating).fill(0).map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-accent fill-accent" />
                  ))}
                  {Array(5 - testimonial.rating).fill(0).map((_, i) => (
                     <Star key={i + testimonial.rating} className="h-5 w-5 text-accent" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

