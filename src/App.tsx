import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import ImagePane from './components/ImagePane';
import BeforeAfterPreview from './components/BeforeAfterPreview';
import ProofControls from './components/ProofControls';
import { decisionTree } from './decisionTree';
import type {
  DecisionTreeAnswer,
  DecisionTreeNode,
  HistoryEntry,
  ImageState,
  LeafNode,
  Line,
  Point,
  ProofState,
  ProofType,
  QuestionNode,
  UnitCellState,
} from './types';
import { PATCH_SIZE, glidePatch, reflectPatch, rotatePatch, samplePatch } from './utils/imageTools';
import './App.css';

const initialImageState: ImageState = {
  src: null,
  element: null,
  width: 0,
  height: 0,
};

const defaultUnitCell: UnitCellState = {
  A: { x: 0.15, y: 0.15 },
  B: { x: 0.45, y: 0.15 },
  C: { x: 0.2, y: 0.45 },
  D: { x: 0.5, y: 0.45 },
};

const revokeObjectUrl = (url: string | null) => {
  if (url) {
    URL.revokeObjectURL(url);
  }
};

function resolveProofRequirements(node: QuestionNode, answer?: DecisionTreeAnswer) {
  const type = answer?.proofType ?? node.proofType ?? 'none';
  return { type, rotationAngleDeg: answer?.rotationAngleDeg };
}

