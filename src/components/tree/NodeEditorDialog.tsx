
"use client";
import { useState, useEffect, useRef } from 'react';
import type { Person, GenerateBiographyInput } from '@/types';
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
import { UserCircle, Wand2, Save, Upload, CalendarIcon, Users, Info, Briefcase, BookOpen, ScrollText, LinkIcon, MapPin, Eye, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { handleGenerateBiography, handleUploadProfilePicture } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useParams } from 'next/navigation';


interface NodeEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  person: Person | null;
  onSave: (person: Person) => void;
  onDeleteRequest: (person: Person) => void;
  onOpenNameSuggestor: (personDetails: Partial<Person>) => void;
}

export default function NodeEditorDialog({ isOpen, onClose, person, onSave, onDeleteRequest, onOpenNameSuggestor }: NodeEditorDialogProps) {
  const [formData, setFormData] = useState<Partial<Person>>({});
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const profilePictureInputRef = useRef<HTMLInputElement>(null);
  const params = useParams();
  const treeId = params.treeId as string;


  useEffect(() => {
    if (person) {
      setFormData(person);
    } else {
      setFormData({ gender: 'male', livingStatus: 'unknown', privacySetting: 'private' }); // Default for new person
    }
  }, [person, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleFirstNameFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === 'New Person') {
      setFormData({ ...formData, firstName: '' });
    }
  };

  const handleSelectChange = (name: keyof Person, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSaveChanges = () => {
    if (!formData.firstName || formData.firstName.trim() === "") {
        toast({variant: "destructive", title: "Validation Error", description: "First Name is required."});
        return;
    }
    onSave(formData as Person);
  };

  const handleGenerateBioClick = async () => {
    setIsGeneratingBio(true);
    const biographyInput: GenerateBiographyInput = {
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
        maidenName: formData.maidenName,
        birthDate: formData.birthDate,
        placeOfBirth: formData.placeOfBirth,
        deathDate: formData.deathDate,
        placeOfDeath: formData.placeOfDeath,
        occupation: formData.occupation,
        education: formData.education,
        religion: formData.religion,
        existingBiography: formData.biography
    };

    try {
        const result = await handleGenerateBiography(biographyInput);
        if ('error' in result) {
            toast({ variant: "destructive", title: "AI Error", description: result.error });
        } else {
            setFormData(prev => ({ ...prev, biography: result.biography }));
            toast({ title: "Biography Generated", description: "AI has drafted a biography." });
        }
    } catch (error) {
        console.error("Failed to generate biography:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not generate biography." });
    } finally {
        setIsGeneratingBio(false);
    }
  };

  const handleProfilePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !person) return;
    
    // Check file size (e.g., 5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Please select an image smaller than 5MB." });
      return;
    }

    setIsUploading(true);

    const actionFormData = new FormData();
    actionFormData.append('profilePicture', file);
    actionFormData.append('treeId', treeId);
    actionFormData.append('personId', person.id);

    try {
      const result = await handleUploadProfilePicture(actionFormData);
      if ('error' in result) {
        throw new Error(result.error);
      }
      
      setFormData(prev => ({ ...prev, profilePictureUrl: result.downloadURL }));
      toast({ title: "Picture Uploaded", description: "Your new profile picture is ready. Save changes to confirm." });

    } catch (error) {
      console.error("Upload failed:", error);
      toast({ variant: "destructive", title: "Upload Failed", description: error instanceof Error ? error.message : "Could not upload image." });
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = ''; // Reset file input
      }
    }
  };

  const handleDeleteClick = () => {
    if (person) {
      onDeleteRequest(person);
    }
  };

  if (!person && !isOpen) return null; 

  const currentPersonName = formData.firstName || person?.firstName || 'New Person';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center">
            <UserCircle className="mr-2 h-6 w-6 text-primary" />
            Edit {currentPersonName}
          </DialogTitle>
          <DialogDescription>
            Update the details for this individual. Fields marked * are recommended.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-6">
        <div className="grid gap-6 py-4">

          <section className="space-y-3 p-3 border rounded-md">
            <h3 className="font-semibold text-md flex items-center"><Info className="mr-2 h-5 w-5 text-primary" />Name Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="namePrefix">Prefix</Label>
                <Input id="namePrefix" name="namePrefix" value={formData.namePrefix || ''} onChange={handleChange} placeholder="Mr., Dr." />
              </div>
              <div>
                <Label htmlFor="firstName">First Name*</Label>
                 <div className="flex items-center gap-2">
                    <Input id="firstName" name="firstName" value={formData.firstName || ''} onChange={handleChange} onFocus={handleFirstNameFocus} placeholder="John" className="flex-grow" />
                    <Button variant="outline" size="icon" title="Suggest Name (AI)" onClick={() => onOpenNameSuggestor(formData)}>
                        <Wand2 className="h-4 w-4 text-accent" />
                    </Button>
                 </div>
              </div>
              <div>
                <Label htmlFor="middleName">Middle Name(s)</Label>
                <Input id="middleName" name="middleName" value={formData.middleName || ''} onChange={handleChange} placeholder="Michael" />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name (Surname)</Label>
                <Input id="lastName" name="lastName" value={formData.lastName || ''} onChange={handleChange} placeholder="Doe" />
              </div>
              <div>
                <Label htmlFor="maidenName">Maiden Name</Label>
                <Input id="maidenName" name="maidenName" value={formData.maidenName || ''} onChange={handleChange} placeholder="Smith" />
              </div>
              <div>
                <Label htmlFor="nameSuffix">Suffix</Label>
                <Input id="nameSuffix" name="nameSuffix" value={formData.nameSuffix || ''} onChange={handleChange} placeholder="Jr., PhD" />
              </div>
              <div>
                <Label htmlFor="nickname">Nickname</Label>
                <Input id="nickname" name="nickname" value={formData.nickname || ''} onChange={handleChange} placeholder="Johnny" />
              </div>
            </div>
          </section>

          <section className="space-y-3 p-3 border rounded-md">
            <h3 className="font-semibold text-md flex items-center"><Users className="mr-2 h-5 w-5 text-primary" />Basic Demographics</h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="gender">Gender*</Label>
                <Select value={formData.gender} onValueChange={(value) => handleSelectChange('gender', value)}>
                  <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-3 p-3 border rounded-md">
            <h3 className="font-semibold text-md flex items-center"><CalendarIcon className="mr-2 h-5 w-5 text-primary" />Vital Dates & Places</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="birthDate">Birth Date</Label>
                <Input id="birthDate" name="birthDate" type="text" value={formData.birthDate || ''} onChange={handleChange} placeholder="YYYY-MM-DD or text"/>
              </div>
              <div>
                <Label htmlFor="placeOfBirth">Place of Birth</Label>
                <Input id="placeOfBirth" name="placeOfBirth" value={formData.placeOfBirth || ''} onChange={handleChange} placeholder="City, Country" />
              </div>
              <div>
                <Label htmlFor="deathDate">Death Date</Label>
                <Input id="deathDate" name="deathDate" type="text" value={formData.deathDate || ''} onChange={handleChange} placeholder="YYYY-MM-DD or text"/>
              </div>
              <div>
                <Label htmlFor="placeOfDeath">Place of Death</Label>
                <Input id="placeOfDeath" name="placeOfDeath" value={formData.placeOfDeath || ''} onChange={handleChange} placeholder="City, Country" />
              </div>
            </div>
          </section>

          <section className="space-y-3 p-3 border rounded-md">
                <h3 className="font-semibold text-md flex items-center"><Eye className="mr-2 h-5 w-5 text-primary" />Status & Visibility</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="livingStatus">Living Status</Label>
                        <Select value={formData.livingStatus || 'unknown'} onValueChange={(value) => handleSelectChange('livingStatus', value)}>
                            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="living">Living</SelectItem>
                                <SelectItem value="deceased">Deceased</SelectItem>
                                <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="privacySetting">Privacy Setting</Label>
                        <Select value={formData.privacySetting || 'private'} onValueChange={(value) => handleSelectChange('privacySetting', value)}>
                            <SelectTrigger><SelectValue placeholder="Select privacy" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="public">Public</SelectItem>
                                <SelectItem value="private">Private</SelectItem>
                                <SelectItem value="invite-only">Invite-Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </section>

            <section className="space-y-3 p-3 border rounded-md">
                <h3 className="font-semibold text-md flex items-center"><Briefcase className="mr-2 h-5 w-5 text-primary" />Biographical Details</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="occupation">Occupation/Profession</Label>
                        <Input id="occupation" name="occupation" value={formData.occupation || ''} onChange={handleChange} placeholder="Teacher, Engineer" />
                    </div>
                    <div>
                        <Label htmlFor="education">Education</Label>
                        <Input id="education" name="education" value={formData.education || ''} onChange={handleChange} placeholder="University Name, Degree" />
                    </div>
                </div>
                <div>
                    <Label htmlFor="religion">Religion/Faith Tradition</Label>
                    <Input id="religion" name="religion" value={formData.religion || ''} onChange={handleChange} placeholder="e.g. Christian, Jewish, N/A" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="biography">Biography / Life Summary</Label>
                    <Textarea id="biography" name="biography" value={formData.biography || ''} onChange={handleChange} placeholder="Key life events, stories..." rows={4} />
                    <Button variant="outline" size="sm" onClick={handleGenerateBioClick} disabled={isGeneratingBio} className="w-full sm:w-auto">
                        {isGeneratingBio ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-accent" />}
                        Generate with AI
                    </Button>
                </div>
            </section>

            <section className="space-y-3 p-3 border rounded-md">
                <h3 className="font-semibold text-md flex items-center"><Upload className="mr-2 h-5 w-5 text-primary" />Media & References</h3>
                 <div className="flex items-start space-x-4">
                    <div className="relative">
                        <Image
                        src={formData.profilePictureUrl || `https://placehold.co/80x80.png?text=${currentPersonName?.[0] || 'P'}`}
                        alt={currentPersonName}
                        width={80}
                        height={80}
                        className="rounded-lg border flex-shrink-0 object-cover"
                        data-ai-hint="person avatar"
                        />
                        {isUploading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                                <Loader2 className="h-6 w-6 text-white animate-spin" />
                            </div>
                        )}
                    </div>
                    <div className="flex-grow space-y-2">
                         <input
                            type="file"
                            ref={profilePictureInputRef}
                            onChange={handleProfilePictureChange}
                            accept="image/png, image/jpeg, image/gif"
                            className="hidden"
                            aria-hidden="true"
                            disabled={isUploading}
                        />
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => profilePictureInputRef.current?.click()}
                            className="text-xs"
                            disabled={isUploading}
                         >
                            <Upload className="mr-2 h-3 w-3" /> Upload New Photo
                        </Button>
                        <p className="text-xs text-muted-foreground">Max file size: 5MB.</p>
                    </div>
                </div>
                <div>
                    <Label htmlFor="sourceCitationsNotes">Additional Photos, Documents, Source Citations & Notes</Label>
                    <Textarea id="sourceCitationsNotes" name="sourceCitationsNotes" value={formData.sourceCitationsNotes || ''} onChange={handleChange} placeholder="Links to media, document references, citation details..." rows={3} />
                </div>
            </section>

            <section className="space-y-3 p-3 border rounded-md">
                <h3 className="font-semibold text-md flex items-center"><LinkIcon className="mr-2 h-5 w-5 text-primary" />Identifiers</h3>
                <div>
                    <Label htmlFor="externalId">External ID (e.g., Ancestry, Find-a-Grave)</Label>
                    <Input id="externalId" name="externalId" value={formData.externalId || ''} onChange={handleChange} placeholder="Link or ID from other services" />
                </div>
                 <div>
                    <Label>KonnectedRoots ID</Label>
                    <Input value={formData.id || person?.id || 'Will be auto-generated'} readOnly className="bg-muted/50" />
                </div>
            </section>
            
            <section className="space-y-3 p-3 border rounded-md bg-secondary/30">
                <h3 className="font-semibold text-md flex items-center"><Wand2 className="mr-2 h-5 w-5 text-accent" />AI Helper Fields</h3>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="origin">Origin (for AI Name Suggestion)</Label>
                        <Input id="origin" name="origin" value={formData.origin || ''} onChange={handleChange} placeholder="e.g., Irish, German"/>
                    </div>
                    <div>
                        <Label htmlFor="historicalPeriod">Historical Period (for AI Name Suggestion)</Label>
                        <Input id="historicalPeriod" name="historicalPeriod" value={formData.historicalPeriod || ''} onChange={handleChange} placeholder="e.g., 19th Century"/>
                    </div>
                </div>
            </section>

        </div>
        </ScrollArea>
        <DialogFooter className="sm:justify-between">
          <Button variant="destructive" onClick={handleDeleteClick}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete Person
          </Button>
          <div className="flex space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={handleSaveChanges} className="bg-primary hover:bg-primary/90">
              <Save className="mr-2 h-4 w-4" /> Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
