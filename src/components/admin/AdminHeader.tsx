"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { searchAdminGlobal, type AdminGlobalSearchResult } from '@/app/admin/actions';
import {
  Menu,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LogOut,
  User,
  Shield,
  X,
  Loader2,
  TreeDeciduous,
  Users,
  Compass,
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
  collapsed?: boolean;
  onToggleSidebar?: () => void;
  onToggleMobileMenu: () => void;
}

export default function AdminHeader({
  collapsed,
  onToggleSidebar,
  onToggleMobileMenu,
}: AdminHeaderProps) {
  const { user, userProfile, logout } = useAuth();
  const router = useRouter();

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<AdminGlobalSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const userName = user?.displayName || user?.email || 'Platform Admin';
  const userInitial = (user?.displayName?.[0] || user?.email?.[0] || 'A').toUpperCase();

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced Live Search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      if (!user) return;
      try {
        const idToken = await user.getIdToken();
        const res = await searchAdminGlobal(idToken, q);
        setResults(res);
      } catch (err) {
        console.error('Error during live global search:', err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timeout);
  }, [searchQuery, user]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsOpen(false);
    router.push(`/admin/users?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleSelectResult = (url: string) => {
    setIsOpen(false);
    router.push(url);
  };

  const hasResults =
    results &&
    (results.navigation.length > 0 || results.users.length > 0 || results.trees.length > 0);

  return (
    <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-20 px-4 md:px-6 flex items-center justify-between gap-4">
      {/* Sidebar Toggles & Global Live Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
          onClick={onToggleMobileMenu}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Desktop Sidebar Collapse Toggle - Relocated cleanly outside search bar */}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="hidden md:flex h-9 w-9 text-muted-foreground hover:text-foreground shrink-0 rounded-lg hover:bg-muted"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* Global Live Search Bar */}
        <div ref={searchContainerRef} className="relative w-full hidden sm:block">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Live search users, trees, pages..."
              value={searchQuery}
              onFocus={() => {
                if (searchQuery.trim()) setIsOpen(true);
              }}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsOpen(false);
              }}
              className="pl-9 pr-9 h-9 bg-muted/40 border-muted-foreground/20 focus-visible:ring-primary text-xs rounded-full"
            />
            {isSearching ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setResults(null);
                  setIsOpen(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                title="Clear query"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </form>

          {/* Live Search Floating Popover */}
          {isOpen && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-card border border-border/80 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in-50 slide-in-from-top-1 duration-150 max-h-[460px] overflow-y-auto">
              {isSearching && !results && (
                <div className="p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Searching platform across users, trees, and tools...
                </div>
              )}

              {!isSearching && !hasResults && (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  <Search className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  No users, trees, or pages matched &ldquo;<span className="text-foreground font-medium">{searchQuery}</span>&rdquo;
                </div>
              )}

              {/* Navigation Shortcuts */}
              {results && results.navigation.length > 0 && (
                <div className="p-2 border-b border-border/50">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Compass className="h-3 w-3 text-primary" />
                    Admin Navigation
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {results.navigation.map((nav) => (
                      <button
                        key={nav.href}
                        onClick={() => handleSelectResult(nav.href)}
                        className="w-full flex items-center justify-between p-2 rounded-lg text-left text-xs hover:bg-muted/70 transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium group-hover:text-primary transition-colors">{nav.title}</span>
                          <span className="text-[11px] text-muted-foreground truncate hidden md:inline">{nav.description}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 shrink-0">
                          {nav.category}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Users */}
              {results && results.users.length > 0 && (
                <div className="p-2 border-b border-border/50">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3 w-3 text-primary" />
                    Matching Users ({results.users.length})
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {results.users.map((u) => (
                      <button
                        key={u.uid}
                        onClick={() => handleSelectResult(`/admin/users?q=${encodeURIComponent(u.email || u.uid)}`)}
                        className="w-full flex items-center justify-between p-2 rounded-lg text-left text-xs hover:bg-muted/70 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarImage src={u.photoURL} alt={u.displayName} />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {u.displayName?.[0] || u.email?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate group-hover:text-primary transition-colors">{u.displayName}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="secondary" className="text-[9px] capitalize px-1.5 py-0">
                            {u.plan}
                          </Badge>
                          {u.role === 'admin' || u.role === 'super_admin' ? (
                            <Badge className="text-[9px] bg-primary/20 text-primary border-primary/30 px-1.5 py-0">
                              Admin
                            </Badge>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Trees */}
              {results && results.trees.length > 0 && (
                <div className="p-2 border-b border-border/50">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <TreeDeciduous className="h-3 w-3 text-emerald-600" />
                    Matching Family Trees ({results.trees.length})
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {results.trees.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectResult(`/admin/trees?q=${encodeURIComponent(t.title || t.id)}`)}
                        className="w-full flex items-center justify-between p-2 rounded-lg text-left text-xs hover:bg-muted/70 transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <TreeDeciduous className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="font-medium truncate group-hover:text-primary transition-colors">{t.title}</span>
                          <span className="text-[11px] text-muted-foreground truncate">({t.memberCount} members)</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] capitalize px-1.5 py-0 shrink-0">
                          {t.visibility}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer View All Shortcut */}
              <div className="p-2 bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Press <kbd className="px-1 py-0.5 bg-background border border-border rounded text-[10px]">Enter</kbd> to search user directory</span>
                <button
                  type="button"
                  onClick={() => handleSelectResult(`/admin/users?q=${encodeURIComponent(searchQuery.trim())}`)}
                  className="text-primary hover:underline font-medium"
                >
                  View All &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
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
