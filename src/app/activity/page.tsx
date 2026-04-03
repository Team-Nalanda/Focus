'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/components/AuthProvider';
import { db, rtdb } from '@/lib/firebase';
import { ref, onValue, set, push, update } from 'firebase/database';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
	Monitor,
	Clock,
	Activity,
	Zap,
	ShieldAlert,
	Loader2,
	Sparkles,
	History,
	ArrowRight,
	Play,
} from 'lucide-react';

export default function ActivityPage() {
	const { user } = useAuth();
	const router = useRouter();
	const [isLiveSessionActive, setIsLiveSessionActive] = useState(false);
	const [currentApp, setCurrentApp] = useState<any>(null);
	const [liveActivity, setLiveActivity] = useState<any[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [liveTip, setLiveTip] = useState<string | null>(null);
	const [elapsedTime, setElapsedTime] = useState('00:00:00');
	const [remainingTime, setRemainingTime] = useState<string | null>(null);
	const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
	const [sessionEndTime, setSessionEndTime] = useState<number | null>(null);

	// 1. RTDB Synchronization
	useEffect(() => {
		if (!user) return;

		const sessionRef = ref(rtdb, `users/${user.uid}/liveSession`);
		const unsubscribe = onValue(sessionRef, (snapshot) => {
			const data = snapshot.val();
			if (data) {
				setIsLiveSessionActive(data.active || false);
				setCurrentApp(data.currentApp || null);
				setActiveSessionId(data.firestoreSessionId || null);
				
				// Sync Session Timestamps
				setSessionStartTime(data.startTime || null);
				setSessionEndTime(data.endTime || null);

				if (data.activities) {
					// Convert activities object to array and sort by newest first
					const acts = Object.entries(data.activities).map(([key, val]: [string, any]) => ({
						id: key,
						...val
					})).sort((a, b) => b.timestamp - a.timestamp);
					setLiveActivity(acts);
				} else {
					setLiveActivity([]);
				}
			} else {
				resetState();
			}
		});

		return () => unsubscribe();
	}, [user]);

	const resetState = () => {
		setIsLiveSessionActive(false);
		setCurrentApp(null);
		setActiveSessionId(null);
		setLiveActivity([]);
		setElapsedTime('00:00:00');
		setRemainingTime(null);
		setSessionStartTime(null);
		setSessionEndTime(null);
	};

	// 2. Timer Logic
	useEffect(() => {
		let interval: NodeJS.Timeout;
		if (isLiveSessionActive) {
			interval = setInterval(() => {
				const now = Date.now();
				
				// ── 1. Update Elapsed Time (from session start) ──
				if (sessionStartTime) {
					const diff = now - sessionStartTime;
					const h = Math.floor(diff / 3600000);
					const m = Math.floor((diff % 3600000) / 60000);
					const s = Math.floor((diff % 60000) / 1000);
					setElapsedTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
				}

				// ── 2. Update Remaining Time (Countdown) ──
				if (sessionEndTime) {
					const diff = sessionEndTime - now;
					if (diff <= 0) {
						setRemainingTime('00:00');
					} else {
						const m = Math.floor(diff / 60000);
						const s = Math.floor((diff % 60000) / 1000);
						setRemainingTime(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
					}
				} else {
					setRemainingTime(null);
				}
			}, 1000);
		}
		return () => clearInterval(interval);
	}, [isLiveSessionActive, sessionStartTime, sessionEndTime]);

	// 3. AI Tips Logic
	useEffect(() => {
		if (isLiveSessionActive && liveActivity.length > 0 && liveActivity.length % 5 === 0) {
			async function fetchTip() {
				try {
					const response = await fetch('/api/analyze', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ activities: liveActivity, type: 'tip' })
					});
					const data = await response.json();
					if (data.tip) {
						setLiveTip(data.tip);
						setTimeout(() => setLiveTip(null), 15000);
					}
				} catch (e) {
					console.error("Live tip error:", e);
				}
			}
			fetchTip();
		}
	}, [liveActivity.length, isLiveSessionActive]);

	// 4. Session Controls
	const stopLiveSession = async () => {
		if (!user || !activeSessionId) return;
		setIsAnalyzing(true);

		try {
			const sessionDocRef = doc(db, 'User', user.uid, 'Session', activeSessionId);
			
			// 1. Finalize Firestore Status IMMEDIATELY and Atomicly
			// We do this first so the session is never 'stuck' as Active
			await updateDoc(sessionDocRef, {
				Status: 'Completed',
				End_Time: serverTimestamp(),
				Updated_At: serverTimestamp(),
			});

			// 2. Clear RTDB Live State (Dashboard/Extension Sync)
			const liveRef = ref(rtdb, `users/${user.uid}/liveSession`);
			await set(liveRef, { 
				active: false,
				currentApp: null,
				activities: null,
				firestoreSessionId: null
			});

			// 3. Notify Extension to Stop
			const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || 'kkfojgfjhkhcgpodfdeldhnnnbabegee';
			if (typeof window !== 'undefined' && (window as any).chrome?.runtime) {
				try {
					(window as any).chrome.runtime.sendMessage(EXTENSION_ID, {
						action: 'SESSION_STOP',
						active: false
					});
				} catch (e) {
					console.warn('Extension stop sync failed (optional):', e);
				}
			}

			// 4. Analyze using AI (Critical Path - WE WAIT FOR THIS NOW)
			// This ensures the report is READY when the user lands on the Tasks page
			try {
				const response = await fetch('/api/analyze', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ activities: liveActivity })
				});
				
				if (response.ok) {
					const analysis = await response.json();
					await updateDoc(sessionDocRef, {
						Focus_Level: analysis.Focus_Score,
						FocusAnalysis: analysis
					});
				}
			} catch (aiError) {
				console.error("AI Analysis Error:", aiError);
				// Silent fallback to avoid blocking the user
			}

			// 5. Success UI Lifecycle
			setIsLiveSessionActive(false);
			setLiveActivity([]);
			setIsAnalyzing(false);
			
			// 6. Navigate to Tasks page to see the report
			router.push('/tasks');
			
		} catch (e) {
			console.error("Stop session error:", e);
			setIsAnalyzing(false);
			alert("Failed to complete session. Please check your connection.");
		}
	};

	const simulateLiveActivity = async () => {
		if (!user || !isLiveSessionActive) return;
		const apps = ['VS Code', 'Chrome', 'Slack', 'Figma', 'Spotify', 'Terminal'];
		const randomApp = apps[Math.floor(Math.random() * apps.length)];
		
		const sessionRef = ref(rtdb, `users/${user.uid}/liveSession`);
		
		// Update only the current app while preserving the session ID
		await update(sessionRef, {
			currentApp: { name: randomApp, startTime: currentApp?.startTime || Date.now() },
		});

		const activityHistoryRef = ref(rtdb, `users/${user.uid}/liveSession/activities`);
		const newActivityRef = push(activityHistoryRef);
		await set(newActivityRef, { name: randomApp, timestamp: Date.now() });
	};

	return (
		<AppLayout>
			<div className="flex flex-col h-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
				{/* Page Header */}
				<div>
					<h1 className="text-3xl font-light tracking-tight mb-2">Live Activity</h1>
					<p className="text-neutral-400 font-light text-sm">
						Monitor your current session in real-time. Data updates as you switch between apps.
					</p>
				</div>

				{!isLiveSessionActive ? (
					<div className="flex-1 flex flex-col items-center justify-center border border-dashed border-neutral-800 rounded-3xl bg-neutral-900/10 p-12 text-center">
						<div className="w-16 h-16 bg-neutral-800/50 rounded-2xl flex items-center justify-center mb-6">
							<ShieldAlert size={32} className="text-neutral-500" />
						</div>
						<h2 className="text-xl font-medium text-white mb-2">No Active Session</h2>
						<p className="text-neutral-400 max-w-sm mb-8 font-light">
							Start a session from the Dashboard or your browser extension to begin real-time monitoring.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
						{/* Left Column: Current Status */}
						<div className="lg:col-span-2 space-y-8">
							<div className="bg-[#0a0a0a] border border-emerald-500/20 rounded-3xl p-8 relative overflow-hidden group">
								<div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
									<Zap size={150} className="text-emerald-500" />
								</div>
								
								<div className="relative z-10 space-y-6">
									<div className="flex items-center gap-3 text-emerald-400 text-sm font-medium uppercase tracking-widest">
										<span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
										Currently Tracking
									</div>
									
									<div className="flex flex-col md:flex-row md:items-end gap-6 justify-between">
										<div className="space-y-2">
											<h2 className="text-5xl font-light text-white mb-2 tracking-tight">
												{currentApp?.name || 'Awaiting Activity...'}
											</h2>
											<div className="flex flex-wrap gap-4 text-neutral-400">
												<p className="flex items-center gap-2 text-sm bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
													<Clock size={14} className="text-neutral-500" />
													Elapsed: <span className="text-white font-mono">{elapsedTime}</span>
												</p>
												{remainingTime && (
													<p className="flex items-center gap-2 text-sm bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-emerald-400">
														<Zap size={14} className="fill-emerald-400" />
														Remaining: <span className="font-mono font-bold">{remainingTime}</span>
													</p>
												)}
											</div>
										</div>

										<div className="flex gap-3">
											<button
												onClick={simulateLiveActivity}
												className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-medium transition-all"
											>
												Simulate Switch
											</button>
											<button
												onClick={stopLiveSession}
												disabled={isAnalyzing}
												className="px-6 py-2 bg-white text-black hover:bg-neutral-200 rounded-xl text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50"
											>
												{isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="fill-black" />}
												Complete Session
											</button>
										</div>
									</div>
								</div>
							</div>

							{/* AI Coaching Tips */}
							{liveTip && (
								<div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 animate-in slide-in-from-top-4 duration-500">
									<div className="flex items-start gap-4">
										<div className="p-2 bg-emerald-500/20 rounded-lg">
											<Sparkles size={20} className="text-emerald-400" />
										</div>
										<div>
											<h3 className="text-sm font-medium text-emerald-300 mb-1">Live Coaching Tip</h3>
											<p className="text-emerald-100/70 text-sm italic font-light leading-relaxed italic">"{liveTip}"</p>
										</div>
									</div>
								</div>
							)}

							{/* Activity Timeline */}
							<div className="bg-[#0a0a0a] border border-neutral-800 rounded-3xl flex flex-col overflow-hidden">
								<div className="p-6 border-b border-neutral-800 flex items-center justify-between">
									<h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 flex items-center gap-2">
										<History size={14} /> Full Session Log
									</h3>
									<span className="text-[10px] text-neutral-600 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 uppercase">
										{liveActivity.length} Events
									</span>
								</div>
								
								<div className="p-2 max-h-[400px] overflow-y-auto">
									{liveActivity.length === 0 ? (
										<div className="p-12 text-center text-neutral-600 text-sm italic">
											No activity history yet. Start switching apps!
										</div>
									) : (
										<div className="space-y-1">
											{liveActivity.map((act, i) => (
												<div key={act.id} className="flex items-center gap-4 p-4 hover:bg-neutral-900/50 rounded-2xl transition-all group">
													<div className="text-xs font-mono text-neutral-600 w-16">
														{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
													</div>
													<div className="w-px h-8 bg-neutral-800 group-hover:bg-emerald-500/50 transition-colors"></div>
													<div className="flex-1 flex items-center justify-between">
														<span className="text-sm text-neutral-300 font-light group-hover:text-white transition-colors">
															Switched to <span className="font-medium text-white">{act.name}</span>
														</span>
														{i === 0 && <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Current</span>}
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Right Column: Insights & Stats */}
						<div className="space-y-6">
							<div className="bg-[#0a0a0a] border border-neutral-800 rounded-3xl p-6">
								<h3 className="text-sm font-medium text-white mb-6 flex items-center gap-2">
									<Activity size={16} className="text-neutral-500" /> Focus Health
								</h3>
								
								<div className="space-y-6">
									<div className="flex justify-between items-end">
										<span className="text-sm text-neutral-400">Switches</span>
										<span className="text-2xl font-light">{liveActivity.length}</span>
									</div>
									<div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
										<div 
											className="h-full bg-emerald-500 transition-all duration-1000" 
											style={{ width: `${Math.min(100, liveActivity.length * 5)}%` }}
										></div>
									</div>
									<p className="text-[10px] text-neutral-500 uppercase tracking-widest leading-relaxed">
										Lower switch counts usually correlate with deeper work. Keep it steady.
									</p>
								</div>
							</div>

							<div className="bg-neutral-900/20 border border-neutral-800 rounded-3xl p-6 border-dashed">
								<div className="flex items-center gap-3 text-neutral-500 mb-4">
									<Monitor size={16} />
									<span className="text-xs font-medium uppercase tracking-widest">Extension Status</span>
								</div>
								<div className="flex items-center gap-2">
									<div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
									<span className="text-sm text-neutral-300">Connected & Syncing</span>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</AppLayout>
	);
}
