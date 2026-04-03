import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { LayoutDashboard, CheckSquare, User as UserIcon, Settings, LogOut } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Profile', href: '/profile', icon: UserIcon },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 h-full bg-black border-r border-[#222] flex flex-col justify-between hidden md:flex shrink-0">
      <div className="p-8">
        <h1 className="text-2xl font-semibold tracking-widest text-white mb-12">FOCUS.</h1>
        <nav className="space-y-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                  isActive 
                    ? 'bg-neutral-800 text-white font-medium' 
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                <span>{item.name}</span>
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
