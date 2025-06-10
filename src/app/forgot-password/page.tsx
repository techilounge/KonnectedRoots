
"use client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, KeyRound, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    // Simulate API call for password reset
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log("Forgot password request for:", data.email);
    toast({
      title: "Password Reset Email Sent",
      description: `If an account exists for ${data.email}, you will receive an email with instructions to reset your password.`,
    });
    form.reset();
    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
        <Button variant="ghost" asChild className="absolute top-4 left-4 md:top-8 md:left-8">
          <Link href="/login">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Login
          </Link>
        </Button>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="font-headline text-2xl md:text-3xl">Forgot Your Password?</CardTitle>
          <CardDescription className="text-sm">
            No worries! Enter your email address below and we&apos;ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label htmlFor="email" className="flex items-center mb-1">
                <Mail className="h-4 w-4 mr-2 text-muted-foreground" /> Email Address
              </Label>
              <Input id="email" type="email" {...form.register("email")} placeholder="you@example.com" />
              {form.formState.errors.email && <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>}
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        </CardContent>
         <CardFooter className="text-center text-sm text-muted-foreground">
          <p>Remembered your password? <Link href="/login" className="text-primary hover:underline">Log In</Link></p>
        </CardFooter>
      </Card>
    </div>
  );
}
