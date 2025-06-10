
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MessageSquare, User, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const contactFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  subject: z.string().min(5, { message: "Subject must be at least 5 characters." }),
  message: z.string().min(10, { message: "Message must be at least 10 characters." }),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function ContactPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormValues) => {
    setIsSubmitting(true);
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log("Contact form submitted:", data);
    toast({
      title: "Message Sent!",
      description: "Thank you for contacting us. We'll get back to you soon.",
    });
    form.reset();
    setIsSubmitting(false);
  };

  return (
    <div className="container py-12 md:py-20">
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader className="text-center">
          <MessageSquare className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="font-headline text-3xl md:text-4xl">Get In Touch</CardTitle>
          <CardDescription className="text-lg">
            We&apos;d love to hear from you! Send us a message with any questions or feedback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="name" className="flex items-center mb-1">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" /> Your Name
                </Label>
                <Input id="name" {...form.register("name")} placeholder="John Doe" />
                {form.formState.errors.name && <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="email" className="flex items-center mb-1">
                  <Mail className="h-4 w-4 mr-2 text-muted-foreground" /> Your Email
                </Label>
                <Input id="email" type="email" {...form.register("email")} placeholder="you@example.com" />
                {form.formState.errors.email && <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>}
              </div>
            </div>
            <div>
              <Label htmlFor="subject" className="flex items-center mb-1">Subject</Label>
              <Input id="subject" {...form.register("subject")} placeholder="Question about features" />
              {form.formState.errors.subject && <p className="text-sm text-destructive mt-1">{form.formState.errors.subject.message}</p>}
            </div>
            <div>
              <Label htmlFor="message" className="flex items-center mb-1">Message</Label>
              <Textarea id="message" {...form.register("message")} placeholder="Your message here..." rows={5} />
              {form.formState.errors.message && <p className="text-sm text-destructive mt-1">{form.formState.errors.message.message}</p>}
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-lg py-3" disabled={isSubmitting}>
              {isSubmitting ? (
                <Send className="mr-2 h-5 w-5 animate-pulse" /> 
              ) : (
                <Send className="mr-2 h-5 w-5" />
              )}
              Send Message
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
