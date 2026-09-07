"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Menu,
  Bell,
  Search,
  CheckCircle2,
  ExternalLink,
  LogOut,
  User,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface AdminHeaderProps {
  onToggleMobileMenu: () => void;
}

export default function AdminHeader({ onToggleMobileMenu }: AdminHeaderProps) {
  const { user, userProfile, logout } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const userName = user?.displayName || user?.email || 'Platform Admin';
  const userInitial = (user?.displayName?.[0] || user?.email?.[0] || 'A').toUpperCase();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/admin/users?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-20 px-4 md:px-6 flex items-center justify-between gap-4">
      {/* Mobile Toggle & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9"
          onClick={onToggleMobileMenu}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <form onSubmit={handleSearchSubmit} className="relative w-full hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search users by name, email, UID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-muted/40 border-muted-foreground/20 focus-visible:ring-primary text-xs rounded-full"
          />
        </form>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Live System Health Badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-[11px] font-medium text-green-600 dark:text-green-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Production Live • All Systems Normal
        </div>

        {/* Quick Link to Messages */}
        <Button variant="ghost" size="icon" asChild className="relative h-9 w-9">
          <Link href="/admin/messages" title="Support Inquiries">
            <Bell className="h-4 w-4 text-muted-foreground" />
          </Link>
        </Button>

        {/* Return to App Button */}
        <Button variant="outline" size="sm" asChild className="hidden sm:flex text-xs h-8 gap-1 border-border">
          <Link href="/dashboard">
            <span>Main App</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Link>
        </Button>

        {/* Admin Avatar & Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                <AvatarImage src={user?.photoURL || ''} alt={userName} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                <Badge variant="secondary" className="w-fit text-[10px] mt-1 capitalize bg-primary/10 text-primary border-0">
                  {userProfile?.role || 'Platform Admin'}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>My Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/configuration" className="cursor-pointer">
                <Shield className="mr-2 h-4 w-4" />
                <span>Platform Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
