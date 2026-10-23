# Changes from Open WebUI

Aaru's web app is based on [Open WebUI](https://github.com/open-webui/open-webui) 0.12.3
(`91ea4e342`). It is maintained as a standalone project and will diverge from upstream; this file
records what Aaru changed, for attribution and license compliance.

Design source: `CorpLynx/aaru` → `design/` (handoff) and `design/specs/openwebui.md`.

Edits to files inherited from Open WebUI carry an `AARU:` comment (`// AARU:`, `# AARU:`,
`/* AARU: */` or `<!-- AARU: -->`). Find them with `git grep -n "AARU:"`.

## Upstream

There are no automatic merges. Keep upstream as a remote and cherry-pick security fixes by hand:

```sh
git remote add upstream https://github.com/open-webui/open-webui.git
git fetch upstream
```

| Date       | Upstream version     | Notes                                    |
| ---------- | -------------------- | ---------------------------------------- |
| 2026-10-22 | 0.12.3 (`91ea4e342`) | Base for Aaru; standalone repo from here |

## License

The code remains under the Open WebUI License (`LICENSE`, with `LICENSE_HISTORY` and
`LICENSE_NOTICE`); keep those files and the copyright notice. The rebrand relies on clause 4(i): at
most 50 end users in any rolling 30-day period. If Aaru exceeds that, the original branding must
return or a license permitting the change must be obtained.

## Changes

### Theme layer (workstream 1)

New files:

- `src/lib/aaru/theme.css`: `--aaru-*` tokens, self-hosted Geist and JetBrains Mono, the gray-scale
  remap onto the Ink ramp, Tailwind utilities (`bg-ink-900`, `text-cipher`, `border-line-2`, ...)
  and off-white checkboxes.
- `static/assets/fonts/Geist-*.woff2`, `JetBrainsMono-*.woff2` plus their OFL licenses.
- `static/static/aaru-mark-animated.svg`, `aaru-mark-white.svg`.

New workflow: `.github/workflows/aaru-image.yaml` (see Building).

Replaced assets (same filenames): favicons, apple-touch icon, PWA icons, `logo.png`, `splash*.png`.

Repository changes: upstream's release, PyPI, Docker and issue-label workflows and its funding link
are removed; Dependabot targets `main`; `README.md` describes Aaru and credits Open WebUI.

Edited upstream files:

- `src/tailwind.css`: imports the theme layer.
- `src/app.html`: title, `theme-color`, dark-only default, animated splash mark, black splash.
- `src/lib/components/chat/Settings/General.svelte`: theme picker limited to Dark and OLED Dark.
- `backend/open_webui/env.py`: `WEBUI_NAME` defaults to `Aaru` with no "(Open WebUI)" suffix.
- `backend/open_webui/main.py`: generated PWA manifest description and colors.
- `static/static/site.webmanifest`: name and colors.

Token names are prefixed `--aaru-*` in this codebase. The handoff's unprefixed names
(`--radius-lg`, `--font-sans`, `--ease-out`, `--text-*`) are Tailwind v4 theme variables and would
restyle stock components.

### No cloud or frontier models

Removed provider-specific code; OpenAI-compatible endpoints and local engines remain.

| Area             | Removed                                                                                                                                                                                      | Remains                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Chat connections | Azure OpenAI mode, Entra ID auth, `api.anthropic.com` connections, OpenAI model filtering and o-series payload handling, `/openai/audio/speech`, cloud URL suggestions                       | OpenAI-compatible connections, Ollama, the Anthropic Messages format adapter (passes through to LiteLLM) |
| Speech           | Azure, ElevenLabs, Deepgram and Mistral engines; OpenAI Realtime voice calls (`routers/audio/realtime.py`, `utils/realtime.ts`, `BridgeCallOverlay.svelte`); OpenAI model and voice defaults | Local Whisper, Web Speech API, Transformers, OpenAI-compatible TTS/STT, the standard voice call overlay  |
| Embeddings       | Azure OpenAI engine                                                                                                                                                                          | SentenceTransformers, Ollama, OpenAI-compatible                                                          |
| Images           | Gemini engine, Azure `api-version`, DALL·E and GPT-Image model list                                                                                                                          | ComfyUI, Automatic1111, OpenAI-compatible (lists the server's own models)                                |
| Documents        | Azure Document Intelligence, Mistral OCR                                                                                                                                                     | Tika, Docling, MinerU, PaddleOCR-VL, local loaders                                                       |
| Config           | `api.openai.com` defaults; `audio.tts.api_key`                                                                                                                                               | Engine defaults follow the first configured connection                                                   |
| Dependencies     | `anthropic`, `azure-ai-documentintelligence`                                                                                                                                                 | `openai` (generic client), `azure-identity` (Azure Blob storage, Azure AI Search)                        |

Not changed: web search providers (search services, not models), Azure Blob and GCS storage, the
ChatGPT history importer, and database migrations.

### Changelog

`CHANGELOG.md`, which feeds the "What's new" dialog, now records Aaru's changes. Open WebUI's
history up to 0.12.3 moved to `docs/OPEN_WEBUI_CHANGELOG.md`, unchanged.

## Building

### Deployable image

The image is built on GitHub Actions, never locally. From the `CorpLynx/aaru` repo root:

```sh
infra/scripts/build-openwebui-image.sh
```

It pushes tag `aaru-<short sha>` for the checked-out commit. `.github/workflows/aaru-image.yaml`
then builds linux/amd64 (non-root, UID 1000), fails on fixable CRITICAL/HIGH Trivy findings
(exceptions go in `.trivyignore` with a reason), and pushes `ghcr.io/corplynx/aaru-web:aaru-<short sha>`.
The script writes the digest-pinned reference into `infra/quadlet/openwebui.container`.

### Local development

`package.json` requires Node 18–22. The production build needs a larger heap:

```sh
NODE_OPTIONS=--max-old-space-size=8192 npm run build
```
