'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';

export default function Home() {
	const { user, isLoading, logout } = useAuth();
	const router = useRouter();
	const [seeding, setSeeding] = useState(false);
	const [seedResult, setSeedResult] = useState<{
		success: boolean;
		message: string;
	} | null>(null);

	useEffect(() => {
		if (!isLoading && !user) {
			router.push('/login');
		}
	}, [user, isLoading, router]);

	const handleSeedData = async () => {
		if (!user) return;
		setSeeding(true);
		setSeedResult(null);
		try {
			// 1. Reference the User document explicitly using the Auth UID
			const userRef = doc(db, 'User', user.uid);
			await setDoc(userRef, {
				User_ID: user.uid,
				Name: user.displayName || 'Oshadha Shiro',
				Email: user.email,
				Age: 25,
				Role: 'Standard',
			});

			// 2. Nest Activity under User/{uid}/Activity
			const actRef = doc(collection(db, 'User', user.uid, 'Activity'));
			await setDoc(actRef, {
				Activity_ID: actRef.id,
				User_ID: user.uid,
				App_Name: 'Figma',
				Start_Time: serverTimestamp(),
				Activity_Type: 'Design',
			});

			// 3. Nest Session under User/{uid}/Session
			const sessRef = doc(collection(db, 'User', user.uid, 'Session'));
			await setDoc(sessRef, {
				Session_ID: sessRef.id,
				User_ID: user.uid,
				Start_Time: serverTimestamp(),
				Focus_Level: 92,
			});

			// 4. Focus Analysis
			const analysisRef = doc(
				collection(db, 'User', user.uid, 'FocusAnalysis'),
			);
			await setDoc(analysisRef, {
				Analysis_ID: analysisRef.id,
				Session_ID: sessRef.id,
				Focus_Score: 95.5,
				Behavior_Pattern: 'Deep Work blocks detected',
				Recommendation: 'Maintain current schedule.',
			});

			// 5. Break Suggestions (Array inside document or nested collection)
			const breakRef = doc(collection(db, 'User', user.uid, 'BreakSuggestion'));
			await setDoc(breakRef, {
				Suggestion_ID: breakRef.id,
				Analysis_ID: analysisRef.id,
				Suggestion_Type: 'Mental',
				Message: 'Take 5 to look out a window.',
				Time_Suggested: serverTimestamp(),
			});

			// 6. Anchor Goals
			const goalRef = doc(collection(db, 'User', user.uid, 'AnchorGoal'));
			await setDoc(goalRef, {
				Anchor_ID: goalRef.id,
				User_ID: user.uid,
				Goal_Description: 'Finish the Firebase Migration',
				Priority_Level: 'High',
			});

			// 7. Device
			const deviceRef = doc(collection(db, 'User', user.uid, 'Device'));
			await setDoc(deviceRef, {
				Device_ID: deviceRef.id,
				User_ID: user.uid,
				Device_Type: 'Desktop',
				Operating_System: 'Windows 11',
			});

			// 8. Settings
			const settingsRef = doc(collection(db, 'User', user.uid, 'Settings'));
			await setDoc(settingsRef, {
				Settings_ID: settingsRef.id,
				User_ID: user.uid,
				Notification_Preference: 'All',
				Sensitivity_Level: 'Medium',
			});

			setSeedResult({
				success: true,
				message: 'Nexus Architecture: Verified & Timestamped.',
			});
		} catch (error: any) {
			console.error(error);
			setSeedResult({
				success: false,
				message:
					error.message ||
					'Failed to seed data. (Check Firestore Security Rules)',
			});
		} finally {
			setSeeding(false);
		}
	};
	if (isLoading || !user) {
		return (
			<div className="flex-1 flex items-center justify-center min-h-screen bg-black">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-white/50"></div>
			</div>
		);
	}

	return (
		<div className="relative min-h-screen flex flex-col bg-black text-white p-6 md:p-12 overflow-hidden">
			{/* Background gradients */}
			<div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-600 rounded-full blur-[150px] opacity-20 mix-blend-screen pointer-events-none"></div>
			<div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[150px] opacity-20 mix-blend-screen pointer-events-none"></div>

			<header className="relative z-10 flex justify-between items-center mb-16">
				<h1 className="text-xl font-semibold tracking-widest text-white/90">
					FOCUS.
				</h1>
				<button
					onClick={logout}
					className="text-sm font-light text-gray-400 hover:text-white transition-colors"
				>
					Sign Out
				</button>
			</header>

			<main className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto text-center space-y-8">
				<div>
					<h2 className="text-5xl md:text-6xl font-light tracking-tight mb-4">
						Hey Welcome to focus
					</h2>
					<p className="text-lg md:text-xl text-gray-400 font-light max-w-lg mx-auto">
						You're successfully signed in as{' '}
						<span className="text-white font-normal">
							{user?.displayName || user?.email}
						</span>
						. Your personalized dashboard is ready.
					</p>
				</div>

				<div className="w-full mt-12 p-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl flex flex-col items-center">
					<div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
						<svg
							className="w-8 h-8 text-white/80"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="1.5"
								d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
							/>
						</svg>
					</div>
					<h3 className="text-xl font-medium mb-2">Initialize Database</h3>

					<button
						onClick={handleSeedData}
						disabled={seeding}
						className="px-8 py-3.5 bg-white text-black hover:bg-gray-200 active:scale-[0.98] transition-all rounded-xl font-medium tracking-wide flex items-center justify-center disabled:opacity-70 shadow-lg shadow-white/10"
					>
						{seeding ? (
							<div className="flex items-center space-x-2">
								<div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
								<span>Seeding Firebase...</span>
							</div>
						) : (
							'Send Dummy Data to Firebase'
						)}
					</button>

					{seedResult && (
						<div
							className={`mt-6 w-full text-sm p-4 rounded-xl text-center border ${seedResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
						>
							{seedResult.message}
						</div>
					)}
				</div>
			</main>
		</div>
	);
}
