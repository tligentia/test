import React from 'react';
import { getSentimentStyles } from './formatter';

interface SentimentBadgeProps {
    score: number | null | undefined;
    className?: string;
}

export const SentimentBadge: React.FC<SentimentBadgeProps> = ({ score, className = "" }) => {
    if (score === null || score === undefined) {
        return null; 
    }

    const styles = getSentimentStyles(score);

    return (
        <div
            className={`flex-shrink-0 text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-sm flex items-center gap-1 transition-all border border-transparent ${className}`}
            style={{ backgroundColor: styles.bgColor, color: styles.textColor }}
            title={`Sentimiento: ${styles.label}`}
        >
            <span className="opacity-70" style={{ fontSize: '0.8em' }}>{styles.icon}</span>
            <span>{styles.label}</span>
        </div>
    );
};