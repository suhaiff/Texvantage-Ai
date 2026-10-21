import React, { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

// Configure marked with GitHub-flavored markdown and line breaks
marked.setOptions({
  gfm: true,
  breaks: true
});

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  isStreaming = false,
  className = ''
}) => {
  const htmlContent = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content) as string;
    } catch (e) {
      return content;
    }
  }, [content]);

  return (
    <div className={`ai-markdown-wrapper relative ${className}`}>
      <div
        className="ai-markdown-content"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
      {isStreaming && (
        <span
          className="inline-block w-2 h-4.5 ml-1 bg-tv-accent rounded-[1px] animate-pulse align-middle"
          title="Streaming analysis..."
        />
      )}
    </div>
  );
};
