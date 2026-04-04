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
                Focus_Level: { integerValue: "0" },
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

    // ── Firestore: Complete Session ──
    async completeSession(uid, sessionId) {
        if (!this._config.projectId || !sessionId) return false;

        const projectId = this._config.projectId;
        // Use PATCH with updateMask for partial document update
        const endpoint = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/User/${uid}/Session/${sessionId}?updateMask.fieldPaths=Status&updateMask.fieldPaths=End_Time&updateMask.fieldPaths=Updated_At`;

        const docData = {
            fields: {
                Status: { stringValue: "Completed" },
                End_Time: { timestampValue: new Date().toISOString() },
                Updated_At: { timestampValue: new Date().toISOString() }
            }
        };

        try {
            const resp = await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(docData)
            });
            return resp.ok;
        } catch (err) {
            console.error('Firestore Complete Session Error:', err);
            return false;
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

    async pushLiveActivity(uid, activityName, activityType = "Neutral") {
        if (!this._config.databaseURL) return;
        const endpoint = `${this._config.databaseURL}/users/${uid}/liveSession/activities.json`;
        
        try {
            await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: activityName,
                    type: activityType,
                    timestamp: Date.now()
                })
            });
            return true;
        } catch (err) {
            console.error('RTDB Push Activity Error:', err);
            return false;
        }
    },

    // ── Firestore: Fetch Recent Sessions ──
    async getSessions(uid, limit = 10) {
        if (!this._config.projectId) return [];

        const projectId = this._config.projectId;
        const endpoint = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

        const query = {
            structuredQuery: {
                from: [{ collectionId: "Session" }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: "__name__" },
                        op: "GREATER_THAN",
                        value: { stringValue: `projects/${projectId}/databases/(default)/documents/User/${uid}/Session/` }
                    }
                },
                orderBy: [{
                    field: { fieldPath: "Start_Time" },
                    direction: "DESCENDING"
                }],
                limit: limit
            }
        };

        try {
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(query)
            });
            const data = await resp.json();
            
            // Map Firestore REST response to clean objects
            return (data || []).filter(item => item.document).map(item => {
                const doc = item.document;
                const fields = doc.fields || {};
                return {
                    id: doc.name.split('/').pop(),
                    Task: fields.Task?.stringValue || "Focus Session",
                    Status: fields.Status?.stringValue || "Completed",
                    Focus_Level: parseInt(fields.Focus_Level?.integerValue || "0"),
                    Start_Time: { 
                        toDate: () => new Date(fields.Start_Time?.timestampValue || Date.now())
                    },
                    FocusAnalysis: fields.FocusAnalysis?.mapValue?.fields ? {
                        Focus_Score: parseInt(fields.FocusAnalysis.mapValue.fields.Focus_Score?.integerValue || "0"),
                        Behavior_Pattern: fields.FocusAnalysis.mapValue.fields.Behavior_Pattern?.stringValue || ""
                    } : null
                };
            });
        } catch (err) {
            console.error('Firestore Fetch Sessions Error:', err);
            return [];
        }
    }
};

export default FirebaseHelper;
