export interface SentimentStyle {
    icon: '▲' | '▼' | '●' | '❓';
    bgColor: string;
    textColor: string;
    label: string;
}

export function formatTextToHtml(text: string): string {
    if (!text) return '';

    // 1. Escape basic HTML tags to prevent XSS
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // 2. Convert Markdown-like syntax to HTML tags
    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic: _text_
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // 3. Convert bullet points (•) into proper list items for better semantics and styling
    html = html.replace(/• /g, '&bull; ');

    // 4. Convert newlines to <br> tags for paragraphs
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
        return { icon: '❓', bgColor: '#f3f4f6', textColor: '#6b7280', label };
    }
    if (score > 3) { // Strong Positive -> Pure Black/Gray theme
        return { icon: '▲', bgColor: '#000000', textColor: '#ffffff', label };
    }
    if (score > 0) { // Positive
        return { icon: '▲', bgColor: '#f3f4f6', textColor: '#000000', label };
    }
    if (score < -3) { // Strong Negative -> Bright Red theme
        return { icon: '▼', bgColor: '#dc2626', textColor: '#ffffff', label };
    }
    if (score < 0) { // Negative
        return { icon: '▼', bgColor: '#fef2f2', textColor: '#dc2626', label };
    }
    // Neutral
    return { icon: '●', bgColor: '#f3f4f6', textColor: '#6b7280', label };
}