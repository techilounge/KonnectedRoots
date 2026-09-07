"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/clients';
import { doc, onSnapshot } from 'firebase/firestore';
import type { SystemConfiguration } from '@/types';
import { AlertCircle, Info, Sparkles, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function SystemBroadcastBanner() {
  const [config, setConfig] = useState<SystemConfiguration | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const unsub = onSnapshot(
        doc(db, 'system', 'configuration'),
        (snap) => {
          if (snap.exists()) {
            setConfig(snap.data() as SystemConfiguration);
          }
        },
        (err) => {
          // Silently handle if document does not exist yet or connection issue
          console.debug('System broadcast banner not accessible:', err.message);
        }
      );
      return () => unsub();
    } catch (e) {
      console.warn('Could not subscribe to system broadcast banner:', e);
    }
  }, []);

  const banner = config?.broadcastBanner;
  const maintenance = config?.maintenanceMode;

  if (dismissed) return null;

  // 1. Maintenance Mode Priority Banner
  if (maintenance?.enabled) {
    return (
      <div className="bg-amber-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-between shadow-sm z-50 sticky top-0">
        <div className="flex items-center gap-2 max-w-7xl mx-auto flex-1">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" />
          <span>{maintenance.message || 'Scheduled maintenance is currently in progress.'}</span>
        </div>
      </div>
    );
  }

  // 2. Broadcast Announcement Banner
  if (!banner?.enabled || !banner.message) return null;

  const bgStyles = {
    info: 'bg-primary text-primary-foreground',
    warning: 'bg-amber-500 text-amber-950',
    success: 'bg-emerald-600 text-white',
    promo: 'bg-gradient-to-r from-purple-600 via-pink-600 to-primary text-white',
  }[banner.type || 'info'];

  const Icon = {
    info: Info,
    warning: AlertCircle,
    success: Sparkles,
    promo: Sparkles,
  }[banner.type || 'info'];

  return (
    <div className={`${bgStyles} px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between transition-all duration-300 z-50 relative shadow-sm`}>
      <div className="flex items-center justify-center gap-2 max-w-7xl mx-auto flex-1 text-center">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{banner.message}</span>
        {banner.linkUrl && (
          <Link
            href={banner.linkUrl}
            className="underline underline-offset-2 ml-1.5 font-semibold hover:opacity-80 transition-opacity"
          >
            {banner.linkText || 'Learn More →'}
          </Link>
        )}
      </div>
      {banner.dismissible !== false && (
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-black/10 transition-colors shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
