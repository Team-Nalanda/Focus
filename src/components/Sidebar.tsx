import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { rtdb } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { LayoutDashboard, CheckSquare, User as UserIcon, Settings, LogOut, Activity, Cpu } from 'lucide-react';

import Image from 'next/image';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [isLive, setIsLive] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    const sessionRef = ref(rtdb, `users/${user.uid}/liveSession`);
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      setIsLive(!!data?.active);
    });
    return () => unsubscribe();
  }, [user]);

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Activity', href: '/activity', icon: Activity, live: isLive },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Device', href: '/device', icon: Cpu },
    { name: 'Profile', href: '/profile', icon: UserIcon },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 h-full bg-black border-r border-[#222] flex flex-col justify-between hidden md:flex shrink-0">
      <div className="p-8">
        <div className="mb-12 flex items-center space-x-3">
          <Image 
            src="/focus-logo-circle.jpg" 
            alt="Focus Logo" 
            width={40} 
            height={40} 
            className="rounded-full"
          />
          <h1 className="text-2xl font-semibold tracking-widest text-white">FOCUS</h1>
        </div>
        <nav className="space-y-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors duration-200 ${
                  isActive 
                    ? 'bg-neutral-800 text-white font-medium' 
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                  <span>{item.name}</span>
                </div>
                {item.live && (
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-8 border-t border-[#222]">
        <button
          onClick={logout}
          className="flex items-center space-x-3 px-4 py-3 w-full rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-900 transition-colors duration-200 text-left"
        >
          <LogOut size={20} strokeWidth={1.5} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
