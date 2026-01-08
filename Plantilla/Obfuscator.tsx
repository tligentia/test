import React, { useState, useEffect } from 'react';
import { X, Lock, Unlock, Copy, Check, ShieldCheck, Database, Zap } from 'lucide-react';
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
  const [masterKey, setMasterKey] = useState('');

  useEffect(() => {
      setMasterKey(localStorage.getItem('app_remote_master_key') || 'tligent_default_2025');
  }, [isOpen]);

  const handleProcess = () => {
    if (!input) return;
    const result = mode === 'encrypt' 
      ? crypto.obfuscate(input) 
      : crypto.deobfuscate(input);
    setOutput(result);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-gray-100 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-900 rounded-xl text-white">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-black text-gray-900 uppercase tracking-tighter text-lg">Crypto Console</h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em]">Obfuscation Engine</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-700 transition-all active:scale-90">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          
          {/* Mode Toggle */}
          <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
            <button 
              onClick={() => { setMode('encrypt'); setOutput(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                mode === 'encrypt' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'
              }`}
            >
              <Lock size={12} /> Encrypt
            </button>
            <button 
              onClick={() => { setMode('decrypt'); setOutput(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                mode === 'decrypt' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'
              }`}
            >
              <Unlock size={12} /> Decrypt
            </button>
          </div>

          {/* Master Key Info */}
          <div className="flex items-center justify-between px-1">
             <span className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-400 flex items-center gap-2">
                <Database size={10} className="text-red-700" /> Remote Sync Active
             </span>
             <span className="text-[8px] font-mono text-gray-300 truncate max-w-[120px]">
                KEY: {masterKey.substring(0, 12)}...
             </span>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === 'encrypt' ? "Introduce texto para ofuscar..." : "Introduce hash para decodificar..."}
              className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-xs text-gray-900 font-mono outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all h-32 resize-none shadow-inner placeholder:italic placeholder:text-gray-300"
            />
          </div>

          {/* Action */}
          <button
            onClick={handleProcess}
            disabled={!input}
            className="w-full bg-red-700 hover:bg-black disabled:bg-gray-100 disabled:text-gray-300 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-lg shadow-red-50/50"
          >
            {mode === 'encrypt' ? 'Generar Obfuscación' : 'Revertir Proceso'}
          </button>

          {/* Output */}
          {output && (
            <div className="space-y-2 animate-in slide-in-from-top-4 duration-300">
              <div className="relative group">
                <div className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-[11px] text-gray-900 font-mono break-all leading-relaxed shadow-sm">
                  {output}
                </div>
                <button 
                  onClick={handleCopy}
                  className="absolute top-2 right-2 p-2 bg-white hover:bg-red-700 text-gray-400 hover:text-white rounded-lg transition-all shadow-sm border border-gray-100 active:scale-90"
                  title="Copiar resultado"
                >
                  {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-widest text-green-600">
                <Zap size={10} fill="currentColor" /> Proceso completado con éxito
              </div>
            </div>
          )}

        </div>

        {/* Footer info */}
        <div className="p-4 bg-gray-50/50 text-center border-t border-gray-100">
            <p className="text-[8px] font-black text-gray-300 uppercase tracking-[0.4em]">Protocolo Tligent v2.5</p>
        </div>
      </div>
    </div>
  );
};