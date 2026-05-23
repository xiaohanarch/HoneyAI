# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

HoneyAI — a static HTML/CSS prototype set for an AI 数字研发产线 (DevPipeline) UI. Pure visual/interaction exploration; no real backend, no build step, no package manager. Files are hand-authored HTML using Tailwind via CDN and a small amount of inline `<script>` for demo interactions.

## Local preview

```bash
cd prototype
python3 -m http.server 8888
# open http://localhost:8888/
```

There are no build, lint, or test commands — the project is intentionally zero-dependency.

## Architecture

The prototype models a 4-stage pipeline (需求富化 → 设计与拆解 → 编码 + UT → SIT 集成测试) plus supporting surfaces. Each HTML file under `prototype/` is a self-contained, standalone page (its own `<head>`, design tokens, and inline scripts) — there is no shared JS/CSS module. Cross-page navigation is via plain `<a href="...">` links between sibling HTML files.

Page roles:

- `index.html` — main pipeline cockpit (driver view)
- `runs-list.html`, `create-run.html` — run history + new-run wizard
- `stage-1-requirement.html`, `stage-2-architecture.html`, `stage-4-test.html` — per-stage detail views
- `agent-detail.html`, `review-detail.html`, `artifact-diff.html` — drill-down detail surfaces
- `node-config-drawer.html`, `interrupt-modal.html` — overlay UI patterns
- `rules-library.html`, `knowledge-graph.html` — knowledge surfaces (军规库, 知识图谱)
- `operations.html`, `people-ops.html` — AI 资产 / 人员 运营 dashboards

## Design system (replicated per file)

All pages share the same visual language, redeclared in each file's `<style>` block. When changing tokens, search-and-replace across `prototype/*.html` — there is no central stylesheet.

- Fonts: `Inter` (UI), `Instrument Serif` + `Songti SC` (`.font-display`, editorial headings), `JetBrains Mono` (`.font-mono`, metrics/IDs)
- Color: OKLCH variables on `:root` — surfaces (`--bg-base/card/elev/deep`), text scale (`--text-strong/body/muted/faint`), status (`--done/run/review/idle-soft/halt`), and a per-agent identity palette (`--a-req`, `--a-graph`, `--a-arch`, `--a-dev`, `--a-sec`, `--a-perf`, `--a-test`)
- Atmosphere: `.bg-atmosphere` (radial OKLCH gradients) layered with `.grain::before` (inline SVG noise, `mix-blend-mode: multiply`) for the signature light-bento look
- Motion: keyframe utilities like `.pulse-run` for live/running states; keep motion on `transform`/`opacity`/`box-shadow`
- Layout: 12-column grid, editorial typography (display serif headings + mono metrics)

## Conventions when editing

- Keep pages self-contained — do not introduce a bundler, package.json, or shared asset directory unless explicitly asked.
- Reuse the existing OKLCH tokens and agent palette rather than adding new hex colors.
- UI copy is Simplified Chinese; preserve language and tone (terse, product-y) when adding strings.
- File size budget per page is loose but `index.html` is already ~1.4k lines — prefer extracting a new sibling page over growing one further.
