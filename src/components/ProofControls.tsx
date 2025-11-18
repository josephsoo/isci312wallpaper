import type { ProofState, ProofType } from '../types';

interface ProofControlsProps {
  proofState: ProofState;
  activeProofType: ProofType;
  interactionsEnabled: boolean;
  onGlideDistanceChange: (value: number) => void;
  onRotationRepeatChange: (value: number) => void;
  onPatchSizeChange: (value: number) => void;
  patchSizeLimits: { min: number; max: number };
  glideMaxDistance: number;
  onResetProof: () => void;
}

export function ProofControls({
  proofState,
  activeProofType,
  interactionsEnabled,
  onGlideDistanceChange,
  onRotationRepeatChange,
  onPatchSizeChange,
  patchSizeLimits,
  onResetProof,
  glideMaxDistance,
}: ProofControlsProps) {
  if (activeProofType === 'none') {
    return <p className="proof-panel__hint">No geometric proof required for this answer.</p>;
  }

  const readyText = proofState.ready ? 'Captured ✓' : 'Waiting for input…';
  const patchSlider = (
    <label className="patch-slider">
      <span>Patch size</span>
      <input
        type="range"
        min={Math.max(40, Math.floor(patchSizeLimits.min))}
        max={Math.max(Math.floor(patchSizeLimits.min) + 20, Math.floor(patchSizeLimits.max))}
        step={Math.max(10, Math.floor((patchSizeLimits.max - patchSizeLimits.min) / 20))}
        value={proofState.patchSize}
        onChange={(evt) => onPatchSizeChange(Number(evt.target.value))}
      />
    </label>
  );

  const resetButton = (
    <button type="button" className="ghost" onClick={onResetProof} disabled={!proofState.ready}>
      Clear proof
    </button>
  );

  if (proofState.type === 'rotation') {
    const order = Math.max(1, Math.round(360 / proofState.angleDeg));
    const showRepeatSlider = order > 2;
    return (
      <div className="proof-panel__section">
        <p>Click a point in the image pane where a {proofState.angleDeg}° rotation should work.</p>
        {showRepeatSlider && (
          <label className="rotation-slider">
            <span>Turn</span>
            <input
              type="range"
              min={1}
              max={order - 1}
              step={1}
              value={proofState.repeats}
              onChange={(evt) => onRotationRepeatChange(Number(evt.target.value))}
            />
          </label>
        )}
        <p className="proof-panel__status">Status: {readyText}</p>
        {patchSlider}
        {resetButton}
      </div>
    );
  }

  if (proofState.type === 'mirror') {
    return (
      <div className="proof-panel__section">
        <p>Click and drag to draw the mirror line directly on the image.</p>
        <p className="proof-panel__status">Status: {readyText}</p>
        {patchSlider}
        {resetButton}
      </div>
    );
  }

  if (proofState.type === 'glide') {
    const disabled = !interactionsEnabled || !proofState.line;
    return (
      <div className="proof-panel__section">
        <p>Draw the glide axis, then adjust the slide distance until the patch lines up.</p>
        <label className="glide-slider">
          <span>Slide</span>
          <input
            type="range"
            min={0}
            max={glideMaxDistance}
            step={0.02}
            value={proofState.distance}
            disabled={disabled}
            onChange={(evt) => onGlideDistanceChange(Number(evt.target.value))}
          />
        </label>
        {patchSlider}
        <p className="proof-panel__status">Status: {readyText}</p>
        {resetButton}
      </div>
    );
  }

  return null;
}

export default ProofControls;
