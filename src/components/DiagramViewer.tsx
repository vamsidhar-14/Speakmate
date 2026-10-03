import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import {
  Maximize2,
  Minimize2,
  Download,
  Copy,
  Check,
  Code2,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Layers,
  AlertCircle
} from 'lucide-react';

// Initialize mermaid once with custom dark engineering theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    darkMode: true,
    background: '#011526',
    primaryColor: '#033a5b',
    primaryTextColor: '#e0f2fe',
    primaryBorderColor: '#00cfff',
    lineColor: '#20f5a2',
    secondaryColor: '#0c2742',
    tertiaryColor: '#032038',
    mainBkg: '#021e36',
    nodeBorder: '#00d2ff',
    clusterBkg: 'rgba(2, 30, 54, 0.7)',
    clusterBorder: '#00cfff',
    titleColor: '#20f5a2',
    edgeLabelBackground: '#011a2f',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSize: '13px',
  },
  securityLevel: 'loose',
});

interface DiagramViewerProps {
  code: string;
  type?: 'mermaid' | 'svg' | 'auto';
  title?: string;
  description?: string;
  keyComponents?: string[];
  className?: string;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export const DiagramViewer: React.FC<DiagramViewerProps> = ({
  code,
  type = 'auto',
  title,
  description,
  keyComponents,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderedSvg, setRenderedSvg] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isRendering, setIsRendering] = useState(false);

  // Detect whether this is pure SVG or Mermaid
  const cleanCode = code ? code.trim() : '';
  const isSvg = type === 'svg' || (type === 'auto' && cleanCode.startsWith('<svg'));

