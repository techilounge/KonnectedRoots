
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, TreeDeciduous, Sparkles, Search, FileText } from "lucide-react";

const steps = [
  {
    step: 1,
    icon: <UserPlus className="h-8 w-8 text-primary" />,
    title: "Sign Up & Start",
    description: "Create your free account and begin your first family tree in minutes.",
  },
  {
    step: 2,
    icon: <TreeDeciduous className="h-8 w-8 text-primary" />,
    title: "Build Your Tree",
    description: "Add family members, link relationships, and fill in details with our easy-to-use tools.",
  },
  {
    step: 3,
    icon: <Sparkles className="h-8 w-8 text-primary" />,
    title: "Discover with AI",
    description: "Utilize AI-powered name suggestions and hints to expand your knowledge.",
  },
  {
    step: 4,
    icon: <FileText className="h-8 w-8 text-primary" />,
    title: "Enrich with Stories",
    description: "Upload photos, documents, and anecdotes to bring your family history to life.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-headline font-bold text-foreground mb-4">
            Begin Your Journey in 4 Simple Steps
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Embarking on your genealogical adventure is straightforward and rewarding.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item) => (
            <Card key={item.step} className="text-center shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  {item.icon}
                </div>
                <CardTitle className="font-headline text-xl text-foreground">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
