'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Session, Activity, FocusAnalysis } from '@/types/firestore';
import { Clock, CheckCircle2, XCircle, Layout, ArrowRight } from 'lucide-react';

// removed mockSessions for live data

export default function TasksPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionActivities, setSessionActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSessions() {
      if (!user) return;
      try {
        const q = query(collection(db, 'User', user.uid, 'Session'), orderBy('Start_Time', 'desc'));
        const snap = await getDocs(q);
        const dbSessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
        setSessions(dbSessions);
        if (dbSessions.length > 0 && !selectedSession) {
          setSelectedSession(dbSessions[0]);
        }
      } catch (error) {
        console.error("Error fetching tasks:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, [user]);

  useEffect(() => {
    async function fetchActivities() {
       if (!user || !selectedSession?.id) return;
       try {
         const actQuery = query(collection(db, 'User', user.uid, 'Activity'), orderBy('Start_Time', 'desc'));
         const snap = await getDocs(actQuery);
         // Filter natively as we don't know if Session_ID index is built
         const acts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)).filter(a => a.Session_ID === selectedSession.id);
         setSessionActivities(acts);
       } catch(e) {
         console.error(e);
       }
    }
    fetchActivities();
  }, [user, selectedSession]);

  return (
    <AppLayout>
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mb-8">
          <h1 className="text-3xl font-light tracking-tight mb-2">Tasks & Sessions</h1>
          <p className="text-neutral-400 font-light text-sm">
            Review your past focus sessions, deeply analyze your flow state, and see your application usage.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0 border border-neutral-800 rounded-xl overflow-hidden bg-[#0a0a0a]">
          
          {/* Left panel: Session List */}
          <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col">
            <div className="p-4 border-b border-neutral-800 bg-[#0e0e0e]">
              <h2 className="text-sm font-medium tracking-widest text-neutral-400 uppercase">History</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className={`w-full text-left p-4 rounded-lg transition-all duration-200 flex flex-col gap-2 ${
                    selectedSession?.id === session.id 
                      ? 'bg-white/5 border border-white/10' 
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-sm font-medium">Session {session.id?.slice(-4) || '0000'}</span>
                    {session.Status === 'Completed' ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <XCircle size={16} className="text-red-400" />
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>Score: {session.Focus_Level || session.FocusAnalysis?.Focus_Score || 0}%</span>
                    <span>
                      {(session.Start_Time as any)?.toDate 
                        ? (session.Start_Time as any).toDate().toLocaleDateString()
                        : 'Recent'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right panel: Session Details */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            {selectedSession ? (
              <div className="p-8 space-y-8">
                
                {/* Header Info */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-3 text-sm text-neutral-400">
                    <Clock size={16} />
                    <span>Duration: {(() => {
                      const st = (selectedSession.Start_Time as any)?.toDate?.();
                      const et = (selectedSession.End_Time as any)?.toDate?.();
                      if (st && et) {
                        return `${Math.round((et.getTime() - st.getTime()) / 60000)} minutes`;
                      }
                      return 'Active / Unknown';
                    })()}</span>
                    <span className="text-neutral-700">•</span>
                    <span>Status: <span className={selectedSession.Status === 'Completed' ? 'text-emerald-400' : 'text-red-400'}>{selectedSession.Status}</span></span>
                  </div>
                  <h2 className="text-4xl font-light tracking-tight">Focus Score: {selectedSession.Focus_Level || selectedSession.FocusAnalysis?.Focus_Score || 'N/A'}</h2>
                </div>

                {/* Analysis Section */}
                <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-xl space-y-4">
                  <h3 className="text-sm uppercase tracking-widest text-neutral-500 font-medium border-b border-neutral-800 pb-2">AI Analysis</h3>
                  <div>
                    <p className="text-white text-md mb-1">Pattern Detected</p>
                    <p className="text-neutral-400 font-light text-sm">
                      {selectedSession.FocusAnalysis?.Behavior_Pattern || 'No clear pattern detected.'}
                    </p>
                  </div>
                  <div>
                    <p className="text-white text-md mb-1">Recommendation</p>
                    <p className="text-neutral-400 font-light text-sm">
                      {selectedSession.FocusAnalysis?.Recommendation || 'Keep maintaining a steady routine.'}
                    </p>
                  </div>
                </div>

                {/* Application Usage / Activities */}
                <div className="space-y-4">
                  <h3 className="text-sm uppercase tracking-widest text-neutral-500 font-medium">Application Context</h3>
                  <div className="grid gap-3">
                    {sessionActivities.length > 0 ? (
                      sessionActivities.map((act) => (
                        <div key={act.id} className="flex items-center justify-between p-4 bg-neutral-900/40 border border-neutral-800 rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className={`p-2 rounded-md ${act.Activity_Type === 'Productive' ? 'bg-emerald-500/10 text-emerald-400' : act.Activity_Type === 'Distracting' ? 'bg-red-500/10 text-red-400' : 'bg-neutral-500/10 text-neutral-400'}`}>
                              <Layout size={18} />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-white">{act.App_Name}</p>
                              <p className="text-xs text-neutral-500">{act.Activity_Type}</p>
                            </div>
                          </div>
                          <span className="text-sm text-neutral-400">
                            {(() => {
                               const ast = (act.Start_Time as any)?.toDate?.();
                               const aet = (act.End_Time as any)?.toDate?.();
                               if (ast && aet) return `${Math.round((aet.getTime() - ast.getTime()) / 60000)}m`;
                               return '< 1m';
                            })()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-neutral-500 italic">No specific app activity recorded for this session.</p>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-neutral-500 p-8 text-center">
                Select a session from the history to view detailed analytics and performance context.
              </div>
            )}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
