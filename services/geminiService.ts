
import { GoogleGenAI, Type } from "@google/genai";
import { Asset, Source, AnalysisContent, QuotaExceededError, AiAnswer, AnomalousPriceError, MarketAnalysisResult, Currency } from '../types';
import { CONVERSION_RATES } from '../constants';

/**
 * Helper to get a fresh instance of the AI client.
 * This ensures we always use the most up-to-date API key from process.env.API_KEY.
 */
function getClient(): GoogleGenAI {
    // Correct initialization using process.env.API_KEY directly as per guidelines.
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

interface TokenUsage {
    promptTokens: number;
    candidateTokens: number;
    totalTokens: number;
}

interface GeminiResponse<T> {
    data: T;
    usage: TokenUsage;
}

function handleGeminiError(error: unknown, defaultMessage: string, model: string): Error {
    console.error(`Gemini API Error in function calling model '${model}':`, error);

    let debugInfo = '';
    if (error instanceof Error && error.stack) {
        const stackLines = error.stack.split('\n');
        const callerLine = stackLines.find(line => line.includes('at ') && !line.includes('geminiService.ts'));
        
        if (callerLine) {
            const match = callerLine.match(/at\s+([^\s(]+)\s+\(?(?:[^\/]+\/)*([^\/)]+:\d+):\d+\)?/);
            if (match && match[1] && match[2]) {
                 debugInfo = `\n(Error en ${match[1]} en ${match[2]})`;
            } else {
                const simpleMatch = callerLine.match(/\((?:[^\/]+\/)*([^\/)]+:\d+:\d+)\)/);
                if (simpleMatch && simpleMatch[1]) {
                    debugInfo = `\n(Error en ${simpleMatch[1]})`;
                } else {
                     debugInfo = `\n(Detalles: ${callerLine.trim()})`;
                }
            }
        }
    }

    if (error instanceof TypeError && (error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('load failed') || error.message.toLowerCase().includes('networkerror'))) {
        return new Error("Error de red. Por favor, comprueba tu conexión a internet, desactiva extensiones de bloqueo de anuncios (ad-blockers) e inténtalo de nuevo." + debugInfo);
    }

    if (error instanceof AnomalousPriceError) {
        error.message += debugInfo;
        return error;
    }

    if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes("resource_exhausted") || errorMessage.includes("quota")) {
            const quotaMessage = `Se ha excedido la cuota de uso para el motor de IA '${model}'. Por favor, revisa tu plan y los detalles de facturación en tu cuenta de Google AI Studio para poder continuar.`;
            return new QuotaExceededError(quotaMessage + debugInfo, model);
        }

        if (errorMessage.includes("api key not valid") || errorMessage.includes("permission_denied") || errorMessage.includes("api_key_invalid")) {
            return new Error(`La clave API de Gemini proporcionada no es válida o no tiene los permisos necesarios.` + debugInfo);
        }

        if (errorMessage.includes("not_found") || errorMessage.includes("404")) {
            return new Error(`El motor de IA '${model}' no fue encontrado o no está disponible. Por favor, selecciona otro motor si es posible.` + debugInfo);
        }

        if (errorMessage.includes("invalid argument")) {
             return new Error(`La solicitud a la API contenía un argumento no válido. Esto puede ser un error interno. Por favor, intenta reformular tu petición. Detalles: ${error.message}` + debugInfo);
        }
        
        if (!errorMessage.includes('json') && !errorMessage.includes('internal')) {
             return new Error(`La API ha devuelto un error: ${error.message}` + debugInfo);
        }
    }

    return new Error(defaultMessage + debugInfo);
}

