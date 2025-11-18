# Wallpaper Symmetry Lab

A guided classifier for wallpaper and frieze patterns. Upload a motif, answer the prompts from the decision tree, and "prove" each answer with a tiny geometric action directly on the canvas—placing rotation dots or drawing mirror / glide lines. The app extracts a small patch, applies the requested transformation, and shows a before/after comparison so you can visually confirm every step before moving on.

## Highlights

- **Single-page workflow** – Top bar for upload/reset, left pane for the interactive canvas, right pane for the active question and proof controls.
- **Question-driven tree** – The entire experience is backed by a JSON decision tree (`src/decisionTree.ts`). Each node declares its answers, the next node, and the proof type that should be demonstrated.
- **Proof widgets** – Rotation answers require a click to place a center; mirror/glide answers require drawing a line; glides add a slider to adjust the slide distance. Every action updates the preview immediately.
- **Before / After preview** – The right pane always shows the sampled patch next to the transformed canvas so you can see whether the symmetry actually holds before you confirm.
- **Backtracking support** – You can back up to any previous question or restart the entire flow without re-uploading the image.

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser. For a production build run `npm run build` and preview it with `npm run preview`.

## Using the classifier

1. Click **Upload image** and select a repeating wallpaper/frieze photo.
2. The app loads the decision tree and shows the first question. Pick an answer to reveal the corresponding proof instructions.
3. **Prove it**:
   - Rotations: click a point where the specified rotation should hold.
   - Mirrors: click and drag to draw the mirror axis.
   - Glides: draw the axis, then fine‑tune the slide distance with the slider.
4. Watch the **Before / After** patch to see if the transformation lines up. If it does, press _“Yes, looks right → Continue”_. If not, change your answer or redo the proof.
5. Follow the tree until you reach a leaf node—the final wallpaper group label and description.

## Project structure

- `src/App.tsx` – Main page shell, state machine, and navigation logic.
- `src/decisionTree.ts` – The JSON-like definition of the classifier tree. Update this file to tweak copy or add new branches.
- `src/components/` – Small presentational helpers (`ImagePane`, `ProofControls`, `BeforeAfterPreview`).
- `src/utils/imageTools.ts` – Patch extraction plus rotation/mirror/glide transforms used by the proof widgets.
- `src/types.ts` – Shared TypeScript interfaces for the tree, proof state, and geometry primitives.

No external UI frameworks are used—the layout and overlays are handcrafted in CSS/SVG and stay responsive from narrow screens to wide desktops.
