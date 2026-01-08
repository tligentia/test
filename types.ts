
export class QuotaExceededError extends Error {
    engine: string;
    constructor(message: string, engine: string) {
        super(message);
        this.name = 'QuotaExceededError';
        this.engine = engine;
    }
}

export class ApiKeyMissingError extends Error {
    constructor() {
        super("CRITICAL_CONFIG_ERROR: La clave API (process.env.API_KEY) no está definida en el entorno de ejecución. El SDK de Gemini no puede inicializarse.");
        this.name = 'ApiKeyMissingError';
    }
}

export class AnomalousPriceError extends Error {
    price: number;
    constructor(message: string, price: number) {
        super(message);
        this.name = 'AnomalousPriceError';
        this.price = price;
    }
}

export interface Asset {
    name: string;
    ticker: string;
    type: 'stock' | 'crypto';
    description?: string;
    currentPrice?: number;
    change?: number;
    investingUrl?: string;
}

export interface Source {
    uri: string;
    title: string;
}

export interface AnalysisContent {
    summary: string;
    fullText: string;
    sentiment: number;
    limitBuyPrice?: number;
    currency?: string;
}

export interface AnalysisVector {
    title:string;
    content: AnalysisContent | null;
    isLoading: boolean;
    error: string | null;
    sources?: Source[];
    isCustom?: boolean;
    isIncludedInGlobal?: boolean;
}

export interface HistoryItem {
    name: string;
    ticker: string;
    type: 'stock' | 'crypto';
    lastClose: number;
    change: number;
    changePercentage: number;
    date: string;
    sentiment: number;
}

export interface GlobalAnalysisState {
    content: AnalysisContent | null;
    isLoading: boolean;
    error: string | null;
    sources?: Source[];
    calculatedWithVectorCount?: number;
}

export interface AppError {
    title: string;
    message: string;
    debugInfo?: any;
}

export type View = 'analysis' | 'market' | 'portfolio' | 'calculator' | 'alternatives' | 'history' | 'charts';
export type Theme = 'light' | 'dark' | 'system';
export type Currency = 'EUR' | 'USD' | 'GBP' | 'JPY' | 'BTC';

export interface CalculatorState {
    investment: string;
    startDate: string;
    endDate: string;
    startPriceInput: string;
    endPriceInput: string;
    inflationRate: string;
    limitBuyPrice?: string;
}

export interface AnalysisSession {
    id: string;
    asset: Asset;
    isInitializing: boolean;
    initializationError?: string | null;
    currentPrice: number | null;
    changeValue: number | null;
    changePercentage: number | null;
    analysisVectors: AnalysisVector[];
    globalAnalysis: GlobalAnalysisState;
    alternativeAssets: Asset[];
    isLoadingAlternatives: boolean;
    haveAlternativesBeenFetched: boolean;
    isAnalyzingAll: boolean;
    calculatorState?: CalculatorState;
    chatHistory: any[];
}

export interface MarketAssetMetric {
  name: string;
  ticker: string;
  marketCap: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  peRatio: number;
  eps: number;
  dividendYield: number;
}

export interface SectorAverage {
  marketCap: string;
  averagePeRatio: number;
  averageEps: number;
  averageDividendYield: number;
}

export interface MarketAnalysisResult {
  title: string;
  assets: MarketAssetMetric[];
  sectorAverage: SectorAverage;
}

export interface MarketAnalysisResultWithCriterion extends MarketAnalysisResult {
  criterion: string;
}

export interface MarketAnalysisState {
    results: Record<string, MarketAnalysisResultWithCriterion[]>;
    isLoading: boolean;
    error: string | null;
    openSectors: string[];
}

export interface PortfolioItem {
    ticker: string;
    name: string;
    type: 'stock' | 'crypto';
    quantity: number;
    purchasePrice: number;
    purchaseDate: string;
}

export interface Portfolio {
    id: string;
    name: string;
    items: PortfolioItem[];
}

/**
 * Interface representing the data structure for the exportable report.
 */
export interface ReportData {
    asset: Asset;
    globalAnalysis: GlobalAnalysisState;
    analyses: AnalysisVector[];
}

/**
 * Interface representing a portfolio item augmented with live market data.
 */
export interface PortfolioItemWithMarketData extends PortfolioItem {
    currentPrice: number | null;
    marketValue: number | null;
    gainLoss: number | null;
    gainLossPercentage: number | null;
}
