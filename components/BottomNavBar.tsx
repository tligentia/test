import React from 'react';
import type { View } from '../types';

interface BottomNavBarProps {
    activeView: View;
    setActiveView: (view: View) => void;
}

const navItems: { view: View; label: string; icon: string }[] = [
    { view: 'market', label: 'Mercado', icon: 'fa-globe' },
    { view: 'analysis', label: 'Análisis', icon: 'fa-chart-pie' },
    { view: 'charts', label: 'Gráficos', icon: 'fa-chart-line' },
    { view: 'portfolio', label: 'Cartera', icon: 'fa-wallet' },
];

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeView, setActiveView }) => {
    return (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-xl flex justify-around items-center h-14 z-50 px-2">
            {navItems.map(({ view, label, icon }) => (
                <button
                    key={view}
                    type="button"
                    title={label}
                    onClick={() => setActiveView(view)}
                    className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${
                        activeView === view ? 'text-red-700 scale-110' : 'text-gray-400 hover:text-black'
                    }`}
                    aria-current={activeView === view ? 'page' : undefined}
                >
                    <i className={`fas ${icon} text-lg`}></i>
                    <span className={`text-[8px] mt-1 font-black uppercase tracking-tighter ${activeView === view ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
                </button>
            ))}
        </nav>
    );
};