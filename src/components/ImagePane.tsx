import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ImageState, Line, Point, ProofState, ProofType, UnitCellState } from '../types';

interface ImagePaneProps {
  image: ImageState;
  proofState: ProofState;
  activeProofType: ProofType;
  interactionsEnabled: boolean;
  onRotationPick?: (point: Point) => void;
  onMirrorLine?: (line: Line) => void;
  onGlideLine?: (line: Line) => void;
  onDraftLine?: (line: Line, kind: 'mirror' | 'glide') => void;
  showUnitCellGuides?: boolean;
  unitCell?: UnitCellState;
  onUnitCellChange?: (cell: UnitCellState) => void;
  unitCellEditable?: boolean;
}

const HANDLE_RADIUS = 8;
const HANDLE_HIT_RADIUS = 14;
const LINE_HIT_THRESHOLD = 12;
const CENTER_HIT_RADIUS = 14;

function lengthOf(line: Line | null) {
  if (!line) return 0;
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

function distanceToLine(point: Point, line: Line, scale: number) {
  const x1 = line.x1;
  const y1 = line.y1;
  const x2 = line.x2;
  const y2 = line.y2;
  const A = point.x - x1;
  const B = point.y - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;
  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  const dx = (point.x - xx) * scale;
  const dy = (point.y - yy) * scale;
  return Math.hypot(dx, dy);
}

export function ImagePane({
  image,
  proofState,
  activeProofType,
  interactionsEnabled,
  onRotationPick,
  onMirrorLine,
  onGlideLine,
  onDraftLine,
  showUnitCellGuides = false,
  unitCell,
  onUnitCellChange,
  unitCellEditable = false,
}: ImagePaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const isDrawingRef = useRef(false);
  const draftLineRef = useRef<Line | null>(null);
  const [draftLine, setDraftLine] = useState<Line | null>(null);
  const editingHandleRef = useRef<'start' | 'end' | null>(null);
  const editingLineKindRef = useRef<'mirror' | 'glide' | null>(null);
  const rotationDragRef = useRef(false);
  const lineDragRef = useRef<{ lastX: number; lastY: number; kind: 'mirror' | 'glide' } | null>(
    null
  );
  const unitCellDragRef = useRef<'A' | 'B' | 'C' | 'D' | null>(null);

  const imageNaturalWidth =
    image.width || image.element?.naturalWidth || (canvasSize.width && scale ? canvasSize.width / scale : 1);
  const imageNaturalHeight =
    image.height || image.element?.naturalHeight || (canvasSize.height && scale ? canvasSize.height / scale : 1);

  const normalizedToImage = (point: Point | undefined | null) => {
    if (!point) return null;
    return { x: point.x * imageNaturalWidth, y: point.y * imageNaturalHeight };
  };

  const imageToNormalized = (point: Point) => ({
    x: Math.min(Math.max(point.x / imageNaturalWidth, 0), 1),
    y: Math.min(Math.max(point.y / imageNaturalHeight, 0), 1),
  });

  const unitCellPoints = (() => {
    if (!unitCell) return null;
    const A = normalizedToImage(unitCell.A);
    const B = normalizedToImage(unitCell.B);
    const C = normalizedToImage(unitCell.C);
    const D = normalizedToImage(unitCell.D);
    if (!A || !B || !C || !D) return null;
    return { A, B, C, D };
  })();

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!image.element || containerSize.width === 0 || containerSize.height === 0) {
      setCanvasSize({ width: 0, height: 0 });
      return;
    }
    const naturalWidth = image.width || image.element.naturalWidth;
    const naturalHeight = image.height || image.element.naturalHeight;
    if (!naturalWidth || !naturalHeight) return;
    const ratio = Math.min(
      containerSize.width / naturalWidth,
      containerSize.height / naturalHeight,
      1
    );
    setScale(ratio || 1);
    setCanvasSize({ width: naturalWidth * ratio, height: naturalHeight * ratio });
  }, [containerSize, image]);

  useEffect(() => {
    if (!image.element) return;
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0 || canvasSize.height === 0) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image.element, 0, 0, canvasSize.width, canvasSize.height);
  }, [image, canvasSize]);

  const getCoords = (evt: MouseEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / scale;
    const y = (evt.clientY - rect.top) / scale;
    return { x, y };
  };

  const startLine = (point: Point) => {
    const line: Line = { x1: point.x, y1: point.y, x2: point.x, y2: point.y };
    draftLineRef.current = line;
    setDraftLine({ ...line });
  };

  const updateLine = (point: Point) => {
    if (!draftLineRef.current) return;
    draftLineRef.current = { ...draftLineRef.current, x2: point.x, y2: point.y };
    setDraftLine({ ...draftLineRef.current });
  };

  const commitLine = () => {
    const finalLine = draftLineRef.current;
    draftLineRef.current = null;
    setDraftLine(null);
    return finalLine;
  };

  useEffect(() => {
    const handleMove = (evt: MouseEvent) => {
      const coords = getCoords(evt);
      if (!coords) return;
      if (
        unitCellDragRef.current &&
        unitCell &&
        unitCellEditable &&
        onUnitCellChange &&
        unitCellPoints
      ) {
        const corner = unitCellDragRef.current;
        const normalizedPoint = imageToNormalized(coords);
        onUnitCellChange({ ...unitCell, [corner]: normalizedPoint });
        return;
      }
      if (lineDragRef.current && draftLineRef.current) {
        const { kind } = lineDragRef.current;
        const prevLine = draftLineRef.current;
        const dx = coords.x - lineDragRef.current.lastX;
        const dy = coords.y - lineDragRef.current.lastY;
        draftLineRef.current = {
          x1: prevLine.x1 + dx,
          y1: prevLine.y1 + dy,
          x2: prevLine.x2 + dx,
          y2: prevLine.y2 + dy,
        };
        lineDragRef.current.lastX = coords.x;
        lineDragRef.current.lastY = coords.y;
        setDraftLine({ ...draftLineRef.current });
        onDraftLine?.({ ...draftLineRef.current }, kind);
        return;
      }
      if (rotationDragRef.current) {
        onRotationPick?.(coords);
        return;
      }
      if (editingHandleRef.current && draftLineRef.current) {
        if (editingHandleRef.current === 'start') {
          draftLineRef.current = { ...draftLineRef.current, x1: coords.x, y1: coords.y };
        } else {
          draftLineRef.current = { ...draftLineRef.current, x2: coords.x, y2: coords.y };
        }
        setDraftLine({ ...draftLineRef.current });
        if (editingLineKindRef.current) {
          onDraftLine?.({ ...draftLineRef.current }, editingLineKindRef.current);
        }
        return;
      }
      if (!isDrawingRef.current) return;
      updateLine(coords);
      if (draftLineRef.current && activeProofType === 'mirror') {
        onDraftLine?.({ ...draftLineRef.current }, 'mirror');
      } else if (draftLineRef.current && activeProofType === 'glide') {
        onDraftLine?.({ ...draftLineRef.current }, 'glide');
      }
    };
    const handleUp = () => {
      if (unitCellDragRef.current) {
        unitCellDragRef.current = null;
        return;
      }
      if (rotationDragRef.current) {
        rotationDragRef.current = false;
        return;
      }
      if (lineDragRef.current && draftLineRef.current) {
        const finalLine = { ...draftLineRef.current };
        const kind = lineDragRef.current.kind;
        lineDragRef.current = null;
        draftLineRef.current = null;
        setDraftLine(null);
        if (kind === 'mirror') onMirrorLine?.(finalLine);
        else onGlideLine?.(finalLine);
        return;
      }
      if (editingHandleRef.current && draftLineRef.current) {
        const finalLine = { ...draftLineRef.current };
        const kind = editingLineKindRef.current;
        editingHandleRef.current = null;
        editingLineKindRef.current = null;
        draftLineRef.current = null;
        setDraftLine(null);
        if (kind === 'mirror') {
          onMirrorLine?.(finalLine);
        } else if (kind === 'glide') {
          onGlideLine?.(finalLine);
        }
        return;
      }
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const finalLine = commitLine();
      if (finalLine && lengthOf(finalLine) > 8) {
        if (activeProofType === 'mirror') {
          onMirrorLine?.(finalLine);
        } else if (activeProofType === 'glide') {
          onGlideLine?.(finalLine);
        }
      }
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [activeProofType, onDraftLine, onGlideLine, onMirrorLine, scale]);

  const handleMouseDown = (evt: React.MouseEvent) => {
    if (!interactionsEnabled) return;
    const coords = getCoords(evt);
    if (!coords) return;
    if (
      showUnitCellGuides &&
      unitCellEditable &&
      unitCell &&
      unitCellPoints &&
      onUnitCellChange
    ) {
      const hitCorner = (corner: 'A' | 'B' | 'C' | 'D', point: Point | null) => {
        if (!point) return false;
        const dist = Math.hypot(point.x - coords.x, point.y - coords.y) * scale;
        if (dist <= HANDLE_HIT_RADIUS) {
          unitCellDragRef.current = corner;
          return true;
        }
        return false;
      };
      if (
        hitCorner('A', unitCellPoints.A) ||
        hitCorner('B', unitCellPoints.B) ||
        hitCorner('C', unitCellPoints.C) ||
        hitCorner('D', unitCellPoints.D)
      ) {
        return;
      }
    }
    if (
      activeProofType === 'rotation' &&
      proofState.type === 'rotation' &&
      proofState.center
    ) {
      const dist = Math.hypot(
        (coords.x - proofState.center.x) * scale,
        (coords.y - proofState.center.y) * scale,
      );
      if (dist <= CENTER_HIT_RADIUS) {
        rotationDragRef.current = true;
        onRotationPick?.(coords);
        return;
      }
    }
    const currentLine =
      proofState.type === 'mirror' || proofState.type === 'glide' ? proofState.line : null;
    if ((activeProofType === 'mirror' || activeProofType === 'glide') && currentLine) {
      const kind = activeProofType;
      const startHit =
        Math.hypot(
          (coords.x - currentLine.x1) * scale,
          (coords.y - currentLine.y1) * scale,
        ) <= HANDLE_HIT_RADIUS;
      const endHit =
        Math.hypot(
          (coords.x - currentLine.x2) * scale,
          (coords.y - currentLine.y2) * scale,
        ) <= HANDLE_HIT_RADIUS;
      if (startHit || endHit) {
        editingHandleRef.current = startHit ? 'start' : 'end';
        editingLineKindRef.current = kind;
        draftLineRef.current = { ...currentLine };
        setDraftLine({ ...currentLine });
        return;
      }
      const dist = distanceToLine(coords, currentLine, scale);
      if (dist <= LINE_HIT_THRESHOLD) {
        lineDragRef.current = { lastX: coords.x, lastY: coords.y, kind };
        draftLineRef.current = { ...currentLine };
        setDraftLine({ ...currentLine });
        return;
      }
    }
    if (activeProofType !== 'mirror' && activeProofType !== 'glide') return;
    isDrawingRef.current = true;
    startLine(coords);
  };

  const handleCanvasClick = (evt: React.MouseEvent) => {
    if (!interactionsEnabled) return;
    if (activeProofType !== 'rotation') return;
    const coords = getCoords(evt);
    if (!coords) return;
    onRotationPick?.(coords);
  };

  const rotationCenter =
    proofState.type === 'rotation' && proofState.center ? proofState.center : null;
  const proofLine =
    (proofState.type === 'mirror' || proofState.type === 'glide') && proofState.line
      ? proofState.line
      : null;
  const patchSample = proofState.patchSample;

  const toDisplay = (value: number) => value * scale;

  return (
    <div className="image-pane__container" ref={containerRef}>
      {image.element && canvasSize.width > 0 ? (
        <div
          className="image-pane__stage"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          <canvas
            ref={canvasRef}
            className="image-pane__canvas"
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseDown={handleMouseDown}
            onClick={handleCanvasClick}
          />
          <svg
            className="image-pane__overlay"
            width={canvasSize.width}
            height={canvasSize.height}
            viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
          >
            {patchSample && !showUnitCellGuides && (
              <rect
                x={toDisplay(patchSample.origin.x)}
                y={toDisplay(patchSample.origin.y)}
                width={patchSample.size * scale}
                height={patchSample.size * scale}
                className="patch-box"
              />
            )}
            {showUnitCellGuides && unitCellPoints && (
              <>
                <path
                  className="unit-cell-outline"
                  d={`M ${toDisplay(unitCellPoints.A!.x)} ${toDisplay(unitCellPoints.A!.y)}
                      L ${toDisplay(unitCellPoints.B!.x)} ${toDisplay(unitCellPoints.B!.y)}
                      L ${toDisplay(unitCellPoints.D!.x)} ${toDisplay(unitCellPoints.D!.y)}
                      L ${toDisplay(unitCellPoints.C!.x)} ${toDisplay(unitCellPoints.C!.y)} Z`}
                />
                <line
                  x1={toDisplay(unitCellPoints.A!.x)}
                  y1={toDisplay(unitCellPoints.A!.y)}
                  x2={toDisplay(unitCellPoints.D!.x)}
                  y2={toDisplay(unitCellPoints.D!.y)}
                  className="unit-cell-diagonal"
                />
                <line
                  x1={toDisplay(unitCellPoints.B!.x)}
                  y1={toDisplay(unitCellPoints.B!.y)}
                  x2={toDisplay(unitCellPoints.C!.x)}
                  y2={toDisplay(unitCellPoints.C!.y)}
                  className="unit-cell-diagonal"
                />
                {(['A', 'B', 'C', 'D'] as const).map((corner) => {
                  const pt = unitCellPoints[corner];
                  if (!pt) return null;
                  return (
                    <circle
                      key={corner}
                      className={unitCellEditable ? 'unit-cell-handle' : 'unit-cell-handle unit-cell-handle--disabled'}
                      cx={toDisplay(pt.x)}
                      cy={toDisplay(pt.y)}
                      r={HANDLE_RADIUS}
                    />
                  );
                })}
              </>
            )}
            {rotationCenter && (
              <circle
                cx={toDisplay(rotationCenter.x)}
                cy={toDisplay(rotationCenter.y)}
                r={6}
                className="overlay-dot"
              />
            )}
            {proofLine && (
              <>
                <line
                  x1={toDisplay(proofLine.x1)}
                  y1={toDisplay(proofLine.y1)}
                  x2={toDisplay(proofLine.x2)}
                  y2={toDisplay(proofLine.y2)}
                  className="overlay-line"
                />
                <circle
                  className="line-handle"
                  cx={toDisplay(proofLine.x1)}
                  cy={toDisplay(proofLine.y1)}
                  r={HANDLE_RADIUS}
                />
                <circle
                  className="line-handle"
                  cx={toDisplay(proofLine.x2)}
                  cy={toDisplay(proofLine.y2)}
                  r={HANDLE_RADIUS}
                />
              </>
            )}
            {draftLine && (
              <line
                x1={toDisplay(draftLine.x1)}
                y1={toDisplay(draftLine.y1)}
                x2={toDisplay(draftLine.x2)}
                y2={toDisplay(draftLine.y2)}
                className="overlay-line overlay-line--draft"
              />
            )}
          </svg>
        </div>
      ) : (
        <div className="image-pane__placeholder">Upload an image to start the lab.</div>
      )}
    </div>
  );
}

export default ImagePane;
