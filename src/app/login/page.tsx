"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred with Google Sign In");
      setLoading(false);
    }
  };

  if (isLoading || user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-white/20"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black text-white p-4">
      {/* Background gradients for abstract aesthetic */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[120px] opacity-30 mix-blend-screen pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px] opacity-30 mix-blend-screen pointer-events-none"></div>

      {/* Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-sm p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl transition-all duration-300 text-center">
        <h2 className="text-3xl font-light tracking-wide mb-2">Welcome</h2>
        <p className="text-gray-400 mb-8 font-light text-sm">
          Sign in to access your Focus sessions.
        </p>

        {error && (
          <div className="mb-6 mx-auto text-sm text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-xl text-center max-w-xs">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          type="button"
          className="w-full py-4 bg-white/10 hover:bg-white/15 border border-white/10 transition-all active:scale-[0.98] rounded-2xl font-medium tracking-wide flex items-center justify-center space-x-3 disabled:opacity-50"
        >
          {loading ? (
             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
