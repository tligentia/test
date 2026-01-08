export interface SentimentStyle {
    icon: '▲' | '▼' | '●' | '❓';
    bgColor: string;
    textColor: string;
    label: string;
}

export function formatTextToHtml(text: string): string {
    if (!text) return '';
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    html = html.replace(/• /g, '&bull; ');
    html = html.replace(/\n/g, '<br />');
    return html;
}

export function formatSentimentScore(score: number | null | undefined): string {
    if (score === null || score === undefined) return '?';
    if (score > 0) return `+${score}`;
    return String(score);
}

export function getSentimentStyles(score: number | null | undefined): SentimentStyle {
    const label = formatSentimentScore(score);

    if (score === null || score === undefined) {
        return { icon: '❓', bgColor: '#e5e7eb', textColor: '#6b7280', label };
    }
    
    // Escala de Grises Estricta según contraste solicitado
    if (score > 3) { // Muy Positivo
        return { icon: '▲', bgColor: '#000000', textColor: '#ffffff', label };
    }
    if (score > 0) { // Positivo
        return { icon: '▲', bgColor: '#4b5563', textColor: '#ffffff', label };
    }
    if (score < -3) { // Muy Negativo
        return { icon: '▼', bgColor: '#9ca3af', textColor: '#000000', label };
    }
    if (score < 0) { // Negativo
        return { icon: '▼', bgColor: '#d1d5db', textColor: '#000000', label };
    }
    
    // Neutral
    return { icon: '●', bgColor: '#f3f4f6', textColor: '#111827', label };
}