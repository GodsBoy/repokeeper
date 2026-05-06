---
date: 2026-05-06
topic: triage-evidence-card
---

# Triage Evidence Card Requirements

## Summary

RepoKeeper should add a compact Triage Evidence Card that explains issue triage decisions in live issue comments and playground previews. The first version should make label choice, duplicate evidence, and uncertainty easier to trust while keeping duplicate issues open by default.

---

## Problem Frame

Independent and small-team maintainers need RepoKeeper to reduce daily triage work without creating new review chores. If RepoKeeper labels an issue or flags a duplicate without showing why, maintainers have to second-guess the automation and the time savings disappear.

Duplicate detection is especially trust-sensitive because a wrong call can make a reporter feel dismissed. The first version should make RepoKeeper's triage reasoning inspectable while preserving a safe default: related or duplicate candidates are surfaced, but the issue remains open.

---

## Actors

- A1. Maintainer: Reviews RepoKeeper's triage output and decides whether to trust, correct, or ignore it.
- A2. Issue reporter: Receives the triage response and may add clarification when duplicate candidates are not exact matches.
- A3. RepoKeeper: Classifies issues, finds possible duplicates, applies labels, and posts comments through GitHub.

---

## Key Flows

- F1. Standard issue triage evidence
  - **Trigger:** A new issue is triaged and no duplicate candidates meet the duplicate display threshold.
  - **Actors:** A1, A2, A3
  - **Steps:** RepoKeeper classifies the issue, applies the configured label, posts a compact evidence card, and includes any uncertainty or needs-info signal.
  - **Outcome:** The maintainer can quickly see what RepoKeeper decided and why.
  - **Covered by:** R1, R2, R4

- F2. Duplicate cluster evidence
  - **Trigger:** A new issue has one or more possible duplicate or related issue candidates.
  - **Actors:** A1, A2, A3
  - **Steps:** RepoKeeper labels the issue as a possible duplicate, shows a small cluster of candidate issues with evidence, asks for clarification when needed, and leaves the issue open.
  - **Outcome:** The maintainer and reporter can compare candidates without treating RepoKeeper's duplicate call as final.
  - **Covered by:** R1, R3, R4, R6

- F3. Playground preview
  - **Trigger:** A maintainer previews an issue or PR scenario in the playground.
  - **Actors:** A1, A3
  - **Steps:** RepoKeeper returns the same style of compact evidence card that live issue comments would use.
  - **Outcome:** The maintainer can understand and tune the triage experience before relying on live issue comments.
  - **Covered by:** R5

---

## Requirements

**Evidence card behavior**
- R1. RepoKeeper must include a compact evidence card in issue triage output that shows the selected classification or label, duplicate evidence when available, and uncertainty when relevant.
- R2. For non-duplicate triage, the evidence card must explain the main reason for the selected label in maintainer-readable language.
- R3. For duplicate triage, the evidence card must show a small cluster of possible duplicate or related issues rather than only the top match.
- R4. The evidence card must avoid presenting uncertain duplicate matches as final judgments.

**Live issue behavior**
- R5. RepoKeeper must keep duplicate-candidate issues open by default.
- R6. RepoKeeper must continue to work inside the existing GitHub issue comment workflow rather than requiring a separate dashboard.

**Playground behavior**
- R7. The playground must preview the same compact evidence card style used in live issue comments.

**Compatibility**
- R8. Existing triage behavior should remain backward compatible unless the new evidence card explicitly changes duplicate presentation.
- R9. The first version must preserve the lightweight setup promise and avoid requiring new infrastructure to use triage evidence.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R6.** Given a new detailed bug report with no duplicate candidates, when RepoKeeper triages it, the issue comment includes a compact card showing the bug label and a short reason for the classification.
- AE2. **Covers R1, R3, R4, R5.** Given a new issue with multiple possible duplicate candidates, when RepoKeeper triages it, the issue comment lists a small cluster of possible related issues, frames them as candidates, and leaves the issue open.
- AE3. **Covers R1, R7.** Given a maintainer uses the playground to preview issue triage, when the preview is generated, the response shows the compact evidence card style rather than a disconnected plain response.
- AE4. **Covers R4, R8.** Given RepoKeeper is uncertain about a label or duplicate match, when it comments, the wording communicates uncertainty and does not overstate confidence.

---

## Success Criteria

- Maintainers can understand why RepoKeeper applied a label or flagged possible duplicates without reading logs.
- Duplicate handling feels safer because candidates are shown as a cluster and issues stay open by default.
- The playground can be used to preview the evidence-card experience before relying on live comments.
- A planner or implementer can build the feature without inventing product behavior beyond this document.

---

## Scope Boundaries

- Auto-closing duplicate issues by default is excluded from v1.
- A triage analytics dashboard is excluded from v1.
- A full maintainer correction or learning loop is excluded from v1.
- Replacing duplicate detection with embeddings is excluded from v1.
- Repo-specific custom label mapping is a separate future feature unless later planning proves it is required for this scope.

---

## Key Decisions

- Evidence appears in issue comments and playground previews: This keeps the feature in the surfaces maintainers already use while offering a safe preview path.
- Duplicate candidates stay open by default: This protects maintainer and reporter trust while the feature earns confidence.
- The card is compact: The feature should reduce triage burden, not create a longer comment that maintainers learn to ignore.

---

## Dependencies / Assumptions

- The existing issue triage, duplicate detection, and playground flows remain the primary integration points.
- The first version can use the current duplicate candidate scoring behavior and improve presentation before changing detection strategy.
- Confidence or uncertainty can be expressed using available triage and duplicate signals, with deeper model calibration deferred if needed.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R1, R2][Technical] What signals should generate the first version of classification evidence without overfitting to prompt internals?
- [Affects R3][Technical] What duplicate candidate count and threshold best balance usefulness and comment length?
- [Affects R7][Technical] How should playground preview data represent duplicate candidates without requiring live GitHub issue data?
