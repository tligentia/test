
import { GoogleGenAI, Type } from "@google/genai";
import { Asset, Source, AnalysisContent, QuotaExceededError, ApiKeyMissingError, MarketAnalysisResult, Currency } from '../types';
import { CONVERSION_RATES } from '../constants';

/**
 * Validates the existence of the API Key and returns a client.
 * Prioritizes manual key from localStorage then process.env.API_KEY.
 */
function getClient(): GoogleGenAI {
    const manualKey = localStorage.getItem('GEMINI_API_KEY');
    const envKey = process.env.API_KEY;
    
    const key = (manualKey && manualKey.length > 10) ? manualKey : envKey;

    if (!key || key === "undefined" || key.length < 10) {
        console.error("CRITICAL: API_KEY is missing in both localStorage and environment.");
        throw new ApiKeyMissingError();
    }
    return new GoogleGenAI({ apiKey: key });
}

function handleGeminiError(error: unknown, defaultMessage: string, model: string): Error {
    console.error(`Gemini Service Error [${model}]:`, error);
    
    if (error instanceof ApiKeyMissingError) return error;

    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        
        if (msg.includes("api key must be set") || msg.includes("api_key_missing") || msg.includes("invalid api key")) {
            return new ApiKeyMissingError();
        }

        if (msg.includes("resource_exhausted") || msg.includes("quota")) {
            return new QuotaExceededError("Cuota de API excedida.", model);
        }
    }
    
    return new Error(`${defaultMessage} (Ref: ${model})`);
}

function cleanAndParseJson<T>(text: string, functionName: string): T {
    try {
        const firstBrace = text.indexOf('{');
        const firstBracket = text.indexOf('[');
        let start = -1;
        let endChar = '';

        if (firstBrace === -1 && firstBracket === -1) return JSON.parse(text.trim());

        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            start = firstBrace;
            endChar = '}';
        } else {
            start = firstBracket;
            endChar = ']';
        }

        const lastEnd = text.lastIndexOf(endChar);
        const jsonText = text.substring(start, lastEnd + 1);
        return JSON.parse(jsonText);
    } catch (e) {
        throw new Error("El motor de IA devolvió una respuesta ilegible.");
    }
}

export async function generateSimpleContent(prompt: string): Promise<string> {
    const model = 'gemini-3-flash-preview';
    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model,
            contents: prompt,
        });
        return response.text || "";
    } catch (error) {
        throw handleGeminiError(error, "Error en generación simple.", model);
    }
}

export async function updateExchangeRates(engine: string = 'gemini-3-flash-preview'): Promise<Record<string, number> | null> {
    const prompt = `Devuelve solo JSON con tasas 1 USD a EUR, GBP, JPY, BTC.`;
    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: prompt,
            config: {
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
        const rates = cleanAndParseJson<Record<string, number>>(response.text, 'updateExchangeRates');
        if (rates) Object.assign(CONVERSION_RATES, rates);
        return rates;
    } catch (e) {
        return null;
    }
}

export async function getAssetInfo(query: string, engine: string): Promise<{ data: Asset[], usage: any }> {
    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: `Busca activos para: ${query}. Devuelve lista JSON con name, ticker, type, description, investingUrl.`,
            config: {
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
                                }
                            }
                        }
                    }
                }
            }
        });
        const result = cleanAndParseJson<{ assets: Asset[] }>(response.text, 'getAssetInfo');
        return { data: result.assets || [], usage: response.usageMetadata };
    } catch (error) {
        throw handleGeminiError(error, "Error buscando activos.", engine);
    }
}

export async function getAssetQuote(asset: Asset, engine: string, currency: Currency): Promise<{ data: any, usage: any }> {
    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: `Cotización actual ${asset.ticker} en ${currency}.`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        price: { type: Type.NUMBER },
                        changeValue: { type: Type.NUMBER },
                        changePercentage: { type: Type.NUMBER },
                        currency: { type: Type.STRING }
                    }
                }
            }
        });
        return { data: cleanAndParseJson(response.text, 'getAssetQuote'), usage: response.usageMetadata };
    } catch (error) {
        throw handleGeminiError(error, "Error de cotización.", engine);
    }
}

