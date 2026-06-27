'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ArrowRightLeft, TrendingUp, RefreshCw } from 'lucide-react';
import CurrencySelector from './CurrencySelector';

const mockData = [
  { time: '10:00', rate: 24.51 }, { time: '11:00', rate: 24.55 },
  { time: '12:00', rate: 24.52 }, { time: '13:00', rate: 24.58 },
  { time: '14:00', rate: 24.60 }, { time: '15:00', rate: 24.59 },
  { time: '16:00', rate: 24.62 },
];

const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window === 'undefined') return 'http://localhost:3000';
  return `http://${window.location.hostname}:3000`;
};

export default function Dashboard() {
  const [base, setBase] = useState('AED');
  const [target, setTarget] = useState('INR');
  const [amount, setAmount] = useState<string>('1');
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const handleAmountChange = (val: string) => {
    if (val === '') {
      setAmount('');
      return;
    }

    // Allow digits, one decimal point, and up to 3 decimal places
    if (!/^\d*\.?\d*$/.test(val)) {
      return;
    }

    if (val.includes('.')) {
      const [integer, decimal] = val.split('.');
      if (decimal.length > 3) {
        setAmount(`${integer}.${decimal.slice(0, 3)}`);
        return;
      }
    }

    setAmount(val);
  };

  // Chart state
  const [range, setRange] = useState<'1D' | '1W' | '1M' | '1Y'>('1M');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Called on mount and whenever base/target changes — uses cache
  useEffect(() => {
    if (base === target) {
      setRate(1);
      setLastUpdated(new Date());
      return;
    }
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

  // Fetch historical data
  useEffect(() => {
    if (base === target) {
      const constantData = [];
      const now = new Date();
      const count = range === '1D' ? 24 : range === '1W' ? 7 : range === '1M' ? 30 : 365;
      for (let i = 0; i <= count; i++) {
        let timeLabel = '';
        if (range === '1D') {
          const time = new Date(now.getTime() - (count - i) * 60 * 60 * 1000);
          timeLabel = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          const date = new Date(now.getTime() - (count - i) * 24 * 60 * 60 * 1000);
          timeLabel = date.toISOString().split('T')[0];
        }
        constantData.push({ time: timeLabel, rate: 1.0 });
      }
      setHistoryData(constantData);
      return;
    }

    let cancelled = false;
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await fetch(
          `${getApiBase()}/rates/history?base=${base}&target=${target}&range=${range}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setHistoryData(data);
        }
      } catch (err) {
        console.error('Failed to load historical data:', err);
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      }
    };
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [base, target, range]);

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
      <div className="bg-white/80 dark:bg-black/20 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-gray-200 dark:border-white/10 shadow-2xl relative z-20 group transition-all duration-300">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-2xl sm:rounded-3xl blur opacity-10 group-hover:opacity-30 transition duration-1000 group-hover:duration-200 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 md:gap-8">

          <div className="flex-1 w-full space-y-2 sm:space-y-4">
            <label className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">From</label>
            <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between transition-colors focus-within:ring-2 ring-blue-500/50">
              <input
                type="number"
                step="0.001"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="bg-transparent text-2xl sm:text-3xl font-bold outline-none w-1/2 text-gray-800 dark:text-gray-100"
              />
              <CurrencySelector
                value={base}
                onChange={setBase}
                exclude={target}
                align="right"
              />
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
                {rate !== null ? ((parseFloat(amount) || 0) * rate).toFixed(3) : '...'}
              </div>
              <CurrencySelector
                value={target}
                onChange={setTarget}
                exclude={base}
                align="right"
              />
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
            </button>
          </div>
        </div>
      </div>

      {/* Chart Card */}
      <div className="bg-white/80 dark:bg-black/20 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-gray-200 dark:border-white/10 shadow-xl h-[280px] sm:h-[340px] md:h-[400px] flex flex-col justify-between relative z-10">
        <div className="flex items-center justify-between mb-3 sm:mb-6 px-1 sm:px-2">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-200">History</h3>
          <div className="flex bg-gray-100 dark:bg-gray-800/80 rounded-xl p-0.5 sm:p-1 border border-gray-200/50 dark:border-white/5 shadow-inner">
            {(['1D', '1W', '1M', '1Y'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${range === r
                  ? 'bg-blue-500 text-white shadow-md scale-105'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-white/5'
                  }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex-1 min-h-0 w-full">
          {loadingHistory && (
            <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-xs flex items-center justify-center rounded-xl z-10 transition-opacity duration-200">
              <RefreshCw className="animate-spin text-blue-500" size={32} />
            </div>
          )}
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={historyData}>
              <defs>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888830" />
              <XAxis
                dataKey="time"
                stroke="#888888"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => {
                  if (!val) return '';
                  if (val.includes('-')) {
                    const parts = val.split('-');
                    if (parts.length === 3) {
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const day = parseInt(parts[2], 10);
                      const monthIdx = parseInt(parts[1], 10) - 1;
                      return `${day} ${months[monthIdx]}`;
                    }
                  }
                  return val;
                }}
              />
              <YAxis
                domain={[
                  (dataMin: number) => dataMin * 0.998,
                  (dataMax: number) => dataMax * 1.002
                ]}
                stroke="#888888"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => val.toFixed(4)}
              />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                itemStyle={{ color: '#60a5fa' }}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                connectNulls={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
