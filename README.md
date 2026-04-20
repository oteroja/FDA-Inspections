# FDA Inspection Risk Profile

Are you worried about the next FDA inspection? Thus static Github Pages app estimates the likely outcome of an FDA inspection based on very simple information you can provide.

## What it does

- Uses an LightGBM model optimized for macro F1 which was trained with data up to 2024 and tested with 2025 and 2026 data.
- Accepts minimal ex ante inputs from the user.
- Infers the rest of the model features with appropriate mappings.
- Shows a three-class probability profile for one case.

## Model notes

- Data source: the FDA inspection dataset can be found https://datadashboard.fda.gov/oii/cd/inspections.htm.
- Target classes: `NAI`, `VAI`, `OAI`.
- Feature engineering: administration mapping, region mapping, product frequency ranks, and inspection history counts frozen through fiscal year 2023.
- The exported browser bundle is stored in `site/assets/fda_model_export.json`.

## Local preview

Run a simple static server from the repository root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