function safeJsonParse<T>(jsonString: string, functionName: string): T {
    try {
        return JSON.parse(jsonString) as T;
    } catch (initialError) {
        console.warn(`Initial JSON parsing failed in ${functionName}. Attempting to repair...`, { error: initialError });
        try {
            let repairedString = '';
            let inString = false;
            let isEscaped = false;

            for (let i = 0; i < jsonString.length; i++) {
                const char = jsonString[i];
                if (isEscaped) {
                    repairedString += char;
                    isEscaped = false;
                    continue;
                }
                if (char === '\\') {
                    isEscaped = true;
                    repairedString += char;
                    continue;
                }
                if (char === '"') {
                    if (inString) {
                        let nextMeaningfulChar = '';
                        for (let j = i + 1; j < jsonString.length; j++) {
                            if (!/\s/.test(jsonString[j])) {
                                nextMeaningfulChar = jsonString[j];
                                break;
                            }
                        }
                        if (nextMeaningfulChar === ':' || nextMeaningfulChar === ',' || nextMeaningfulChar === '}' || nextMeaningfulChar === ']') {
                            inString = false;
                            repairedString += char;
                        } else {
                            repairedString += '\\"';
                        }
                    } else {
                        inString = true;
                        repairedString += char;
                    }
                } else if (inString && (char === '\n' || char === '\r')) {
                    if (char === '\n') repairedString += '\\n';
                    if (char === '\r') repairedString += '\\r';
                } else {
                    repairedString += char;
                }
            }
            return JSON.parse(repairedString) as T;
        } catch (repairError) {
            console.error(`Error parsing JSON in ${functionName} even after repair attempt:`, repairError, "Raw string:", jsonString);
            throw new Error(`La API devolvió un formato de datos inesperado. Por favor, inténtalo de nuevo.`);
        }
    }
}

function cleanAndParseJson<T>(text: string, functionName: string): T {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let start = -1;
    let endChar = '';

    if (firstBrace === -1 && firstBracket === -1) {
        return safeJsonParse<T>(text.trim(), functionName);
    }

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        start = firstBrace;
        endChar = '}';
    } else {
        start = firstBracket;
        endChar = ']';
    }

    const lastEnd = text.lastIndexOf(endChar);
    if (lastEnd === -1 || lastEnd <= start) {
        throw new Error(`Estructura JSON incompleta detectada en ${functionName}`);
    }

    const jsonText = text.substring(start, lastEnd + 1);
    return safeJsonParse<T>(jsonText, functionName);
}

export async function generateSimpleContent(prompt: string): Promise<string> {
    const model = 'gemini-3-flash-preview';
    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: model,
            contents: prompt,
        });
        return response.text || "";
    } catch (error) {
        throw handleGeminiError(error, "Error generando contenido simple.", model);
    }
}

export async function updateExchangeRates(engine: string = 'gemini-3-flash-preview'): Promise<Record<string, number> | null> {
    const prompt = `Actúa como un servidor de datos financieros en tiempo real.
Tu objetivo es proporcionar las tasas de conversión de divisas EXACTAS y ACTUALES utilizando Google Search.
Base: 1 USD.
Monedas objetivo: EUR, GBP, JPY, BTC.
Formato de respuesta: ÚNICAMENTE un objeto JSON válido.`;

    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        EUR: { type: Type.NUMBER },
                        GBP: { type: Type.NUMBER },
                        JPY: { type: Type.NUMBER },
                        BTC: { type: Type.NUMBER }
                    }
                }
            }
        });

        const jsonText = response.text.trim();
        if (jsonText) {
            const rates = cleanAndParseJson<Record<string, number>>(jsonText, 'updateExchangeRates');
            if (rates) {
                Object.assign(CONVERSION_RATES, {
                    ...CONVERSION_RATES,
                    ...rates
                });
                return rates;
            }
        }
    } catch (error) {
        console.warn("No se pudieron actualizar las tasas de cambio.", error);
    }
    return null;
}

