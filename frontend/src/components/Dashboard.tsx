'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ArrowRightLeft, TrendingUp, RefreshCw } from 'lucide-react';

const mockData = [
  { time: '10:00', rate: 24.51 }, { time: '11:00', rate: 24.55 },
  { time: '12:00', rate: 24.52 }, { time: '13:00', rate: 24.58 },
  { time: '14:00', rate: 24.60 }, { time: '15:00', rate: 24.59 },
  { time: '16:00', rate: 24.62 },
];

const getApiBase = () => `http://${window.location.hostname}:3000`;

export default function Dashboard() {
  const [base, setBase] = useState('AED');
  const [target, setTarget] = useState('INR');
  const [amount, setAmount] = useState<number>(1);
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Called on mount and whenever base/target changes — uses cache
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${getApiBase()}/rates?base=${base}&symbols=${target}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.rates?.[target]) {
          setRate(data.rates[target]);
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error('Failed to load rate:', err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [base, target]);

  // Called only when user clicks Refresh — always busts cache
  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/rates/refresh?base=${base}&symbols=${target}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.rates?.[target]) {
        setRate(data.rates[target]);
        setLastUpdated(data.refreshedAt ? new Date(data.refreshedAt) : new Date());
      }
    } catch (err) {
      console.error('Failed to refresh rate:', err);
    } finally {
      setLoading(false);
    }
  };

  const switchCurrencies = () => {
    setBase(target);
    setTarget(base);
  };

  const formatLastUpdated = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Exchange Card */}
      <div className="bg-white/80 dark:bg-black/20 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-gray-200 dark:border-white/10 shadow-2xl relative overflow-hidden group transition-all duration-300">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-2xl sm:rounded-3xl blur opacity-10 group-hover:opacity-30 transition duration-1000 group-hover:duration-200 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 md:gap-8">
          
          <div className="flex-1 w-full space-y-2 sm:space-y-4">
            <label className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">From</label>
            <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between transition-colors focus-within:ring-2 ring-blue-500/50">
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="bg-transparent text-2xl sm:text-3xl font-bold outline-none w-1/2 text-gray-800 dark:text-gray-100" 
              />
              <select 
                value={base} 
                onChange={(e) => setBase(e.target.value)}
                className="bg-transparent text-lg sm:text-xl font-bold outline-none cursor-pointer text-gray-700 dark:text-gray-200 py-1"
              >
                <option value="AED">AED</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="INR">INR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
          </div>

          <button onClick={switchCurrencies} className="p-2 sm:p-3 md:p-4 bg-blue-50 dark:bg-blue-500/10 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-full transition-transform hover:scale-110 active:scale-95 shadow-sm -my-2 md:my-0">
            <ArrowRightLeft size={20} className="sm:hidden" />
            <ArrowRightLeft size={24} className="hidden sm:block md:hidden" />
            <ArrowRightLeft size={28} className="hidden md:block" />
          </button>

          <div className="flex-1 w-full space-y-2 sm:space-y-4">
            <label className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">To</label>
            <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between">
              <div className={`text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 truncate w-1/2 transition-opacity duration-200 ${loading ? 'opacity-40' : 'opacity-100'}`}>
                {rate !== null ? (amount * rate).toFixed(4) : '...'}
              </div>
              <select 
                value={target} 
                onChange={(e) => setTarget(e.target.value)}
                className="bg-transparent text-lg sm:text-xl font-bold outline-none cursor-pointer text-gray-700 dark:text-gray-200 py-1"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer row: mid-market rate + refresh */}
        <div className="mt-4 sm:mt-6 md:mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 py-1.5 sm:py-2 px-3 sm:px-4 rounded-full whitespace-nowrap">
            <TrendingUp size={14} className="sm:hidden" />
            <TrendingUp size={16} className="hidden sm:block" />
            <span className="truncate max-w-[260px] sm:max-w-none">
              Mid-market: 1 {base} = {rate !== null ? rate : '...'} {target}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            {lastUpdated && (
              <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                Updated {formatLastUpdated(lastUpdated)}
              </span>
            )}
            <button
              id="refresh-rate-btn"
              onClick={handleRefresh}
              disabled={loading}
              title="Fetch live rate from API (bypasses cache)"
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold"
            >
              <RefreshCw
                size={13}
                className={`sm:hidden ${loading ? 'animate-spin' : ''}`}
              />
              <RefreshCw
                size={15}
                className={`hidden sm:block ${loading ? 'animate-spin' : ''}`}
              />
              <span className="hidden xs:inline">{loading ? 'Live…' : 'Refresh'}</span>
              <span className="xs:hidden">{loading ? '…' : '↻'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chart Card */}
      <div className="bg-white/80 dark:bg-black/20 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-gray-200 dark:border-white/10 shadow-xl h-[280px] sm:h-[340px] md:h-[400px]">
        <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-6 text-gray-800 dark:text-gray-200 px-1 sm:px-2">24h History</h3>
        <ResponsiveContainer width="100%" height="80%">
          <LineChart data={mockData}>
            <defs>
              <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888830" />
            <XAxis dataKey="time" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis domain={['dataMin - 0.05', 'dataMax + 0.05']} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val.toFixed(2)} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
              itemStyle={{ color: '#60a5fa' }}
            />
            <Line 
              type="monotone" 
              dataKey="rate" 
              stroke="#3b82f6" 
              strokeWidth={4} 
              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
              activeDot={{ r: 8, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
