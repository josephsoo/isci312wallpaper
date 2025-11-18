export interface Point {
  x: number;
  y: number;
}

export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type ProofType = 'none' | 'rotation' | 'mirror' | 'glide';

export interface DecisionTreeAnswer {
  key: string;
  label: string;
  next: string;
  proofType?: ProofType;
  rotationAngleDeg?: number;
}

export interface QuestionNode {
  id: string;
  type: 'question';
  questionText: string;
  proofType?: ProofType;
  note?: string | string[];
  needsUnitCell?: boolean;
  answers: DecisionTreeAnswer[];
}

export interface LeafNode {
  id: string;
  type: 'leaf';
  groupCode: string;
  description?: string;
}

export type DecisionTreeNode = QuestionNode | LeafNode;

export interface DecisionTree {
  start: string;
  nodes: Record<string, DecisionTreeNode>;
}

export interface ImageState {
  src: string | null;
  element: HTMLImageElement | null;
  width: number;
  height: number;
}

export interface UnitCellState {
  A: Point;
  B: Point;
  C: Point;
  D: Point;
}

export interface BaseProofState {
  type: ProofType;
  ready: boolean;
  before: ImageData | null;
  after: ImageData | null;
  patchSize: number;
  patchSample: PatchSample | null;
}

export interface RotationProofState extends BaseProofState {
  type: 'rotation';
  center: Point | null;
  angleDeg: number;
  repeats: number;
}

export interface MirrorProofState extends BaseProofState {
  type: 'mirror';
  line: Line | null;
}

export interface GlideProofState extends BaseProofState {
  type: 'glide';
  line: Line | null;
  distance: number;
}

export interface NoneProofState extends BaseProofState {
  type: 'none';
}

export type ProofState =
  | RotationProofState
  | MirrorProofState
  | GlideProofState
  | NoneProofState;

export interface HistoryEntry {
  nodeId: string;
  selectedAnswerKey: string | null;
}

export interface PatchSample {
  data: ImageData;
  origin: Point;
  relativeCenter: Point;
  size: number;
}