export async function getAnalysisVectorsForAsset(asset: Asset, engine: string): Promise<{ data: string[] | null, usage: any }> {
    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: `8 vectores de análisis para ${asset.name}.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { vectors: { type: Type.ARRAY, items: { type: Type.STRING } } }
                }
            }
        });
        const res = cleanAndParseJson<{ vectors: string[] }>(response.text, 'getAnalysisVectors');
        return { data: res.vectors, usage: response.usageMetadata };
    } catch (e) {
        throw handleGeminiError(e, "Error obteniendo vectores.", engine);
    }
}

export async function getAssetAnalysis(asset: Asset, vector: string, engine: string): Promise<{ data: any, usage: any }> {
    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: `Analiza ${vector} para ${asset.name}.`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        sentiment: { type: Type.NUMBER },
                        summary: { type: Type.STRING },
                        fullText: { type: Type.STRING },
                        limitBuyPrice: { type: Type.NUMBER }
                    }
                }
            }
        });
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = chunks.map(c => ({ uri: c.web?.uri || '', title: c.web?.title || 'Fuente' })).filter(s => s.uri);
        return { data: { content: cleanAndParseJson(response.text, 'getAssetAnalysis'), sources }, usage: response.usageMetadata };
    } catch (e) {
        throw handleGeminiError(e, "Error de análisis.", engine);
    }
}

export async function getGlobalAnalysis(asset: Asset, context: string, engine: string): Promise<{ data: any, usage: any }> {
    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: `Visión global de ${asset.name} basada en: ${context}`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        sentiment: { type: Type.NUMBER },
                        summary: { type: Type.STRING },
                        fullText: { type: Type.STRING },
                        limitBuyPrice: { type: Type.NUMBER }
                    }
                }
            }
        });
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = chunks.map(c => ({ uri: c.web?.uri || '', title: c.web?.title || 'Fuente' })).filter(s => s.uri);
        return { data: { content: cleanAndParseJson(response.text, 'getGlobalAnalysis'), sources }, usage: response.usageMetadata };
    } catch (e) {
        throw handleGeminiError(e, "Error de visión global.", engine);
    }
}

export async function getAssetPriceOnDate(asset: Asset, date: string, engine: string, currentPrice: number | null, currency: Currency): Promise<{ data: { price: number }, usage: any }> {
    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: `Precio cierre ${asset.ticker} el ${date} en JSON.`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: { type: Type.OBJECT, properties: { price: { type: Type.NUMBER } }, required: ["price"] }
            }
        });
        return { data: cleanAndParseJson(response.text, 'getAssetPriceOnDate'), usage: response.usageMetadata };
    } catch (error) { throw handleGeminiError(error, "Error histórico.", engine); }
}

export async function getAssetFuturePricePrediction(asset: Asset, date: string, engine: string, currency: Currency): Promise<{ data: { price: number }, usage: any }> {
    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: `Predicción precio ${asset.ticker} al ${date} en JSON.`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: { type: Type.OBJECT, properties: { price: { type: Type.NUMBER } }, required: ["price"] }
            }
        });
        return { data: cleanAndParseJson(response.text, 'getAssetFuturePricePrediction'), usage: response.usageMetadata };
    } catch (error) { throw handleGeminiError(error, "Error predicción.", engine); }
}

export async function getLimitBuyPrice(asset: Asset, engine: string, currency: Currency): Promise<{ data: { price: number }, usage: any }> {
    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: `Límite compra ${asset.ticker} en JSON.`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: { type: Type.OBJECT, properties: { price: { type: Type.NUMBER } }, required: ["price"] }
            }
        });
        return { data: cleanAndParseJson(response.text, 'getLimitBuyPrice'), usage: response.usageMetadata };
    } catch (error) { throw handleGeminiError(error, "Error límite.", engine); }
}

export async function getAlternativeAssets(asset: Asset, engine: string, currency: Currency): Promise<{ data: Asset[], usage: any }> {
    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: `Competidores de ${asset.ticker} en JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        assets: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: { name: { type: Type.STRING }, ticker: { type: Type.STRING }, type: { type: Type.STRING }, description: { type: Type.STRING } },
                                required: ["name", "ticker", "type"]
                            }
                        }
                    }
                }
            }
        });
        const result = cleanAndParseJson<{ assets: Asset[] }>(response.text, 'getAlternativeAssets');
        return { data: result.assets || [], usage: response.usageMetadata };
    } catch (error) { throw handleGeminiError(error, "Error alternativas.", engine); }
}

export async function analyzeMarketSector(sector: string, criterion: string, engine: string, currency: Currency): Promise<{ data: MarketAnalysisResult, usage: any }> {
    try {
        const client = getClient();
        const response = await client.models.generateContent({
            model: engine,
            contents: `Análisis sector ${sector} criterio ${criterion} en JSON.`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        sectorAverage: { type: Type.OBJECT, properties: { marketCap: { type: Type.STRING }, averagePeRatio: { type: Type.NUMBER }, averageEps: { type: Type.NUMBER }, averageDividendYield: { type: Type.NUMBER } } },
                        assets: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, ticker: { type: Type.STRING }, marketCap: { type: Type.STRING }, sentiment: { type: Type.STRING }, peRatio: { type: Type.NUMBER }, eps: { type: Type.NUMBER }, dividendYield: { type: Type.NUMBER } } } }
                    }
                }
            }
        });
        return { data: cleanAndParseJson(response.text, 'analyzeMarketSector'), usage: response.usageMetadata };
    } catch (error) { throw handleGeminiError(error, "Error sector.", engine); }
}

export async function getAvailableTextModels(): Promise<string[]> {
    return ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
}
