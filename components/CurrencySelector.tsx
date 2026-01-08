import React, { useState, useRef, useEffect } from 'react';
import type { Currency } from '../types';
import { CONVERSION_RATES } from '../constants';

interface CurrencySelectorProps {
    currency: Currency;
    setCurrency: (currency: Currency) => void;
}

const currencies: { value: Currency; label: string }[] = [
    { value: 'EUR', label: '€ EUR' },
    { value: 'USD', label: '$ USD' },
    { value: 'GBP', label: '£ GBP' },
    { value: 'JPY', label: '¥ JPY' },
    { value: 'BTC', label: '₿ BTC' },
];

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({ currency, setCurrency }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Cierra el dropdown si se hace clic fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = currencies.find(c => c.value === currency)?.label || currency;

    // Use a unique ID based on a key for refresh purposes if rates change (though standard React re-render handles values)
    const rateKey = JSON.stringify(CONVERSION_RATES);

    return (
        <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="h-11 w-32 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-slate-800 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200 dark:focus:ring-slate-200 flex items-center justify-between"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                title={`Divisa actual: ${selectedLabel}. 1 USD = ${CONVERSION_RATES[currency]?.toFixed(6)} ${currency}`}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <i className="fas fa-coins text-slate-400"></i>
                    <span className="truncate">{selectedLabel}</span>
                </div>
                <i className={`fas fa-chevron-down text-slate-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}></i>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-1" role="listbox">
                        {currencies.map(({ value, label }) => {
                            const rate = CONVERSION_RATES[value] ?? 1;
                            const isSelected = value === currency;
                            const displayPrecision = value === 'BTC' ? 8 : 6;
                            
                            return (
                                <button
                                    key={`${value}-${rateKey}`}
                                    type="button"
                                    onClick={() => {
                                        setCurrency(value);
                                        setIsOpen(false);
                                    }}
                                    className={`group w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors ${
                                        isSelected 
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold' 
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                    role="option"
                                    aria-selected={isSelected}
                                    title={`Tipo de cambio actual: 1 USD = ${rate.toFixed(displayPrecision)} ${value}`}
                                >
                                    <span>{label}</span>
                                    {/* Muestra la tasa con mayor precisión y siempre visible */}
                                    <span className="text-[10px] font-mono text-slate-400 group-hover:text-red-700 transition-colors">
                                        {rate.toFixed(displayPrecision)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 text-[9px] text-slate-400 text-center border-t border-slate-100 dark:border-slate-800">
                        Tasas base USD (Actualizadas vía IA)
                    </div>
                </div>
            )}
        </div>
    );
};