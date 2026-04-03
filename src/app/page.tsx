'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import {
	collection,
	getDocs,
	query,
	orderBy,
	limit,
	doc,
	setDoc,
	addDoc,
	updateDoc,
	serverTimestamp,
} from 'firebase/firestore';
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
	CartesianGrid,
} from 'recharts';
import {
	ArrowUpRight,
	Zap,
	Target,
	Clock,
	Activity,
	Play,
	CheckSquare,
	Monitor,
	Loader2,
	Sparkles,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { rtdb } from '@/lib/firebase';
import {
	ref,
	onValue,
	set,
	push,
	serverTimestamp as rtdbTimestamp,
} from 'firebase/database';

export default function Dashboard() {
	const { user } = useAuth();
	const [sessions, setSessions] = useState<Session[]>([]);
	const [loadingDb, setLoadingDb] = useState(true);
	const [startingExtension, setStartingExtension] = useState(false);
	const [chartData, setChartData] = useState<any[]>([]);
	const [isSessionLive, setIsSessionLive] = useState(false);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

	useEffect(() => {
		async function fetchData() {
			if (!user) return;
			
			// 1. RTDB Monitor for Live Session State
			const liveRef = ref(rtdb, `users/${user.uid}/liveSession`);
			const unsubscribeRtdb = onValue(liveRef, (snapshot) => {
				const data = snapshot.val();
				setIsSessionLive(!!data?.active);
				setActiveSessionId(data?.firestoreSessionId || null);
			});

			try {
				const q = query(
					collection(db, 'User', user.uid, 'Session'),
					orderBy('Start_Time', 'desc'),
				);
				const snap = await getDocs(q);
				const data = snap.docs.map(
					(doc) => ({ id: doc.id, ...doc.data() }) as Session,
				);
				setSessions(data);

				// Process data for charts (last 7 days)
				const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
				const tempChartData = [];
				for (let i = 6; i >= 0; i--) {
					const targetDate = new Date();
					targetDate.setDate(targetDate.getDate() - i);
					targetDate.setHours(0, 0, 0, 0);

					const daySessions = data.filter((s) => {
						const t = s.Start_Time as any; // FirestoreDate could be Timestamp
						const date = t?.toDate ? t.toDate() : new Date();
						return (
							date.getDate() === targetDate.getDate() &&
							date.getMonth() === targetDate.getMonth() &&
							date.getFullYear() === targetDate.getFullYear()
						);
					});

					let dayScore = 0;
					let dayDuration = 0;
					
					// Only use completed sessions for the focus score to avoid inflating with placeholders
					const completedDaySessions = daySessions.filter(s => s.Status === 'Completed');
					
					if (completedDaySessions.length > 0) {
						dayScore = Math.round(
							completedDaySessions.reduce(
								(acc, s) => acc + (s.FocusAnalysis?.Focus_Score || s.Focus_Level || 0),
								0,
							) / completedDaySessions.length,
						);
					}

					// Duration can still include active sessions (optional, but consistent with 'Deep Work Time')
					if (daySessions.length > 0) {
						dayDuration = daySessions.reduce((acc, s) => {
							const st = (s.Start_Time as any)?.toDate?.() || new Date();
							const et = (s.End_Time as any)?.toDate?.() || null;
							if (et) {
								return acc + (et.getTime() - st.getTime()) / (1000 * 60 * 60);
							}
							return acc; // Don't count ongoing session duration in history charts
						}, 0);
					}

					tempChartData.push({
						day: days[targetDate.getDay()],
						score: dayScore,
						duration: parseFloat(dayDuration.toFixed(1)),
					});
				}
				setChartData(tempChartData);
			} catch (error) {
				console.error('Error fetching sessions:', error);
			} finally {
				setLoadingDb(false);
			}

			return () => unsubscribeRtdb();
		}
		fetchData();
	}, [user]);

	const handleStartExtension = async () => {
		setStartingExtension(true);
		if (!user) return;

		try {
			// 1. Create a real Firestore Session document
			const sessionRef = await addDoc(
				collection(db, 'User', user.uid, 'Session'),
				{
					Status: 'Active',
					Focus_Level: 0,
					Start_Time: serverTimestamp(),
					Created_At: serverTimestamp(),
					Updated_At: serverTimestamp(),
					BreakSuggestion: [],
				},
			);

			// 2. Initialize RTDB for realtime extension tracking
			const rtdbSessionRef = ref(rtdb, `users/${user.uid}/liveSession`);
			await set(rtdbSessionRef, {
				active: true,
				firestoreSessionId: sessionRef.id,
				currentApp: { name: 'Focus Starting...', startTime: Date.now() },
				activities: {},
			});

			// 3. Sync Session ID to extension directly
			const EXTENSION_ID = 'kkfojgfjhkhcgpodfdeldhnnnbabegee';
			if (typeof window !== 'undefined' && (window as any).chrome?.runtime) {
				try {
					(window as any).chrome.runtime.sendMessage(EXTENSION_ID, {
						action: 'SESSION_SYNC',
						sessionId: sessionRef.id,
						active: true
					});
				} catch (e) {
					console.warn('Extension sync failed (optional):', e);
				}
			}

			setStartingExtension(false);
		} catch (e) {
			console.error('Start session error:', e);
			setStartingExtension(false);
		}
	};

	const handleStopSession = async () => {
		if (!user || !activeSessionId) return;
		setStartingExtension(true); // Loading state

		try {
			// 1. Fetch activities for the current session to analyze
			const activitiesSnapshot = await getDocs(
				collection(db, 'User', user.uid, 'Session', activeSessionId, 'Activity')
			);
			const activities = activitiesSnapshot.docs.map(doc => doc.data());

			// 2. Analyze using DeepSeek via API
			let analysis = { Focus_Score: 70, Behavior_Pattern: "Good job.", Recommendation: "Keep it up." };
			if (activities.length > 0) {
				const response = await fetch('/api/analyze', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ activities })
				});
				if (response.ok) analysis = await response.json();
			}

			// 3. Update Firestore Session with results
			const sessionRef = doc(db, 'User', user.uid, 'Session', activeSessionId);
			await updateDoc(sessionRef, {
				Status: 'Completed',
				End_Time: serverTimestamp(),
				Updated_At: serverTimestamp(),
				Focus_Level: analysis.Focus_Score,
				FocusAnalysis: analysis
			});

			// 4. Clear RTDB Live State
			const liveRef = ref(rtdb, `users/${user.uid}/liveSession`);
			await set(liveRef, { active: false });

			// 5. Notify extension to stop tracking
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

			setStartingExtension(false);
			// Refresh local session list if needed or let data effect handle it
		} catch (e) {
			console.error("Stop session error:", e);
			setStartingExtension(false);
		}
	};


	const completedSessions = sessions.filter((s) => s.Status === 'Completed');

	const totalDeepWorkHours = completedSessions.reduce((acc, s) => {
		const st = (s.Start_Time as any)?.toDate?.() || new Date();
		const et = (s.End_Time as any)?.toDate?.() || null;
		return acc + (et ? (et.getTime() - st.getTime()) / (1000 * 60 * 60) : 0);
	}, 0);

	const deepWorkDisplay = `${Math.floor(totalDeepWorkHours)}h ${Math.round((totalDeepWorkHours % 1) * 60)}m`;

	const avgFocusScore =
		completedSessions.length > 0
			? Math.round(
					completedSessions.reduce(
						(acc, s) => acc + (s.FocusAnalysis?.Focus_Score || s.Focus_Level || 0),
						0,
					) / completedSessions.length,
			  )
			: 0;


	return (
		<AppLayout>
			<div className="flex flex-col h-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
				{/* Header Section */}
				<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
					<div>
						<h1 className="text-3xl font-light tracking-tight mb-2">
							Overview
						</h1>
						<p className="text-neutral-400 font-light text-sm">
							Welcome back,{' '}
							<span className="text-white font-medium">
								{user?.displayName || 'User'}
							</span>
							. Here is your focus analytics.
						</p>
					</div>

					<div className="flex items-center gap-3">
						{isSessionLive ? (
							<button
								onClick={handleStopSession}
								disabled={startingExtension}
								className="group flex items-center space-x-3 px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg font-medium tracking-wide hover:bg-red-500/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 shadow-[0_0_20px_-10px_rgba(239,68,68,0.5)]"
							>
								{startingExtension ? (
									<div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
								) : (
									<div className="w-2.5 h-2.5 bg-red-500 rounded-sm animate-pulse mr-1"></div>
								)}
								<span>
									{startingExtension ? 'Finalizing Analysis...' : 'Stop Focus Session'}
								</span>
							</button>
						) : (
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
								<span>
									{startingExtension ? 'Connecting...' : 'Start Extension'}
								</span>
							</button>
						)}
					</div>
				</div>

				{/* Stats Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{[
						{
							label: 'Avg Focus Score',
							value: isNaN(avgFocusScore) ? '-' : `${avgFocusScore}`,
							icon: Target,
							trend: '',
							isUp: true,
							skipTrendIcon: true,
						},
						{
							label: 'Deep Work Time',
							value: deepWorkDisplay,
							icon: Clock,
							trend: '',
							isUp: true,
							skipTrendIcon: true,
						},
						{
							label: 'Sessions Completed',
							value: `${completedSessions.length}`,
							icon: CheckSquare,
							trend: '',
							skipTrendIcon: true,
						},
						{
							label: 'Total Sessions',
							value: `${sessions.length}`,
							icon: Zap,
							trend: '',
							isUp: false,
							skipTrendIcon: true,
						},
					].map((stat, i) => (
						<div
							key={i}
							className="p-6 rounded-xl border border-neutral-800 bg-[#0a0a0a] flex flex-col justify-between h-36"
						>
							<div className="flex justify-between items-start text-neutral-400">
								<span className="text-sm tracking-wide">{stat.label}</span>
								<stat.icon
									size={18}
									strokeWidth={1.5}
									className="text-neutral-500"
								/>
							</div>
							<div className="flex items-end justify-between">
								<span className="text-3xl font-light tracking-tight">
									{stat.value}
								</span>
								<span
									className={`text-xs flex items-center ${stat.trend.startsWith('+') ? 'text-emerald-400' : 'text-neutral-500'}`}
								>
									{!stat.skipTrendIcon &&
										(stat.isUp ? (
											<ArrowUpRight size={14} className="mr-1" />
										) : (
											<ArrowUpRight size={14} className="mr-1 rotate-90" />
										))}
									{stat.trend}
								</span>
							</div>
						</div>
					))}
				</div>

				{/* Main Charts */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[300px]">
					<div className="lg:col-span-2 rounded-xl border border-neutral-800 bg-[#0a0a0a] p-6 flex flex-col">
						<h3 className="text-sm tracking-wide text-neutral-400 mb-6">
							Focus Trend line (Last 7 Days)
						</h3>
						<div className="flex-1 w-full min-h-[250px]">
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart
									data={chartData}
									margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
								>
									<defs>
										<linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
											<stop offset="5%" stopColor="#fff" stopOpacity={0.15} />
											<stop offset="95%" stopColor="#fff" stopOpacity={0} />
										</linearGradient>
									</defs>
									<CartesianGrid
										strokeDasharray="3 3"
										vertical={false}
										stroke="#222"
									/>
									<XAxis
										dataKey="day"
										axisLine={false}
										tickLine={false}
										tick={{ fill: '#666', fontSize: 12 }}
										dy={10}
									/>
									<YAxis
										axisLine={false}
										tickLine={false}
										tick={{ fill: '#666', fontSize: 12 }}
									/>
									<Tooltip
										contentStyle={{
											backgroundColor: '#111',
											borderColor: '#333',
											borderRadius: '8px',
										}}
										itemStyle={{ color: '#fff' }}
									/>
									<Area
										type="monotone"
										dataKey="score"
										stroke="#fff"
										strokeWidth={2}
										fillOpacity={1}
										fill="url(#colorScore)"
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
					</div>

					<div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] p-6 flex flex-col">
						<h3 className="text-sm tracking-wide text-neutral-400 mb-6">
							Activity Duration (Hrs)
						</h3>
						<div className="flex-1 w-full min-h-[250px]">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={chartData}
									margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										vertical={false}
										stroke="#222"
									/>
									<XAxis
										dataKey="day"
										axisLine={false}
										tickLine={false}
										tick={{ fill: '#666', fontSize: 12 }}
										dy={10}
									/>
									<YAxis
										axisLine={false}
										tickLine={false}
										tick={{ fill: '#666', fontSize: 12 }}
									/>
									<Tooltip
										cursor={{ fill: '#1a1a1a' }}
										contentStyle={{
											backgroundColor: '#111',
											borderColor: '#333',
											borderRadius: '8px',
										}}
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
