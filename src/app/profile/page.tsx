'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/components/AuthProvider';
import { User as UserIcon, Mail, Activity, Flame, ShieldAlert, Award } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  
  // Static mockup for analytics based on the prompt's request
  const profileStats = {
    totalFocusHours: 142,
    peakDistractionApp: 'Twitter',
    averageFocusTime: '45m',
    topFocusTime: '10:00 AM',
    distractionResistance: 84 // out of 100
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-light tracking-tight mb-2">Profile</h1>
          <p className="text-neutral-400 font-light text-sm">
            Manage your personal information and overview your focus psychology profile.
          </p>
        </div>

        <div className="grid gap-6">
          {/* Identity Section */}
          <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-neutral-900 border-2 border-neutral-800 flex items-center justify-center shadow-inner">
              <UserIcon size={40} className="text-neutral-500" />
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-2xl font-medium tracking-tight text-white">{user?.displayName || 'Oshadha Shiro'}</h2>
              <div className="flex items-center space-x-2 text-neutral-400 text-sm">
                <Mail size={14} />
                <span>{user?.email || 'oshadha@example.com'}</span>
              </div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/5 rounded-full border border-white/5 mt-2">
                <Award size={14} className="text-amber-400" />
                <span className="text-xs font-medium text-amber-400 tracking-wider uppercase">Pro Level</span>
              </div>
            </div>
          </div>

          {/* Psychology & Focus Assessment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-8">
              <div className="flex items-center space-x-3 text-neutral-400 mb-6">
                <Flame size={20} className="text-emerald-400" />
                <h3 className="uppercase tracking-widest text-xs font-medium">Focus Strengths</h3>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white">Peak Flow State</span>
                    <span className="text-neutral-500">{profileStats.topFocusTime}</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-4/5"></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white">Average Focus Duration</span>
                    <span className="text-neutral-500">{profileStats.averageFocusTime} per session</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-3/5"></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white">Total Focus Logged</span>
                    <span className="text-neutral-500">{profileStats.totalFocusHours} Hrs</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-8">
               <div className="flex items-center space-x-3 text-neutral-400 mb-6">
                <ShieldAlert size={20} className="text-red-400" />
                <h3 className="uppercase tracking-widest text-xs font-medium">Distraction Profile</h3>
              </div>

               <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white">Distraction Resistance</span>
                    <span className="text-neutral-500">{profileStats.distractionResistance}%</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                     <div className="h-full bg-red-500 rounded-full w-[84%]"></div>
                  </div>
                </div>

                <div>
                   <div className="flex flex-col mb-1 pt-2">
                    <span className="text-white text-sm mb-2">Major Disrupter Context</span>
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                      <p className="text-red-400 text-sm font-medium">{profileStats.peakDistractionApp}</p>
                      <p className="text-red-400/60 text-xs mt-1">Accounts for 60% of focus session interruptions.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </AppLayout>
  );
}