function createProofState(type: ProofType, rotationAngleDeg?: number): ProofState {
  const base = {
    ready: type === 'none',
    before: null,
    after: null,
    patchSize: PATCH_SIZE,
    patchSample: null,
  };

  if (type === 'rotation') {
    return {
      ...base,
      type,
      center: null,
      angleDeg: rotationAngleDeg ?? 180,
      repeats: 1,
    };
  }

  if (type === 'mirror') {
    return {
      ...base,
      type,
      line: null,
    };
  }

  if (type === 'glide') {
    return {
      ...base,
      type,
      line: null,
      distance: 0.5,
    };
  }

  return {
    ...base,
    type: 'none',
  };
}

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [image, setImage] = useState<ImageState>(initialImageState);
  const [currentNodeId, setCurrentNodeId] = useState(decisionTree.start);
  const [selectedAnswerKey, setSelectedAnswerKey] = useState<string | null>(null);
  const [proofState, setProofState] = useState<ProofState>(createProofState('none'));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [draftStore, setDraftStore] = useState<Record<string, Record<string, ProofState>>>({});
  const [unitCell, setUnitCell] = useState<UnitCellState>(defaultUnitCell);

  const currentNode = useMemo<DecisionTreeNode | null>(() => {
    return decisionTree.nodes[currentNodeId] ?? null;
  }, [currentNodeId]);

  const imageReady = Boolean(image.element);
  const isLeaf = currentNode?.type === 'leaf';
  const showUnitCellGuides =
    currentNode?.type === 'question' && currentNode.needsUnitCell ? true : false;

  const handleUnitCellChange = (next: UnitCellState) => {
    setUnitCell({
      A: {
        x: Math.min(Math.max(next.A.x, 0), 1),
        y: Math.min(Math.max(next.A.y, 0), 1),
      },
      B: {
        x: Math.min(Math.max(next.B.x, 0), 1),
        y: Math.min(Math.max(next.B.y, 0), 1),
      },
      C: {
        x: Math.min(Math.max(next.C.x, 0), 1),
        y: Math.min(Math.max(next.C.y, 0), 1),
      },
      D: {
        x: Math.min(Math.max(next.D.x, 0), 1),
        y: Math.min(Math.max(next.D.y, 0), 1),
      },
    });
  };
  const patchSizeLimits = useMemo(() => {
    if (!image.element || !image.width || !image.height) {
      return { min: 60, max: 600 };
    }
    const minDim = Math.min(image.width, image.height);
    const max = Math.max(80, minDim);
    const min = Math.max(40, Math.min(max - 20, minDim * 0.2));
    return { min, max };
  }, [image]);

  useEffect(() => {
    return () => revokeObjectUrl(objectUrl);
  }, [objectUrl]);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    evt.target.value = '';
    if (!file) return;
    if (objectUrl) revokeObjectUrl(objectUrl);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage({
        src: url,
        element: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      setCurrentNodeId(decisionTree.start);
      setSelectedAnswerKey(null);
      setHistory([]);
      setProofState(createProofState('none'));
      setUnitCell(defaultUnitCell);
    };
    img.onerror = () => revokeObjectUrl(url);
    img.src = url;
    setObjectUrl(url);
  };

  const handleRestart = () => {
    setCurrentNodeId(decisionTree.start);
    setSelectedAnswerKey(null);
    setHistory([]);
    setProofState(createProofState('none'));
    setDraftStore({});
    setUnitCell(defaultUnitCell);
  };

  const handleSelectAnswer = (answerKey: string) => {
    if (!imageReady) return;
    if (!currentNode || currentNode.type !== 'question') return;
    const answer = currentNode.answers.find((candidate) => candidate.key === answerKey);
    if (!answer) return;
    const { type, rotationAngleDeg } = resolveProofRequirements(currentNode, answer);
    setSelectedAnswerKey(answerKey);
    const draftsForNode = draftStore[currentNodeId] ?? {};
    const existingDraft = draftsForNode[answerKey];
    const newProofState = existingDraft ?? createProofState(type, rotationAngleDeg);
    setProofState(newProofState);
  };

  useEffect(() => {
    if (
      selectedAnswerKey &&
      proofState.type === 'none' &&
      currentNode &&
      currentNode.type === 'question'
    ) {
      handleConfirmAnswer();
    }
  }, [proofState.type, selectedAnswerKey, currentNode]);

  useEffect(() => {
    if (!selectedAnswerKey) return;
    setDraftStore((prev) => {
      const nodeDrafts = prev[currentNodeId] ?? {};
      return {
        ...prev,
        [currentNodeId]: { ...nodeDrafts, [selectedAnswerKey]: proofState },
      };
    });
  }, [currentNodeId, proofState, selectedAnswerKey]);

  const handleResetProof = () => {
    if (!currentNode || currentNode.type !== 'question' || !selectedAnswerKey) return;
    const answer = currentNode.answers.find((candidate) => candidate.key === selectedAnswerKey);
    if (!answer) return;
    const { type, rotationAngleDeg } = resolveProofRequirements(currentNode, answer);
    setProofState(createProofState(type, rotationAngleDeg));
  };

  const handleRotationPick = (point: Point) => {
    if (!image.element) return;
    const img = image.element;
    setProofState((prev) => {
      if (prev.type !== 'rotation') return prev;
      const patch = samplePatch(img, point, prev.patchSize);
      if (!patch) return prev;
      const rotated = rotatePatch(patch, prev.angleDeg * prev.repeats, img);
      return {
        ...prev,
        before: patch.data,
        after: rotated,
        center: point,
        patchSample: patch,
        ready: true,
      };
    });
  };

  const captureLine = (line: Line, kind: 'mirror' | 'glide', isFinal = true) => {
    if (!image.element) return;
    const img = image.element;
    setProofState((prev) => {
      if (kind === 'mirror' && prev.type === 'mirror') {
        const midPoint: Point = { x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 };
        const patch = samplePatch(img, midPoint, prev.patchSize);
        if (!patch) return prev;
        const reflected = reflectPatch(patch, line, img);
        return {
          ...prev,
          before: patch.data,
          after: reflected,
          line,
          patchSample: patch,
          ready: isFinal ? true : prev.ready,
        };
      }
      if (kind === 'glide' && prev.type === 'glide') {
        const midPoint: Point = { x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 };
        const patch = samplePatch(img, midPoint, prev.patchSize);
        if (!patch) return prev;
        const distancePx = prev.distance * (patch.size / 2);
        const glided = glidePatch(patch, line, distancePx, img);
        return {
          ...prev,
          before: patch.data,
          after: glided,
          line,
          patchSample: patch,
          ready: isFinal ? true : prev.ready,
        };
      }
      return prev;
    });
  };

  const handleMirrorLine = (line: Line) => captureLine(line, 'mirror');
  const handleGlideLine = (line: Line) => captureLine(line, 'glide');
  const handleDraftLine = (line: Line, kind: 'mirror' | 'glide') =>
    captureLine(line, kind, false);

  const handleGlideDistanceChange = (value: number) => {
    if (!image.element) return;
    const img = image.element;
    const baseLength = Math.max(image.width ?? 0, image.height ?? 0);
    setProofState((prev) => {
      if (prev.type !== 'glide' || !prev.patchSample || !prev.line) {
        return prev;
      }
      const distancePx = value * baseLength;
      const after = glidePatch(prev.patchSample, prev.line, distancePx, img);
      return {
        ...prev,
        distance: value,
        after,
      };
    });
  };

  const resizePatch = (prev: ProofState, size: number): ProofState => {
    if (!image.element) return { ...prev, patchSize: size };
    const img = image.element;
    if (prev.type === 'rotation' && prev.center) {
      const patch = samplePatch(img, prev.center, size);
      if (!patch) return { ...prev, patchSize: size };
      const rotated = rotatePatch(patch, prev.angleDeg * prev.repeats, img);
      return { ...prev, before: patch.data, after: rotated, patchSample: patch, patchSize: size };
    }
    if ((prev.type === 'mirror' || prev.type === 'glide') && prev.line) {
      const midPoint: Point = {
        x: (prev.line.x1 + prev.line.x2) / 2,
        y: (prev.line.y1 + prev.line.y2) / 2,
      };
      const patch = samplePatch(img, midPoint, size);
      if (!patch) return { ...prev, patchSize: size };
      if (prev.type === 'mirror') {
        const reflected = reflectPatch(patch, prev.line, img);
        return { ...prev, before: patch.data, after: reflected, patchSample: patch, patchSize: size };
      }
      const baseLength = Math.max(image.width ?? 0, image.height ?? 0);
      const distancePx = prev.distance * baseLength;
      const glided = glidePatch(patch, prev.line, distancePx, img);
      return { ...prev, before: patch.data, after: glided, patchSample: patch, patchSize: size };
    }
    return { ...prev, patchSize: size };
  };

  const handlePatchSizeChange = (value: number) => {
    const clamped = Math.min(Math.max(value, patchSizeLimits.min), patchSizeLimits.max);
    setProofState((prev) => resizePatch(prev, clamped));
  };

  const handleRotationRepeatChange = (value: number) => {
    if (!image.element) return;
    const repeats = Math.max(1, value);
    const img = image.element;
    setProofState((prev) => {
      if (prev.type !== 'rotation' || !prev.center || !prev.patchSample) {
        return prev;
      }
      const rotated = rotatePatch(prev.patchSample, prev.angleDeg * repeats, img);
      return { ...prev, repeats, after: rotated };
    });
  };

  const handleChangeAnswer = () => {
    setSelectedAnswerKey(null);
    setProofState(createProofState('none'));
  };

  const handleConfirmAnswer = () => {
    if (!currentNode || currentNode.type !== 'question') return;
    if (!selectedAnswerKey || !proofState.ready) return;
    const answer = currentNode.answers.find((candidate) => candidate.key === selectedAnswerKey);
    if (!answer) return;
    setHistory((prev) => [...prev, { nodeId: currentNode.id, selectedAnswerKey }]);
    setCurrentNodeId(answer.next);
    setSelectedAnswerKey(null);
    setProofState(createProofState('none'));
    setDraftStore((prev) => ({
      ...prev,
      [answer.next]: prev[answer.next] ?? {},
    }));
  };

  const handleBack = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const nextHistory = [...prev];
      const last = nextHistory.pop()!;
      setCurrentNodeId(last.nodeId);
      setSelectedAnswerKey(last.selectedAnswerKey);
      const node = decisionTree.nodes[last.nodeId];
      if (node && node.type === 'question' && last.selectedAnswerKey) {
        const storedDraft = (draftStore[last.nodeId] ?? {})[last.selectedAnswerKey];
        if (storedDraft) {
          setProofState(storedDraft);
        } else {
          const answer = node.answers.find((candidate) => candidate.key === last.selectedAnswerKey);
          const { type, rotationAngleDeg } = resolveProofRequirements(node, answer);
          setProofState(createProofState(type, rotationAngleDeg));
        }
      } else {
        setProofState(createProofState('none'));
      }
      return nextHistory;
    });
  };

  const canGoBack = history.length > 0;
  const proofInteractionsEnabled = imageReady && Boolean(selectedAnswerKey) && !isLeaf;

  const renderLeaf = (leaf: LeafNode) => (
    <div className="leaf-card">
      <p className="leaf-card__label">Classification complete</p>
      <p className="leaf-card__code">{leaf.groupCode}</p>
      {leaf.description && <p className="leaf-card__description">{leaf.description}</p>}
      <div className="nav-row">
        <button className="ghost" onClick={handleBack} disabled={!canGoBack}>
          Back
        </button>
        <button className="primary" onClick={handleRestart}>
          Restart
        </button>
      </div>
    </div>
  );

  const renderQuestion = (node: QuestionNode) => {
    const prompt = node.questionText || (node as any).text || '';
    const noteContent = node.note;
    const notes =
      typeof noteContent === 'string'
        ? [noteContent]
        : Array.isArray(noteContent)
          ? noteContent
          : null;
    return (
      <>
        <div className="question-card">
          <div className="question-card__header">
            <h2>{prompt}</h2>
            {!imageReady && <p className="question-card__hint">Upload an image to answer.</p>}
          </div>
          {notes && (
            <ul className="question-card__notes">
              {notes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        <div className="answer-grid">
          {node.answers.map((answer) => (
            <button
              key={answer.key}
              type="button"
              className={`answer-button ${selectedAnswerKey === answer.key ? 'answer-button--active' : ''}`}
              onClick={() => handleSelectAnswer(answer.key)}
              disabled={!imageReady}
            >
              {answer.label}
            </button>
          ))}
        </div>
      </div>

      {!(selectedAnswerKey && proofState.type === 'none') && (
        <div className="proof-card">
          {selectedAnswerKey ? (
            <>
            <ProofControls
              proofState={proofState}
              activeProofType={proofState.type}
              interactionsEnabled={proofInteractionsEnabled}
              onGlideDistanceChange={handleGlideDistanceChange}
              onRotationRepeatChange={handleRotationRepeatChange}
              onPatchSizeChange={handlePatchSizeChange}
              patchSizeLimits={patchSizeLimits}
              glideMaxDistance={image.width && proofState.patchSample ? (image.width / proofState.patchSample.size) : 1}
              onResetProof={handleResetProof}
            />
              <BeforeAfterPreview before={proofState.before} after={proofState.after} />
              <div className="proof-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={handleConfirmAnswer}
                  disabled={!proofState.ready}
                >
                  Looks right → Continue
                </button>
                <button type="button" className="ghost" onClick={handleChangeAnswer}>
                  Change my answer
                </button>
              </div>
            </>
          ) : (
            <p className="proof-panel__hint">Pick an answer to unlock the proof step.</p>
          )}
        </div>
      )}

      <div className="nav-row">
        <button className="ghost" onClick={handleBack} disabled={!canGoBack}>
          Back
        </button>
      </div>
    </>
  );
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar__content">
          <h1>Wallpaper Symmetry Lab</h1>
          <div className="top-bar__actions">
            <button type="button" className="primary" onClick={handleUploadClick}>
              Upload image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
            />
            <button type="button" className="ghost" onClick={handleRestart} disabled={!imageReady}>
              Restart
            </button>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="image-pane">
          <div className="pane-heading">
            <h2>Image & overlays</h2>
            {!imageReady && (
              <p className="pane-hint">Upload a repeating wallpaper or frieze pattern.</p>
            )}
          </div>
          <ImagePane
            image={image}
            proofState={proofState}
            activeProofType={proofState.type}
            interactionsEnabled={proofInteractionsEnabled}
            onRotationPick={handleRotationPick}
            onMirrorLine={handleMirrorLine}
            onGlideLine={handleGlideLine}
            onDraftLine={handleDraftLine}
            showUnitCellGuides={showUnitCellGuides}
            unitCell={unitCell}
            onUnitCellChange={handleUnitCellChange}
            unitCellEditable={showUnitCellGuides}
          />
        </section>

        <section className="question-pane">
          {currentNode && currentNode.type === 'leaf' && renderLeaf(currentNode)}
          {currentNode && currentNode.type === 'question' && renderQuestion(currentNode)}
        </section>
      </main>
    </div>
  );
}

export default App;
