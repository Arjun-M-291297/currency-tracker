'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export const CURRENCY_DETAILS: Record<string, { name: string; symbol: string; color: string }> = {
  AED: { name: 'UAE Dirham', symbol: 'د.إ', color: 'from-emerald-500 to-teal-600' },
  USD: { name: 'US Dollar', symbol: '$', color: 'from-blue-500 to-indigo-600' },
  EUR: { name: 'Euro', symbol: '€', color: 'from-violet-500 to-indigo-600' },
  INR: { name: 'Indian Rupee', symbol: '₹', color: 'from-orange-400 to-amber-500' },
  GBP: { name: 'British Pound', symbol: '£', color: 'from-purple-500 to-pink-600' },
  JPY: { name: 'Japanese Yen', symbol: '¥', color: 'from-red-500 to-rose-600' },
  CAD: { name: 'Canadian Dollar', symbol: 'C$', color: 'from-cyan-500 to-blue-600' },
  AUD: { name: 'Australian Dollar', symbol: 'A$', color: 'from-teal-500 to-emerald-600' },
  CHF: { name: 'Swiss Franc', symbol: 'CHF', color: 'from-pink-500 to-rose-600' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', color: 'from-yellow-400 to-orange-500' },
};

interface CurrencySelectorProps {
  value: string;
  onChange: (value: string) => void;
  exclude?: string;
  currencies?: string[];
  align?: 'left' | 'right';
  wFull?: boolean;
}

export default function CurrencySelector({
  value,
  onChange,
  exclude,
  currencies = ['AED', 'USD', 'EUR', 'INR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'SGD'],
  align = 'left',
  wFull = false,
}: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedDetails = CURRENCY_DETAILS[value] || { name: value, symbol: '', color: 'from-gray-500 to-gray-600' };
  const filteredCurrencies = currencies.filter((c) => c !== exclude);

  return (
    <div ref={containerRef} className={`relative ${wFull ? 'w-full' : 'inline-block'} text-left`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-3 py-1.5 sm:px-4 sm:py-2.5 bg-white/40 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-xl sm:rounded-2xl text-gray-800 dark:text-gray-100 hover:bg-white/80 dark:hover:bg-white/10 active:scale-95 transition-all duration-200 shadow-sm outline-none font-bold text-base sm:text-lg cursor-pointer ${
          wFull ? 'w-full justify-between' : ''
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs text-white font-extrabold bg-gradient-to-br ${selectedDetails.color} shadow-sm`}>
            {selectedDetails.symbol}
          </span>
          <span className="tracking-wider">{value}</span>
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-2 ${wFull ? 'w-full' : 'w-48 sm:w-52'} max-h-72 overflow-y-auto rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10`}
        >
          {filteredCurrencies.map((code) => {
            const details = CURRENCY_DETAILS[code] || { name: code, symbol: '', color: 'from-gray-500 to-gray-600' };
            const isSelected = value === code;

            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  onChange(code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm text-white font-extrabold bg-gradient-to-br ${details.color} flex-shrink-0 shadow-sm`}>
                    {details.symbol}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold tracking-wider leading-none mb-0.5">{code}</span>
                    <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 truncate leading-none">{details.name}</span>
                  </div>
                </div>
                {isSelected && <Check size={16} className="text-blue-500 dark:text-blue-400 flex-shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
