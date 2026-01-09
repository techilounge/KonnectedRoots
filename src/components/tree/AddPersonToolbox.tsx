"use client";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Wand2, Link2, UploadCloud, XCircle, Users } from 'lucide-react';
import type { Person } from '@/types';
import { cn } from '@/lib/utils';

interface AddPersonToolboxProps {
  onAddPerson: (personDetails?: Partial<Person>) => void;
  selectedPerson: Person | null;
  onInitiateRelationship: () => void;
  onInitiatePhotoUpload: () => void;
  isLinkingMode: boolean;
  // New props for relationship finder
  onInitiateRelationshipFinder: () => void;
  isRelationshipFinderMode: boolean;
  relationshipFinderPerson1: Person | null;
}

export default function AddPersonToolbox({
  onAddPerson,
  selectedPerson,
  onInitiateRelationship,
  onInitiatePhotoUpload,
  isLinkingMode,
  onInitiateRelationshipFinder,
  isRelationshipFinderMode,
  relationshipFinderPerson1,
}: AddPersonToolboxProps) {
  const getRelationshipFinderDescription = () => {
    if (isRelationshipFinderMode) {
      if (relationshipFinderPerson1) {
        return `Click another person to find their relationship with ${relationshipFinderPerson1.firstName}.`;
      }
      return 'Click the first person.';
    }
    if (selectedPerson) {
      return `Find how '${selectedPerson.firstName}' is related to another person.`;
    }
    return 'Select a person, then click to find relationships.';
  };

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

      {/* AI Relationship Finder - Repurposed AI Tools */}
      <Card className={cn("bg-secondary/50 transition-all", isRelationshipFinderMode && "ring-2 ring-accent")}>
        <CardHeader className="p-3">
          <CardTitle className="text-md font-headline flex items-center">
            <Wand2 className="mr-2 h-5 w-5 text-accent" /> AI Relationship Finder
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <CardDescription className="text-xs mb-2">
            {getRelationshipFinderDescription()}
          </CardDescription>
          <Button
            className="w-full"
            variant={isRelationshipFinderMode ? "destructive" : "outline"}
            size="sm"
            onClick={onInitiateRelationshipFinder}
            disabled={!selectedPerson && !isRelationshipFinderMode}
          >
            {isRelationshipFinderMode ? (
              <>
                <XCircle className="mr-2 h-4 w-4" /> Cancel
              </>
            ) : (
              <>
                <Users className="mr-2 h-4 w-4" /> Find Relationship
              </>
            )}
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
