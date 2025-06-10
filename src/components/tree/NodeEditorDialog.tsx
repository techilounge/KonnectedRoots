
"use client";
import { useState, useEffect } from 'react';
import type { Person } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { UserCircle, Wand2, Save, Upload, CalendarIcon } from 'lucide-react';

interface NodeEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  person: Person | null;
  onSave: (person: Person) => void;
  onOpenNameSuggestor: (personDetails: Partial<Person>) => void;
}

export default function NodeEditorDialog({ isOpen, onClose, person, onSave, onOpenNameSuggestor }: NodeEditorDialogProps) {
  const [formData, setFormData] = useState<Partial<Person>>({});

  useEffect(() => {
    if (person) {
      setFormData(person);
    } else {
      setFormData({ gender: 'neutral' }); // Default for new person
    }
  }, [person]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (name: keyof Person, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSave = () => {
    if (formData) {
      onSave(formData as Person); // Assume formData is valid Person for saving
    }
  };

  if (!person) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center">
            <UserCircle className="mr-2 h-6 w-6 text-primary" />
            Edit {formData.name || 'Person'}
          </DialogTitle>
          <DialogDescription>
            Update the details for this individual.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
          <div className="flex items-center space-x-4">
            <Image
              src={formData.profilePictureUrl || `https://placehold.co/80x80.png?text=${formData.name?.[0] || 'P'}`}
              alt={formData.name || 'Profile'}
              width={80}
              height={80}
              className="rounded-lg border"
              data-ai-hint="person avatar"
            />
            <div>
              <Label htmlFor="profilePictureUrl">Profile Picture URL</Label>
              <Input
                id="profilePictureUrl"
                name="profilePictureUrl"
                value={formData.profilePictureUrl || ''}
                onChange={handleChange}
                placeholder="https://example.com/image.png"
              />
              <Button variant="outline" size="sm" className="mt-2 text-xs">
                <Upload className="mr-2 h-3 w-3" /> Upload Image (Placeholder)
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right col-span-1">Name</Label>
            <div className="col-span-3 flex items-center gap-2">
              <Input
                id="name"
                name="name"
                value={formData.name || ''}
                onChange={handleChange}
                className="flex-grow"
              />
              <Button 
                variant="outline" 
                size="icon" 
                title="Suggest Name (AI)"
                onClick={() => onOpenNameSuggestor(formData)}
              >
                <Wand2 className="h-4 w-4 text-accent" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="gender" className="text-right col-span-1">Gender</Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => handleSelectChange('gender', value)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="birthDate" className="text-right col-span-1">Birth Date</Label>
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              value={formData.birthDate || ''}
              onChange={handleChange}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="deathDate" className="text-right col-span-1">Death Date</Label>
            <Input
              id="deathDate"
              name="deathDate"
              type="date"
              value={formData.deathDate || ''}
              onChange={handleChange}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="origin" className="text-right col-span-1">Origin</Label>
            <Input
              id="origin"
              name="origin"
              value={formData.origin || ''}
              onChange={handleChange}
              className="col-span-3"
              placeholder="e.g., Irish, German"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="historicalPeriod" className="text-right col-span-1">Historical Period</Label>
            <Input
              id="historicalPeriod"
              name="historicalPeriod"
              value={formData.historicalPeriod || ''}
              onChange={handleChange}
              className="col-span-3"
              placeholder="e.g., 19th Century, Medieval"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              placeholder="Add any relevant notes, stories, or memories..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={handleSave} className="bg-primary hover:bg-primary/90">
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