export async function getAssetInfo(query: string, engine: string): Promise<GeminiResponse<Asset[]>> {
    const prompt = `Un usuario ha introducido: "${query}". Identifica coincidencias relevantes. Proporciona nombre, ticker, tipo ('stock' o 'crypto'), descripción y URL de Investing.com (español).`;

    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: prompt,
            config: {
                temperature: 0.3,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        assets: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    ticker: { type: Type.STRING },
                                    type: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    investingUrl: { type: Type.STRING }
                                },
                                required: ["name", "ticker", "type", "description", "investingUrl"]
                            }
                        }
                    },
                    required: ["assets"]
                },
            },
        });
        
        const usageMetadata = response.usageMetadata;
        const usage: TokenUsage = {
            promptTokens: usageMetadata?.promptTokenCount ?? 0,
            candidateTokens: usageMetadata?.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata?.totalTokenCount ?? 0,
        };
        const jsonText = response.text.trim();
        if (!jsonText) return { data: [], usage };
        
        const result = cleanAndParseJson<{ assets: Asset[] }>(jsonText, 'getAssetInfo');
        return { data: result.assets ?? [], usage };
    } catch (error) {
        throw handleGeminiError(error, "No se pudo conectar con el servicio de IA para buscar activos.", engine);
    }
}

export async function getAnalysisVectorsForAsset(asset: Asset, engine: string): Promise<GeminiResponse<string[] | null>> {
    let prompt = `Como analista senior, genera 8 vectores de análisis clave para "${asset.name}" (${asset.ticker}).`;

    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: prompt,
            config: {
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        vectors: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING
                            }
                        }
                    },
                    required: ["vectors"],
                },
            },
        });
        
        const usageMetadata = response.usageMetadata;
        const usage: TokenUsage = {
            promptTokens: usageMetadata?.promptTokenCount ?? 0,
            candidateTokens: usageMetadata?.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata?.totalTokenCount ?? 0,
        };
        const jsonText = response.text.trim();
        if (!jsonText) return { data: null, usage };
        
        const result = cleanAndParseJson<{ vectors: string[] }>(jsonText, 'getAnalysisVectorsForAsset');
        return { data: result.vectors || null, usage };
    } catch (error) {
        throw handleGeminiError(error, "No se pudieron obtener los vectores de análisis.", engine);
    }
}

export async function getAssetAnalysis(asset: Asset, vector: string, engine: string): Promise<GeminiResponse<{ content: AnalysisContent; sources: Source[] }>> {
    const prompt = `Realiza un análisis estratégico sobre el vector "${vector}" para el activo "${asset.name}" (${asset.ticker}).
Devuelve JSON: sentiment (number -10 a 10), summary (string), fullText (string), limitBuyPrice (number opcional).`;

    try {
        const client = getClient();
        const config: any = {
             tools: [{googleSearch: {}}],
             systemInstruction: "Eres un analista experto. Devuelves exclusivamente JSON.",
             temperature: 0.5,
             responseMimeType: "application/json",
             responseSchema: {
                type: Type.OBJECT,
                properties: {
                    sentiment: { type: Type.NUMBER },
                    summary: { type: Type.STRING },
                    fullText: { type: Type.STRING },
                    limitBuyPrice: { type: Type.NUMBER }
                },
                required: ["sentiment", "summary", "fullText"]
             }
        };
        
        if (engine === 'gemini-3-flash-preview') {
            config.thinkingConfig = { thinkingBudget: 256 };
        }
        
         const response = await client.models.generateContent({
            model: engine,
            contents: prompt,
            config: config
        });
        const usageMetadata = response.usageMetadata;
        const usage: TokenUsage = {
            promptTokens: usageMetadata?.promptTokenCount ?? 0,
            candidateTokens: usageMetadata?.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata?.totalTokenCount ?? 0,
        };
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        const sources: Source[] = groundingChunks.map(chunk => ({
            uri: chunk.web?.uri ?? '',
            title: chunk.web?.title ?? 'Fuente sin título'
        })).filter(s => s.uri);
        
        const analysisContent = cleanAndParseJson<AnalysisContent>(response.text, 'getAssetAnalysis');
        return { data: { content: analysisContent, sources }, usage };
    } catch (error) {
        throw handleGeminiError(error, `No se pudo generar el análisis para "${vector}".`, engine);
    }
}

