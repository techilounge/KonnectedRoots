
"use client";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Users, Wand2 } from 'lucide-react';

interface AddPersonToolboxProps {
  onAddPerson: (personDetails?: Partial<Person>) => void;
}

export default function AddPersonToolbox({ onAddPerson }: AddPersonToolboxProps) {
  return (
    <aside className="w-64 bg-card p-4 border-r space-y-4 shadow-md">
      <h2 className="text-lg font-headline text-foreground mb-2">Toolbox</h2>
      
      <Card className="bg-secondary/50">
        <CardHeader className="p-3">
          <CardTitle className="text-md font-headline flex items-center">
            <UserPlus className="mr-2 h-5 w-5 text-primary" /> Add Individual
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground mb-2">
            Click to add a new person to the tree.
          </p>
          <Button 
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90" 
            size="sm"
            onClick={() => onAddPerson({})} // Pass empty object for new person
          >
            Add New Person
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-secondary/50">
        <CardHeader className="p-3">
          <CardTitle className="text-md font-headline flex items-center">
            <Wand2 className="mr-2 h-5 w-5 text-accent" /> AI Tools
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground mb-2">
            Use AI to help with names or find records.
          </p>
          <Button 
            className="w-full" 
            variant="outline" 
            size="sm"
            onClick={() => onAddPerson({})} // Can also trigger name suggester for a new person
          >
            Suggest Name (AI)
          </Button>
        </CardContent>
      </Card>

      <div className="pt-4 border-t text-xs text-muted-foreground">
        More tools like relationship connectors, photo uploads, etc., would appear here.
      </div>
    </aside>
  );
}
