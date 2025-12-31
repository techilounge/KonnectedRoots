
"use client";

import { useState, useEffect } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { handleSuggestName } from '@/app/actions';
import type { SuggestNameInput, SuggestNameOutput, Person } from '@/types';
import { Loader2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NameSuggestorProps {
  isOpen: boolean;
  onClose: () => void;
  personDetails?: Partial<Person> | null;
  onNameSuggested: (name: string, reason: string) => void;
}

const formSchema = z.object({
  gender: z.enum(['male', 'female', 'other', 'unknown'], { required_error: "Gender is required." }),
  origin: z.string().optional(),
  historicalPeriod: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NameSuggestor({ isOpen, onClose, personDetails, onNameSuggested }: NameSuggestorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestNameOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gender: personDetails?.gender || 'male',
      origin: personDetails?.origin || '',
      historicalPeriod: personDetails?.historicalPeriod || '',
    },
  });

  useEffect(() => {
    form.reset({
      gender: personDetails?.gender || 'male',
      origin: personDetails?.origin || '',
      historicalPeriod: personDetails?.historicalPeriod || '',
    });
    setSuggestion(null);
  }, [personDetails, form, isOpen]);


  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    setSuggestion(null);
    const result = await handleSuggestName(values);
    setIsLoading(false);

    if ('error' in result) {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error,
      });
    } else {
      setSuggestion(result);
      toast({
        title: "Name Suggested!",
        description: `AI suggested: ${result.name}. Reason: ${result.reason.substring(0, 50)}...`,
      });
    }
  }

  const handleUseSuggestion = () => {
    if (suggestion) {
      onNameSuggested(suggestion.name, suggestion.reason);
      onClose();
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); form.reset(); setSuggestion(null); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center">
            <Wand2 className="mr-2 h-6 w-6 text-accent" /> AI Name Suggestor
          </DialogTitle>
          <DialogDescription>
            Let AI help you find a name. Provide some details for better suggestions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="origin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cultural Origin (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Irish, Italian, Viking" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="historicalPeriod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Historical Period (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 18th Century, Ancient Rome" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Get Suggestions
            </Button>
          </form>
        </Form>

        {suggestion && !('error' in suggestion) && (
          <div className="mt-6 p-4 border rounded-md bg-secondary/50">
            <h4 className="font-headline text-lg">Suggestion: <span className="text-primary">{suggestion.name}</span></h4>
            <p className="text-sm text-muted-foreground mt-1"><strong>Reason:</strong> {suggestion.reason}</p>
            <Button onClick={handleUseSuggestion} size="sm" className="mt-3 bg-primary hover:bg-primary/90">
              Use This Name
            </Button>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => { onClose(); form.reset(); setSuggestion(null); }}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
