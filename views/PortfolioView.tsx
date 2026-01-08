
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { Portfolio, PortfolioItem, Currency, Asset, PortfolioItemWithMarketData, HistoryItem } from '../types';
import { getAssetQuote, getAssetInfo } from '../services/geminiService';
import { InputDialog } from '../components/InputDialog';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { SentimentBadge } from '../components/SentimentBadge';
import { X } from 'lucide-react';

interface PortfolioViewProps {
    portfolios: Portfolio[];
    activePortfolio: Portfolio | undefined;
    activePortfolioId: string | null;
    setActivePortfolioId: (id: string | null) => void;
    currency: Currency;
    currentEngine: string;
    onApiError: (e: unknown, title: string, message: string) => void;
    onSelectAsset: (asset: Asset) => void;
    isApiBlocked: boolean;
    assetForPortfolio: { asset: Asset; price: number | null } | null;
    onClearAssetForPortfolio: () => void;
    onNewPortfolio: (name: string) => void;
    onRenamePortfolio: (id: string, newName: string) => void;
    onDeletePortfolio: (id: string) => void;
    onAddAsset: (portfolioId: string, assetInfo: { ticker: string, name: string, type: 'stock' | 'crypto' }, quantity: number, purchasePrice: number, purchaseDate: string) => void;
    onRemoveAsset: (portfolioId: string, ticker: string) => void;
    onImportPortfolio: (items: PortfolioItem[], portfolioName: string) => void;
}

// Colores Estrictos: Negro, Rojos, Grises
const PORTFOLIO_COLORS = ['#000000', '#dc2626', '#4b5563', '#9ca3af', '#1f2937', '#7f1d1d', '#374151'];

const parseInvestingDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const cleanedStr = dateStr.replace(/"/g, '').trim();
    if (cleanedStr.includes('/')) {
        const parts = cleanedStr.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) return new Date(year, month, day).toISOString().split('T')[0];
        }
    }
    return new Date().toISOString().split('T')[0];
};

