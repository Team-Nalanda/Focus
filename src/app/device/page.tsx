'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/components/AuthProvider';
import { db, rtdb } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { Session, Device, EnvironmentReading } from '@/types/firestore';
import {
	Cpu,
	Thermometer,
	Droplets,
	Sun,
	Volume2,
	Wifi,
	WifiOff,
	Activity,
	Gauge,
	Clock,
	Zap,
	ChevronRight,
	Radio,
} from 'lucide-react';

// ── Helper: Suitability badge color
function getSuitabilityStyle(label: string) {
	switch (label) {
		case 'Excellent':
			return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' };
		case 'Good':
			return { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400' };
		case 'Fair':
			return { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' };
		case 'Poor':
			return { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' };
		default:
			return { bg: 'bg-neutral-500/10', border: 'border-neutral-500/20', text: 'text-neutral-400' };
	}
}

// ── Helper: Score color
function getScoreColor(score: number) {
	if (score >= 85) return 'text-emerald-400';
	if (score >= 65) return 'text-green-400';
	if (score >= 40) return 'text-amber-400';
	return 'text-red-400';
}

// ── Helper: Score glow
function getScoreGlow(score: number) {
	if (score >= 85) return 'shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]';
	if (score >= 65) return 'shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]';
	if (score >= 40) return 'shadow-[0_0_30px_-5px_rgba(245,158,11,0.3)]';
	return 'shadow-[0_0_30px_-5px_rgba(239,68,68,0.3)]';
}

// ── Helper: Sensor range indicator bar
function RangeBar({ value, min, max, optMin, optMax, unit, color }: {
	value: number; min: number; max: number; optMin: number; optMax: number; unit: string; color: string;
}) {
	const percent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
	const optStart = ((optMin - min) / (max - min)) * 100;
	const optWidth = ((optMax - optMin) / (max - min)) * 100;
	const inRange = value >= optMin && value <= optMax;

	return (
		<div className="space-y-2">
			<div className="relative h-2 w-full bg-neutral-800 rounded-full overflow-visible">
				{/* Optimal zone */}
				<div
					className="absolute top-0 h-full bg-emerald-500/15 rounded-full"
					style={{ left: `${optStart}%`, width: `${optWidth}%` }}
				/>
				{/* Marker */}
				<div
					className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-black transition-all duration-1000 ${inRange ? 'bg-emerald-400' : `bg-${color}-400`}`}
					style={{ left: `${percent}%`, transform: `translate(-50%, -50%)` }}
				/>
			</div>
			<div className="flex justify-between text-[10px] text-neutral-600">
				<span>{min}{unit}</span>
				<span className="text-emerald-500/50">{optMin}–{optMax}{unit} optimal</span>
				<span>{max}{unit}</span>
			</div>
		</div>
	);
}

export default function DevicePage() {
	const { user } = useAuth();

	// Real-time state from RTDB
	const [deviceStatus, setDeviceStatus] = useState<any>(null);
	const [liveEnvironment, setLiveEnvironment] = useState<any>(null);
	const [isSessionActive, setIsSessionActive] = useState(false);

	// Historical state from Firestore
	const [envHistory, setEnvHistory] = useState<(Session & { Environment: EnvironmentReading })[]>([]);
	const [devices, setDevices] = useState<Device[]>([]);
	const [loading, setLoading] = useState(true);

	// ── 1. RTDB real-time listeners
	useEffect(() => {
		if (!user) return;

		// Device status
		const deviceRef = ref(rtdb, `users/${user.uid}/device`);
		const unsubDevice = onValue(deviceRef, (snapshot) => {
			const data = snapshot.val();
			if (data) {
				// Check if device is still "online" (last seen within 30 seconds)
				const isOnline = data.online && data.lastSeen && (Date.now() - data.lastSeen < 30000);
				setDeviceStatus({ ...data, online: isOnline });
			} else {
				setDeviceStatus(null);
			}
		});

		// Live session environment
		const envRef = ref(rtdb, `users/${user.uid}/liveSession`);
		const unsubEnv = onValue(envRef, (snapshot) => {
			const data = snapshot.val();
			setIsSessionActive(!!data?.active);
			if (data?.environment) {
				setLiveEnvironment(data.environment);
			} else {
				setLiveEnvironment(null);
			}
		});

		return () => {
			unsubDevice();
			unsubEnv();
		};
	}, [user]);

	// ── 2. Firestore historical data
	useEffect(() => {
		if (!user) return;

		async function fetchHistory() {
			try {
				// Fetch sessions with environment data
				const sessionsQ = query(
					collection(db, 'User', user!.uid, 'Session'),
					orderBy('Start_Time', 'desc'),
				);
				const snap = await getDocs(sessionsQ);
				const sessions = snap.docs
					.map((doc) => ({ id: doc.id, ...doc.data() }) as Session)
					.filter((s) => s.Environment);
				setEnvHistory(sessions as any);

				// Fetch registered devices
				const devSnap = await getDocs(collection(db, 'User', user!.uid, 'Device'));
				const devs = devSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Device);
				setDevices(devs);
			} catch (e) {
				console.error('Error fetching device history:', e);
			} finally {
				setLoading(false);
			}
		}
		fetchHistory();
	}, [user]);

	// ── Periodically refresh device online status (since RTDB only updates on push)
	useEffect(() => {
		const interval = setInterval(() => {
			if (deviceStatus?.lastSeen) {
				const isOnline = Date.now() - deviceStatus.lastSeen < 30000;
				if (isOnline !== deviceStatus.online) {
					setDeviceStatus((prev: any) => prev ? { ...prev, online: isOnline } : null);
				}
			}
		}, 5000);
		return () => clearInterval(interval);
	}, [deviceStatus?.lastSeen]);

	const isDeviceOnline = deviceStatus?.online === true;
	
	let fallbackEnv = null;
	if (envHistory.length > 0 && envHistory[0]?.Environment) {
		const env = envHistory[0].Environment as any;
		fallbackEnv = {
			temperature: env.Temperature,
			humidity: env.Humidity,
			lightLevel: env.Light_Level,
			noiseLevel: env.Noise_Level,
			suitabilityScore: env.Suitability_Score,
			focusSuitability: env.Focus_Suitability
		};
	}
	
	const displayEnvironment = (isSessionActive ? liveEnvironment : null) || deviceStatus?.lastEnvironment || fallbackEnv;

	return (
		<AppLayout>
			<div className="flex flex-col h-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
				{/* Page Header */}
				<div className="shrink-0">
					<h1 className="text-3xl font-light tracking-tight mb-2">Device</h1>
					<p className="text-neutral-400 font-light text-sm">
						Monitor your hardware desk companion and environment sensors in real-time.
					</p>
				</div>

				{/* Device Status Card */}
				<div className={`shrink-0 relative overflow-hidden rounded-2xl border p-6 transition-all ${
					isDeviceOnline
						? 'border-emerald-500/20 bg-emerald-500/[0.02]'
						: 'border-neutral-800 bg-[#0a0a0a]'
				}`}>
					<div className="absolute top-0 right-0 p-6 opacity-[0.03]">
						<Cpu size={120} />
					</div>

					<div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
						<div className="flex items-center gap-5">
							<div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
								isDeviceOnline
									? 'bg-emerald-500/10 border-emerald-500/20'
									: 'bg-neutral-900 border-neutral-800'
							}`}>
								{isDeviceOnline
									? <Wifi size={24} className="text-emerald-400" />
									: <WifiOff size={24} className="text-neutral-600" />
								}
							</div>
							<div>
								<h2 className="text-lg font-medium text-white">
									{deviceStatus?.name || (devices[0]?.Device_Name) || 'Focus Desk Monitor'}
								</h2>
								<div className="flex items-center gap-3 mt-1">
									<div className="flex items-center gap-1.5">
										<div className={`w-2 h-2 rounded-full ${isDeviceOnline ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-neutral-700'}`} />
										<span className={`text-xs ${isDeviceOnline ? 'text-emerald-400' : 'text-neutral-500'}`}>
											{isDeviceOnline ? 'Online' : 'Offline'}
										</span>
									</div>
									{deviceStatus?.firmwareVersion && (
										<span className="text-[10px] text-neutral-600 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
											v{deviceStatus.firmwareVersion}
										</span>
									)}
									{deviceStatus?.id && (
										<span className="text-[10px] font-mono text-neutral-600">
											{deviceStatus.id}
										</span>
									)}
								</div>
							</div>
						</div>

						<div className="flex items-center gap-4">
							{deviceStatus?.lastSeen && (
								<div className="text-right">
									<p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-0.5">Last Seen</p>
									<p className="text-xs text-neutral-400 font-mono">
										{new Date(deviceStatus.lastSeen).toLocaleTimeString()}
									</p>
								</div>
							)}
							{isDeviceOnline && isSessionActive && (
								<div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
									<Radio size={12} className="text-emerald-400 animate-pulse" />
									<span className="text-xs text-emerald-400 font-medium">Streaming</span>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Main Content Grid */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[500px]">

					{/* Live Environment Monitor — Left 2/3 */}
					<div className="lg:col-span-2 space-y-6">
						{displayEnvironment ? (
							<>
								{/* Suitability Score Hero */}
								<div className={`rounded-2xl border p-8 text-center ${getScoreGlow(displayEnvironment.suitabilityScore)} border-neutral-800 bg-[#0a0a0a]`}>
									<p className="text-xs text-neutral-500 uppercase tracking-[0.2em] font-medium mb-4">
										Environment Focus Score
									</p>
									<div className="flex items-center justify-center gap-4 mb-4">
										<span className={`text-7xl font-light tracking-tighter ${getScoreColor(displayEnvironment.suitabilityScore)}`}>
											{displayEnvironment.suitabilityScore}
										</span>
										<span className="text-neutral-600 text-2xl font-light">/100</span>
									</div>
									{displayEnvironment.focusSuitability && (() => {
										const style = getSuitabilityStyle(displayEnvironment.focusSuitability);
										return (
											<span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium ${style.bg} ${style.border} ${style.text} border`}>
												<Gauge size={14} />
												{displayEnvironment.focusSuitability}
											</span>
										);
									})()}
								</div>

								{/* Sensor Cards Grid */}
								<div className="grid grid-cols-2 gap-4">
									{/* Temperature */}
									<div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] p-5 space-y-4">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2 text-neutral-400">
												<Thermometer size={16} className="text-orange-400" />
												<span className="text-xs font-medium uppercase tracking-wider">Temperature</span>
											</div>
											<span className="text-2xl font-light text-white">{displayEnvironment.temperature}°C</span>
										</div>
										<RangeBar value={displayEnvironment.temperature} min={10} max={38} optMin={24} optMax={28} unit="°" color="orange" />
									</div>

									{/* Humidity */}
									<div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] p-5 space-y-4">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2 text-neutral-400">
												<Droplets size={16} className="text-blue-400" />
												<span className="text-xs font-medium uppercase tracking-wider">Humidity</span>
											</div>
											<span className="text-2xl font-light text-white">{displayEnvironment.humidity}%</span>
										</div>
										<RangeBar value={displayEnvironment.humidity} min={0} max={100} optMin={40} optMax={60} unit="%" color="blue" />
									</div>

									{/* Light Level */}
									<div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] p-5 space-y-4">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2 text-neutral-400">
												<Sun size={16} className="text-yellow-400" />
												<span className="text-xs font-medium uppercase tracking-wider">Light</span>
											</div>
											<span className="text-2xl font-light text-white">{displayEnvironment.lightLevel} <span className="text-sm text-neutral-600">lux</span></span>
										</div>
										<RangeBar value={displayEnvironment.lightLevel} min={0} max={1000} optMin={300} optMax={500} unit="lx" color="yellow" />
									</div>

									{/* Noise Level */}
									<div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] p-5 space-y-4">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2 text-neutral-400">
												<Volume2 size={16} className="text-purple-400" />
												<span className="text-xs font-medium uppercase tracking-wider">Noise</span>
											</div>
											<span className="text-2xl font-light text-white">{displayEnvironment.noiseLevel}<span className="text-sm text-neutral-600">/10</span></span>
										</div>
										<RangeBar value={displayEnvironment.noiseLevel} min={0} max={10} optMin={0} optMax={2} unit="" color="purple" />
									</div>
								</div>
							</>
						) : (
							<div className="flex-1 flex flex-col items-center justify-center border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/10 p-16 text-center min-h-[400px]">
								<div className="w-16 h-16 bg-neutral-800/50 rounded-2xl flex items-center justify-center mb-6">
									<Activity size={32} className="text-neutral-600" />
								</div>
								<h2 className="text-xl font-medium text-white mb-2">No Live Environment Data</h2>
								<p className="text-neutral-500 max-w-sm font-light text-sm leading-relaxed">
									{!isDeviceOnline
										? 'Connect your Focus Desk Monitor to start receiving environment data. Ensure the device is powered on and connected to WiFi.'
										: 'Start a focus session to begin receiving live environment readings from your device.'
									}
								</p>
							</div>
						)}
					</div>

					{/* Right Column — History & Device Info */}
					<div className="space-y-6">
						{/* Registered Devices */}
						<div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] overflow-hidden">
							<div className="p-4 border-b border-neutral-800">
								<h3 className="text-xs uppercase tracking-widest text-neutral-500 font-medium flex items-center gap-2">
									<Cpu size={12} />
									Registered Devices
								</h3>
							</div>
							<div className="p-4 space-y-3">
								{devices.length > 0 ? (
									devices.map((device) => (
										<div key={device.id} className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900/50 border border-neutral-800/50">
											<div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center">
												<Cpu size={16} className="text-neutral-400" />
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-sm text-white font-medium truncate">
													{device.Device_Name || device.Device_Type || 'Unknown Device'}
												</p>
												<p className="text-[10px] text-neutral-600 truncate">
													{device.Firmware_Version ? `v${device.Firmware_Version}` : device.Operating_System || 'ESP8266'} · {device.id}
												</p>
											</div>
										</div>
									))
								) : (
									<div className="text-center py-6">
										<p className="text-sm text-neutral-500 italic">No devices registered yet.</p>
										<p className="text-[10px] text-neutral-600 mt-2">
											Power on your ESP8266 to auto-register.
										</p>
									</div>
								)}
							</div>
						</div>

						{/* Pairing Guide */}
						<div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/10 p-5 space-y-3">
							<h3 className="text-xs uppercase tracking-widest text-neutral-500 font-medium">Quick Setup</h3>
							<ol className="space-y-2.5 text-sm text-neutral-400 font-light">
								{[
									'Flash the firmware to your ESP8266',
									'Configure WiFi credentials in the sketch',
									'Set your User ID and server URL',
									'The device will auto-register on boot',
								].map((step, i) => (
									<li key={i} className="flex items-start gap-2.5">
										<span className="w-5 h-5 rounded-md bg-neutral-800 text-neutral-500 text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-medium">
											{i + 1}
										</span>
										<span>{step}</span>
									</li>
								))}
							</ol>
						</div>

						{/* Environment History */}
						<div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] overflow-hidden">
							<div className="p-4 border-b border-neutral-800">
								<h3 className="text-xs uppercase tracking-widest text-neutral-500 font-medium flex items-center gap-2">
									<Clock size={12} />
									Environment History
								</h3>
							</div>
							<div className="max-h-[300px] overflow-y-auto">
								{loading ? (
									<div className="p-8 text-center text-neutral-600 text-sm">Loading...</div>
								) : envHistory.length > 0 ? (
									<div className="divide-y divide-neutral-800/50">
										{envHistory.slice(0, 10).map((session) => {
											const env = session.Environment;
											const suitStyle = getSuitabilityStyle(env.Focus_Suitability);
											const date = (session.Start_Time as any)?.toDate?.();
											return (
												<div key={session.id} className="px-4 py-3 flex items-center justify-between hover:bg-neutral-900/30 transition-colors">
													<div className="flex-1 min-w-0">
														<p className="text-sm text-neutral-300 truncate">
															{session.Task || 'Focus Session'}
														</p>
														<p className="text-[10px] text-neutral-600 mt-0.5">
															{date ? date.toLocaleDateString() : 'Recent'} · {env.Temperature}°C · {env.Light_Level}lx
														</p>
													</div>
													<div className="flex items-center gap-2">
														<span className={`text-xs font-medium ${getScoreColor(env.Suitability_Score)}`}>
															{env.Suitability_Score}
														</span>
														<span className={`text-[10px] px-2 py-0.5 rounded-full border ${suitStyle.bg} ${suitStyle.border} ${suitStyle.text}`}>
															{env.Focus_Suitability}
														</span>
													</div>
												</div>
											);
										})}
									</div>
								) : (
									<div className="p-8 text-center text-neutral-600 text-sm italic">
										No environment readings recorded yet.
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</AppLayout>
	);
}
