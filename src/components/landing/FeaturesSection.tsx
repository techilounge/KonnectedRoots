
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Share2, Download, FileText, Lock, Edit } from 'lucide-react';

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
    icon: <Download className="h-10 w-10 text-primary" />,
    title: 'GEDCOM Import & Export',
    description: 'Import existing family trees or export your data in industry-standard GEDCOM format.',
    id: 'gedcom'
  },
  {
    icon: <FileText className="h-10 w-10 text-primary" />,
    title: 'PDF & Image Exports',
    description: 'Download beautiful printable versions of your family tree to share or preserve.',
    id: 'exports'
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
            Everything You Need to Build Your Family History
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Powerful tools designed to help you discover, document, and share your ancestry with the people who matter most.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <Card key={feature.id} className="group shadow-lg hover:shadow-xl transition-all duration-300 bg-card transform hover:-translate-y-2 border-2 border-transparent hover:border-primary">
              <CardHeader className="items-center text-center">
                <div className="p-4 bg-primary/10 rounded-full mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
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
