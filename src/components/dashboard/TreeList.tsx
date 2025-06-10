
"use client";
import Link from 'next/link';
import type { FamilyTree } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Clock, ArrowRight, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TreeListProps {
  trees: FamilyTree[];
  onEditTree: (tree: FamilyTree) => void;
  onDeleteTree: (treeId: string) => void;
}

export default function TreeList({ trees, onEditTree, onDeleteTree }: TreeListProps) {
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
             <p className="text-sm text-muted-foreground">A brief summary or recent activity could go here.</p>
          </CardContent>
          <CardFooter className="flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-2 pt-4 border-t">
             <div className="text-xs text-muted-foreground flex items-center">
                <Clock className="mr-1 h-3 w-3" />
                Updated {formatDistanceToNow(new Date(tree.lastUpdated), { addSuffix: true })}
              </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Tree options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/tree/${tree.id}`} className="flex items-center">
                    <ArrowRight className="mr-2 h-4 w-4" /> Open Tree
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEditTree(tree)} className="flex items-center">
                  <Edit className="mr-2 h-4 w-4" /> Edit Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDeleteTree(tree.id)} className="flex items-center text-destructive focus:text-destructive focus:bg-destructive/10">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Tree
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
