
import { LucideIcon } from 'lucide-react';
import { generateSimpleContent } from '../services/geminiService';
import { GoogleGenAI } from "@google/genai";
import { Currency } from '../types';

// --- TIPOS ---
export type CurrencyCode = Currency;

export interface StageConfig {
  id: number;
  name: string;
  action: string;
  color: string;
  bg: string;
  icon: LucideIcon;
}

// --- CONSTANTES DE ESTILO ---
export const COLORS = {
  bg: 'bg-white',
  card: 'bg-white',
  textMain: 'text-black',
  textSub: 'text-gray-500',
  accentRed: 'text-red-700',
  border: 'border-gray-100',
  btnPrimary: 'bg-black hover:bg-red-700 text-white',
  btnAi: 'bg-black hover:bg-red-700 text-white', 
  aiBg: 'bg-gray-50',
  aiText: 'text-black',
  aiBorder: 'border-gray-100'
};

export const AUTHORIZED_DOMAIN = 'tligent.com';

export const CURRENCIES: Record<CurrencyCode, { code: CurrencyCode; name: string; symbol: string; isCrypto: boolean }> = {
    EUR: { code: 'EUR', name: 'Euro', symbol: '€', isCrypto: false },
    USD: { code: 'USD', name: 'Dólar USA', symbol: '$', isCrypto: false },
    GBP: { code: 'GBP', name: 'Libra Esterlina', symbol: '£', isCrypto: false },
    JPY: { code: 'JPY', name: 'Yen Japonés', symbol: '¥', isCrypto: false },
    BTC: { code: 'BTC', name: 'Bitcoin', symbol: '₿', isCrypto: true },
};

// --- CONFIGURACIÓN DE SEGURIDAD DINÁMICA ---
const DEFAULT_IPS = [
  atob('NzkuMTEyLjg1LjE3Mw=='), 
  atob('MzcuMjIzLjE1LjYz')    
];

export const getAllowedIps = (): string[] => {
  const stored = localStorage.getItem('app_allowed_ips');
  return stored ? JSON.parse(stored) : DEFAULT_IPS;
};

export const saveAllowedIps = (ips: string[]) => {
  localStorage.setItem('app_allowed_ips', JSON.stringify(ips));
};

// --- LÓGICA DE CLAVES ---
export const getShortcutKey = (shortcut: string): string | null => {
  const code = shortcut.toLowerCase().trim();
  if (code === 'ok') return atob("QUl6YVN5QmxKbnh2Y0F4UVhHWWVHSlhjOHE0OTR4d095a0VNN19v");
  if (code === 'cv') return atob("QUl6YVN5QXExcTZCRS1zeWRsN1Y2aWtNaFE5SDB2TXY0OTFNcHk4");
  return null;
};

// --- UTILS CRYPTO ---
export const crypto = {
    obfuscate: (text: string, key: string) => {
       try {
           return btoa(text);
       } catch (e) { return text; }
    },
    deobfuscate: (text: string, key: string) => {
        try {
            return atob(text);
        } catch(e) { return text; }
    }
}

// --- SERVICIO GEMINI ---
export const generateContent = async (prompt: string): Promise<string> => {
  try {
    return await generateSimpleContent(prompt);
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
};

export const validateKey = async (key: string): Promise<boolean> => {
    // Validación de formato para claves de Google Gemini
    return key.startsWith('AIzaSy') && key.length > 30;
}

export const listAvailableModels = async (): Promise<string[]> => {
    return ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
}

export const askGemini = async (question: string, model: string, key?: string): Promise<string> => {
     try {
         // Se prioriza la clave manual sobre la del entorno para permitir gestión de recursos del usuario
         const activeKey = key || process.env.API_KEY || '';
         const ai = new GoogleGenAI({ apiKey: activeKey });
         const response = await ai.models.generateContent({
             model: model,
             contents: question,
         });
         return response.text || "Sin respuesta";
     } catch (e: any) {
         return `Error: ${e.message}`;
     }
}
