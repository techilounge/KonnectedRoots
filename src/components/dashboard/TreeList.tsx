
"use client";
import Link from 'next/link';
import type { FamilyTree } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Edit3, Clock, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TreeListProps {
  trees: FamilyTree[];
}

export default function TreeList({ trees }: TreeListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {trees.map((tree) => (
        <Card key={tree.id} className="flex flex-col shadow-sm hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{tree.name}</CardTitle>
            <CardDescription className="flex items-center text-sm text-muted-foreground pt-1">
              <Users className="mr-2 h-4 w-4" /> {tree.memberCount} members
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
             {/* Placeholder for more tree details or a preview */}
             <p className="text-sm text-muted-foreground">A brief summary or recent activity could go here.</p>
          </CardContent>
          <CardFooter className="flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-2 pt-4 border-t">
             <div className="text-xs text-muted-foreground flex items-center">
                <Clock className="mr-1 h-3 w-3" />
                Updated {formatDistanceToNow(new Date(tree.lastUpdated), { addSuffix: true })}
              </div>
            <Button asChild size="sm" variant="ghost" className="text-primary hover:text-primary/90">
              <Link href={`/tree/${tree.id}`}>
                Open Tree <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
