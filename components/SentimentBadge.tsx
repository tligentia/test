import React from 'react';
import { getSentimentStyles } from './formatter';

interface SentimentBadgeProps {
    score: number | null | undefined;
}

export const SentimentBadge: React.FC<SentimentBadgeProps> = ({ score }) => {
    if (score === null || score === undefined) {
        return null; 
    }

    const styles = getSentimentStyles(score);

    return (
        <div
            className="flex-shrink-0 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all"
            style={{ backgroundColor: styles.bgColor, color: styles.textColor }}
            title={`Sentimiento: ${styles.label}`}
        >
            <span style={{ fontSize: '0.9em' }}>{styles.icon}</span>
            <span>{styles.label}</span>
        </div>
    );
};