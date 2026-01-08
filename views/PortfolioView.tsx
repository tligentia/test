
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Portfolio, PortfolioItem, Currency, Asset, PortfolioItemWithMarketData } from '../types';
import { getAssetQuote, getAssetInfo } from '../services/geminiService';
import { InputDialog } from '../components/InputDialog';
import { ConfirmationModal } from '../components/ConfirmationModal';

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

const COLORS = ['#000000', '#dc2626', '#4b5563', '#9ca3af', '#1f2937', '#7f1d1d', '#374151'];

// --- UTILIDADES DE PARSEO ---
const parseInvestingDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const cleanedStr = dateStr.replace(/"/g, '').trim();
    if (cleanedStr.includes('/')) {
        const parts = cleanedStr.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                return new Date(year, month, day).toISOString().split('T')[0];
            }
        }
    }
    const monthMap: { [key: string]: number } = {
        'ene': 0, 'jan': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'apr': 3, 'may': 4,
        'jun': 5, 'jul': 6, 'ago': 7, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10,
        'dic': 11, 'dec': 11
    };
    const parts = cleanedStr.replace(/,/g, '').split(' ');
    if (parts.length === 3) {
        const monthStr = parts[0].toLowerCase().substring(0, 3);
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        const month = monthMap[monthStr];
        if (!isNaN(day) && !isNaN(year) && month !== undefined) {
            return new Date(year, month, day).toISOString().split('T')[0];
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

export const PortfolioView: React.FC<PortfolioViewProps> = ({
    portfolios,
    activePortfolio,
    activePortfolioId,
    setActivePortfolioId,
    currency,
    currentEngine,
    onApiError,
    onSelectAsset,
    isApiBlocked,
    assetForPortfolio,
    onClearAssetForPortfolio,
    onNewPortfolio,
    onRenamePortfolio,
    onDeletePortfolio,
    onAddAsset,
    onRemoveAsset,
    onImportPortfolio,
}) => {
    const [marketData, setMarketData] = useState<Record<string, number | null>>({});
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [grouping, setGrouping] = useState<'all' | 'stock' | 'crypto'>('all');
    
    // Import State
    const [showImport, setShowImport] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState('');
    const [importError, setImportError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Dialogs state
    const [dialogState, setDialogState] = useState<{
        type: 'new' | 'rename' | 'delete' | null;
        data?: any;
    }>({ type: null });

    // Form state
    const [ticker, setTicker] = useState('');
    const [quantity, setQuantity] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    
    const quantityInputRef = useRef<HTMLInputElement>(null);
    
    const portfolioItems = useMemo(() => activePortfolio?.items ?? [], [activePortfolio]);


    useEffect(() => {
        if (assetForPortfolio) {
            setTicker(assetForPortfolio.asset.ticker);
            setPurchasePrice(assetForPortfolio.price ? assetForPortfolio.price.toString() : '');
            setQuantity('');
            setPurchaseDate(new Date().toISOString().split('T')[0]);
            quantityInputRef.current?.focus();
            onClearAssetForPortfolio();
        }
    }, [assetForPortfolio, onClearAssetForPortfolio]);

    const fetchPrices = useCallback(async () => {
        if (portfolioItems.length === 0) return;
        setIsLoadingPrices(true);
        const prices: Record<string, number | null> = {};
        const promises = portfolioItems.map(item =>
            getAssetQuote({ name: item.name, ticker: item.ticker, type: item.type }, currentEngine, currency)
                .then(response => {
                    if (response) {
                        prices[item.ticker] = response.data?.price ?? null;
                    } else {
                        prices[item.ticker] = null;
                    }
                })
                .catch(e => {
                    console.error(`Failed to fetch price for ${item.ticker}`, e);
                    prices[item.ticker] = null;
                })
        );
        await Promise.all(promises);
        setMarketData(prices);
        setIsLoadingPrices(false);
    }, [portfolioItems, currency, currentEngine]);

    useEffect(() => {
        fetchPrices();
    }, [fetchPrices]);

    const handleAddAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        const numQuantity = parseFloat(quantity);
        const numPurchasePrice = parseFloat(purchasePrice);

        if (!ticker.trim() || !purchaseDate || isNaN(numQuantity) || numQuantity <= 0 || isNaN(numPurchasePrice) || numPurchasePrice < 0) {
            setError('Por favor, completa todos los campos con valores válidos.');
            return;
        }

        setIsAdding(true);
        setError(null);

        try {
            if (!activePortfolioId) {
                throw new Error("No hay una cartera activa seleccionada.");
            }
            const { data: assetInfo } = await getAssetInfo(ticker, currentEngine);

            if (!assetInfo || assetInfo.length === 0) {
                throw new Error(`No se encontró ningún activo con el ticker '${ticker}'.`);
            }

            const asset = assetInfo[0];
            
            onAddAsset(activePortfolioId, { ticker: asset.ticker, name: asset.name, type: asset.type }, numQuantity, numPurchasePrice, purchaseDate);

            setTicker('');
            setQuantity('');
            setPurchasePrice('');
            setPurchaseDate(new Date().toISOString().split('T')[0]);

        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Ocurrió un error al añadir el activo.';
            setError(msg);
            onApiError(err, 'Error al Añadir Activo', msg);
        } finally {
            setIsAdding(false);
        }
    };
    
    const handleRemoveAsset = (tickerToRemove: string) => {
        if (activePortfolioId) {
            onRemoveAsset(activePortfolioId, tickerToRemove);
        }
    };

    const handleNewPortfolio = () => {
        setDialogState({ type: 'new' });
    };

    const handleRenamePortfolio = () => {
        if (activePortfolio) {
            setDialogState({ type: 'rename', data: { id: activePortfolio.id, name: activePortfolio.name } });
        }
    };
    
    const handleDeletePortfolio = () => {
        if (!activePortfolio || portfolios.length <= 1) {
            alert("No puedes eliminar la última cartera.");
            return;
        }
        setDialogState({ type: 'delete', data: { id: activePortfolio.id, name: activePortfolio.name } });
    };
    
    const closeDialogs = () => {
        setDialogState({ type: null });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setImportFile(e.target.files[0]);
            setImportStatus('');
            setImportError('');
        }
    };

    const handleImportCSV = async () => {
        if (!importFile) {
            setImportError("Por favor, selecciona un archivo CSV.");
            return;
        }
        setIsImporting(true);
        setImportStatus("Leyendo archivo...");
        setImportError('');

        const parseCsvRow = (row: string): string[] => {
            const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            return values.map(value => {
                const trimmed = value.trim();
                if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
                    return trimmed.slice(1, -1).replace(/""/g, '"');
                }
                return trimmed;
            });
        };

        try {
            const csvText = await importFile.text();
            const allLines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
            if (allLines.length < 2) throw new Error("El archivo CSV está vacío o solo contiene cabeceras.");

            const headerMappings = {
                symbol: ['símbolo', 'symbol', 'ticker'],
                name: ['descripción', 'description', 'nombre', 'name'],
                quantity: ['cantidad', 'quantity', 'cant.', 'qty.'],
                price: ['precio medio apertura', 'avg. price', 'precio medio', 'avg. open price', 'average price', 'precio', 'precio entrada'],
                date: ['fecha', 'date', 'fecha apertura']
            };

            let headerRowIndex = -1;
            let headers: string[] = [];
            let bestHeaderMatch = -1; 

            for (let i = 0; i < allLines.length; i++) {
                const potentialHeadersRaw = parseCsvRow(allLines[i]);
                const potentialHeaders = potentialHeadersRaw.map(h => h.trim().toLowerCase());
                
                const hasSymbol = headerMappings.symbol.some(alias => potentialHeaders.includes(alias));
                const hasQuantity = headerMappings.quantity.some(alias => potentialHeaders.includes(alias));
                const hasDate = headerMappings.date.some(alias => potentialHeaders.includes(alias));

                if (hasSymbol && hasQuantity) {
                    if (hasDate && bestHeaderMatch < 2) { 
                        headerRowIndex = i;
                        headers = potentialHeaders;
                        bestHeaderMatch = 2;
                    } else if (!hasDate && bestHeaderMatch < 1) { 
                        headerRowIndex = i;
                        headers = potentialHeaders;
                        bestHeaderMatch = 1;
                    }
                }
            }
            
            if (headerRowIndex === -1) throw new Error("No se pudo encontrar una fila de cabeceras válida.");

            const findHeaderIndex = (aliases: string[]): number => {
                for (const alias of aliases) {
                    const index = headers.indexOf(alias);
                    if (index !== -1) return index;
                }
                return -1;
            };

            const symbolIdx = findHeaderIndex(headerMappings.symbol);
            const nameIdx = findHeaderIndex(headerMappings.name);
            const quantityIdx = findHeaderIndex(headerMappings.quantity);
            const priceIdx = findHeaderIndex(headerMappings.price);
            const dateIdx = findHeaderIndex(headerMappings.date);

            const rows = allLines.slice(headerRowIndex + 1);
            const parsedRows: any[] = [];
            
            rows.forEach((row) => {
                const values = parseCsvRow(row);
                if (values.length < headers.length * 0.7) return;

                const rowData = {
                    ticker: values[symbolIdx],
                    name: values[nameIdx],
                    quantity: parseInvestingNumber(values[quantityIdx] ?? '0'),
                    purchasePrice: parseInvestingNumber(values[priceIdx] ?? '0'),
                    purchaseDate: dateIdx !== -1 && values[dateIdx] ? parseInvestingDate(values[dateIdx]) : new Date().toISOString().split('T')[0],
                };

                if (rowData.ticker && !isNaN(rowData.quantity) && rowData.quantity > 0) {
                    parsedRows.push(rowData);
                }
            });
            
            if(parsedRows.length === 0) throw new Error("No se encontraron registros válidos.");

            setImportStatus(`Sincronizando con IA (${parsedRows.length} activos)...`);
            const uniqueTickers = [...new Set(parsedRows.map(r => r.ticker))];
            const assetTypeMap = new Map<string, 'stock' | 'crypto'>();
            
            await Promise.all(uniqueTickers.map(async (ticker) => {
                try {
                    const { data } = await getAssetInfo(String(ticker), currentEngine);
                    if (data && data.length > 0) {
                        const match = data.find(d => d.ticker.toLowerCase() === String(ticker).toLowerCase()) || data[0];
                        assetTypeMap.set(String(ticker), match.type);
                    }
                } catch (e) { console.warn(e); }
            }));

            const importedItems: PortfolioItem[] = parsedRows.map(row => {
                const type = assetTypeMap.get(row.ticker);
                if (!type) return null;
                return { ...row, type };
            }).filter((item): item is PortfolioItem => item !== null);

            if (importedItems.length > 0) {
                 onImportPortfolio(importedItems, importFile?.name.replace(/\.csv$/i, '') || 'Cartera Importada');
                 setImportStatus(`¡Éxito! ${importedItems.length} activos importados.`);
                 setImportFile(null);
                 if(fileInputRef.current) fileInputRef.current.value = "";
                 setTimeout(() => setShowImport(false), 2000);
            } else {
                throw new Error("No se pudo identificar el tipo de los activos mediante IA.");
            }

        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Error durante la importación.';
            setImportError(msg);
            onApiError(e, 'Error de Importación', msg);
        } finally {
            setIsImporting(false);
        }
    };

    const portfolioWithMarketData = useMemo((): PortfolioItemWithMarketData[] => {
        return portfolioItems.map(item => {
            const currentPrice = marketData[item.ticker] ?? null;
            const marketValue = typeof currentPrice === 'number' ? item.quantity * currentPrice : null;
            const costBasis = item.quantity * item.purchasePrice;
            const gainLoss = marketValue !== null ? marketValue - costBasis : null;
            const gainLossPercentage = gainLoss !== null && costBasis > 0 ? (gainLoss / costBasis) * 100 : null;

            return {
                ...item,
                currentPrice,
                marketValue,
                gainLoss,
                gainLossPercentage
            };
        });
    }, [portfolioItems, marketData]);

    const totals = useMemo(() => {
        const initial = { totalValue: 0, totalCost: 0, hasValue: false };
        const result = portfolioWithMarketData.reduce((acc, item) => {
            if (item.marketValue !== null) {
                acc.totalValue += item.marketValue;
                acc.totalCost += item.quantity * item.purchasePrice;
                acc.hasValue = true;
            }
            return acc;
        }, initial);
        
        if (!result.hasValue && portfolioWithMarketData.length > 0) return { totalValue: 0, totalGainLoss: 0, totalGainLossPercentage: 0 };
        if (!result.hasValue) return null;


        const totalGainLoss = result.totalValue - result.totalCost;
        const totalGainLossPercentage = result.totalCost > 0 ? (totalGainLoss / result.totalCost) * 100 : 0;
        
        return {
            totalValue: result.totalValue,
            totalGainLoss,
            totalGainLossPercentage
        };
    }, [portfolioWithMarketData]);
    
    const chartData = useMemo(() => {
        return portfolioWithMarketData
            .filter(item => item.marketValue && item.marketValue > 0)
            .map(item => ({ name: item.name, value: item.marketValue! }))
            .sort((a, b) => b.value - a.value);
    }, [portfolioWithMarketData]);

    const displayedPortfolio = useMemo(() => {
        if (grouping === 'all') {
            return portfolioWithMarketData;
        }
        return portfolioWithMarketData.filter(item => item.type === grouping);
    }, [portfolioWithMarketData, grouping]);

    const currencyFormatter = (value: number) => value.toLocaleString('es-ES', { style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const FilterButton: React.FC<{ label: string; group: 'all' | 'stock' | 'crypto' }> = ({ label, group }) => (
        <button
            onClick={() => setGrouping(group)}
            className={`px-3 py-1 text-sm font-black uppercase tracking-widest rounded-md transition ${
                grouping === group
                    ? 'bg-black text-white dark:bg-red-700 shadow-sm'
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100 dark:bg-neutral-800 dark:hover:bg-neutral-700'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-6">
             <div className="bg-white dark:bg-neutral-900 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-grow">
                    <label htmlFor="portfolio-select" className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex-shrink-0">Cartera:</label>
                    <select id="portfolio-select" value={activePortfolioId ?? ''} onChange={e => setActivePortfolioId(e.target.value)} className="h-9 w-full sm:w-auto flex-grow appearance-none rounded-xl border border-gray-100 bg-gray-50 py-1 pl-3 pr-8 text-[10px] font-black uppercase tracking-widest text-gray-700 transition focus:outline-none focus:ring-2 focus:ring-red-700 dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-200">
                        {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={handleNewPortfolio} className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-neutral-800 dark:text-gray-300 transition-all"><i className="fas fa-plus mr-1.5"></i>Nueva</button>
                    <button onClick={handleRenamePortfolio} disabled={!activePortfolio} className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-neutral-800 dark:text-gray-300 transition-all disabled:opacity-50"><i className="fas fa-pen mr-1.5"></i>Renombrar</button>
                    <button onClick={() => setShowImport(!showImport)} className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${showImport ? 'bg-black text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-neutral-800'}`}><i className="fas fa-file-import mr-1.5"></i>Importar</button>
                    <button onClick={handleDeletePortfolio} disabled={!activePortfolio || portfolios.length <= 1} className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl text-red-700 bg-red-50 hover:bg-red-100 transition-all disabled:opacity-50"><i className="fas fa-trash-alt mr-1.5"></i>Eliminar</button>
                </div>
            </div>

            {showImport && (
                 <div className="bg-gray-50 dark:bg-neutral-950 p-6 rounded-3xl border border-gray-100 dark:border-neutral-800 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                             <h4 className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white">Importar Cartera desde Investing.com</h4>
                             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Sube un archivo CSV para añadir activos automáticamente</p>
                        </div>
                        <button onClick={() => setShowImport(false)} className="text-gray-300 hover:text-red-700"><i className="fas fa-times"></i></button>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                         <div className="flex-1 w-full">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                ref={fileInputRef}
                                className="block w-full text-[10px] font-black uppercase tracking-widest text-gray-400
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-xl file:border-0
                                file:text-[9px] file:font-black file:uppercase file:tracking-widest
                                file:bg-black file:text-white
                                hover:file:bg-red-700
                                file:cursor-pointer"
                                disabled={isImporting}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleImportCSV}
                            disabled={!importFile || isImporting || isApiBlocked}
                            className="h-10 px-8 bg-red-700 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-red-800 transition-all active:scale-95 disabled:bg-gray-200 flex items-center justify-center gap-3"
                        >
                            {isImporting ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> : "Sincronizar Cartera"}
                        </button>
                    </div>
                     {importStatus && <p className="text-[9px] font-black uppercase tracking-widest text-green-600 mt-3">{importStatus}</p>}
                     {importError && <p className="text-[9px] font-black uppercase tracking-widest text-red-600 mt-3">{importError}</p>}
                </div>
            )}

            {totals && (
                <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-neutral-800">
                    <div className="flex justify-between items-center mb-8 flex-wrap gap-y-2">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">Resumen Estratégico</h3>
                        <button
                            type="button"
                            onClick={fetchPrices}
                            disabled={isLoadingPrices || isApiBlocked || portfolioItems.length === 0}
                            className="px-4 py-2 bg-gray-50 text-gray-400 hover:text-black dark:bg-neutral-800 dark:text-gray-500 dark:hover:text-white transition-all text-[9px] font-black uppercase tracking-widest rounded-xl flex items-center gap-3 disabled:opacity-30"
                        >
                            {isLoadingPrices ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                    <span>Actualizando Mercado</span>
                                </>
                            ) : (
                                <><i className="fas fa-sync-alt"></i><span>Actualizar Cotizaciones</span></>
                            )}
                        </button>
                    </div>
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
                        <div className="space-y-8 lg:col-span-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Valor Total Cartera</p>
                                    <p className="text-4xl font-black text-black dark:text-white tracking-tighter">{currencyFormatter(totals.totalValue)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Ganancia/Pérdida Bruta</p>
                                    <p className={`text-3xl font-black tracking-tighter ${totals.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-700'}`}>{currencyFormatter(totals.totalGainLoss)}</p>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-baseline mb-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Rendimiento Histórico</p>
                                    <p className={`text-xl font-black tracking-tighter ${totals.totalGainLossPercentage >= 0 ? 'text-green-600' : 'text-red-700'}`}>{totals.totalGainLossPercentage.toFixed(2)}%</p>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-neutral-800 rounded-full h-3 overflow-hidden">
                                    <div 
                                        className={`${totals.totalGainLossPercentage >= 0 ? 'bg-green-600' : 'bg-red-700'} h-full transition-all duration-700`}
                                        style={{ width: `${Math.min(Math.abs(totals.totalGainLossPercentage), 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                        <div className="h-64 w-full lg:col-span-1">
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                        nameKey="name"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => [currencyFormatter(value), '']}
                                        contentStyle={{ backgroundColor: '#000', border: 'none', borderRadius: '12px', fontSize: '10px', fontWeight: '900', color: '#fff' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
             <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-neutral-800">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 mb-6">Terminal de Adquisición</h3>
                <form onSubmit={handleAddAsset} className="grid grid-cols-1 sm:grid-cols-5 gap-6 items-end">
                    <div className="sm:col-span-1">
                        <label htmlFor="ticker" className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">Símbolo</label>
                        <input id="ticker" type="text" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="AAPL, BTC..." className="w-full h-11 px-4 text-[10px] font-black uppercase tracking-widest border border-gray-100 rounded-xl bg-gray-50 focus:ring-2 focus:ring-red-700 focus:outline-none dark:bg-neutral-800 dark:border-neutral-700" />
                    </div>
                     <div className="sm:col-span-1">
                        <label htmlFor="quantity" className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">Cantidad</label>
                        <input id="quantity" ref={quantityInputRef} type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.00" className="w-full h-11 px-4 text-[10px] font-black uppercase tracking-widest border border-gray-100 rounded-xl bg-gray-50 focus:ring-2 focus:ring-red-700 focus:outline-none dark:bg-neutral-800 dark:border-neutral-700" />
                    </div>
                    <div className="sm:col-span-1">
                        <label htmlFor="purchasePrice" className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">{`Precio Entrada (${currency})`}</label>
                        <input id="purchasePrice" type="number" step="any" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="0.00" className="w-full h-11 px-4 text-[10px] font-black uppercase tracking-widest border border-gray-100 rounded-xl bg-gray-50 focus:ring-2 focus:ring-red-700 focus:outline-none dark:bg-neutral-800 dark:border-neutral-700" />
                    </div>
                     <div className="sm:col-span-1">
                        <label htmlFor="purchaseDate" className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">Fecha</label>
                        <input id="purchaseDate" type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="w-full h-11 px-4 text-[10px] font-black uppercase tracking-widest border border-gray-100 rounded-xl bg-gray-50 focus:ring-2 focus:ring-red-700 focus:outline-none dark:bg-neutral-800 dark:border-neutral-700" />
                    </div>
                    <button type="submit" disabled={isAdding || isApiBlocked} className="w-full h-11 bg-black text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-xl hover:bg-red-700 transition-all active:scale-95 disabled:bg-gray-200">
                         {isAdding ? <i className="fas fa-spinner fa-spin"></i> : "Registrar Activo"}
                    </button>
                </form>
                 {error && <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-red-700 text-center">{error}</p>}
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-4 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mr-2">Filtrar por categoría:</span>
                    <FilterButton label="Todos" group="all" />
                    <FilterButton label="Acciones" group="stock" />
                    <FilterButton label="Cripto" group="crypto" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-neutral-800/50 text-[9px] text-gray-400 font-black uppercase tracking-[0.2em]">
                            <tr>
                                <th scope="col" className="px-6 py-4">Activo</th>
                                <th scope="col" className="px-6 py-4 text-right">Cant.</th>
                                <th scope="col" className="px-6 py-4 text-right">Entrada</th>
                                <th scope="col" className="px-6 py-4 text-right">Actual</th>
                                <th scope="col" className="px-6 py-4 text-right">Valor Mercado</th>
                                <th scope="col" className="px-6 py-4 text-right">G/P Abs.</th>
                                <th scope="col" className="px-6 py-4 text-right">% G/P</th>
                                <th scope="col" className="px-6 py-4 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                            {displayedPortfolio.map(item => (
                                 <tr key={item.ticker} className="hover:bg-gray-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <button onClick={() => onSelectAsset(item)} className="group text-left" title={`Analizar ${item.name}`}>
                                            <p className="text-xs font-black uppercase tracking-tight text-gray-900 dark:text-white group-hover:text-red-700 transition-colors">{item.name}</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{item.ticker}</p>
                                        </button>
                                    </td>
                                    <td className="px-6 py-5 text-right text-[11px] font-black tracking-tighter">{item.quantity}</td>
                                    <td className="px-6 py-5 text-right text-[11px] font-black tracking-tighter">{currencyFormatter(item.purchasePrice)}</td>
                                    <td className="px-6 py-5 text-right text-[11px] font-black tracking-tighter">
                                         {item.currentPrice !== null ? currencyFormatter(item.currentPrice) : <span className="text-gray-300 animate-pulse">...</span>}
                                    </td>
                                    <td className="px-6 py-5 text-right text-xs font-black tracking-tighter">
                                         {item.marketValue !== null ? currencyFormatter(item.marketValue) : <span className="text-gray-200">...</span>}
                                    </td>
                                     <td className={`px-6 py-5 text-right text-[11px] font-black tracking-tighter ${item.gainLoss === null ? '' : item.gainLoss >= 0 ? 'text-green-600' : 'text-red-700'}`}>
                                        {item.gainLoss !== null ? currencyFormatter(item.gainLoss) : <span className="text-gray-200">...</span>}
                                    </td>
                                     <td className={`px-6 py-5 text-right text-[11px] font-black tracking-tighter ${item.gainLossPercentage === null ? '' : item.gainLossPercentage >= 0 ? 'text-green-600' : 'text-red-700'}`}>
                                        {item.gainLossPercentage !== null ? `${item.gainLossPercentage.toFixed(2)}%` : <span className="text-gray-200">...</span>}
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <button onClick={() => handleRemoveAsset(item.ticker)} className="w-8 h-8 rounded-full text-gray-300 hover:bg-red-50 hover:text-red-700 transition-all" title="Eliminar activo">
                                            <i className="fas fa-trash-can text-xs"></i>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {portfolioItems.length === 0 && (
                    <div className="text-center py-20">
                         <i className="fas fa-wallet text-4xl text-gray-100 mb-4"></i>
                         <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">La terminal está vacía. Inicia un registro o importa un archivo.</p>
                    </div>
                )}
            </div>
            <InputDialog
                isOpen={dialogState.type === 'new' || dialogState.type === 'rename'}
                title={dialogState.type === 'new' ? 'Nueva Cartera' : 'Renombrar Cartera'}
                label="Nombre de la cartera"
                initialValue={dialogState.type === 'rename' ? dialogState.data?.name : `Cartera ${portfolios.length + 1}`}
                confirmText={dialogState.type === 'new' ? 'Crear' : 'Renombrar'}
                onConfirm={(name) => {
                    if (dialogState.type === 'new') {
                        onNewPortfolio(name);
                    } else if (dialogState.type === 'rename' && dialogState.data) {
                        onRenamePortfolio(dialogState.data.id, name);
                    }
                    closeDialogs();
                }}
                onClose={closeDialogs}
            />
            <ConfirmationModal
                isOpen={dialogState.type === 'delete'}
                title="Eliminar Cartera"
                message={`¿Estás seguro de que quieres eliminar la cartera "${dialogState.data?.name}"? Esta acción es irreversible.`}
                onConfirm={() => {
                    if (dialogState.type === 'delete' && dialogState.data) {
                        onDeletePortfolio(dialogState.data.id);
                    }
                    closeDialogs();
                }}
                onClose={closeDialogs}
                confirmText="Eliminar"
            />
        </div>
    );
};
