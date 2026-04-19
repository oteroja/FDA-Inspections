# FDA Inspection Risk Profile

A static GitHub Pages app for estimating whether a case is likely NAI, VAI, or OAI.

## What it does

- Uses the first LightGBM model from the notebook, the one optimized for macro F1.
- Accepts minimal ex ante inputs from the user.
- Infers the rest of the model features with notebook-derived mappings.
- Shows a three-class probability profile for one case.

## Model notes

- Data source: the FDA inspection dataset used in `Untitled-1.ipynb`.
- Target classes: `NAI`, `VAI`, `OAI`.
- Feature engineering: administration mapping, region mapping, product frequency ranks, and facility history counts frozen through fiscal year 2023.
- The exported browser bundle is stored in `site/assets/fda_model_export.json`.

## Publish to GitHub Pages

1. Push this repository to GitHub.
2. In the repo settings, enable GitHub Pages from the repository root.
3. Open `index.html` in the published site.

## Local preview

Run a simple static server from the repository root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