const parseInvestingNumber = (numStr: string): number => {
    if (typeof numStr !== 'string') return NaN;
    const cleanedStr = numStr.replace(/"/g, '').replace(/€|\$|£|¥|₿/g, '').trim();
    if (!cleanedStr) return NaN;
    const hasComma = cleanedStr.includes(',');
    const hasDot = cleanedStr.includes('.');
    if (hasComma && (!hasDot || cleanedStr.lastIndexOf(',') > cleanedStr.lastIndexOf('.'))) {
        return parseFloat(cleanedStr.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(cleanedStr.replace(/,/g, ''));
};

/**
 * PortfolioView component manages the display and logic for user portfolios.
 * Fixed the return type issue and the incomplete sentimentMap record.
 */
export const PortfolioView: React.FC<PortfolioViewProps> = ({
    portfolios, activePortfolio, activePortfolioId, setActivePortfolioId, currency,
    currentEngine, onApiError, onSelectAsset, isApiBlocked, assetForPortfolio,
    onClearAssetForPortfolio, onNewPortfolio, onRenamePortfolio, onDeletePortfolio,
    onAddAsset, onRemoveAsset, onImportPortfolio,
}) => {
    const [marketData, setMarketData] = useState<Record<string, number | null>>({});
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [grouping, setGrouping] = useState<'all' | 'stock' | 'crypto'>('all');
    
    // Recuperar sentimientos del historial para los badges
    const [historySentiment, setHistorySentiment] = useState<Record<string, number>>({});

    // Fix: Completed the sentimentMap Record and finished the useEffect logic
    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem('assetAnalysisHistory');
            if (savedHistory) {
                const history: HistoryItem[] = JSON.parse(savedHistory);
                const sentimentMap: Record<string, number> = {};
                history.forEach(item => {
                    sentimentMap[item.ticker] = item.sentiment;
                });
                setHistorySentiment(sentimentMap);
            }
        } catch (e) {
            console.error("Error loading history for portfolio sentiments", e);
        }
    }, []);

    // Fetch prices for active portfolio items whenever the portfolio, engine, or currency changes
    useEffect(() => {
        if (!activePortfolio || activePortfolio.items.length === 0) return;

        const fetchPrices = async () => {
            setIsLoadingPrices(true);
            const prices: Record<string, number | null> = {};
            
            try {
                await Promise.all(activePortfolio.items.map(async (item) => {
                    try {
                        const { data } = await getAssetQuote({ name: item.name, ticker: item.ticker, type: item.type }, currentEngine, currency);
                        prices[item.ticker] = data?.price ?? null;
                    } catch (e) {
                        console.error(`Failed to fetch price for ${item.ticker}`, e);
                        prices[item.ticker] = null;
                    }
                }));
                setMarketData(prices);
            } catch (e) {
                console.error("Error fetching market data for portfolio", e);
            } finally {
                setIsLoadingPrices(false);
            }
        };

        fetchPrices();
    }, [activePortfolio, currentEngine, currency]);

    // Calculate detailed market data for each portfolio item
    const portfolioWithMarketData = useMemo(() => {
        if (!activePortfolio) return [];
        return activePortfolio.items.map(item => {
            const currentPrice = marketData[item.ticker] ?? null;
            const marketValue = currentPrice !== null ? item.quantity * currentPrice : null;
            const costBasis = item.quantity * item.purchasePrice;
            const gainLoss = marketValue !== null ? marketValue - costBasis : null;
            const gainLossPercentage = costBasis > 0 && gainLoss !== null ? (gainLoss / costBasis) * 100 : null;

            return {
                ...item,
                currentPrice,
                marketValue,
                gainLoss,
                gainLossPercentage
            };
        });
    }, [activePortfolio, marketData]);

    // Aggregate totals for the portfolio
    const totalValue = portfolioWithMarketData.reduce((acc, item) => acc + (item.marketValue ?? 0), 0);
    const totalCost = portfolioWithMarketData.reduce((acc, item) => acc + (item.quantity * item.purchasePrice), 0);
    const totalGainLoss = totalValue - totalCost;
    const totalGainLossPercentage = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

    // Prepare data for the allocation chart
    const chartData = useMemo(() => {
        return portfolioWithMarketData
            .filter(item => item.marketValue !== null && item.marketValue > 0)
            .map(item => ({
                name: item.ticker,
                value: item.marketValue || 0
            }));
    }, [portfolioWithMarketData]);

    // Local state for the "Add Asset" modal flow
    const [addQuantity, setAddQuantity] = useState('1');
    const [addPrice, setAddPrice] = useState('');

    // Trigger adding modal if an asset is sent to the portfolio from external views
    useEffect(() => {
        if (assetForPortfolio) {
            setAddPrice(assetForPortfolio.price?.toString() || '');
            setIsAdding(true);
        }
    }, [assetForPortfolio]);

    const handleAddAssetConfirm = () => {
        if (assetForPortfolio && activePortfolioId) {
            const quantity = parseFloat(addQuantity);
            const price = parseFloat(addPrice);
            if (!isNaN(quantity) && !isNaN(price)) {
                onAddAsset(activePortfolioId, {
                    ticker: assetForPortfolio.asset.ticker,
                    name: assetForPortfolio.asset.name,
                    type: assetForPortfolio.asset.type
                }, quantity, price, new Date().toISOString().split('T')[0]);
                setIsAdding(false);
                onClearAssetForPortfolio();
            }
        }
    };

    // Return the actual component UI. Fix: returns valid ReactNode.
    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20 sm:pb-8">
            {/* Header & Portfolio Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center">
                        <i className="fas fa-wallet text-xl"></i>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-black">Mi Cartera</h2>
                        <select 
                            value={activePortfolioId || ''} 
                            onChange={(e) => setActivePortfolioId(e.target.value)}
                            className="text-xs font-bold uppercase tracking-widest text-gray-400 bg-transparent border-none focus:ring-0 p-0 cursor-pointer hover:text-red-700 transition-colors"
                        >
                            {portfolios.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Valor Total</p>
                    <p className="text-3xl font-black text-black tracking-tighter">
                        {totalValue.toLocaleString('es-ES', { style: 'currency', currency: currency })}
                    </p>
                    <div className={`text-[10px] font-black uppercase tracking-widest mt-1 ${totalGainLoss >= 0 ? 'text-green-600' : 'text-red-700'}`}>
                        {totalGainLoss >= 0 ? '+' : ''}{totalGainLoss.toLocaleString('es-ES', { style: 'currency', currency: currency })} ({totalGainLossPercentage.toFixed(2)}%)
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Allocation Chart */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-6 self-start">Distribución de Activos</h3>
                    {chartData.length > 0 ? (
                        <div className="w-full h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PORTFOLIO_COLORS[index % PORTFOLIO_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: '900' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-gray-300">
                            <i className="fas fa-chart-pie text-4xl mb-4 opacity-20"></i>
                            <p className="text-[10px] font-black uppercase tracking-widest">Sin datos</p>
                        </div>
                    )}
                </div>

                {/* Assets Table */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Posiciones Detalladas</h3>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setGrouping('all')}
                                className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${grouping === 'all' ? 'bg-black text-white' : 'text-gray-400 hover:text-black'}`}
                            >
                                Todos
                            </button>
                            <button 
                                onClick={() => setGrouping('stock')}
                                className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${grouping === 'stock' ? 'bg-black text-white' : 'text-gray-400 hover:text-black'}`}
                            >
                                Acciones
                            </button>
                            <button 
                                onClick={() => setGrouping('crypto')}
                                className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${grouping === 'crypto' ? 'bg-black text-white' : 'text-gray-400 hover:text-black'}`}
                            >
                                Cripto
                            </button>
                        </div>
                    </div>

                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-50">
                                <th className="pb-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Activo</th>
                                <th className="pb-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Cantidad</th>
                                <th className="pb-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Precio Actual</th>
                                <th className="pb-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Valor Mercado</th>
                                <th className="pb-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">G/P (%)</th>
                                <th className="pb-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {portfolioWithMarketData
                                .filter(item => grouping === 'all' || item.type === grouping)
                                .map(item => (
                                <tr key={item.ticker} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${item.type === 'crypto' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-black'}`}>
                                                <i className={`fas ${item.type === 'crypto' ? 'fa-bitcoin' : 'fa-building-columns'}`}></i>
                                            </div>
                                            <div>
                                                <p className="font-black uppercase tracking-tight text-sm text-black">{item.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase">{item.ticker}</span>
                                                    {historySentiment[item.ticker] !== undefined && (
                                                        <SentimentBadge score={historySentiment[item.ticker]} className="scale-75 origin-left" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 text-right">
                                        <p className="text-sm font-black text-black">{item.quantity.toLocaleString('es-ES')}</p>
                                    </td>
                                    <td className="py-4 text-right">
                                        <p className="text-sm font-black text-black">
                                            {item.currentPrice !== null 
                                                ? item.currentPrice.toLocaleString('es-ES', { style: 'currency', currency: currency })
                                                : <span className="text-gray-300 animate-pulse">...</span>
                                            }
                                        </p>
                                    </td>
                                    <td className="py-4 text-right">
                                        <p className="text-sm font-black text-black">
                                            {item.marketValue !== null 
                                                ? item.marketValue.toLocaleString('es-ES', { style: 'currency', currency: currency })
                                                : <span className="text-gray-300">...</span>
                                            }
                                        </p>
                                    </td>
                                    <td className="py-4 text-right">
                                        <div className={`text-[10px] font-black uppercase tracking-widest ${item.gainLoss && item.gainLoss >= 0 ? 'text-green-600' : 'text-red-700'}`}>
                                            {item.gainLossPercentage !== null 
                                                ? `${item.gainLossPercentage >= 0 ? '+' : ''}${item.gainLossPercentage.toFixed(2)}%`
                                                : '---'
                                            }
                                        </div>
                                    </td>
                                    <td className="py-4 text-right pr-2">
                                        <button 
                                            onClick={() => onRemoveAsset(activePortfolioId!, item.ticker)}
                                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-700 transition-all p-2"
                                            title="Eliminar de la cartera"
                                        >
                                            <i className="fas fa-trash-can fa-xs"></i>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {portfolioWithMarketData.length === 0 && (
                        <div className="py-20 text-center text-gray-300">
                            <i className="fas fa-wallet text-4xl mb-4 opacity-20"></i>
                            <p className="text-[10px] font-black uppercase tracking-widest">Cartera Vacía</p>
                            <p className="text-[9px] mt-2 italic">Añade activos desde la vista de análisis</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal for adding from assetForPortfolio (triggered from external components) */}
            {isAdding && assetForPortfolio && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-gray-900 uppercase tracking-tighter text-xl">Añadir a Cartera</h3>
                            <button 
                                onClick={() => { setIsAdding(false); onClearAssetForPortfolio(); }}
                                className="text-gray-400 hover:text-red-700"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-2xl mb-6 border border-gray-100">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Activo Detectado</p>
                            <p className="font-black text-black uppercase tracking-tight">{assetForPortfolio.asset.name} ({assetForPortfolio.asset.ticker})</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Cantidad</label>
                                <input 
                                    type="number" 
                                    value={addQuantity} 
                                    onChange={(e) => setAddQuantity(e.target.value)}
                                    className="w-full h-12 bg-white border border-gray-200 p-4 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-red-700 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Precio de Compra ({currency})</label>
                                <input 
                                    type="number" 
                                    value={addPrice} 
                                    onChange={(e) => setAddPrice(e.target.value)}
                                    className="w-full h-12 bg-white border border-gray-200 p-4 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-red-700 transition-all"
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button 
                                onClick={() => { setIsAdding(false); onClearAssetForPortfolio(); }}
                                className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleAddAssetConfirm}
                                className="flex-2 bg-black hover:bg-red-700 text-white py-4 px-8 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95"
                            >
                                Confirmar Adición
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
