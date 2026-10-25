'use client';

import type { ChatMessage } from '@/lib/types/agent';

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-md"
          style={{
            backgroundColor: '#131b2e',
            color: '#ffffff',
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            lineHeight: '1.6',
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className="max-w-[90%] px-4 py-3 rounded-2xl rounded-bl-md"
        style={{
          backgroundColor: '#f8f9ff',
          border: '1px solid rgba(198,198,205,0.12)',
          fontFamily: 'Inter, sans-serif',
          fontSize: '13px',
          lineHeight: '1.7',
          color: '#0f172a',
        }}
      >
        <MarkdownContent content={message.content} />
        {isStreaming && <BlinkingCursor />}
      </div>
    </div>
  );
}

function BlinkingCursor() {
  return (
    <span
      className="inline-block w-2 h-4 ml-0.5 rounded-sm animate-pulse"
      style={{ backgroundColor: '#006591' }}
    />
  );
}

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown rendering without external dependency
  // Handles: headers, bold, italic, lists, code blocks, links
  const html = simpleMarkdownToHtml(content);
  return <div className="prose-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}

function simpleMarkdownToHtml(md: string): string {
  let html = md;

  // Code blocks
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.slice(3, -3).replace(/^\w*\n/, '');
    return `<pre style="background:#131b2e;color:#e2e8f0;padding:12px;border-radius:8px;overflow-x:auto;font-size:12px;margin:8px 0"><code>${escapeHtml(code)}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:#e5eeff;padding:1px 5px;border-radius:4px;font-size:12px">$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:700;margin:12px 0 4px;font-family:Manrope,sans-serif">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:14px 0 6px;font-family:Manrope,sans-serif">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 style="font-size:16px;font-weight:800;margin:16px 0 8px;font-family:Manrope,sans-serif">$1</h2>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc;margin-bottom:2px">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul style="margin:6px 0">${match}</ul>`);

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;list-style:decimal;margin-bottom:2px">$1</li>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#006591;text-decoration:underline">$1</a>');

  // Line breaks (double newline = paragraph)
  html = html.replace(/\n\n/g, '<br/><br/>');
  html = html.replace(/\n/g, '<br/>');

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
