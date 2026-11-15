# Nextwork Match — EvidenceNet v1

**Version:** 1.0.0-beta.1 · **Status:** synthetic-trained research beta

## What this model is

An original supervised evidence classifier trained for Nextwork. A 16-input, 16-hidden-unit tanh neural network with a four-class softmax output (340 learned parameters). Its training examples and learned weights were created in this repository. It runs as a small JavaScript artifact on CPU in the browser; matching needs no external inference API, GPU, AI credits, or paid hosting.

This is a compact classifier using engineered text-pair features, not a generative language model or a fine-tuned transformer. It does not have a general language model's understanding. Deterministic concept aliases, clause extraction, guards, and scoring rules surround the learned classifier. The architecture itself is standard; the dataset, weights, and integration are specific to Nextwork.

## Intended use

Help a person compare written resume evidence against an individual listing and Nextwork's separate field-foundation rubric. Show quoted passages, distinguish a bare mention from a described contribution, and suggest where to add accurate evidence. All applicants retain the ability to apply regardless of score. Employers must review applications themselves.

The outputs are **supported**, **partial**, **not evidenced**, and **contradictory**. A postprocessing layer flags conflicting statements and hard requirements such as degrees, certifications, and exact years for manual review. Model probabilities are not calibrated qualification probabilities and are not shown as such.

## How compatibility is calculated

A supported contribution earns 100 evidence points, a partial mention or related-tool passage earns 50, and absent/contradictory/conflicting/manual evidence earns zero automatic points. Requested skills have weight 2 and deliverables weight 1 inside the listing score. Overall compatibility is 75% listing evidence and 25% field foundations. Field foundations are coaching criteria, not additional employer requirements. For an external pasted description, the score averages recognized skill and manual-requirement rows; unrecognized requirements can be missed. Empty/short resumes do not receive marketplace scores.

These numbers are a transparent evidence rubric, not a probability of hiring or an independently validated measure of skill.

## Training data and provenance

- 5,114 original, programmatically generated synthetic training pairs, with authored templates and labels.
- 139 validation pairs and 147 test pairs, using separate concept families and sentence templates.
- A further 61 developer-authored challenge cases cover negation, related tools, learning goals, coursework, team attribution, conflicts, credentials, unknown tools, and prompt-like text.
- No real user resumes, personal data, scraped profiles, hiring decisions, or protected attributes were collected for training.
- Synthetic labels and challenge cases have **not** been independently reviewed by domain experts. The challenge set is a development regression suite, not an independent research benchmark.

`models/nextwork-match/data/manifest.json` records the dataset hash and feature-source hash. Training uses seed 1749 and pinned Python dependencies. Data generation and full training scripts are included in the repository. Browser inference is checked against probabilities exported by the Python training implementation.

## Evaluation and limits

The current synthetic template holdout scores 100% accuracy, while the developer-authored challenge suite scores 60/61 (98.36%). **These figures describe constrained authored examples only. They are not real-applicant accuracy and should not be used in marketing as such.** Feature-driven synthetic templates are easier than real resumes. The comparison keyword baseline only emits supported/not-evidenced, so its four-way task accuracy is not an apples-to-apples measure of hiring quality.

A retained challenge failure is “Engineered React components for a neighborhood shop”: v1 under-credits this as partial because the action vocabulary does not recognize “engineered.” Full per-class confusion matrices and errors are in `models/nextwork-match/benchmark.json`.

Other limits include English-only text features, a finite alias dictionary, ambiguous scope in compound sentences, no document-layout understanding, no verification of credentials or claimed outcomes, limited treatment of multiple skills within a single requirement, and no understanding of chronology across conflicting claims. Uploaded scanned PDFs still need text extraction/OCR. The model can over-credit or under-credit evidence. Missing evidence does not establish missing ability. No real-world fairness, calibration, or predictive-validity study has been completed.

## Privacy and fallback

Inference runs locally; matching never sends resume content to a model API. The application still saves resumes privately to the signed-in account as described in its profile flow. No training-data submission is implemented. Optional Gemini writing feedback is a separate, explicitly disclosed service. General resume health checks are rules, not EvidenceNet predictions. If model resources are unavailable, the application labels the older text-comparison fallback and does not claim EvidenceNet produced it. Derived evidence caches are cleared when the account workspace is cleared.

## Next validation milestone

Before claiming real-world accuracy or using scores for consequential decisions: collect separately consented and de-identified evidence pairs, have multiple qualified reviewers annotate them, resolve disagreements, reserve people/organizations/listings exclusively for evaluation, compare against the current baseline, and measure per-label errors and performance across fields and resume formats. Expand the model only after that evaluation.
