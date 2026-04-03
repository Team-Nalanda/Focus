'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Session, FocusAnalysis } from '@/types/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import { ArrowUpRight, Zap, Target, Clock, Activity, Play, CheckSquare } from 'lucide-react';

// Mocked data for chart structure in case DB is newly seeded or empty
const mockFocusData = [
  { day: 'Mon', score: 65, duration: 2.5 },
  { day: 'Tue', score: 80, duration: 4.2 },
  { day: 'Wed', score: 75, duration: 3.8 },
  { day: 'Thu', score: 92, duration: 5.1 },
  { day: 'Fri', score: 88, duration: 4.9 },
  { day: 'Sat', score: 45, duration: 1.2 },
  { day: 'Sun', score: 95, duration: 6.0 },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [startingExtension, setStartingExtension] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        const q = query(collection(db, 'User', user.uid, 'Session'), orderBy('Start_Time', 'desc'), limit(5));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
        setSessions(data);
      } catch (error) {
        console.error("Error fetching sessions:", error);
      } finally {
        setLoadingDb(false);
      }
    }
    fetchData();
  }, [user]);

  const handleStartExtension = () => {
    setStartingExtension(true);
    setTimeout(() => {
      setStartingExtension(false);
      // Simulate connecting to external extension
      alert("Extension launched successfully! Monitoring focus...");
    }, 1500);
  };

  const avgFocusScore = sessions.length > 0 
    ? Math.round(sessions.reduce((acc, s) => acc + (s.Focus_Level || 0), 0) / sessions.length)
    : 82;

  return (
    <AppLayout>
      <div className="flex flex-col h-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-light tracking-tight mb-2">Overview</h1>
            <p className="text-neutral-400 font-light text-sm">
              Welcome back, <span className="text-white font-medium">{user?.displayName || 'User'}</span>. Here is your focus analytics.
            </p>
          </div>
          
          <button 
            onClick={handleStartExtension}
            disabled={startingExtension}
            className="group flex items-center space-x-3 px-6 py-3 bg-white text-black rounded-lg font-medium tracking-wide hover:bg-neutral-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
          >
            {startingExtension ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
            ) : (
              <Play size={18} className="fill-black" />
            )}
            <span>{startingExtension ? 'Connecting...' : 'Start Extension'}</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Avg Focus Score', value: `${avgFocusScore}`, icon: Target, trend: '+4%', isUp: true },
            { label: 'Deep Work Time', value: '24h 12m', icon: Clock, trend: '+12%', isUp: true },
            { label: 'Sessions Completed', value: sessions.length > 0 ? `${sessions.length}` : '14', icon: CheckSquare, trend: '+2', skipTrendIcon: true },
            { label: 'Current Streak', value: '4 Days', icon: Zap, trend: '-1', isUp: false, skipTrendIcon: true },
          ].map((stat, i) => (
            <div key={i} className="p-6 rounded-xl border border-neutral-800 bg-[#0a0a0a] flex flex-col justify-between h-36">
              <div className="flex justify-between items-start text-neutral-400">
                <span className="text-sm tracking-wide">{stat.label}</span>
                <stat.icon size={18} strokeWidth={1.5} className="text-neutral-500" />
              </div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-light tracking-tight">{stat.value}</span>
                <span className={`text-xs flex items-center ${stat.trend.startsWith('+') ? 'text-emerald-400' : 'text-neutral-500'}`}>
                  {!stat.skipTrendIcon && (stat.isUp ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowUpRight size={14} className="mr-1 rotate-90" />)}
                  {stat.trend}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Main Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[300px]">
          
          <div className="lg:col-span-2 rounded-xl border border-neutral-800 bg-[#0a0a0a] p-6 flex flex-col">
            <h3 className="text-sm tracking-wide text-neutral-400 mb-6">Focus Trend line (Last 7 Days)</h3>
            <div className="flex-1 w-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockFocusData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fff" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#fff" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] p-6 flex flex-col">
            <h3 className="text-sm tracking-wide text-neutral-400 mb-6">Activity Duration (Hrs)</h3>
            <div className="flex-1 w-full min-h-[250px]">
               <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockFocusData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: '#1a1a1a' }}
                    contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="duration" fill="#444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>
    </AppLayout>
  );
}
