'use client';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export default function MindsetMessageBubble({ role, content, isStreaming = false }: Props) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] px-4 py-3 rounded-2xl rounded-br-md"
          style={{ backgroundColor: '#131b2e', color: '#ffffff', fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: '1.65' }}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className="max-w-[92%] px-4 py-3 rounded-2xl rounded-bl-md"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid rgba(203,213,225,0.7)',
          color: '#0f172a',
          fontFamily: 'Inter, sans-serif',
          fontSize: '13px',
          lineHeight: '1.7',
        }}
      >
        <MarkdownLite content={content} />
        {isStreaming ? <span className="inline-block w-2 h-4 ml-1 rounded-sm animate-pulse" style={{ backgroundColor: '#006591' }} /> : null}
      </div>
    </div>
  );
}

function MarkdownLite({ content }: { content: string }) {
  const html = simpleMarkdownToHtml(content);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function simpleMarkdownToHtml(md: string): string {
  let html = md;
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.slice(3, -3).replace(/^\w*\n/, '');
    return `<pre style="background:#0f172a;color:#e2e8f0;padding:12px;border-radius:10px;overflow-x:auto;font-size:12px"><code>${escapeHtml(code)}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code style="background:#e5eeff;padding:1px 5px;border-radius:4px">$1</code>');
  html = html.replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:700;margin:10px 0 4px;font-family:Manrope,sans-serif">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:12px 0 4px;font-family:Manrope,sans-serif">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 style="font-size:16px;font-weight:800;margin:14px 0 6px;font-family:Manrope,sans-serif">$1</h2>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul style="margin:6px 0">${match}</ul>`);
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