  useEffect(() => {
    let isMounted = true;

    if (isSvg) {
      setRenderedSvg(cleanCode);
      setRenderError(null);
      return;
    }

    // Otherwise render with Mermaid
    const renderMermaid = async () => {
      if (!cleanCode) return;
      setIsRendering(true);
      setRenderError(null);

      try {
        const uniqueId = `mermaid-graph-${Math.random().toString(36).substring(2, 9)}`;
        // Clean mermaid code if it contains markdown markers
        let processedCode = cleanCode;
        if (processedCode.startsWith('```mermaid')) {
          processedCode = processedCode.replace(/^```mermaid\s*/, '').replace(/```$/, '').trim();
        } else if (processedCode.startsWith('```')) {
          processedCode = processedCode.replace(/^```[a-z]*\s*/, '').replace(/```$/, '').trim();
        }

        const { svg } = await mermaid.render(uniqueId, processedCode);
        if (isMounted) {
          setRenderedSvg(svg);
          setRenderError(null);
        }
      } catch (err: any) {
        console.warn('Mermaid rendering notice:', err);
        if (isMounted) {
          setRenderError(err?.message || 'Diagram syntax requires adjustment.');
        }
      } finally {
        if (isMounted) {
          setIsRendering(false);
        }
      }
    };

    renderMermaid();

    return () => {
      isMounted = false;
    };
  }, [cleanCode, isSvg]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    const svgToDownload = renderedSvg || (isSvg ? cleanCode : '');
    if (!svgToDownload) return;

    const blob = new Blob([svgToDownload], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = (title || 'academic-diagram').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.href = url;
    link.download = `${safeTitle}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div
      className={`rounded-2xl border border-[rgba(0,210,255,0.35)] bg-[rgba(1,18,34,0.95)] shadow-[0_8px_32px_rgba(0,18,35,0.6)] backdrop-blur-md overflow-hidden transition-all duration-200 ${
        isFullscreen
          ? 'fixed inset-4 z-50 flex flex-col shadow-[0_0_50px_rgba(0,210,255,0.3)] border-[rgba(0,210,255,0.6)]'
          : className
      }`}
    >
      {/* Diagram Header / Toolbar */}
      <div className="px-4 py-2.5 bg-[rgba(2,26,48,0.9)] border-b border-[rgba(0,210,255,0.2)] flex flex-wrap items-center justify-between gap-2 text-white">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#00d2ff]/20 border border-[#00d2ff]/40 flex items-center justify-center text-[#00d2ff]">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold text-xs text-[#dff4ff] tracking-tight block">
              {title || (isSvg ? 'Vector Concept Visualization' : 'Interactive Architecture Diagram')}
            </span>
            <span className="text-[10px] text-[#00d2ff] font-semibold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-[#20f5a2]" />
              {isSvg ? 'Vector SVG' : 'MermaidJS Visualization'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Zoom controls (only in visual mode) */}
          {viewMode === 'visual' && (
            <div className="flex items-center bg-[rgba(1,14,28,0.8)] border border-[rgba(0,210,255,0.25)] rounded-lg px-1 py-0.5 mr-1">
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out"
                className="p-1 hover:text-[#00d2ff] text-[#90b8ce] transition-colors cursor-pointer"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="text-[10px] font-mono px-1 text-[#d4ebf8]">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In"
                className="p-1 hover:text-[#00d2ff] text-[#90b8ce] transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
              {zoomLevel !== 1 && (
                <button
                  type="button"
                  onClick={handleResetZoom}
                  title="Reset Zoom"
                  className="p-1 hover:text-[#20f5a2] text-[#90b8ce] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          )}

          {/* Toggle Visual / Code */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'visual' ? 'code' : 'visual')}
            className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              viewMode === 'code'
                ? 'bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/40'
                : 'text-[#90b8ce] hover:text-white hover:bg-white/5'
            }`}
            title={viewMode === 'visual' ? 'View Diagram Code' : 'View Visual Diagram'}
          >
            {viewMode === 'visual' ? (
              <>
                <Code2 className="w-3 h-3" />
                <span>Code</span>
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                <span>Visual</span>
              </>
            )}
          </button>

          {/* Copy Code */}
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-1.5 rounded-lg text-[#90b8ce] hover:text-[#20f5a2] hover:bg-white/5 transition-colors cursor-pointer"
            title="Copy Diagram Syntax"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#20f5a2]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download SVG */}
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="p-1.5 rounded-lg text-[#90b8ce] hover:text-[#00d2ff] hover:bg-white/5 transition-colors cursor-pointer"
            title="Download SVG Vector Graphic"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-[#90b8ce] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div
        className={`p-4 overflow-auto flex-1 transition-all ${
          isFullscreen ? 'min-h-[500px]' : 'max-h-[500px] min-h-[220px]'
        } flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(0,35,65,0.4),rgba(1,14,28,0.95))]`}
      >
        {viewMode === 'code' ? (
          <div className="w-full h-full font-mono text-[11px] text-[#b3daf0] overflow-auto p-2">
            <pre className="p-3 bg-[rgba(1,10,20,0.85)] border border-[rgba(0,210,255,0.2)] rounded-xl whitespace-pre-wrap leading-relaxed">
              <code>{cleanCode}</code>
            </pre>
          </div>
        ) : renderError ? (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-md">
            <AlertCircle className="w-8 h-8 text-[#ffb020] mb-2" />
            <h4 className="text-sm font-bold text-white mb-1">Visualization Preview Notice</h4>
            <p className="text-xs text-[#90b8ce] mb-3 leading-relaxed">
              The diagram definition is available. You can view the full syntax, copy it into Mermaid Live editor, or switch to code view.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('code')}
                className="px-3 py-1.5 rounded-lg bg-[#00d2ff]/20 text-[#00d2ff] hover:bg-[#00d2ff]/30 text-xs font-semibold cursor-pointer transition-colors"
              >
                Inspect Code Syntax
              </button>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 text-xs font-semibold cursor-pointer transition-colors"
              >
                Copy Diagram Code
              </button>
            </div>
          </div>
        ) : isRendering ? (
          <div className="flex items-center gap-2 text-xs text-[#00d2ff] py-8">
            <div className="w-4 h-4 border-2 border-[#00d2ff] border-t-transparent rounded-full animate-spin" />
            <span>Rendering visual diagram...</span>
          </div>
        ) : isSvg ? (
          <div
            ref={containerRef}
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
            className="w-full flex items-center justify-center overflow-auto transition-transform duration-150"
            dangerouslySetInnerHTML={{ __html: renderedSvg || cleanCode }}
          />
        ) : (
          <div
            ref={containerRef}
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
            className="w-full flex items-center justify-center overflow-auto transition-transform duration-150 [&>svg]:max-w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: renderedSvg }}
          />
        )}
      </div>

      {/* Description / Educational Breakdown Footer */}
      {(description || (keyComponents && keyComponents.length > 0)) && (
        <div className="px-4 py-2.5 bg-[rgba(2,22,40,0.9)] border-t border-[rgba(0,210,255,0.18)] text-xs">
          {description && (
            <p className="text-[#a8cfeb] text-[11px] leading-relaxed mb-2">
              <strong className="text-[#20f5a2]">Conceptual Takeaway: </strong>
              {description}
            </p>
          )}

          {keyComponents && keyComponents.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-[#709ab2] font-semibold mr-1">Key Components:</span>
              {keyComponents.map((comp, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-[rgba(0,210,255,0.1)] border border-[rgba(0,210,255,0.25)] text-[#d4efff] text-[10px] font-medium"
                >
                  {comp}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
