# 🔄 Frontend Token Refresh Implementation Guide

This guide shows how to implement automatic token refresh using Axios interceptors for seamless user experience.

## 📋 **Overview**

When a user's Firebase ID token expires, the backend returns a 401 error with specific error codes. The frontend should automatically refresh the token and retry the failed request without user intervention.

## 🎯 **Backend API Endpoints**

### **Refresh Token Endpoint**
```
POST /api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "your-firebase-refresh-token"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "idToken": "new-firebase-id-token",
    "refreshToken": "new-firebase-refresh-token", 
    "expiresIn": "3600",
    "user": {
      "uid": "user-uid",
      "email": "user@example.com",
      "name": "User Name",
      "picture": "avatar-url",
      "emailVerified": true
    }
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid or expired refresh token",
  "error": "Authentication failed"
}
```

### **Protected Endpoint Error Response**
When ID token is expired, protected endpoints return:
```json
{
  "error": "Authentication failed",
  "code": "auth/id-token-expired",
  "action": "refresh_token",
  "message": "Token has expired. Please refresh your token and try again.",
  "timestamp": "2025-08-18T20:00:00.000Z"
}
```

## 🚀 **Frontend Implementation**

### **1. Token Storage Service**

```javascript
// services/tokenService.js
class TokenService {
  static getIdToken() {
    return localStorage.getItem('idToken');
  }

  static getRefreshToken() {
    return localStorage.getItem('refreshToken');
  }

  static setTokens(idToken, refreshToken) {
    localStorage.setItem('idToken', idToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  static clearTokens() {
    localStorage.removeItem('idToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  static setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  static getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  static isTokenExpired(token) {
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  }
}

export default TokenService;
```

### **2. Axios Configuration with Interceptors**

```javascript
// services/apiService.js
import axios from 'axios';
import TokenService from './tokenService';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Request interceptor - Add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = TokenService.getIdToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and has token expired code
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'auth/id-token-expired' &&
      error.response?.data?.action === 'refresh_token' &&
      !originalRequest._retry
    ) {
      
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = TokenService.getRefreshToken();
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Call refresh token endpoint
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken: refreshToken
        });

        const { idToken, refreshToken: newRefreshToken, user } = response.data.data;

        // Update stored tokens
        TokenService.setTokens(idToken, newRefreshToken);
        TokenService.setUser(user);

        // Update default authorization header
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${idToken}`;
        originalRequest.headers.Authorization = `Bearer ${idToken}`;

        // Process queued requests
        processQueue(null, idToken);

        // Retry original request
        return apiClient(originalRequest);

      } catch (refreshError) {
        // Refresh failed - clear tokens and redirect to login
        processQueue(refreshError, null);
        TokenService.clearTokens();
        
        // Dispatch logout event or redirect to login
        window.dispatchEvent(new CustomEvent('auth:logout'));
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other auth errors
    if (error.response?.status === 401) {
      // Token is invalid, revoked, or other auth error
      TokenService.clearTokens();
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

### **3. Auth Context/Hook Integration**

```javascript
// hooks/useAuth.js
import { createContext, useContext, useEffect, useState } from 'react';
import TokenService from '../services/tokenService';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing user on app load
    const storedUser = TokenService.getUser();
    const idToken = TokenService.getIdToken();
    
    if (storedUser && idToken && !TokenService.isTokenExpired(idToken)) {
      setUser(storedUser);
    } else {
      TokenService.clearTokens();
    }
    
    setLoading(false);

    // Listen for logout events from interceptor
    const handleLogout = () => {
      setUser(null);
      navigate('/login');
    };

    window.addEventListener('auth:logout', handleLogout);
    
    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, [navigate]);

  const login = (userData, tokens) => {
    TokenService.setTokens(tokens.idToken, tokens.refreshToken);
    TokenService.setUser(userData);
    setUser(userData);
  };

  const logout = () => {
    TokenService.clearTokens();
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      loading,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### **4. API Service Functions**

```javascript
// services/api.js
import apiClient from './apiService';

export const authAPI = {
  googleSignUp: (idToken) => 
    apiClient.post('/auth/signup/google', { idToken }),
  
  googleSignIn: (idToken) => 
    apiClient.post('/auth/signin/google', { idToken }),
  
  refreshToken: (refreshToken) => 
    apiClient.post('/auth/refresh-token', { refreshToken }),
};

export const userAPI = {
  getProfile: () => 
    apiClient.get('/user/profile'),
  
  updateProfile: (data) => 
    apiClient.put('/user/profile', data),
  
  getWatchlist: () => 
    apiClient.get('/user/watchlist'),
  
  addToWatchlist: (companyCode) => 
    apiClient.post('/user/watchlist', { companyCode }),
  
  removeFromWatchlist: (companyCode) => 
    apiClient.delete('/user/watchlist', { data: { companyCode } }),
};

export const companyAPI = {
  followCompany: (companyCode) => 
    apiClient.post('/company/follow', { companyCode }),
  
  unfollowCompany: (companyCode) => 
    apiClient.post('/company/unfollow', { companyCode }),
};
```

### **5. Usage in Components**

```javascript
// components/Dashboard.js
import React, { useEffect, useState } from 'react';
import { userAPI, companyAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const Dashboard = () => {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      const response = await userAPI.getWatchlist();
      setWatchlist(response.data.data.watchlist);
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowCompany = async (companyCode) => {
    try {
      await companyAPI.followCompany(companyCode);
      // Refresh watchlist
      loadWatchlist();
    } catch (error) {
      console.error('Failed to follow company:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <div>
        <h2>Your Watchlist</h2>
        {watchlist.map(company => (
          <div key={company}>{company}</div>
        ))}
      </div>
      <button onClick={() => handleFollowCompany('AAPL')}>
        Follow Apple
      </button>
    </div>
  );
};

export default Dashboard;
```

## 🔧 **Environment Variables**

Add to your `.env` file:
```bash
REACT_APP_API_URL=http://localhost:3001/api
```

## 🎯 **Key Features**

### ✅ **Automatic Token Refresh**
- Detects expired tokens automatically
- Refreshes tokens in background
- Retries failed requests seamlessly

### ✅ **Request Queuing**
- Prevents multiple refresh attempts
- Queues requests during refresh
- Processes all queued requests after refresh

### ✅ **Error Handling**
- Handles refresh token expiry
- Automatically logs out on auth failures
- Provides user feedback for errors

### ✅ **Security**
- Stores tokens in localStorage
- Clears tokens on logout/errors
- Validates token expiry

## 🚨 **Important Notes**

1. **Refresh Token Expiry**: Refresh tokens also expire (usually after 30 days). When this happens, users must log in again.

2. **Security**: Consider using httpOnly cookies for production instead of localStorage for better security.

3. **Network Errors**: The interceptor only handles 401 auth errors. Network errors should be handled separately.

4. **Concurrent Requests**: The queuing mechanism prevents multiple refresh attempts when multiple requests fail simultaneously.

5. **Logout Events**: The interceptor dispatches custom events for logout scenarios that your auth context can listen to.

## 🎉 **Benefits**

- **Seamless UX**: Users never see token expiry errors
- **Automatic Recovery**: Failed requests retry automatically
- **Centralized Logic**: All token management in one place
- **Production Ready**: Handles edge cases and concurrent requests

This implementation provides a robust, production-ready token refresh system that works seamlessly with your backend! 🚀