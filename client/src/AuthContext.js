import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect } from 'react';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const stored = localStorage.getItem('shiftsync_token');
        if (stored) {
            fetch('/api/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                if (data?.user) {
                    setToken(stored);
                    setUser(data.user);
                }
                else {
                    console.warn('Stored token invalid or expired, clearing session.');
                    localStorage.removeItem('shiftsync_token');
                }
            })
                .catch(() => {
                console.warn('Failed to validate stored token, clearing session.');
                localStorage.removeItem('shiftsync_token');
            })
                .finally(() => setLoading(false));
        }
        else {
            setLoading(false);
        }
    }, []);
    const login = async (username, password) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Login failed' }));
            throw new Error(err.error || 'Login failed');
        }
        const data = await res.json();
        localStorage.setItem('shiftsync_token', data.token);
        setToken(data.token);
        setUser(data.user);
    };
    const loginWithToken = async (jwtToken) => {
        const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${jwtToken}` },
        });
        if (!res.ok)
            throw new Error('Invalid token');
        const data = await res.json();
        localStorage.setItem('shiftsync_token', jwtToken);
        setToken(jwtToken);
        setUser(data.user);
    };
    const register = async (employeeName, username, password) => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeName, username, password }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Registration failed' }));
            throw new Error(err.error || 'Registration failed');
        }
        const data = await res.json();
        localStorage.setItem('shiftsync_token', data.token);
        setToken(data.token);
        setUser(data.user);
    };
    const logout = () => {
        localStorage.removeItem('shiftsync_token');
        setToken(null);
        setUser(null);
    };
    return (_jsx(AuthContext.Provider, { value: { user, token, login, loginWithToken, register, logout, loading }, children: children }));
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
