'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Session, Activity } from '@/types/firestore';
import { Clock, CheckCircle2, XCircle, Layout, Brain, Sparkles, ShieldCheck, Zap, Trash2 } from 'lucide-react';

export default function TasksPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionActivities, setSessionActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleCompleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !confirm('Mark this session as completed?')) return;

    try {
      const sessionRef = doc(db, 'User', user.uid, 'Session', sessionId);
      await updateDoc(sessionRef, {
        Status: 'Completed',
        End_Time: serverTimestamp(),
        Updated_At: serverTimestamp()
      });

      // TRIGGER SELF-HEALING ANALYSIS IMMEDIATELY
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities: sessionActivities })
      });
      
      if (response.ok) {
        const analysis = await response.json();
        await updateDoc(sessionRef, {
          Focus_Level: analysis.Focus_Score,
          FocusAnalysis: analysis
        });
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, Status: 'Completed', FocusAnalysis: analysis, Focus_Level: analysis.Focus_Score } : s));
      }
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  // 1. Realtime Listeners & Auto-Heal Coordinator
  useEffect(() => {
    if (!user) return;
    
    // a. Listen for Sessions (Sidebar List)
    const sessionsQ = query(collection(db, 'User', user.uid, 'Session'), orderBy('Start_Time', 'desc'));
    const unsubscribeSessions = onSnapshot(sessionsQ, (snap) => {
      const dbSessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
      setSessions(dbSessions);
      
      // Update selected anchor if needed
      if (selectedSession?.id) {
        const current = dbSessions.find(s => s.id === selectedSession.id);
        if (current) setSelectedSession(current);
      } else if (dbSessions.length > 0 && !selectedSession) {
        setSelectedSession(dbSessions[0]);
      }
      setLoading(false);
    });

    // b. Listen for Activities (Selected Session Detail)
    let unsubscribeActivities = () => {};
    if (selectedSession?.id) {
      const actQuery = query(
        collection(db, 'User', user.uid, 'Session', selectedSession.id, 'Activity'), 
        orderBy('Start_Time', 'desc')
      );
      unsubscribeActivities = onSnapshot(actQuery, (snap) => {
        const acts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
        setSessionActivities(acts);
      });

      // c. Side-Effect: Auto-Heal Analysis for Completed Sessions
      if (selectedSession.Status === 'Completed' && !selectedSession.FocusAnalysis && sessionActivities.length > 0) {
        setIsAnalyzing(true);
        const heal = async () => {
          try {
            const response = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ activities: sessionActivities })
            });
            if (response.ok) {
              const analysis = await response.json();
              await updateDoc(doc(db, 'User', user.uid, 'Session', selectedSession.id!), {
                Focus_Level: analysis.Focus_Score,
                FocusAnalysis: analysis
              });
            }
          } catch (e) {
            console.error("Auto-heal failed:", e);
          } finally {
            setIsAnalyzing(false);
          }
        };
        heal();
      }
    }

    return () => {
      unsubscribeSessions();
      unsubscribeActivities();
    };
  }, [user, selectedSession?.id, sessionActivities.length]);

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !confirm('Are you sure you want to delete this session?')) return;

    try {
      await deleteDoc(doc(db, 'User', user.uid, 'Session', sessionId));
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (selectedSession?.id === sessionId) setSelectedSession(null);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  if (!isMounted) return <AppLayout><div className="h-full bg-black" /></AppLayout>;

  return (
    <AppLayout>
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mb-8">
          <h1 className="text-3xl font-light tracking-tight mb-2">Tasks & Sessions</h1>
          <p className="text-neutral-400 font-light text-sm">Review your past focus sessions, deeply analyze your flow state, and see your application usage.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
          {/* Timeline Sidebar */}
          <div className="lg:col-span-1 border border-neutral-800 rounded-2xl bg-[#0a0a0a] overflow-y-auto max-h-[70vh]">
            <div className="p-4 border-b border-neutral-800">
              <h3 className="text-xs uppercase tracking-widest text-neutral-500 font-medium">History</h3>
            </div>
            <div className="flex flex-col">
              {loading ? (
                <div className="p-8 text-center text-neutral-500 text-sm">Loading sessions...</div>
              ) : sessions.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 text-sm italic">No focus history found. <br/> Start your first session to begin tracking.</div>
              ) : (
                sessions.map((session, index) => (
                <div
                  key={session.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedSession(session)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedSession(session); } }}
                  className={`group flex flex-col items-start p-5 border-l-2 transition-all hover:bg-neutral-900/50 cursor-pointer ${
                    selectedSession?.id === session.id 
                      ? 'border-white bg-neutral-900/80' 
                      : 'border-transparent text-neutral-400'
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-1">
                    <span className="text-sm font-medium text-white truncate max-w-[160px]" title={session.Task || `Session ${sessions.length - index}`}>
                      {session.Task || `Session ${sessions.length - index}`}
                    </span>
                    <div className="flex items-center gap-2">
                      {session.Status === 'Completed' ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : session.Status === 'Active' ? (
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      ) : (
                        <XCircle size={16} className="text-red-400/50" />
                      )}
                      <button 
                        onClick={(e) => session.id && handleCompleteSession(session.id, e)}
                        className={`p-1.5 hover:bg-emerald-500/10 rounded-md transition-all text-neutral-500 hover:text-emerald-400 active:scale-95 ${session.Status !== 'Active' && 'hidden'}`}
                        title="Force Complete Session"
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <button 
                        onClick={(e) => session.id && handleDeleteSession(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded-md transition-all text-neutral-500 hover:text-red-400 active:scale-95"
                        title="Delete Session"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-neutral-500 w-full text-left uppercase tracking-wider font-medium">
                    <span>Score: {session.FocusAnalysis?.Focus_Score || session.Focus_Level || 0}%</span>
                    <span>
                      {(session.Start_Time as any)?.toDate 
                        ? (session.Start_Time as any).toDate().toLocaleDateString()
                        : 'Recent'}
                    </span>
                  </div>
                </div>
              ))
              )}
            </div>
          </div>

          {/* Detailed View */}
          <div className="lg:col-span-2 space-y-6 overflow-y-auto max-h-[70vh] pr-2">
            {!selectedSession ? (
              <div className="h-full flex items-center justify-center border border-neutral-800 border-dashed rounded-2xl bg-neutral-900/20 text-neutral-500">
                <p>Select a session to view detailed intelligence</p>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
                
                {/* Header Info */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    {selectedSession.Task && (
                      <h2 className="text-2xl font-medium tracking-tight text-white">
                        {selectedSession.Task}
                      </h2>
                    )}
                    {selectedSession.id && (
                      <span className="inline-block text-[10px] font-mono text-neutral-600 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded">
                        ID: {selectedSession.id}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 text-sm text-neutral-400">
                    <Clock size={16} className="text-neutral-500" />
                    <span>Duration: {(() => {
                      const st = (selectedSession.Start_Time as any)?.toDate?.();
                      const et = (selectedSession.End_Time as any)?.toDate?.();
                      if (st && et) {
                        return `${Math.round((et.getTime() - st.getTime()) / 60000)} minutes`;
                      }
                      return selectedSession.Status === 'Active' ? 'Ongoing...' : 'Unknown';
                    })()}</span>
                    <span className="text-neutral-700">&bull;</span>
                    <span className="flex items-center gap-1.5">
                      Status: 
                      <span className={`capitalize ${
                        selectedSession.Status === 'Completed' ? 'text-emerald-400' : 
                        selectedSession.Status === 'Active' ? 'text-emerald-500 animate-pulse' : 'text-red-400'
                      }`}>
                        {selectedSession.Status || 'In Progress'}
                      </span>
                    </span>
                  </div>
                  <h2 className="text-5xl font-light tracking-tight flex items-baseline gap-3">
                    <span className="text-neutral-500 text-2xl font-light">Focus Score:</span>
                    <span className={getScoreColor(selectedSession.FocusAnalysis?.Focus_Score || selectedSession.Focus_Level || 0)}>
                      {selectedSession.FocusAnalysis?.Focus_Score || selectedSession.Focus_Level || '0'}
                    </span>
                  </h2>
                </div>

                {/* AI Analysis Section */}
                <div className="group relative overflow-hidden bg-[#0d0d0d] border border-neutral-800 p-8 rounded-2xl space-y-8 transition-all hover:border-neutral-700">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                     <Brain size={120} />
                  </div>
                  
                  <div className="flex items-center gap-3 text-emerald-400/80">
                    <Sparkles size={20} />
                    <h3 className="text-xs uppercase tracking-[0.2em] font-medium">Session Intelligence Report</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-white">
                        <Brain size={18} className="text-neutral-500" />
                        <p className="text-sm font-medium">Behavioral Pattern</p>
                      </div>
                      {isAnalyzing || (selectedSession.Status === 'Completed' && !selectedSession.FocusAnalysis) ? (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-4 bg-neutral-800 rounded w-full"></div>
                          <div className="h-4 bg-neutral-800 rounded w-5/6"></div>
                          <p className="text-[10px] text-neutral-600 uppercase tracking-widest mt-2">Analyzing Life Patterns...</p>
                        </div>
                      ) : (
                        <p className="text-neutral-400 font-light text-sm leading-relaxed min-h-[4rem]">
                          {selectedSession.FocusAnalysis?.Behavior_Pattern || 
                            (selectedSession.Status === 'Active' ? 'Computing live patterns from activity stream...' : 'Awaiting final data synchronization.')}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-white">
                        <ShieldCheck size={18} className="text-emerald-500/70" />
                        <p className="text-sm font-medium">Insights</p>
                      </div>
                      {isAnalyzing || (selectedSession.Status === 'Completed' && !selectedSession.FocusAnalysis) ? (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-4 bg-neutral-800 rounded w-full"></div>
                          <div className="h-4 bg-neutral-800 rounded w-4/6"></div>
                          <p className="text-[10px] text-neutral-600 uppercase tracking-widest mt-2">Scanning Cognition...</p>
                        </div>
                      ) : (
                        <p className="text-neutral-400 font-light text-sm leading-relaxed min-h-[4rem]">
                          {selectedSession.FocusAnalysis?.Recommendation || 
                           (selectedSession.Status === 'Active' 
                             ? 'Context established. Strategic advice will appear once you click "Complete Session".' 
                             : 'Finalizing behavioral intelligence...')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Application Usage / Activities */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-widest text-neutral-500 font-medium">Application Context</h3>
                    <span className="text-[10px] text-neutral-600 px-2 py-0.5 rounded border border-neutral-800 uppercase">Live Sync</span>
                  </div>
                  
                  <div className="grid gap-3">
                    {sessionActivities.length > 0 ? (
                      sessionActivities.map((act) => (
                        <div key={act.id} className="group flex items-center justify-between p-4 bg-neutral-900/30 border border-neutral-800/60 rounded-xl hover:bg-neutral-900/60 transition-all hover:border-neutral-700">
                          <div className="flex items-center space-x-4">
                            <div className={`p-2.5 rounded-lg border ${
                              act.Activity_Type === 'Productive' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' : 
                              act.Activity_Type === 'Distracting' ? 'bg-red-500/5 text-red-400 border-red-500/10' : 
                              'bg-neutral-500/5 text-neutral-400 border-neutral-800'
                            }`}>
                              <Layout size={18} />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-white group-hover:text-emerald-50 relative">
                                {act.App_Name}
                                {act.Activity_Type === 'Productive' && <Zap size={10} className="inline ml-1.5 text-emerald-500/60 fill-emerald-500/20" />}
                              </p>
                              <p className="text-[10px] uppercase tracking-wider text-neutral-600 group-hover:text-neutral-500 transition-colors uppercase">{act.Activity_Type}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-mono text-neutral-400">
                              {(() => {
                                 const ast = (act.Start_Time as any)?.toDate?.();
                                 const aet = (act.End_Time as any)?.toDate?.();
                                 if (ast && aet) return `${Math.round((aet.getTime() - ast.getTime()) / 60000)}m`;
                                 return selectedSession.Status === 'Active' ? 'Active' : '< 1m';
                              })()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center border border-neutral-800 border-dashed rounded-xl bg-neutral-900/10">
                        <p className="text-sm text-neutral-500 italic">
                          {selectedSession.Status === 'Active' ? 'Monitoring real-time activity context...' : 'No specific app activity recorded for this block.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
