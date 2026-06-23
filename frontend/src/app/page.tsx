import Dashboard from '@/components/Dashboard';
import Watchlist from '@/components/Watchlist';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-slate-50 selection:bg-blue-500/30">
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-blue-500/10 via-emerald-500/5 to-transparent pointer-events-none" />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <header className="mb-8 sm:mb-12 text-center md:text-left">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-3 sm:mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-emerald-400">
              Currency
            </span> Tracker
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
            Real-time exchange rates, smart alerts, and historical data all in one beautiful dashboard.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Dashboard />
          </div>
          <div className="lg:col-span-1">
            <Watchlist />
          </div>
        </div>
      </main>
    </div>
  );
}
