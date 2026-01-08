
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

// --- LÓGICA DE CLAVES Y OFUSCACIÓN ---
const MASTER_SEED = "tligent";

export const crypto = {
    obfuscate: (text: string) => {
       try {
           const xored = text.split('').map((char, i) => 
               String.fromCharCode(char.charCodeAt(0) ^ MASTER_SEED.charCodeAt(i % MASTER_SEED.length))
           ).join('');
           return btoa(xored);
       } catch (e) { return text; }
    },
    deobfuscate: (encoded: string) => {
        try {
            const decoded = atob(encoded);
            return decoded.split('').map((char, i) => 
                String.fromCharCode(char.charCodeAt(0) ^ MASTER_SEED.charCodeAt(i % MASTER_SEED.length))
            ).join('');
        } catch(e) { return encoded; }
    }
}

/**
 * Devuelve la API Key revelada si el código coincide con 'ok' o 'cv'.
 */
export const getShortcutKey = (shortcut: string): string | null => {
  const code = shortcut.toLowerCase().trim();
  if (code === 'ok') return crypto.deobfuscate("NSUTBjYXNicpJlE3BxYWXhhSCFhFPzNQVyYZOBI5PR8ECg41Lw4i");
  if (code === 'cv') return crypto.deobfuscate("NSUTBjYXNRczGh8LBEwaBzEuFSpDIFUkOEgKIy5fOi0pHTYgIygi");
  return null;
};

export const listAvailableModels = async (): Promise<string[]> => {
    return ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
}

export const askGemini = async (question: string, model: string): Promise<string> => {
     try {
         const manualKey = localStorage.getItem('GEMINI_API_KEY');
         const key = manualKey || process.env.API_KEY;
         const ai = new GoogleGenAI({ apiKey: key });
         const response = await ai.models.generateContent({
             model: model,
             contents: question,
         });
         return response.text || "Sin respuesta";
     } catch (e: any) {
         return `Error: ${e.message}`;
     }
}
