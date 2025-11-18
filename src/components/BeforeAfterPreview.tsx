import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface BeforeAfterPreviewProps {
  before: ImageData | null;
  after: ImageData | null;
}

function useDrawImageData(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  data: ImageData | null,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!data) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    canvas.width = data.width;
    canvas.height = data.height;
    ctx.putImageData(data, 0, 0);
  }, [canvasRef, data]);
}

export function BeforeAfterPreview({ before, after }: BeforeAfterPreviewProps) {
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);

  useDrawImageData(beforeRef, before);
  useDrawImageData(afterRef, after);

  const hasData = Boolean(before);

  return (
    <div className="preview-panel">
      <div className="preview-panel__row">
        <div className="preview-panel__column">
          <p className="preview-panel__label">Before</p>
          <canvas ref={beforeRef} className="preview-panel__canvas" />
        </div>
        <div className="preview-panel__column">
          <p className="preview-panel__label">After</p>
          <canvas ref={afterRef} className="preview-panel__canvas" />
        </div>
      </div>
      {!hasData && <p className="preview-panel__hint">Capture a patch to compare.</p>}
    </div>
  );
}

export default BeforeAfterPreview;
