
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SearchBar } from './components/SearchBar';
import { getAssetInfo, getAvailableTextModels, updateExchangeRates } from './services/geminiService';
import { HistoryItem, AppError, QuotaExceededError, Asset, View, AnalysisSession, Theme, Currency, MarketAnalysisState } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ErrorDisplay } from './components/ErrorDisplay';
import { HistoryView } from './views/HistoryView';
import { AnalysisView } from './views/AnalysisView';
import { CalculatorView } from './views/CalculatorView';
import { AlternativesView } from './views/AlternativesView';
import { BottomNavBar } from './components/BottomNavBar';
import { MarketView } from './views/MarketView';
import { PortfolioView } from './views/PortfolioView';
import { CurrencySelector } from './components/CurrencySelector';
import { AssetHeader } from './components/AssetHeader';
import { Tabs } from './components/Tabs';
import { ChartView } from './views/ChartView';
import { usePortfolios } from './hooks/usePortfolios';
import { AppMenu } from './Plantilla/AppMenu';

// Importaciones de Plantilla
import { Footer as TemplateFooter } from './Plantilla/Footer';
import { Ajustes as AjustesModal } from './Plantilla/Ajustes';
import { Cookies as CookiesModal } from './Plantilla/Cookies';

interface AppProps {
    userIp: string | null;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
}

const navItems: { view: View; label: string; icon: string }[] = [
    { view: 'market', label: 'Mercado', icon: 'fa-globe' },
    { view: 'analysis', label: 'Análisis', icon: 'fa-chart-pie' },
    { view: 'charts', label: 'Gráficos', icon: 'fa-chart-line' },
    { view: 'portfolio', label: 'Cartera', icon: 'fa-wallet' },
    { view: 'calculator', label: 'Calculadora', icon: 'fa-calculator' },
    { view: 'history', label: 'Historial', icon: 'fa-history' },
];

