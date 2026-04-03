'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/components/AuthProvider';
import { Save, Bell, Shield, User as UserIcon } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  
  const [notificationPref, setNotificationPref] = useState('Important');
  const [sensitivityLevel, setSensitivityLevel] = useState('Medium');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    // Simulate API call to update Firebase Settings Document
    setTimeout(() => {
      setSaving(false);
      alert('Settings saved successfully.');
    }, 1000);
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto w-full">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-light tracking-tight mb-2">Settings</h1>
            <p className="text-neutral-400 font-light text-sm">
              Configure your focus parameters, privacy, and account setup.
            </p>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-2.5 bg-white text-black rounded-lg font-medium tracking-wide hover:bg-neutral-200 transition-all active:scale-[0.98] disabled:opacity-70"
          >
            <Save size={18} />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>

        <div className="space-y-6">
          
          {/* Account Settings */}
          <section className="bg-[#0a0a0a] border border-neutral-800 rounded-xl overflow-hidden">
            <div className="bg-[#0e0e0e] border-b border-neutral-800 p-4 flex items-center space-x-3 text-neutral-300">
              <UserIcon size={18} />
              <h2 className="text-sm tracking-widest uppercase font-medium">Account</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm text-neutral-400">Display Name</label>
                  <input 
                    type="text" 
                    defaultValue={user?.displayName || 'Oshadha Shiro'}
                    className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-lg px-4 py-2.5 outline-none focus:border-neutral-600 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-neutral-400">Email Address</label>
                  <input 
                    type="email" 
                    defaultValue={user?.email || 'oshadha@example.com'}
                    disabled
                    className="w-full bg-neutral-900/50 border border-neutral-800 text-neutral-500 rounded-lg px-4 py-2.5 outline-none cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* AI Focus Settings */}
          <section className="bg-[#0a0a0a] border border-neutral-800 rounded-xl overflow-hidden">
            <div className="bg-[#0e0e0e] border-b border-neutral-800 p-4 flex items-center space-x-3 text-neutral-300">
              <Shield size={18} />
              <h2 className="text-sm tracking-widest uppercase font-medium">Focus Configuration</h2>
            </div>
            <div className="p-6 space-y-8">
              
              <div className="space-y-3">
                <label className="text-sm text-neutral-400 block break-words">AI Interference Sensitivity</label>
                <p className="text-xs text-neutral-500 mb-4 break-words">How aggressively should the AI detect distractons and intervene during a Focus Session?</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['Low', 'Medium', 'High', 'Strict'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setSensitivityLevel(level)}
                      className={`py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                        sensitivityLevel === level 
                          ? 'border-white text-white bg-white/5' 
                          : 'border-neutral-800 text-neutral-500 hover:border-neutral-600'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section className="bg-[#0a0a0a] border border-neutral-800 rounded-xl overflow-hidden">
            <div className="bg-[#0e0e0e] border-b border-neutral-800 p-4 flex items-center space-x-3 text-neutral-300">
              <Bell size={18} />
              <h2 className="text-sm tracking-widest uppercase font-medium">Notifications</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4 max-w-lg">
                {[
                  { value: 'All', title: 'All Activities', desc: 'Get notified for every focus gap and achievement.' },
                  { value: 'Important', title: 'Important Only', desc: 'Only alert me when I am severely drifting.' },
                  { value: 'None', title: 'Do Not Disturb', desc: 'No notifications. Pure silence.' }
                ].map((pref) => (
                  <label key={pref.value} className="flex items-start space-x-4 cursor-pointer group">
                    <div className="relative pt-1">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        notificationPref === pref.value 
                          ? 'border-emerald-500 bg-emerald-500/20' 
                          : 'border-neutral-600 group-hover:border-neutral-400'
                      }`}>
                        {notificationPref === pref.value && (
                          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                        )}
                      </div>
                      <input 
                        type="radio" 
                        className="hidden" 
                        name="notification_pref" 
                        checked={notificationPref === pref.value} 
                        onChange={() => setNotificationPref(pref.value)}
                      />
                    </div>
                    <div>
                      <h4 className="text-white text-sm font-medium">{pref.title}</h4>
                      <p className="text-neutral-500 text-xs mt-0.5">{pref.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </section>

        </div>
      </div>
    </AppLayout>
  );
}
