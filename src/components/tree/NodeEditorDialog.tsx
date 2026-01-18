
"use client";
import { useState, useEffect, useRef, KeyboardEvent } from 'react';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Image from 'next/image';
import { UserCircle, Wand2, Save, Upload, CalendarIcon, Users, Briefcase, Loader2, Sparkles, Trash2, ChevronDown, Settings2, Languages, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import TranslationDialog from '@/components/tree/TranslationDialog';
import DocumentOCRDialog from '@/components/tree/DocumentOCRDialog';
import PhotoEnhanceDialog from '@/components/tree/PhotoEnhanceDialog';
import { handleGenerateBiography } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useParams } from 'next/navigation';
import { uploadPersonPhoto } from "@/lib/uploadPersonPhoto";


interface NodeEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  person: Person | null;
  onSave: (person: Person) => void;
  onDeleteRequest: (person: Person) => void;
  onOpenNameSuggestor: (personDetails: Partial<Person>) => void;
  treeId?: string;
}

export default function NodeEditorDialog({ isOpen, onClose, person, onSave, onDeleteRequest, onOpenNameSuggestor, treeId: propTreeId }: NodeEditorDialogProps) {
  const [formData, setFormData] = useState<Partial<Person>>({});
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranslationOpen, setIsTranslationOpen] = useState(false);
  const [isOCROpen, setIsOCROpen] = useState(false);
  const [isEnhanceOpen, setIsEnhanceOpen] = useState(false);
  const { toast } = useToast();
  const profilePictureInputRef = useRef<HTMLInputElement>(null);
  const params = useParams();
  const treeId = propTreeId || params.treeId as string;


  useEffect(() => {
    if (person) {
      setFormData(person);
    } else {
      setFormData({ gender: 'male', livingStatus: 'unknown', privacySetting: 'private' });
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
      toast({ variant: "destructive", title: "Validation Error", description: "First Name is required." });
      return;
    }
    if (!formData.gender || (formData.gender !== 'male' && formData.gender !== 'female')) {
      toast({ variant: "destructive", title: "Validation Error", description: "Gender is required. Please select Male or Female." });
      return;
    }
    onSave(formData as Person);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target instanceof HTMLInputElement) {
      e.preventDefault();
      handleSaveChanges();
    }
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

  // Compress image before upload
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = document.createElement('img');

      img.onload = () => {
        const maxSize = 400; // Max dimension
        let { width, height } = img;

        // Resize if larger than maxSize
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original if compression fails
          }
        }, 'image/jpeg', 0.8); // 80% quality
      };

      img.onerror = () => resolve(file); // Fallback to original on error
      img.src = URL.createObjectURL(file);
    });
  };

  const handleProfilePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !person) return;

    setIsUploading(true);
    try {
      // Compress image before upload
      const compressedFile = await compressImage(file);
      const downloadURL = await uploadPersonPhoto(compressedFile, treeId, person.id);
      setFormData(prev => ({ ...prev, profilePictureUrl: downloadURL }));
      toast({ title: "Picture Uploaded", description: "Your profile picture has been compressed and uploaded. Save to confirm." });
    } catch (e: any) {
      console.error("Upload failed:", e);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: e.message || "An unexpected error occurred.",
      });
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = '';
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
  const srcUrl =
    formData.profilePictureUrl ||
    `https://placehold.co/80x80.png?text=${(currentPersonName?.[0] ?? 'P').toString().toUpperCase()}`;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-2">
            <DialogTitle className="font-headline text-xl flex items-center">
              <UserCircle className="mr-2 h-5 w-5 text-primary" />
              Edit {currentPersonName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Fields marked * are required. Press Enter to save.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <form onKeyDown={handleKeyDown} className="space-y-3 py-2">

              <Accordion type="single" defaultValue="essential" collapsible className="space-y-2">

                {/* ESSENTIAL INFO - Photo, Name, Gender */}
                <AccordionItem value="essential" className="border rounded-lg px-3">
                  <AccordionTrigger className="py-2 hover:no-underline">
                    <span className="flex items-center text-sm font-semibold">
                      <UserCircle className="mr-2 h-4 w-4 text-primary" />
                      Essential Info
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    {/* Photo + Name Row */}
                    <div className="flex gap-4 mb-3">
                      {/* Photo */}
                      <div className="flex-shrink-0">
                        <div className="relative">
                          <Image
                            src={srcUrl}
                            alt={currentPersonName ?? 'Profile photo'}
                            width={64}
                            height={64}
                            className="rounded-lg border object-cover"
                            data-ai-hint="person avatar"
                          />
                          {isUploading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                              <Loader2 className="h-5 w-5 text-white animate-spin" />
                            </div>
                          )}
                        </div>
                        <input
                          type="file"
                          ref={profilePictureInputRef}
                          onChange={handleProfilePictureChange}
                          accept="image/png, image/jpeg, image/gif, image/webp"
                          className="hidden"
                          disabled={isUploading}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => profilePictureInputRef.current?.click()}
                          className="text-xs mt-1 h-6 px-2 w-full"
                          disabled={isUploading}
                          type="button"
                        >
                          <Upload className="mr-1 h-3 w-3" /> Photo
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEnhanceOpen(true)}
                          disabled={!srcUrl && !formData.profilePictureUrl && !person?.profilePictureUrl}
                          className="text-xs mt-1 h-6 px-2 w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          type="button"
                        >
                          <Sparkles className="mr-1 h-3 w-3" /> Enhance
                        </Button>
                      </div>

                      {/* Names */}
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="firstName" className="text-xs">First Name*</Label>
                          <div className="flex gap-1">
                            <Input
                              id="firstName"
                              name="firstName"
                              value={formData.firstName || ''}
                              onChange={handleChange}
                              onFocus={handleFirstNameFocus}
                              placeholder="John"
                              className="h-8 text-sm"
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Suggest Name (AI)" onClick={() => onOpenNameSuggestor(formData)} type="button">
                              <Wand2 className="h-3 w-3 text-accent" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="lastName" className="text-xs">Last Name</Label>
                          <Input id="lastName" name="lastName" value={formData.lastName || ''} onChange={handleChange} placeholder="Doe" className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label htmlFor="gender" className="text-xs">Gender*</Label>
                          <Select value={formData.gender} onValueChange={(value) => handleSelectChange('gender', value)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="nickname" className="text-xs">Nickname</Label>
                          <Input id="nickname" name="nickname" value={formData.nickname || ''} onChange={handleChange} placeholder="Johnny" className="h-8 text-sm" />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* VITAL RECORDS - Birth/Death */}
                <AccordionItem value="vital" className="border rounded-lg px-3">
                  <AccordionTrigger className="py-2 hover:no-underline">
                    <span className="flex items-center text-sm font-semibold">
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                      Vital Records
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="birthDate" className="text-xs">Birth Date</Label>
                        <Input id="birthDate" name="birthDate" value={formData.birthDate || ''} onChange={handleChange} placeholder="YYYY-MM-DD" className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="placeOfBirth" className="text-xs">Birth Place</Label>
                        <Input id="placeOfBirth" name="placeOfBirth" value={formData.placeOfBirth || ''} onChange={handleChange} placeholder="City, Country" className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="deathDate" className="text-xs">Death Date</Label>
                        <Input id="deathDate" name="deathDate" value={formData.deathDate || ''} onChange={handleChange} placeholder="YYYY-MM-DD" className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="placeOfDeath" className="text-xs">Death Place</Label>
                        <Input id="placeOfDeath" name="placeOfDeath" value={formData.placeOfDeath || ''} onChange={handleChange} placeholder="City, Country" className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="livingStatus" className="text-xs">Living Status</Label>
                        <Select value={formData.livingStatus || 'unknown'} onValueChange={(value) => handleSelectChange('livingStatus', value)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="living">Living</SelectItem>
                            <SelectItem value="deceased">Deceased</SelectItem>
                            <SelectItem value="unknown">Unknown</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* ADDITIONAL DETAILS - More names, Bio, Occupation */}
                <AccordionItem value="additional" className="border rounded-lg px-3">
                  <AccordionTrigger className="py-2 hover:no-underline">
                    <span className="flex items-center text-sm font-semibold">
                      <Briefcase className="mr-2 h-4 w-4 text-primary" />
                      Additional Details
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 space-y-3">
                    {/* Extended name fields */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label htmlFor="namePrefix" className="text-xs">Prefix</Label>
                        <Input id="namePrefix" name="namePrefix" value={formData.namePrefix || ''} onChange={handleChange} placeholder="Mr., Dr." className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="middleName" className="text-xs">Middle Name</Label>
                        <Input id="middleName" name="middleName" value={formData.middleName || ''} onChange={handleChange} placeholder="Michael" className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="nameSuffix" className="text-xs">Suffix</Label>
                        <Input id="nameSuffix" name="nameSuffix" value={formData.nameSuffix || ''} onChange={handleChange} placeholder="Jr., PhD" className="h-8 text-sm" />
                      </div>
                      <div className="col-span-3 sm:col-span-1">
                        <Label htmlFor="maidenName" className="text-xs">Maiden Name</Label>
                        <Input id="maidenName" name="maidenName" value={formData.maidenName || ''} onChange={handleChange} placeholder="Smith" className="h-8 text-sm" />
                      </div>
                    </div>

                    {/* Biographical */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="occupation" className="text-xs">Occupation</Label>
                        <Input id="occupation" name="occupation" value={formData.occupation || ''} onChange={handleChange} placeholder="Teacher" className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="education" className="text-xs">Education</Label>
                        <Input id="education" name="education" value={formData.education || ''} onChange={handleChange} placeholder="University" className="h-8 text-sm" />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="religion" className="text-xs">Religion</Label>
                        <Input id="religion" name="religion" value={formData.religion || ''} onChange={handleChange} placeholder="e.g. Christian" className="h-8 text-sm" />
                      </div>
                    </div>

                    {/* Biography */}
                    <div>
                      <Label htmlFor="biography" className="text-xs">Biography</Label>
                      <Textarea id="biography" name="biography" value={formData.biography || ''} onChange={handleChange} placeholder="Life summary..." rows={3} className="text-sm" />
                      <div className="flex gap-1 mt-1 flex-wrap">
                        <Button variant="outline" size="sm" onClick={handleGenerateBioClick} disabled={isGeneratingBio} className="h-7 text-xs" type="button">
                          {isGeneratingBio ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3 text-accent" />}
                          Generate with AI
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setIsTranslationOpen(true)} className="h-7 text-xs" type="button">
                          <Languages className="mr-1 h-3 w-3" />
                          Translate
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setIsOCROpen(true)} className="h-7 text-xs" type="button">
                          <FileText className="mr-1 h-3 w-3" />
                          Scan Doc
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* ADVANCED - Privacy, IDs, AI Helper */}
                <AccordionItem value="advanced" className="border rounded-lg px-3">
                  <AccordionTrigger className="py-2 hover:no-underline">
                    <span className="flex items-center text-sm font-semibold">
                      <Settings2 className="mr-2 h-4 w-4 text-primary" />
                      Advanced
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="privacySetting" className="text-xs">Privacy</Label>
                        <Select value={formData.privacySetting || 'private'} onValueChange={(value) => handleSelectChange('privacySetting', value)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="private">Private</SelectItem>
                            <SelectItem value="invite-only">Invite-Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="externalId" className="text-xs">External ID</Label>
                        <Input id="externalId" name="externalId" value={formData.externalId || ''} onChange={handleChange} placeholder="Ancestry ID" className="h-8 text-sm" />
                      </div>
                    </div>

                    {/* AI Helper fields */}
                    <div className="grid grid-cols-2 gap-2 p-2 bg-muted/30 rounded-md">
                      <div>
                        <Label htmlFor="origin" className="text-xs text-muted-foreground">Origin (AI)</Label>
                        <Input id="origin" name="origin" value={formData.origin || ''} onChange={handleChange} placeholder="e.g., Irish" className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="historicalPeriod" className="text-xs text-muted-foreground">Era (AI)</Label>
                        <Input id="historicalPeriod" name="historicalPeriod" value={formData.historicalPeriod || ''} onChange={handleChange} placeholder="19th Century" className="h-8 text-sm" />
                      </div>
                    </div>

                    {/* Source Notes */}
                    <div>
                      <Label htmlFor="sourceCitationsNotes" className="text-xs">Source Notes</Label>
                      <Textarea id="sourceCitationsNotes" name="sourceCitationsNotes" value={formData.sourceCitationsNotes || ''} onChange={handleChange} placeholder="Citations, references..." rows={2} className="text-sm" />
                    </div>

                    {/* Read-only ID */}
                    <div>
                      <Label className="text-xs text-muted-foreground">System ID</Label>
                      <Input value={formData.id || person?.id || 'Auto-generated'} readOnly className="h-8 text-sm bg-muted/50" />
                    </div>
                  </AccordionContent>
                </AccordionItem>

              </Accordion>
            </form>
          </ScrollArea>

          <DialogFooter className="pt-3 border-t flex-shrink-0 sm:justify-between gap-2">
            <Button variant="destructive" size="sm" onClick={handleDeleteClick} type="button">
              <Trash2 className="mr-1 h-3 w-3" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="button" size="sm" onClick={handleSaveChanges} className="bg-primary hover:bg-primary/90">
                <Save className="mr-1 h-3 w-3" /> Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Translation Dialog */}
      <TranslationDialog
        isOpen={isTranslationOpen}
        onClose={() => setIsTranslationOpen(false)}
        initialText={formData.biography || ''}
        onUseTranslation={(translatedText) => {
          setFormData(prev => ({ ...prev, biography: translatedText }));
          toast({ title: "Translation Applied", description: "Biography updated with translation." });
        }}
      />

      {/* Document OCR Dialog */}
      <DocumentOCRDialog
        isOpen={isOCROpen}
        onClose={() => setIsOCROpen(false)}
        onDataExtracted={(data) => {
          // Populate relevant fields from extracted data
          if (data.text) {
            setFormData(prev => ({
              ...prev,
              biography: prev.biography
                ? `${prev.biography}\n\n--- Extracted from document ---\n${data.text}`
                : data.text
            }));
          }
          if (data.places && data.places.length > 0 && !formData.placeOfBirth) {
            setFormData(prev => ({ ...prev, placeOfBirth: data.places![0] }));
          }
          toast({ title: "Data Extracted", description: "Document data added to biography." });
        }}
      />

      {/* Photo Enhance Dialog */}
      <PhotoEnhanceDialog
        isOpen={isEnhanceOpen}
        onClose={() => setIsEnhanceOpen(false)}
        currentPhotoUrl={srcUrl}
        onPhotoEnhanced={(newPhotoUrl) => {
          // In a real app, this would be an uploaded file URL
          // For this demo, we're just updating the preview state
          setFormData(prev => ({ ...prev, profilePictureUrl: newPhotoUrl }));
          toast({ title: "Photo Updated", description: "Enhanced photo applied to profile." });
        }}
      />
    </>
  );
}