export async function getGlobalAnalysis(asset: Asset, existingAnalyses: string, engine: string): Promise<GeminiResponse<{ content: AnalysisContent; sources: Source[] }>> {
    const prompt = `Como CIO, formula una "Visión Global" para "${asset.name}" (${asset.ticker}). 
Basado en: ${existingAnalyses}.
Devuelve JSON: sentiment (-10 a 10), summary, fullText, limitBuyPrice (number).`;

    try {
        const client = getClient();
        const config: any = {
             tools: [{googleSearch: {}}],
             systemInstruction: "Eres un CIO de élite. Devuelves exclusivamente JSON.",
             temperature: 0.6,
             responseMimeType: "application/json",
             responseSchema: {
                type: Type.OBJECT,
                properties: {
                    sentiment: { type: Type.NUMBER },
                    summary: { type: Type.STRING },
                    fullText: { type: Type.STRING },
                    limitBuyPrice: { type: Type.NUMBER }
                },
                required: ["sentiment", "summary", "fullText", "limitBuyPrice"]
             }
        };
        
        if (engine === 'gemini-3-flash-preview') {
            config.thinkingConfig = { thinkingBudget: 256 };
        }
        
        const response = await client.models.generateContent({
            model: engine,
            contents: prompt,
            config: config
        });
        const usageMetadata = response.usageMetadata;
        const usage: TokenUsage = {
            promptTokens: usageMetadata?.promptTokenCount ?? 0,
            candidateTokens: usageMetadata?.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata?.totalTokenCount ?? 0,
        };
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        const sources: Source[] = groundingChunks.map(chunk => ({
            uri: chunk.web?.uri ?? '',
            title: chunk.web?.title ?? 'Fuente sin título'
        })).filter(s => s.uri);
        
        const analysisContent = cleanAndParseJson<AnalysisContent>(response.text, 'getGlobalAnalysis');
        return { data: { content: analysisContent, sources }, usage };
    } catch (error) {
        throw handleGeminiError(error, 'No se pudo generar la Visión Global.', engine);
    }
}

export async function getAlternativeAssets(asset: Asset, engine: string, currency: Currency): Promise<GeminiResponse<Asset[] | null>> {
    const prompt = `Encuentra 4 competidores para '${asset.name}' (${asset.ticker}). Precio en ${currency}. Devuelve JSON: lista 'alternatives' con 'name', 'ticker', 'currentPrice' (number), 'change' (number).`;

    try {
        const client = getClient();
        const config: any = {
            tools: [{googleSearch: {}}],
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    alternatives: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                ticker: { type: Type.STRING },
                                currentPrice: { type: Type.NUMBER },
                                change: { type: Type.NUMBER }
                            },
                            required: ["name", "ticker", "currentPrice", "change"]
                        }
                    }
                }
            }
        };

        const response = await client.models.generateContent({
            model: engine,
            contents: prompt,
            config: config,
        });
        
        const usageMetadata = response.usageMetadata;
        const usage: TokenUsage = {
            promptTokens: usageMetadata?.promptTokenCount ?? 0,
            candidateTokens: usageMetadata?.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata?.totalTokenCount ?? 0,
        };
        const result = cleanAndParseJson<{alternatives: any[]}>(response.text, 'getAlternativeAssets');

        if (result && result.alternatives) {
             const alternativesWithType = result.alternatives.map((alt: any) => ({
                 name: alt.name, ticker: alt.ticker, type: asset.type, description: '',
                 currentPrice: typeof alt.currentPrice === 'number' ? alt.currentPrice : undefined,
                 change: typeof alt.change === 'number' ? alt.change : undefined
             }));
            return { data: alternativesWithType, usage };
        }
        return { data: null, usage };
    } catch (error) {
        throw handleGeminiError(error, "No se pudieron obtener activos alternativos.", engine);
    }
}