export default function App({ userIp, theme, onThemeChange }: AppProps): React.ReactElement {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [analysisHistory, setAnalysisHistory] = useLocalStorage<HistoryItem[]>('assetAnalysisHistory', []);
    const [currentEngine, setCurrentEngine] = useLocalStorage<string>('selectedAiEngine', 'gemini-3-flash-preview');
    const [availableEngines, setAvailableEngines] = useState<string[]>([]);
    const [sessions, setSessions] = useLocalStorage<AnalysisSession[]>('analysisSessions', []);
    const [activeSessionId, setActiveSessionId] = useLocalStorage<string | null>('activeAnalysisSessionId', null);
    
    // Modales de Plantilla
    const [showAjustesModal, setShowAjustesModal] = useState(false);
    const [showCookiesModal, setShowCookiesModal] = useState(false);

    const {
        portfolios,
        activePortfolio,
        activePortfolioId,
        setActivePortfolioId,
        addPortfolio,
        renamePortfolio,
        deletePortfolio,
        addAssetToPortfolio,
        removeAssetFromPortfolio,
        importAndMergePortfolio,
    } = usePortfolios();

    const [activeView, setActiveView] = useLocalStorage<View>('activeView', 'market');
    const [currency, setCurrency] = useLocalStorage<Currency>('userCurrency', 'EUR');
    const [marketAnalysisState, setMarketAnalysisState] = useState<MarketAnalysisState>({
        results: {},
        isLoading: false,
        error: null,
        openSectors: [],
    });
    const [assetForPortfolio, setAssetForPortfolio] = useState<{ asset: Asset; price: number | null } | null>(null);

    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [error, setError] = useState<AppError | null>(null);
    const [isQuotaExhausted, setIsQuotaExhausted] = useState<boolean>(false);
    const [suggestedAssets, setSuggestedAssets] = useState<Asset[] | null>(null);
    const [lastRatesUpdate, setLastRatesUpdate] = useState<number>(Date.now());

    const isLoadingEngines = availableEngines.length === 0;
    const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
    const showSearchBar = !['market', 'history'].includes(activeView);
    const isApiBlocked = isQuotaExhausted;

    useEffect(() => {
        const loadAndSetModels = async () => {
            try {
                const engines = await getAvailableTextModels();
                setAvailableEngines(engines);
                if (!engines.includes(currentEngine)) setCurrentEngine(engines[0]);
            } catch (err) {
                // El ErrorBoundary capturará si esto falla por API Key
                console.error("Initialization failed:", err);
            }
        };
        const loadRates = async () => {
            const rates = await updateExchangeRates();
            if (rates) {
                setLastRatesUpdate(Date.now());
            }
        };

        loadAndSetModels();
        loadRates();
    }, []);

    const handleApiError = useCallback((e: any, title: string, message: string) => {
        if (e instanceof QuotaExceededError) {
            setIsQuotaExhausted(true);
            setError({ title: `Cuota Excedida`, message: e.message });
        } else if (e.name === 'ApiKeyMissingError') {
            // Forzar disparo del ErrorBoundary para diagnóstico completo
            throw e;
        } else {
            setError({ title, message: e instanceof Error ? e.message : message });
        }
    }, []);

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setError(null);
        setSuggestedAssets(null);
        try {
            const { data } = await getAssetInfo(searchQuery, currentEngine);
            if (data.length > 0) setSuggestedAssets(data);
            else setError({ title: 'Activo no Encontrado', message: 'No se detectaron coincidencias.' });
        } catch (e) {
            handleApiError(e, 'Error de Búsqueda', 'Fallo al buscar el activo.');
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery, currentEngine, handleApiError]);

    const handleAssetSelection = useCallback((asset: Asset) => {
        const existing = sessions.find(s => s.id === asset.ticker);
        if (existing) {
            setActiveSessionId(existing.id);
            setActiveView('analysis');
            setSuggestedAssets(null);
            setSearchQuery('');
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        const future = new Date(); future.setFullYear(future.getFullYear() + 5);
        const newSession: AnalysisSession = {
            id: asset.ticker, asset, isInitializing: true, currentPrice: null, changeValue: null, changePercentage: null,
            analysisVectors: [], globalAnalysis: { content: null, isLoading: false, error: null }, alternativeAssets: [],
            isLoadingAlternatives: false, haveAlternativesBeenFetched: false, isAnalyzingAll: false,
            calculatorState: { investment: '1000', startDate: today, endDate: future.toISOString().split('T')[0], startPriceInput: '', endPriceInput: '', inflationRate: '3' },
            chatHistory: []
        };
        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newSession.id);
        setActiveView('analysis');
        setSuggestedAssets(null);
        setSearchQuery('');
    }, [sessions, setActiveSessionId, setSessions, setActiveView]);

    const renderActiveView = () => {
        switch(activeView) {
            case 'analysis': return <AnalysisView sessions={sessions} activeSession={activeSession} onSessionChange={setSessions} onActiveSessionChange={setActiveSessionId} onCloseSession={(id) => setSessions(s => s.filter(x => x.id !== id))} onClearSessions={() => setSessions([])} suggestedAssets={suggestedAssets} onSelectAsset={handleAssetSelection} currentEngine={currentEngine} isQuotaExhausted={isApiBlocked} onApiError={handleApiError} setHistory={setAnalysisHistory} currency={currency} onSendToPortfolio={(a, p) => { setAssetForPortfolio({ asset: a, price: p }); setActiveView('portfolio'); }} />;
            case 'market': return <MarketView currentEngine={currentEngine} onApiError={handleApiError} isApiBlocked={isApiBlocked} currency={currency} setSearchQuery={setSearchQuery} setActiveView={setActiveView} analysisState={marketAnalysisState} setAnalysisState={setMarketAnalysisState} />;
            case 'portfolio': return <PortfolioView portfolios={portfolios} activePortfolio={activePortfolio} activePortfolioId={activePortfolioId} setActivePortfolioId={setActivePortfolioId} currency={currency} currentEngine={currentEngine} onApiError={handleApiError} onSelectAsset={handleAssetSelection} isApiBlocked={isApiBlocked} assetForPortfolio={assetForPortfolio} onClearAssetForPortfolio={() => setAssetForPortfolio(null)} onNewPortfolio={addPortfolio} onRenamePortfolio={renamePortfolio} onDeletePortfolio={deletePortfolio} onAddAsset={addAssetToPortfolio} onRemoveAsset={removeAssetFromPortfolio} onImportPortfolio={importAndMergePortfolio} />;
            case 'charts': return <ChartView activeSession={activeSession} theme="light" />;
            case 'calculator': return <CalculatorView activeSession={activeSession} onSessionChange={setSessions} currentEngine={currentEngine} onApiError={handleApiError} currency={currency} />;
            case 'alternatives': return <AlternativesView activeSession={activeSession} onSessionChange={setSessions} currentEngine={currentEngine} onApiError={handleApiError} onSelectAsset={handleAssetSelection} isApiBlocked={isApiBlocked} currency={currency} />;
            case 'history': return <HistoryView history={analysisHistory} onSelectHistoryItem={(item) => handleAssetSelection({ name: item.name, ticker: item.ticker, type: item.type })} onClearHistory={() => setAnalysisHistory([])} currency={currency} />;
            default: return null;
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-white text-black font-sans">
            <main className="flex-grow container mx-auto px-4 py-8">
                <header className="flex justify-between items-center mb-10">
                    <div className="flex-1 text-left">
                        <h1 className="text-3xl font-black uppercase tracking-tighter text-black leading-none">
                            Invers<span className="text-red-700">IA</span>
                        </h1>
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.5em] mt-1">Análisis Estratégico</p>
                    </div>
                    <div className="flex-shrink-0 flex justify-end">
                        <AppMenu />
                    </div>
                </header>

                <nav className="hidden sm:flex justify-center mb-8">
                    <div className="bg-gray-100 p-1 rounded-xl flex border border-gray-200">
                        {navItems.map(({ view, label, icon }) => (
                            <button 
                                key={view} 
                                type="button" 
                                title={label}
                                onClick={() => setActiveView(view)} 
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-200 ${activeView === view ? 'bg-red-700 text-white shadow-lg' : 'text-gray-500 hover:text-black'}`}
                            >
                                <i className={`fas ${icon} text-sm`}></i>
                                <span className="hidden md:inline">{label}</span>
                            </button>
                        ))}
                    </div>
                </nav>
                
                <div className="max-w-6xl mx-auto">
                     {showSearchBar && (
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-3 mb-8">
                            <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} onSearch={handleSearch} isLoading={isSearching || isLoadingEngines} isApiBlocked={isApiBlocked} />
                            <CurrencySelector key={lastRatesUpdate} currency={currency} setCurrency={setCurrency} />
                            { (sessions.length > 0) && (
                                <button type="button" onClick={() => { if(confirm("¿Cerrar todas?")) setSessions([]) }} className="h-11 w-11 flex items-center justify-center bg-gray-50 text-gray-400 rounded-xl hover:bg-red-700 hover:text-white transition-all"><i className="fas fa-times"></i></button>
                            )}
                        </div>
                    )}

                    {sessions.length > 0 && !['market', 'history'].includes(activeView) && (
                        <div className="mb-8">
                            <Tabs sessions={sessions} activeSessionId={activeSessionId} onSelectSession={setActiveSessionId} onCloseSession={(id) => setSessions(s => s.filter(x => x.id !== id))} />
                            {activeSession && (
                                <div className="mt-4">
                                    <AssetHeader 
                                        asset={activeSession.asset} 
                                        currentPrice={activeSession.currentPrice} 
                                        changeValue={activeSession.changeValue} 
                                        changePercentage={activeSession.changePercentage} 
                                        currency={currency} 
                                        onSendToPortfolio={(a, p) => { setAssetForPortfolio({ asset: a, price: p }); setActiveView('portfolio'); }} 
                                        onShowAlternatives={() => setActiveView('alternatives')}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    <ErrorDisplay error={error} onDismiss={() => setError(null)} />
                    {renderActiveView()}
                </div>
            </main>
            
            <TemplateFooter userIp={userIp} onShowCookies={() => setShowCookiesModal(true)} onShowAjustes={() => setShowAjustesModal(true)} />
            <BottomNavBar activeView={activeView} setActiveView={setActiveView} />
            
            <AjustesModal 
                isOpen={showAjustesModal} 
                onClose={() => setShowAjustesModal(false)} 
                userIp={userIp} 
            />
            <CookiesModal isOpen={showCookiesModal} onClose={() => setShowCookiesModal(false)} />
        </div>
    );
}
