"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  TreeDeciduous,
  CreditCard,
  Sparkles,
  FileBarChart,
  Sliders,
  ShieldCheck,
  Mail,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Logo from '@/components/shared/Logo';

interface AdminSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navSections = [
  {
    title: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Management',
    items: [
      { href: '/admin/users', label: 'Users & Accounts', icon: Users },
      { href: '/admin/trees', label: 'Trees & Content', icon: TreeDeciduous },
      { href: '/admin/billing', label: 'Subscriptions', icon: CreditCard },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { href: '/admin/ai-metering', label: 'AI Operations', icon: Sparkles },
      { href: '/admin/reports', label: 'Reports & Exports', icon: FileBarChart },
    ],
  },
  {
    title: 'Platform Control',
    items: [
      { href: '/admin/configuration', label: 'Configuration', icon: Sliders },
      { href: '/admin/audit-logs', label: 'Audit Trail', icon: ShieldCheck },
      { href: '/admin/messages', label: 'Support Inquiries', icon: Mail },
    ],
  },
];

export default function AdminSidebar({ collapsed, onToggleCollapse }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "bg-card border-r border-border transition-all duration-300 ease-in-out flex flex-col z-30 sticky top-0 h-screen select-none",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Sidebar Top Branding */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed ? (
          <div className="flex items-center space-x-2">
            <Link href="/admin" className="flex items-center space-x-2">
              <Logo className="h-8 w-auto" />
            </Link>
            <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30 uppercase tracking-wider px-1.5 py-0">
              Admin
            </Badge>
          </div>
        ) : (
          <div className="mx-auto">
            <ShieldAlert className="h-7 w-7 text-primary" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:flex"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {!collapsed && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 mb-2">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Sidebar Footer: Return to Main App */}
      <div className="p-3 border-t border-border mt-auto">
        <Button
          variant="ghost"
          asChild
          className={cn(
            "w-full text-muted-foreground hover:text-foreground justify-start text-xs",
            collapsed && "justify-center px-0"
          )}
        >
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="ml-2 font-medium">Exit to App</span>}
          </Link>
        </Button>
      </div>
    </aside>
  );
}
