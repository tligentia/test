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

// --- LÓGICA DE CLAVES Y OFUSCACIÓN (PROTOCOLO TLIGENT) ---

const MASTER_SEED = "tligent";

export const crypto = {
    /**
     * Ofusca el texto utilizando XOR y Base64.
     */
    obfuscate: (text: string) => {
       try {
           const xored = text.split('').map((char, i) => 
               String.fromCharCode(char.charCodeAt(0) ^ MASTER_SEED.charCodeAt(i % MASTER_SEED.length))
           ).join('');
           return btoa(xored);
       } catch (e) { 
           console.error("Obfuscation error", e);
           return text; 
       }
    },
    /**
     * Desofusca el texto invirtiendo el proceso de XOR y Base64.
     */
    deobfuscate: (encoded: string) => {
        try {
            const decoded = atob(encoded);
            return decoded.split('').map((char, i) => 
                String.fromCharCode(char.charCodeAt(0) ^ MASTER_SEED.charCodeAt(i % MASTER_SEED.length))
            ).join('');
        } catch(e) { 
            console.error("Deobfuscation error", e);
            return encoded; 
        }
    }
}

/**
 * Devuelve la API Key revelada si el código coincide con 'ok' o 'cv'.
 * Utiliza los secretos ofuscados y la semilla 'tligent'.
 */
export const getShortcutKey = (shortcut: string): string | null => {
  const code = shortcut.toLowerCase().trim();
  
  if (code === 'ok') {
      // Secreto Ofuscado para OK (Sistema)
      return crypto.deobfuscate("NSUTBjYXNicpJlE3BxYWXhhSCFhFPzNQVyYZOBI5PR8ECg41Lw4i");
  }
  
  if (code === 'cv') {
      // Secreto Ofuscado para CV (Colaborador)
      return crypto.deobfuscate("NSUTBjYXNRczGh8LBEwaBzEuFSpDIFUkOEgKIy5fOi0pHTYgIygi");
  }
  
  return null;
};

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
    return key.startsWith('AIzaSy') && key.length > 30;
}

export const listAvailableModels = async (): Promise<string[]> => {
    return ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
}

/**
 * Realiza una consulta a Gemini utilizando exclusivamente process.env.API_KEY.
 */
export const askGemini = async (question: string, model: string): Promise<string> => {
     try {
         const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
         const response = await ai.models.generateContent({
             model: model,
             contents: question,
         });
         return response.text || "Sin respuesta";
     } catch (e: any) {
         console.error("Error in askGemini Sandbox:", e);
         return `Error: ${e.message}`;
     }
}