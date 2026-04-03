'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/components/AuthProvider';
import { User as UserIcon, Mail, Activity as ActivityIcon, Flame, ShieldAlert, Award } from 'lucide-react';

import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Session, Activity } from '@/types/firestore';

export default function ProfilePage() {
  const { user } = useAuth();
  
  const [profileStats, setProfileStats] = useState({
    totalFocusHours: 0,
    peakDistractionApp: '-',
    averageFocusTime: '0m',
    topFocusTime: '-',
    distractionResistance: 0
  });

  useEffect(() => {
    async function loadProfileMetrics() {
      if (!user) return;
      try {
        const fetchSessions = await getDocs(collection(db, 'User', user.uid, 'Session'));
        const fetchActivities = await getDocs(collection(db, 'User', user.uid, 'Activity'));
        
        const sessions = fetchSessions.docs.map(d => d.data() as Session);
        const activities = fetchActivities.docs.map(d => d.data() as Activity);

        // 1. Total Focus Hours
        let totalMs = 0;
        sessions.forEach(s => {
          const st = (s.Start_Time as any)?.toDate?.() || new Date();
          const et = (s.End_Time as any)?.toDate?.() || null;
          if (et) totalMs += (et.getTime() - st.getTime());
        });
        const totalHours = Math.floor(totalMs / 3600000);
        
        // 2. Average focus time
        const avgMs = sessions.length > 0 ? Math.round(totalMs / sessions.length) : 0;
        const avgFocusMins = Math.floor(avgMs / 60000);

        // 3. Peak distraction app
        const distApps: Record<string, number> = {};
        let topDistApp = 'None Detected';
        let maxDist = 0;
        activities.filter(a => a.Activity_Type === 'Distracting').forEach(a => {
           distApps[a.App_Name] = (distApps[a.App_Name] || 0) + 1;
           if (distApps[a.App_Name] > maxDist) {
             maxDist = distApps[a.App_Name];
             topDistApp = a.App_Name;
           }
        });

        // 4. Distraction Resistance (Ratio of Productive vs Distracting Activities)
        const totalActs = activities.length;
        const distCount = activities.filter(a => a.Activity_Type === 'Distracting').length;
        const resistance = totalActs > 0 ? Math.round(((totalActs - distCount) / totalActs) * 100) : 100;

        setProfileStats({
          totalFocusHours: totalHours,
          peakDistractionApp: topDistApp,
          averageFocusTime: `${avgFocusMins}m`,
          topFocusTime: 'Morning', // Placeholder proxy algorithm string
          distractionResistance: resistance
        });

      } catch (error) {
        console.error("Failed to load profile metrics", error);
      }
    }
    loadProfileMetrics();
  }, [user]);

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
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '80%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white">Average Focus Duration</span>
                    <span className="text-neutral-500">{profileStats.averageFocusTime} per session</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '60%' }}></div>
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
                     <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${profileStats.distractionResistance}%` }}></div>
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