async function _getAssetPrice(
    asset: Asset,
    date: string,
    engine: string,
    currency: Currency,
    type: 'historical' | 'future',
    currentPriceForAnomalyCheck: number | null
): Promise<GeminiResponse<{ price: number | null; currency: string } | null>> {

    let prompt: string;
    let systemInstruction = "API de precios. Devuelve exclusivamente JSON.";
    const schema = {
        type: Type.OBJECT,
        properties: {
            price: { type: Type.NUMBER },
            currency: { type: Type.STRING }
        },
        required: ["price", "currency"]
    };
    
    switch (type) {
        case 'historical':
            prompt = `Precio histórico para "${asset.name}" (${asset.ticker}) al ${date} en "${currency.toUpperCase()}".`;
            break;
        case 'future':
            prompt = `Predicción de precio futuro para "${asset.name}" (${asset.ticker}) al ${date} en "${currency.toUpperCase()}".`;
            break;
    }

    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                systemInstruction,
                temperature: type === 'future' ? 0.4 : 0,
                responseMimeType: "application/json",
                responseSchema: schema
            }
        });

        const usageMetadata = response.usageMetadata;
        const usage: TokenUsage = {
            promptTokens: usageMetadata?.promptTokenCount ?? 0,
            candidateTokens: usageMetadata?.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata?.totalTokenCount ?? 0,
        };
        const text = response.text.trim();
        const priceData = cleanAndParseJson<{ price: number | null; currency: string }>(text, type === 'historical' ? 'getAssetPriceOnDate' : 'getAssetFuturePricePrediction');

        if (priceData && (typeof priceData.price === 'number' || priceData.price === null)) {
            if (type === 'historical' && priceData.price && currentPriceForAnomalyCheck && currentPriceForAnomalyCheck > 1) {
                const ratio = priceData.price / currentPriceForAnomalyCheck;
                if (ratio > 20 || ratio < 0.05) {
                    throw new AnomalousPriceError(`Precio histórico (${priceData.price} ${currency}) anómalo.`, priceData.price);
                }
            }
            return { data: priceData, usage };
        }
        throw new Error("Formato de precio no válido.");
    } catch (error) {
        if (error instanceof AnomalousPriceError) throw error;
        throw handleGeminiError(error, `Error obteniendo precio ${type}.`, engine);
    }
}

export async function getAssetQuote(asset: Asset, engine: string, currency: Currency): Promise<GeminiResponse<{ price: number; changeValue: number; changePercentage: number; currency: string } | null>> {
    const prompt = `Cotización actual para "${asset.name}" (${asset.ticker}) en ${currency.toUpperCase()}. JSON: price, changeValue, changePercentage, currency.`;

    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                systemInstruction: "API de cotizaciones. JSON estricto.",
                temperature: 0,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        price: { type: Type.NUMBER },
                        changeValue: { type: Type.NUMBER },
                        changePercentage: { type: Type.NUMBER },
                        currency: { type: Type.STRING }
                    },
                    required: ["price", "changeValue", "changePercentage", "currency"]
                }
            }
        });
        const usageMetadata = response.usageMetadata;
        const usage: TokenUsage = {
            promptTokens: usageMetadata?.promptTokenCount ?? 0,
            candidateTokens: usageMetadata?.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata?.totalTokenCount ?? 0,
        };
        const quoteData = cleanAndParseJson<{ price: number; changeValue: number; changePercentage: number; currency: string }>(response.text, 'getAssetQuote');
        return { data: quoteData, usage };
    } catch (error) {
        throw handleGeminiError(error, "No se pudo obtener la cotización del activo.", engine);
    }
}

export async function getAssetPriceOnDate(asset: Asset, date: string, engine: string, currentPrice: number | null, currency: Currency): Promise<GeminiResponse<{ price: number | null; currency: string } | null>> {
    return _getAssetPrice(asset, date, engine, currency, 'historical', currentPrice);
}

export async function getAssetFuturePricePrediction(asset: Asset, date: string, engine: string, currency: Currency): Promise<GeminiResponse<{ price: number; currency: string } | null>> {
    const result = await _getAssetPrice(asset, date, engine, currency, 'future', null);
    return result as GeminiResponse<{ price: number; currency: string } | null>;
}

