import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { loginUser, registerUser, getMe } from '../services/api';
import { io } from 'socket.io-client';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const socketRef = useRef(null);

    // Register user with socket for online tracking
    const registerSocket = (userData) => {
        if (!userData) return;
        if (!socketRef.current) {
            socketRef.current = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
        }
        socketRef.current.emit('register-user', { userId: userData._id, role: userData.role });
    };

    useEffect(() => {
        const token = localStorage.getItem('prism_token');
        if (token) {
            getMe()
                .then((res) => {
                    setUser(res.data.user);
                    registerSocket(res.data.user);
                })
                .catch(() => localStorage.removeItem('prism_token'))
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
        return () => { if (socketRef.current) socketRef.current.disconnect(); };
    }, []);

    const login = async (email, password) => {
        try {
            setError('');
            const res = await loginUser({ email, password });
            localStorage.setItem('prism_token', res.data.token);
            setUser(res.data.user);
            registerSocket(res.data.user);
            return res.data;
        } catch (err) {
            const msg = err.response?.data?.message || 'Login failed';
            setError(msg);
            throw new Error(msg);
        }
    };

    const register = async (data) => {
        try {
            setError('');
            const res = await registerUser(data);
            localStorage.setItem('prism_token', res.data.token);
            setUser(res.data.user);
            registerSocket(res.data.user);
            return res.data;
        } catch (err) {
            const msg = err.response?.data?.message || 'Registration failed';
            setError(msg);
            throw new Error(msg);
        }
    };

    const logout = () => {
        localStorage.removeItem('prism_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
