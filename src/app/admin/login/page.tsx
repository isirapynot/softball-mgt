'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, type: 'admin' }),
    });
    setLoading(false);
    if (res.ok) {
      router.push('/admin/roster');
      router.refresh();
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Admin Access</h1>
        <p className="text-sm text-gray-500 mb-6">Enter your admin PIN to manage the roster and schedule.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="••••••"
              autoFocus
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !pin}
            className="w-full bg-green-700 text-white py-2 rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
