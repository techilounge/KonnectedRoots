
"use client";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Wand2, Link2, UploadCloud, XCircle } from 'lucide-react';
import type { Person } from '@/types';
import { cn } from '@/lib/utils';

interface AddPersonToolboxProps {
  onAddPerson: (personDetails?: Partial<Person>) => void;
  selectedPerson: Person | null;
  onInitiateRelationship: () => void;
  onInitiatePhotoUpload: () => void;
  isLinkingMode: boolean;
}

export default function AddPersonToolbox({ 
  onAddPerson, 
  selectedPerson,
  onInitiateRelationship,
  onInitiatePhotoUpload,
  isLinkingMode,
}: AddPersonToolboxProps) {
  return (
    <aside className="w-64 bg-card p-4 border-r space-y-4 shadow-md flex flex-col">
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
            onClick={() => onAddPerson({})}
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
            onClick={() => onAddPerson({})}
          >
            Suggest Name (AI)
          </Button>
        </CardContent>
      </Card>
      
      <div className="pt-4 border-t space-y-4 flex-grow">
          <Card className={cn("bg-secondary/50 transition-all", isLinkingMode && "ring-2 ring-accent")}>
            <CardHeader className="p-3">
              <CardTitle className="text-md font-headline flex items-center">
                <Link2 className="mr-2 h-5 w-5 text-primary" /> Create Relationship
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <CardDescription className="text-xs mb-2">
                {isLinkingMode ? `Click another person to link with ${selectedPerson?.firstName}.` : (selectedPerson ? `Link '${selectedPerson.firstName}' to another person.` : 'Select a person to start linking.')}
              </CardDescription>
              <Button 
                variant={isLinkingMode ? "destructive" : "outline"} 
                size="sm" 
                className="w-full"
                onClick={onInitiateRelationship}
                disabled={!selectedPerson}
              >
                {isLinkingMode ? <XCircle className="mr-2 h-4 w-4" /> : <Link2 className="mr-2 h-4 w-4" />}
                {isLinkingMode ? "Cancel Linking" : "Start Linking"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-secondary/50">
            <CardHeader className="p-3">
              <CardTitle className="text-md font-headline flex items-center">
                <UploadCloud className="mr-2 h-5 w-5 text-primary" /> Upload Photo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <CardDescription className="text-xs mb-2">
                {selectedPerson ? `Upload a profile picture for '${selectedPerson.firstName}'.` : 'Select a person to upload their photo.'}
              </CardDescription>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={onInitiatePhotoUpload}
                disabled={!selectedPerson}
              >
                Choose Photo...
              </Button>
            </CardContent>
          </Card>
      </div>
    </aside>
  );
}
