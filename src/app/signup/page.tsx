"use client"; // This page now needs to be a client component to use hooks

import AuthForm from "@/components/auth/AuthForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function SignupPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after the initial render
    setIsClient(true);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto">
       <Button variant="ghost" asChild className="absolute top-4 left-4 md:top-8 md:left-8">
          <Link href="/">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Home
          </Link>
        </Button>
      {/* Only render the AuthForm on the client to avoid hydration mismatch */}
      {isClient && <AuthForm mode="signup" />}
    </div>
  );
}