export async function getLimitBuyPrice(asset: Asset, engine: string, currency: Currency): Promise<GeminiResponse<{ price: number } | null>> {
    const prompt = `Precio Límite de Compra para "${asset.name}" (${asset.ticker}) en ${currency.toUpperCase()}. JSON: price.`;

    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                systemInstruction: "API de análisis técnico. JSON estricto.",
                temperature: 0.2,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { price: { type: Type.NUMBER } },
                    required: ["price"]
                }
            }
        });
        const usageMetadata = response.usageMetadata;
        const usage: TokenUsage = {
            promptTokens: usageMetadata?.promptTokenCount ?? 0,
            candidateTokens: usageMetadata?.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata?.totalTokenCount ?? 0,
        };
        const priceData = cleanAndParseJson<{ price: number }>(response.text, 'getLimitBuyPrice');
        return { data: priceData, usage };
    } catch (error) {
        throw handleGeminiError(error, "Error en precio límite.", engine);
    }
}

export async function getAvailableTextModels(): Promise<string[]> {
    return ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
}

export async function analyzeMarketSector(sector: string, criteria: string, engine: string, currency: Currency): Promise<GeminiResponse<MarketAnalysisResult>> {
    const prompt = `Análisis del sector "${sector}" basado en el criterio "${criteria}".
Devuelve JSON: title, assets (name, ticker, marketCap, sentiment, peRatio, eps, dividendYield), sectorAverage.
Métricas financieras en ${currency.toUpperCase()}.`;

    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.2,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        assets: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    ticker: { type: Type.STRING },
                                    marketCap: { type: Type.STRING },
                                    sentiment: { type: Type.STRING },
                                    peRatio: { type: Type.NUMBER },
                                    eps: { type: Type.NUMBER },
                                    dividendYield: { type: Type.STRING }
                                },
                                required: ["name", "ticker", "marketCap", "sentiment", "peRatio", "eps", "dividendYield"]
                            }
                        },
                        sectorAverage: {
                            type: Type.OBJECT,
                            properties: {
                                marketCap: { type: Type.STRING },
                                averagePeRatio: { type: Type.NUMBER },
                                averageEps: { type: Type.NUMBER },
                                averageDividendYield: { type: Type.NUMBER }
                            },
                            required: ["marketCap", "averagePeRatio", "averageEps", "averageDividendYield"]
                        }
                    },
                    required: ["title", "assets", "sectorAverage"]
                }
            },
        });
        
        const usageMetadata = response.usageMetadata;
        const usage: TokenUsage = {
            promptTokens: usageMetadata?.promptTokenCount ?? 0,
            candidateTokens: usageMetadata?.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata?.totalTokenCount ?? 0,
        };
        const result = cleanAndParseJson<MarketAnalysisResult>(response.text, 'analyzeMarketSector');

        const parseNumeric = (value: any): number => {
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                const numericString = value.match(/-?[\d.]+/);
                return numericString ? parseFloat(numericString[0]) : 0;
            }
            return 0;
        };

        const sanitizedResult: MarketAnalysisResult = {
            ...result,
            assets: (result.assets || []).map(asset => ({
                ...asset,
                peRatio: parseNumeric(asset.peRatio),
                eps: parseNumeric(asset.eps),
                dividendYield: parseNumeric(asset.dividendYield),
            })),
            sectorAverage: result.sectorAverage ? {
                ...result.sectorAverage,
                averagePeRatio: parseNumeric(result.sectorAverage.averagePeRatio),
                averageEps: parseNumeric(result.sectorAverage.averageEps),
                averageDividendYield: parseNumeric(result.sectorAverage.averageDividendYield),
            } : { marketCap: '0', averagePeRatio: 0, averageEps: 0, averageDividendYield: 0 },
        };

        return { data: sanitizedResult, usage };
    } catch (error) {
        throw handleGeminiError(error, "No se pudo generar el análisis de mercado.", engine);
    }
}
