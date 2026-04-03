const FirebaseHelper = {
    _config: {
        apiKey: "AIzaSyAIT-S7wpTtmAI3O61_4e07DYuqg_MGRyk",
        authDomain: "focus-24f51.firebaseapp.com",
        databaseURL: "https://focus-24f51-default-rtdb.firebaseio.com",
        projectId: "focus-24f51",
        storageBucket: "focus-24f51.firebasestorage.app",
        messagingSenderId: "967520924679",
        appId: "1:967520924679:web:0b267c68d8c9df5419e6a2",
        measurementId: "G-ZFVPJKJ5VC"
    },

    async init() {
        return Promise.resolve(true);
    },

    // ── Firestore: Create Session ──
    async createSession(uid, sessionData) {
        if (!this._config.projectId) return null;

        const projectId = this._config.projectId;
        const endpoint = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/User/${uid}/Session`;

        const docData = {
            fields: {
                Status: { stringValue: "Active" },
                Focus_Level: { integerValue: "100" },
                Start_Time: { timestampValue: new Date().toISOString() },
                Created_At: { timestampValue: new Date().toISOString() },
                Updated_At: { timestampValue: new Date().toISOString() },
                Task: { stringValue: sessionData.task || "" }
            }
        };

        try {
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(docData)
            });
            const data = await resp.json();
            // The document name is "projects/.../databases/(default)/documents/User/.../Session/SESSION_ID"
            const nameParts = data.name.split('/');
            return nameParts[nameParts.length - 1];
        } catch (err) {
            console.error('Firestore Create Session Error:', err);
            return null;
        }
    },

    // ── Firestore: Permanent Activity Log ──
    async logActivity(uid, activity) {
        if (!this._config.projectId || !activity.sessionId) {
            console.warn('Skipping Firestore log: Missing projectId or sessionId.');
            return false;
        }

        const projectId = this._config.projectId;
        const sessionId = activity.sessionId;
        const collectionPath = `User/${uid}/Session/${sessionId}/Activity`;
        const endpoint = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}`;

        const docData = {
            fields: {
                App_Name: { stringValue: activity.appName },
                Activity_Type: { stringValue: activity.type || "Neutral" },
                Start_Time: { timestampValue: new Date().toISOString() },
                End_Time: { timestampValue: new Date().toISOString() } // Close immediately for simple logs
            }
        };

        try {
            await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(docData)
            });
            return true;
        } catch (err) {
            console.error('Firestore Log Error:', err);
            return false;
        }
    },

    // ── RTDB: Real-time Live Monitor Sync ──
    async updateLiveSession(uid, data) {
        if (!this._config.databaseURL) return;
        const endpoint = `${this._config.databaseURL}/users/${uid}/liveSession.json`;
        
        try {
            await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return true;
        } catch (err) {
            console.error('RTDB Sync Error:', err);
            return false;
        }
    },

    async pushLiveActivity(uid, activityName) {
        if (!this._config.databaseURL) return;
        const endpoint = `${this._config.databaseURL}/users/${uid}/liveSession/activities.json`;
        
        try {
            await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: activityName,
                    timestamp: Date.now()
                })
            });
            return true;
        } catch (err) {
            console.error('RTDB Push Activity Error:', err);
            return false;
        }
    }
};

export default FirebaseHelper;
