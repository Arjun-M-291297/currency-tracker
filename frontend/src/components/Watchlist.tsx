'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, TrendingUp, TrendingDown, BellRing, BellOff,
  RefreshCw, AlertCircle, CheckCircle2, X
} from 'lucide-react';

const CURRENCIES = ['AED', 'USD', 'EUR', 'INR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'SGD'];

type Alert = {
  id: string;
  base: string;
  target: string;
  threshold: number;
  condition: 'above' | 'below';
  isActive: boolean;
  createdAt: string;
};

type AlertWithRate = Alert & { currentRate?: number; loading?: boolean };

function getApiBase() {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  return `http://${window.location.hostname}:3000`;
}

export default function Watchlist() {
  const [alerts, setAlerts] = useState<AlertWithRate[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    base: 'AED',
    target: 'INR',
    threshold: '',
    condition: 'above' as 'above' | 'below',
  });

  // ── Fetch current live rate for each alert ─────────────────────────
  const fetchLiveRates = async (alertList: Alert[]) => {
    const updatedRates: Record<string, number> = {};

    // Group by base to minimise API calls
    const grouped: Record<string, string[]> = {};
    for (const a of alertList) {
      if (!grouped[a.base]) grouped[a.base] = [];
      if (!grouped[a.base].includes(a.target)) grouped[a.base].push(a.target);
    }

    await Promise.all(
      Object.entries(grouped).map(async ([base, targets]) => {
        try {
          const symbols = targets.join(',');
          const res = await fetch(`${getApiBase()}/rates?base=${base}&symbols=${symbols}`);
          if (!res.ok) return;
          const data = await res.json();
          for (const t of targets) {
            if (data.rates?.[t]) {
              updatedRates[`${base}/${t}`] = data.rates[t];
            }
          }
        } catch {}
      })
    );

    setAlerts((prev) =>
      prev.map((a) => ({
        ...a,
        currentRate: updatedRates[`${a.base}/${a.target}`],
        loading: false,
      }))
    );
  };

  // ── Fetch alerts from backend ──────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${getApiBase()}/alerts/all`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Alert[] = await res.json();
      setAlerts(data.map((a) => ({ ...a, loading: true })));
      // After loading alerts, fetch live rates for each pair
      fetchLiveRates(data);
    } catch (err) {
      setError('Could not reach the backend. Is the server running?');
      console.error(err);
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initialise = async () => {
      try {
        const res = await fetch(`${getApiBase()}/alerts/all`);
        if (!res.ok || cancelled) return;
        const data: Alert[] = await res.json();
        if (cancelled) return;
        setAlerts(data.map((a) => ({ ...a, loading: true })));

        // Fetch live rates for each alert pair
        const updatedRates: Record<string, number> = {};
        const grouped: Record<string, string[]> = {};
        for (const a of data) {
          if (!grouped[a.base]) grouped[a.base] = [];
          if (!grouped[a.base].includes(a.target)) grouped[a.base].push(a.target);
        }
        await Promise.all(
          Object.entries(grouped).map(async ([base, targets]) => {
            try {
              const symbols = targets.join(',');
              const r = await fetch(`${getApiBase()}/rates?base=${base}&symbols=${symbols}`);
              if (!r.ok) return;
              const d = await r.json();
              for (const t of targets) {
                if (d.rates?.[t]) {
                  updatedRates[`${base}/${t}`] = d.rates[t];
                }
              }
            } catch { /* ignore individual rate fetch errors */ }
          })
        );

        if (!cancelled) {
          setAlerts((prev) =>
            prev.map((a) => ({
              ...a,
              currentRate: updatedRates[`${a.base}/${a.target}`],
              loading: false,
            }))
          );
        }
      } catch (err) {
        if (!cancelled) setError('Could not reach the backend. Is the server running?');
        console.error(err);
      } finally {
        if (!cancelled) setLoadingAlerts(false);
      }
    };
    initialise();
    return () => { cancelled = true; };
  }, []);

  // ── Create alert ───────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.threshold || isNaN(Number(form.threshold))) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${getApiBase()}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base: form.base,
          target: form.target,
          threshold: Number(form.threshold),
          condition: form.condition,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowModal(false);
      setForm({ base: 'AED', target: 'INR', threshold: '', condition: 'above' });
      await fetchAlerts();
    } catch (err) {
      console.error('Failed to create alert:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete alert ───────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    try {
      await fetch(`${getApiBase()}/alerts/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete alert:', err);
      fetchAlerts(); // rollback on error
    }
  };

  // ── Toggle active ──────────────────────────────────────────────────
  const handleToggle = async (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a))
    );
    try {
      await fetch(`${getApiBase()}/alerts/${id}/toggle`, { method: 'PATCH' });
    } catch {
      fetchAlerts(); // rollback
    }
  };

  const isTriggered = (a: AlertWithRate) =>
    a.currentRate !== undefined &&
    ((a.condition === 'above' && a.currentRate > a.threshold) ||
      (a.condition === 'below' && a.currentRate < a.threshold));

  return (
    <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-gray-200 dark:border-white/10 shadow-xl transition-all duration-300 hover:shadow-2xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-emerald-500">
            Watchlist & Alerts
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {alerts.filter((a) => a.isActive).length} active alert{alerts.filter((a) => a.isActive).length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-1.5 sm:gap-2">
          <button
            onClick={fetchAlerts}
            className="p-2 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors active:scale-90"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 p-2 rounded-full transition-colors active:scale-90"
            title="Add alert"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm bg-red-500/10 text-red-400 rounded-xl px-4 py-3 border border-red-500/20">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loadingAlerts && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-gray-200/30 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadingAlerts && alerts.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <BellOff size={40} className="mb-3 opacity-40" />
          <p className="font-medium">No alerts yet</p>
          <p className="text-sm mt-1">Click <span className="text-emerald-500">+</span> to create one</p>
        </div>
      )}

      {/* Alert list */}
      {!loadingAlerts && alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((item) => {
            const triggered = isTriggered(item);
            return (
              <div
                key={item.id}
                className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.01] ${
                  !item.isActive
                    ? 'opacity-50 bg-gray-50/30 border-gray-200/30 dark:bg-gray-800/10 dark:border-white/5'
                    : triggered
                    ? 'bg-emerald-50 border-emerald-500/30 dark:bg-emerald-500/10 shadow-md shadow-emerald-500/10'
                    : 'bg-gray-50/50 border-gray-200/50 dark:bg-gray-800/20 dark:border-white/5'
                }`}
              >
                {/* Left: pair + condition */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-xl ${
                      triggered && item.isActive
                        ? 'bg-emerald-500/20 text-emerald-500'
                        : 'bg-gray-200/50 dark:bg-white/10 text-gray-400'
                    }`}
                  >
                    {triggered && item.isActive ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <BellRing size={18} />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-base font-bold text-gray-800 dark:text-gray-200 truncate">
                      {item.base} → {item.target}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      {item.condition === 'above' ? (
                        <TrendingUp size={12} className="text-emerald-500" />
                      ) : (
                        <TrendingDown size={12} className="text-red-500" />
                      )}
                      Alert {item.condition} {item.threshold}
                    </span>
                  </div>
                </div>

                {/* Right: rate + actions */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="flex flex-col items-end">
                    {item.loading ? (
                      <div className="h-5 w-16 rounded bg-gray-200/50 dark:bg-white/10 animate-pulse" />
                    ) : item.currentRate !== undefined ? (
                      <>
                        <span
                          className={`text-lg font-bold ${
                            triggered && item.isActive
                              ? 'text-emerald-500'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {item.currentRate.toFixed(4)}
                        </span>
                        <span className="text-xs text-gray-400">live rate</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>

                  {/* Toggle active */}
                  <button
                    onClick={() => handleToggle(item.id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      item.isActive
                        ? 'text-blue-400 hover:bg-blue-500/10'
                        : 'text-gray-300 hover:bg-gray-400/10'
                    }`}
                    title={item.isActive ? 'Pause alert' : 'Resume alert'}
                  >
                    {item.isActive ? <BellRing size={16} /> : <BellOff size={16} />}
                  </button>

                  {/* Delete — always visible on mobile (no hover), visible on hover on desktop */}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-500/10 opacity-40 sm:opacity-0 group-hover:opacity-100 transition-all active:opacity-100 active:text-red-500"
                    title="Delete alert"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Alert Modal ─────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          {/* Panel */}
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl p-5 sm:p-8 w-full max-w-md shadow-2xl border border-gray-100 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200 mx-3 sm:mx-0">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">New Alert</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={22} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Currency pair */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                    From
                  </label>
                  <select
                    value={form.base}
                    onChange={(e) => setForm({ ...form, base: e.target.value })}
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 font-bold text-gray-800 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500/50 cursor-pointer"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                    To
                  </label>
                  <select
                    value={form.target}
                    onChange={(e) => setForm({ ...form, target: e.target.value })}
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 font-bold text-gray-800 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500/50 cursor-pointer"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Condition */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Trigger when rate is
                </label>
                <div className="flex gap-3">
                  {(['above', 'below'] as const).map((cond) => (
                    <button
                      key={cond}
                      onClick={() => setForm({ ...form, condition: cond })}
                      className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${
                        form.condition === cond
                          ? cond === 'above'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-red-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}
                    >
                      {cond === 'above' ? '↑ Above' : '↓ Below'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Threshold */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Threshold Rate
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 24.5"
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                  className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 font-bold text-gray-800 dark:text-gray-100 outline-none focus:ring-2 ring-blue-500/50 text-lg"
                />
              </div>

              <button
                onClick={handleCreate}
                disabled={submitting || !form.threshold}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-bold text-lg shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-2"
              >
                {submitting ? 'Creating…' : 'Create Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
