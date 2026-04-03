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

    async logDistraction(taskName, distractedUrl) {
        if (!this._config || !this._config.projectId) {
            console.error('Firebase config missing or projectId undefined. Initialize first.');
            return;
        }

        const projectId = this._config.projectId;
        const collection = 'user_distractions';
        
        // Firestore REST API Endpoint to add a document
        const endpoint = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`;

        const docData = {
            fields: {
                timestamp: { timestampValue: new Date().toISOString() },
                taskName: { stringValue: taskName },
                distractedUrl: { stringValue: distractedUrl }
            }
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(docData)
            });

            if (!response.ok) {
                console.error('Failed to log distraction to Firestore.', await response.text());
                return false;
            }
            
            console.log('Distraction logged successfully to Firestore REST API');
            return true;
        } catch (err) {
            console.error('Error hitting Firestore REST endpoint:', err);
            return false;
        }
    }
};

export default FirebaseHelper;
