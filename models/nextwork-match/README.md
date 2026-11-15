# Nextwork Match / EvidenceNet

Original compact supervised classifier for resume-requirement evidence. The learned weights are in `dist/nextwork-model.js`; `dist/nextwork-features.js` defines deterministic inputs and `dist/nextwork-match.js` implements inference, conservative guards, evidence selection, and suggestions. Both the custom model and the surrounding rules are documented in the [model card](../../dist/nextwork-match-model-card.md).

## Reproduce training (free, CPU)

Use Node 22+ and Python 3.11+. No API key, user data, or GPU is needed.

```sh
python3 -m venv /tmp/nextwork-model-env
/tmp/nextwork-model-env/bin/pip install -r models/nextwork-match/requirements.txt
node models/nextwork-match/build-data.cjs
node models/nextwork-match/build-challenge.cjs
OPENBLAS_NUM_THREADS=1 /tmp/nextwork-model-env/bin/python models/nextwork-match/train.py
node models/nextwork-match/evaluate.cjs
node tests/nextwork-match.test.js
```

Or run the **Train Nextwork Match** GitHub Actions workflow. It exports a candidate model and evaluation artifacts; it does not overwrite the production model. Review the model card and full benchmark errors before promoting any retrained artifact.

`data/*.jsonl` are authored synthetic examples. The three generated splits separate both concept families and sentence templates. `challenge.jsonl` is a developer-authored development suite, not an independent human benchmark. `data/features.json` is generated and ignored. `verification.json` contains input vectors and Python inference outputs for cross-runtime parity checks. `evaluation.json` measures the raw classifier; `benchmark.json` measures the application pipeline, including guards. Do not report these synthetic metrics as real-world accuracy.

## Extending safely

Do not place live resumes, emails, profile records, or secrets in this dataset. Real examples require separate opt-in consent, de-identification, qualified annotations, and a held-out evaluation split grouped by person, organization, and listing. No automatic ingestion of user resumes is enabled. Keep hard credentials and dates in manual review. Keep the job/field rubric separate from learned classifier probabilities.

After a feature change, regenerate data and retrain so `featuresSha256` remains aligned. Publish matching changes to `dist/` and mirror into `docs/`, including all three runtime scripts. Bump frontend cache versions. The original pretrained-transformer proposal remains a possible later model architecture; this first implementation uses a smaller original MLP to run synchronously on the current free static site.
