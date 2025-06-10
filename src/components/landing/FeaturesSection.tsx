
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Share2, Search, Brain, Lock, Edit } from 'lucide-react';

const features = [
  {
    icon: <Users className="h-10 w-10 text-primary" />,
    title: 'Interactive Family Tree',
    description: 'Easily build and visualize your family tree with our intuitive drag-and-drop canvas.',
    id: 'interactive-tree'
  },
  {
    icon: <Edit className="h-10 w-10 text-primary" />,
    title: 'Detailed Profiles',
    description: 'Add rich details like names, dates, photos, and stories to each family member.',
    id: 'detailed-profiles'
  },
  {
    icon: <Share2 className="h-10 w-10 text-primary" />,
    title: 'Collaborate with Family',
    description: 'Invite family members to view and contribute to your shared history.',
    id: 'collaboration'
  },
  {
    icon: <Brain className="h-10 w-10 text-primary" />,
    title: 'AI Name Suggestions',
    description: 'Get intelligent name suggestions based on historical trends and cultural origins.',
    id: 'ai-suggestions'
  },
  {
    icon: <Search className="h-10 w-10 text-primary" />,
    title: 'Historical Records Search',
    description: 'Access a vast database of historical records to uncover new connections (Coming Soon).',
    id: 'records-search'
  },
  {
    icon: <Lock className="h-10 w-10 text-primary" />,
    title: 'Secure & Private',
    description: 'Your family data is kept safe and private with robust security measures.',
    id: 'secure-private'
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-16 md:py-24 bg-secondary">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-headline font-bold text-foreground mb-4">
            Everything You Need to Grow Your Roots
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Explore the powerful features that make KonnectedRoots the perfect place to discover your family history.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <Card key={feature.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card">
              <CardHeader className="items-center text-center">
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  {feature.icon}
                </div>
                <CardTitle className="font-headline text-xl text-foreground">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
