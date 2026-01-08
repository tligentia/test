
import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, Sparkles, HelpCircle, AlertCircle, CheckCircle2, X, ChevronDown, Coins, Check } from 'lucide-react';
import { COLORS, CURRENCIES } from './Parameters';
import { Footer } from './Footer';
import { Cookies } from './Cookies';
import { Ajustes } from './Ajustes';
import { Manual } from './Manual';
import { AppMenu } from './AppMenu';
import { Currency } from '../types';

interface ShellProps {
  children: React.ReactNode;
  userIp: string | null;
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  rates: Record<Currency, number>;
  // Added missing props to fix TS error
  apiKey: string;
  onApiKeySave: (key: string) => void;
}

export const Shell: React.FC<ShellProps> = ({ 
  children, 
  userIp, 
  currency,
  onCurrencyChange,
  rates,
  // Destructured missing props
  apiKey,
  onApiKeySave
}) => {
  const [showAjustes, setShowAjustes] = useState(false);
  const [showCookies, setShowCookies] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const currencyMenuRef = useRef<HTMLDivElement>(null);

  // Close currency menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (currencyMenuRef.current && !currencyMenuRef.current.contains(event.target as Node)) {
        setIsCurrencyMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`min-h-screen ${COLORS.bg} font-sans flex flex-col p-4 md:p-8`}>
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white mb-8 border-b border-gray-200 pb-6 pt-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-gray-900 flex items-center gap-2">
            <BarChart3 className="text-red-700" size={32} />
            Cripto <span className="text-red-700">GO</span>
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center">
                <span className="flex items-center gap-1 text-[9px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded-md border border-green-100">
                  <CheckCircle2 size={10} /> AI ONLINE
                </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowManual(true)}
            className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-900 px-4 py-2 rounded-xl transition-all active:scale-95 group shadow-sm"
          >
            <HelpCircle size={18} className="text-red-700 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Manual</span>
          </button>

          {/* Selector Global de Moneda (Vertical Dropdown) */}
          <div className="relative" ref={currencyMenuRef}>
              <button
                  onClick={() => setIsCurrencyMenuOpen(!isCurrencyMenuOpen)}
                  className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm hover:border-red-700 transition-all group h-[42px]"
              >
                  <div className="flex items-center gap-2">
                      <span className="text-red-700 font-black text-sm">{CURRENCIES[currency]?.symbol || '$'}</span>
                      <span className="text-[11px] font-black uppercase tracking-widest text-gray-900">{currency}</span>
                  </div>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform duration-300 ${isCurrencyMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCurrencyMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-100 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ring-1 ring-black/5">
                      <div className="p-3 bg-gray-50/50 border-b border-gray-100">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                              <Coins size={12} className="text-red-700" /> Monitor de Divisas
                          </h4>
                      </div>
                      <div className="p-1.5 flex flex-col">
                          {Object.values(CURRENCIES).map((curr) => {
                              const rateValue = rates[curr.code] || 1;
                              const isSelected = currency === curr.code;
                              return (
                                  <button
                                      key={curr.code}
                                      onClick={() => {
                                          onCurrencyChange(curr.code);
                                          setIsCurrencyMenuOpen(false);
                                      }}
                                      className={`flex items-center justify-between p-3 rounded-xl transition-all ${isSelected ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                                  >
                                      <div className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${isSelected ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                              {curr.symbol}
                                          </div>
                                          <div className="text-left">
                                              <div className="flex items-center gap-1.5">
                                                  <span className={`text-[11px] font-black uppercase tracking-wider ${isSelected ? 'text-red-700' : 'text-gray-900'}`}>{curr.code}</span>
                                                  <span className="text-[9px] font-bold text-gray-400 uppercase">{curr.name}</span>
                                              </div>
                                              <div className="text-[9px] font-mono text-gray-400 mt-0.5">
                                                  1 USD = {rateValue.toLocaleString(undefined, { maximumFractionDigits: curr.isCrypto ? 8 : 4 })} {curr.code}
                                              </div>
                                          </div>
                                      </div>
                                      {isSelected && <Check size={14} className="text-red-700" />}
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              )}
          </div>

          <AppMenu />
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 max-w-7xl mx-auto w-full">{children}</main>

      {/* FOOTER */}
      <Footer 
        userIp={userIp} 
        onShowCookies={() => setShowCookies(true)} 
        onShowAjustes={() => setShowAjustes(true)} 
      />

      {/* MODAL AJUSTES (API, IPs, RESET) */}
      <Ajustes 
        isOpen={showAjustes} 
        onClose={() => setShowAjustes(false)} 
        userIp={userIp}
        // Passed required props to fix TS error
        apiKey={apiKey}
        onApiKeySave={onApiKeySave}
      />

      {/* MODAL PRIVACIDAD Y COOKIES */}
      <Cookies isOpen={showCookies} onClose={() => setShowCookies(false)} />

      {/* MODAL MANUAL DE AYUDA */}
      <Manual isOpen={showManual} onClose={() => setShowManual(false)} />
    </div>
  );
};
