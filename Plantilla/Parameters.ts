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

// --- LÓGICA DE CLAVES Y OFUSCACIÓN ---

/**
 * Obtiene la clave maestra dinámica desde el LocalStorage (sincronizada por AppMenu)
 * o utiliza la clave de respaldo por defecto.
 */
const getRemoteKey = (): string => {
  return localStorage.getItem('app_remote_master_key') || 'tligent_default_2025';
};

export const crypto = {
    /**
     * Ofusca el texto utilizando un proceso de XOR y Base64 basado en la clave maestra actual.
     */
    obfuscate: (text: string, customKey?: string) => {
       const key = customKey || getRemoteKey();
       try {
           // Proceso Tligent: Texto -> Base64 -> XOR con Key -> Base64
           let b64 = btoa(text);
           let xored = '';
           for (let i = 0; i < b64.length; i++) {
               xored += String.fromCharCode(b64.charCodeAt(i) ^ key.charCodeAt(i % key.length));
           }
           return btoa(xored);
       } catch (e) { 
           console.error("Obfuscation error", e);
           return text; 
       }
    },
    /**
     * Desofusca el texto invirtiendo el proceso de XOR y Base64.
     */
    deobfuscate: (text: string, customKey?: string) => {
        const key = customKey || getRemoteKey();
        try {
            let dexored = atob(text);
            let resultB64 = '';
            for (let i = 0; i < dexored.length; i++) {
                resultB64 += String.fromCharCode(dexored.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return atob(resultB64);
        } catch(e) { 
            console.error("Deobfuscation error", e);
            return text; 
        }
    }
}

/**
 * Devuelve la API Key desofuscada si el código introducido coincide con un atajo.
 * Utiliza el sistema de desofuscación dinámico vinculado a la hoja de cálculo.
 */
export const getShortcutKey = (shortcut: string): string | null => {
  const code = shortcut.toLowerCase().trim();
  
  // Las cadenas a continuación han sido pre-ofuscadas con la lógica Tligent.
  // Al usar crypto.deobfuscate, se garantiza que solo se descifren correctamente
  // si la clave maestra (por defecto o de Google Sheets) es la correcta.
  
  if (code === 'ok') {
      // Clave Gemini 1 ofuscada
      return crypto.deobfuscate("ExYVGR0fEBYfExAVHhMRAxoYExAVExAaExEUAxoTFRIREhYVExEVFxoTFRYf");
  }
  
  if (code === 'cv') {
      // Clave Gemini 2 ofuscada
      return crypto.deobfuscate("ExYVGR0fEBYfExAdExEUAxoTFRIRExAeEhYVExAaExEUAxYfExYVExEVExAV");
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