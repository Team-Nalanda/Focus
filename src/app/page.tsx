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
	const [liveActivity, setLiveActivity] = useState<any[]>([]);
	const [currentApp, setCurrentApp] = useState<any>(null);
	const [isLiveSessionActive, setIsLiveSessionActive] = useState(false);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [liveTip, setLiveTip] = useState<string | null>(null);

	useEffect(() => {
		async function fetchData() {
			if (!user) return;
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
					if (daySessions.length > 0) {
						dayScore = Math.round(
							daySessions.reduce((acc, s) => acc + (s.Focus_Level || 0), 0) /
								daySessions.length,
						);
						// Estimate duration
						dayDuration = daySessions.reduce((acc, s) => {
							const st = (s.Start_Time as any)?.toDate?.() || new Date();
							const et = (s.End_Time as any)?.toDate?.() || null;
							if (et) {
								return acc + (et.getTime() - st.getTime()) / (1000 * 60 * 60);
							}
							return acc + 0.5; // default 30 mins if not completed
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
		}
		fetchData();
	}, [user]);

	useEffect(() => {
		if (!user) return;

		// Listen for live session status and activities in RTDB
		const sessionRef = ref(rtdb, `users/${user.uid}/liveSession`);
		const unsubscribe = onValue(sessionRef, (snapshot) => {
			const data = snapshot.val();
			if (data) {
				setIsLiveSessionActive(data.active || false);
				setCurrentApp(data.currentApp || null);
				setActiveSessionId(data.firestoreSessionId || null);

				if (data.activities) {
					const acts = Object.values(data.activities).reverse();
					setLiveActivity(acts);
				} else {
					setLiveActivity([]);
				}
			} else {
				setIsLiveSessionActive(false);
				setCurrentApp(null);
				setActiveSessionId(null);
				setLiveActivity([]);
			}
		});

		return () => unsubscribe();
	}, [user]);

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
						// Hide tip after some time
						setTimeout(() => setLiveTip(null), 10000);
					}
				} catch (e) {
					console.error("Live tip error:", e);
				}
			}
			fetchTip();
		}
	}, [liveActivity.length, isLiveSessionActive]);

	const simulateLiveActivity = async () => {
		if (!user) return;

		const apps = ['VS Code', 'Chrome', 'Slack', 'Figma', 'Spotify', 'Terminal'];
		const randomApp = apps[Math.floor(Math.random() * apps.length)];
		const sessionRef = ref(rtdb, `users/${user.uid}/liveSession`);

		await set(sessionRef, {
			active: true,
			currentApp: {
				name: randomApp,
				startTime: Date.now(),
			},
		});

		// Push to activity history in RTDB
		const activityHistoryRef = ref(
			rtdb,
			`users/${user.uid}/liveSession/activities`,
		);
		const newActivityRef = push(activityHistoryRef);
		await set(newActivityRef, {
			name: randomApp,
			timestamp: Date.now(),
		});
	};

	const stopLiveSimulation = async () => {
		if (!user) return;
		setIsAnalyzing(true);

		try {
			// 1. Finalize current Firestore session if we have an ID
			if (activeSessionId) {
				const sessionDocRef = doc(
					db,
					'User',
					user.uid,
					'Session',
					activeSessionId,
				);
				await updateDoc(sessionDocRef, {
					Status: 'Completed',
					End_Time: serverTimestamp(),
					Updated_At: serverTimestamp(),
				});

				// 2. Trigger AI Analysis on the collected app logs
				const response = await fetch('/api/analyze', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ activities: liveActivity }),
				});

				const analysis = await response.json();

				// 3. Update Firestore with AI results
				await updateDoc(sessionDocRef, {
					FocusAnalysis: {
						...analysis,
						Analyzed_At: serverTimestamp(),
					},
				});
			}

			// 4. Clear RTDB live state
			const rtdbRef = ref(rtdb, `users/${user.uid}/liveSession`);
			await set(rtdbRef, null);

			setActiveSessionId(null);
			alert('Session analyzed by Gemma AI and saved to your history!');
		} catch (e) {
			console.error('Stop session error:', e);
		} finally {
			setIsAnalyzing(false);
		}
	};

	const handleSeedSampleData = async () => {
		if (!user) return;
		setStartingExtension(true);
		try {
			const userRef = doc(db, 'User', user.uid);
			await setDoc(
				userRef,
				{
					Email: user.email,
					Name: user.displayName || 'Demo User',
					Settings: {
						Notification_Preference: 'Important',
						Sensitivity_Level: 'Medium',
					},
					Updated_At: serverTimestamp(),
				},
				{ merge: true },
			);

			const daysToSeed = 7;
			for (let i = 0; i < daysToSeed; i++) {
				const date = new Date();
				date.setDate(date.getDate() - i);
				const numSessions = Math.floor(Math.random() * 3) + 1;

				for (let j = 0; j < numSessions; j++) {
					const hour = 9 + j * 4 + Math.floor(Math.random() * 2);
					const startTime = new Date(date);
					startTime.setHours(hour, 0, 0, 0);
					const durationMins = 45 + Math.floor(Math.random() * 75);
					const endTime = new Date(startTime.getTime() + durationMins * 60000);
					const focusLevel = 70 + Math.floor(Math.random() * 30);

					const sessionRef = doc(collection(db, 'User', user.uid, 'Session'));
					await setDoc(sessionRef, {
						Status: 'Completed',
						Focus_Level: focusLevel,
						Start_Time: Timestamp.fromDate(startTime),
						End_Time: Timestamp.fromDate(endTime),
						FocusAnalysis: {
							Focus_Score: focusLevel,
							Behavior_Pattern:
								i % 2 === 0
									? 'Consistent high productivity throughout the morning.'
									: 'Mid-session context switching detected.',
							Recommendation:
								'Your focus is naturally higher in the mornings. Maintain this schedule.',
							Analyzed_At: serverTimestamp(),
						},
					});

					const apps = [
						{ name: 'VS Code', type: 'Productive' },
						{ name: 'Figma', type: 'Productive' },
						{ name: 'Chrome', type: 'Neutral' },
						{ name: 'Spotify', type: 'Neutral' },
						{ name: 'Twitter', type: 'Distracting' },
						{ name: 'Instagram', type: 'Distracting' },
					];

					const numActivities = 3 + Math.floor(Math.random() * 3);
					for (let k = 0; k < numActivities; k++) {
						const app = apps[Math.floor(Math.random() * apps.length)];
						const actStart = new Date(startTime.getTime() + k * 15 * 60000);
						const actEnd = new Date(actStart.getTime() + 12 * 60000);

						const activityRef = doc(
							collection(db, 'User', user.uid, 'Activity'),
						);
						await setDoc(activityRef, {
							Session_ID: sessionRef.id,
							App_Name: app.name,
							Activity_Type: app.type,
							Start_Time: Timestamp.fromDate(actStart),
							End_Time: Timestamp.fromDate(actEnd),
						});
					}
				}
			}
			alert(
				'Sample data seeded! The dashboard will now reflect your new focus history.',
			);
			window.location.reload();
		} catch (e) {
			console.error(e);
			alert('Seeding failed. Check console for details.');
		} finally {
			setStartingExtension(false);
		}
	};

	const handleStartExtension = async () => {
		setStartingExtension(true);
		if (!user) return;

		try {
			// 1. Create a real Firestore Session document
			const sessionRef = await addDoc(
				collection(db, 'User', user.uid, 'Session'),
				{
					Status: 'Active',
					Focus_Level: 100,
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

			setStartingExtension(false);
		} catch (e) {
			console.error('Start session error:', e);
			setStartingExtension(false);
		}
	};

	const totalDeepWorkHours = sessions.reduce((acc, s) => {
		const st = (s.Start_Time as any)?.toDate?.() || new Date();
		const et = (s.End_Time as any)?.toDate?.() || null;
		return acc + (et ? (et.getTime() - st.getTime()) / (1000 * 60 * 60) : 0);
	}, 0);

	const deepWorkDisplay = `${Math.floor(totalDeepWorkHours)}h ${Math.round((totalDeepWorkHours % 1) * 60)}m`;

	const avgFocusScore =
		sessions.length > 0
			? Math.round(
					sessions.reduce((acc, s) => acc + (s.Focus_Level || 0), 0) /
						sessions.length,
				)
			: 0;

	return (
		<AppLayout>
			<div className="flex flex-col h-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
				{/* Realtime Live Monitor - Top of Dashboard */}
				{isLiveSessionActive && (
					<div className="w-full bg-neutral-900/50 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-md animate-in zoom-in-95 duration-500">
						<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
							<div className="flex items-center gap-4">
								<div className="relative">
									<div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/50">
										<Monitor size={24} className="text-emerald-400" />
									</div>
									<div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping"></div>
									<div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full"></div>
								</div>
								<div>
									<h2 className="text-lg font-medium text-white flex items-center gap-2">
										Live Session Active
									</h2>
									<p className="text-neutral-400 text-sm font-light">
										Currently focused:{' '}
										<span className="text-emerald-400 font-medium">
											{currentApp?.name || 'Waiting...'}
										</span>
									</p>
								</div>
							</div>

							{liveTip && (
								<div className="flex-1 max-w-sm px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-500">
									<div className="flex items-start gap-3">
										<Sparkles size={14} className="text-emerald-400 mt-1 shrink-0" />
										<p className="text-xs text-emerald-100 font-light leading-relaxed italic">
											{liveTip}
										</p>
									</div>
								</div>
							)}

							<button
								onClick={stopLiveSimulation}
								disabled={isAnalyzing}
								className="px-4 py-2 bg-neutral-800 hover:bg-red-900/20 hover:text-red-400 border border-neutral-700 hover:border-red-500/50 rounded-lg text-sm transition-all active:scale-95 disabled:opacity-50"
							>
								{isAnalyzing ? (
									<div className="flex items-center gap-2">
										<Loader2 size={14} className="animate-spin" />
										Analyzing...
									</div>
								) : (
									'Stop Tracking'
								)}
							</button>
						</div>
					</div>
				)}

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
						<button
							onClick={handleSeedSampleData}
							disabled={startingExtension}
							className="flex items-center space-x-2 px-4 py-3 bg-neutral-900 text-neutral-400 border border-neutral-800 rounded-lg font-medium tracking-wide hover:text-white hover:border-neutral-700 transition-all active:scale-[0.98] disabled:opacity-70"
						>
							<Activity size={18} />
							<span>Seed Data</span>
						</button>
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
						<button
							onClick={simulateLiveActivity}
							className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium tracking-wide hover:bg-emerald-500 transition-all active:scale-[0.98]"
						>
							Log Live Action
						</button>
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
							value: `${sessions.filter((s) => s.Status === 'Completed').length}`,
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
