
import React, { useState } from 'react';
import { X, Lock, Unlock, Copy, Check } from 'lucide-react';
import { crypto } from './Parameters';

interface ObfuscatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Obfuscator: React.FC<ObfuscatorProps> = ({ isOpen, onClose }) => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [copied, setCopied] = useState(false);

  const handleProcess = () => {
    if (!input) return;
    const result = mode === 'encrypt' 
      ? crypto.obfuscate(input, "tligent") 
      : crypto.deobfuscate(input, "tligent");
    setOutput(result);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-gray-800 rounded-lg text-red-500">
              <Lock size={16} />
            </div>
            <div>
              <h3 className="font-bold text-white uppercase tracking-wider text-sm">Crypto Tool</h3>
              <p className="text-[10px] text-gray-500 font-mono">Obfuscation Utility</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Mode Toggle */}
          <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button 
              onClick={() => setMode('encrypt')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                mode === 'encrypt' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Lock size={12} /> Encrypt
            </button>
            <button 
              onClick={() => setMode('decrypt')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                mode === 'decrypt' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Unlock size={12} /> Decrypt
            </button>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Input Data</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === 'encrypt' ? "Enter text to obfuscate..." : "Enter hash to decode..."}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-300 font-mono outline-none focus:border-red-900 focus:ring-1 focus:ring-red-900 transition-all h-24 resize-none"
            />
          </div>

          {/* Action */}
          <button
            onClick={handleProcess}
            disabled={!input}
            className="w-full bg-red-700 hover:bg-red-600 disabled:bg-gray-800 disabled:text-gray-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98]"
          >
            Process Data
          </button>

          {/* Output */}
          {output && (
            <div className="space-y-2 animate-in slide-in-from-top-2">
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Result Output</label>
              <div className="relative group">
                <div className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-green-500 font-mono break-all">
                  {output}
                </div>
                <button 
                  onClick={handleCopy}
                  className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
