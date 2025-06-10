
import AuthForm from "@/components/auth/AuthForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="w-full max-w-md mx-auto">
        <Button variant="ghost" asChild className="absolute top-4 left-4 md:top-8 md:left-8">
          <Link href="/">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Home
          </Link>
        </Button>
      <AuthForm mode="login" />
    </div>
  );
}
