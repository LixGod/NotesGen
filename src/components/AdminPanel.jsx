import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Database, LogOut, Search, Clock, User, Mail, MessageSquare } from 'lucide-react';

const AdminPanel = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [inputs, setInputs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();
            if (data.success) {
                setIsLoggedIn(true);
                fetchInputs();
            } else {
                setError(data.message || 'Invalid credentials');
            }
        } catch (err) {
            setError('Could not connect to server');
        } finally {
            setLoading(false);
        }
    };

    const fetchInputs = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/inputs');
            const data = await response.json();
            setInputs(data);
        } catch (err) {
            console.error('Error fetching inputs:', err);
        }
    };

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4 font-['Outfit']">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl"
                >
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-4">
                            <LogIn className="w-8 h-8 text-indigo-400" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">Admin Portal</h2>
                        <p className="text-white/40">Secure access to user submissions</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-sm text-white/60 mb-2 ml-1">Email Address</label>
                            <input 
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                placeholder="admin@example.com"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-white/60 mb-2 ml-1">Password</label>
                            <input 
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                                >
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Sign In'}
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 font-['Outfit']">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                            <Database className="w-10 h-10 text-indigo-500" />
                            Data Dashboard
                        </h1>
                        <p className="text-white/40">Managing {inputs.length} user submissions</p>
                    </div>
                    <button 
                        onClick={() => setIsLoggedIn(false)}
                        className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center gap-2 w-fit"
                    >
                        <LogOut className="w-5 h-5" />
                        Log Out
                    </button>
                </header>

                <div className="grid grid-cols-1 gap-6">
                    <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/2">
                                        <th className="px-8 py-6 text-sm font-semibold text-white/60">User Details</th>
                                        <th className="px-8 py-6 text-sm font-semibold text-white/60">Message</th>
                                        <th className="px-8 py-6 text-sm font-semibold text-white/60 text-right">Date Submitted</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inputs.map((input, idx) => (
                                        <motion.tr 
                                            key={input.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="border-b border-white/5 hover:bg-white/[0.02] transition-all"
                                        >
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                                        <User className="w-5 h-5 text-indigo-400" />
                                                    </div>
                                                    <div>
                                                        <div className="text-white font-medium">{input.user_name || 'Anonymous'}</div>
                                                        <div className="text-white/40 text-sm flex items-center gap-1">
                                                            <Mail className="w-3 h-3" />
                                                            {input.user_email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="max-w-md">
                                                    <div className="text-white/80 line-clamp-2 flex items-start gap-2">
                                                        <MessageSquare className="w-4 h-4 text-white/20 shrink-0 mt-1" />
                                                        {input.message}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="text-white/40 text-sm flex items-center justify-end gap-2">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(input.created_at).toLocaleDateString(undefined, { 
                                                        month: 'short', 
                                                        day: 'numeric', 
                                                        hour: '2-digit', 
                                                        minute: '2-digit' 
                                                    })}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                    {inputs.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="px-8 py-20 text-center text-white/20 italic">
                                                No submissions found yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
