'use client';

import React, { useEffect } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from './AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, CheckSquare, User as UserIcon, Settings } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[#fff]/30 border-r-2 border-[#fff]/30"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-black text-white p-8 md:p-12 relative flex flex-col items-center">
        {/* Subtle background ambient glow, minimized for ultra-minimalist feel */}
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[40%] bg-neutral-800 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
        
        {/* Max width container for better readability on ultra-wide screens */}
        <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col h-full relative z-10 pb-20 md:pb-0">
          {children}
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden fixed bottom-6 left-6 right-6 h-16 bg-neutral-900/80 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-around z-50 px-2 shadow-2xl">
          {[
            { href: '/', icon: LayoutDashboard },
            { href: '/tasks', icon: CheckSquare },
            { href: '/profile', icon: UserIcon },
            { href: '/settings', icon: Settings },
          ].map((item, i) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link key={i} href={item.href} className={`p-3 rounded-xl transition-all ${isActive ? 'bg-white text-black scale-105' : 'text-neutral-400 hover:text-white'}`}>
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
