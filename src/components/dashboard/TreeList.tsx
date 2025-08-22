
"use client";
import type { FamilyTree } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Clock, ArrowRight, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

interface TreeListProps {
  trees: FamilyTree[];
  onEditTree: (tree: FamilyTree) => void;
  onDeleteTree: (treeId: string) => void;
}

export default function TreeList({ trees, onEditTree, onDeleteTree }: TreeListProps) {
  const router = useRouter();

  const handleOpenTree = (tree: FamilyTree) => {
    router.push(`/tree/${tree.id}`);
  };
  
  const getFormattedDate = (timestamp: any) => {
    if (!timestamp || !timestamp.toDate) {
      // Handle cases where timestamp is not a Firestore Timestamp
      // It might be a string from older data or null
      try {
        const date = new Date(timestamp);
        if(isNaN(date.getTime())) return "a while ago";
        return formatDistanceToNow(date, { addSuffix: true });
      } catch (e) {
        return "a while ago";
      }
    }
    return formatDistanceToNow(timestamp.toDate(), { addSuffix: true });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {trees.map((tree) => (
        <Card 
          key={tree.id} 
          className="flex flex-col shadow-md hover:shadow-xl hover:border-primary/50 transition-all duration-300"
        >
          <CardHeader className="pb-3 cursor-pointer" onClick={() => handleOpenTree(tree)}>
            <div className="flex justify-between items-start">
              <div className="flex-grow">
                <CardTitle className="font-headline text-xl text-primary">{tree.title}</CardTitle>
                <CardDescription className="flex items-center text-sm text-muted-foreground pt-1">
                  <Users className="mr-2 h-4 w-4" /> {tree.memberCount} members
                </CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()} // Prevent card click when opening menu
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Tree options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => handleOpenTree(tree)} className="flex items-center cursor-pointer">
                    <ArrowRight className="mr-2 h-4 w-4" /> Open Tree
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEditTree(tree)} className="flex items-center cursor-pointer">
                    <Edit className="mr-2 h-4 w-4" /> Rename Tree
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDeleteTree(tree.id)} className="flex items-center text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Tree
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="flex-grow pt-0 pb-3 cursor-pointer" onClick={() => handleOpenTree(tree)}>
             <p className="text-sm text-muted-foreground">{tree.description || "No description provided."}</p>
          </CardContent>
          <CardFooter className="flex items-center justify-between pt-3 pb-4 border-t mt-auto">
             <div className="text-xs text-muted-foreground flex items-center">
                <Clock className="mr-1 h-3 w-3" />
                Updated {getFormattedDate(tree.lastUpdated)}
              </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
