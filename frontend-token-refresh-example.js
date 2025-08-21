// Example: Frontend Token Refresh Implementation
// Add this to your frontend authentication service

class TokenManager {
    constructor() {
        this.currentUser = null;
        this.refreshTimer = null;
    }

    // Initialize with Firebase auth state listener
    init(auth) {
        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                this.scheduleTokenRefresh();
            } else {
                this.clearRefreshTimer();
            }
        });
    }

    // Get a fresh token (automatically refreshes if needed)
    async getValidToken() {
        if (!this.currentUser) {
            throw new Error('User not authenticated');
        }

        try {
            // getIdToken() automatically refreshes if token is expired
            return await this.currentUser.getIdToken();
        } catch (error) {
            console.error('Failed to get valid token:', error);
            throw error;
        }
    }

    // Force refresh token
    async refreshToken() {
        if (!this.currentUser) return null;

        try {
            // Force refresh with true parameter
            const token = await this.currentUser.getIdToken(true);
            console.log('Token refreshed successfully');
            return token;
        } catch (error) {
            console.error('Token refresh failed:', error);
            throw error;
        }
    }

    // Schedule automatic token refresh every 50 minutes
    scheduleTokenRefresh() {
        this.clearRefreshTimer();
        this.refreshTimer = setInterval(() => {
            this.refreshToken().catch(console.error);
        }, 50 * 60 * 1000); // 50 minutes
    }

    clearRefreshTimer() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
}

// Usage in your API calls
const tokenManager = new TokenManager();

// Initialize with your Firebase auth instance
// tokenManager.init(auth);

// API call with automatic token refresh
async function followCompany(companyCode) {
    try {
        const token = await tokenManager.getValidToken();

        const response = await fetch('/api/company/follow', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ companyCode })
        });

        if (response.status === 401) {
            const errorData = await response.json();

            if (errorData.code === 'auth/id-token-expired' && errorData.action === 'refresh_token') {
                // Try refreshing token and retry
                console.log('Token expired, refreshing and retrying...');
                await tokenManager.refreshToken();

                // Retry the request with fresh token
                const newToken = await tokenManager.getValidToken();
                const retryResponse = await fetch('/api/company/follow', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${newToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ companyCode })
                });

                return await retryResponse.json();
            } else {
                // Other auth errors - redirect to login
                window.location.href = '/login';
                throw new Error(errorData.message);
            }
        }

        return await response.json();
    } catch (error) {
        console.error('Follow company failed:', error);
        throw error;
    }
}

// Export for use in your app
export { tokenManager, followCompany };