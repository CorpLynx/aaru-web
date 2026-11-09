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

Supply chain: workflow actions are pinned to commit SHAs (version in a trailing comment, which
Dependabot keeps updated), the `Dockerfile` base images and the Trivy scanner image are pinned by
digest (Dependabot's docker ecosystem bumps the base images), and the CI formatter by exact version. Upstream's `regression.yaml` is removed: it ran `open-webui/tests` from that repository's
`main` branch on upstream release PRs.

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

### Errors and disclaimers

Edited upstream files:

- `src/routes/+error.svelte`: branded error page with a plain explanation per status (404, 401/403,
  5xx) and links home and to the legal pages. Internal error messages are never shown.
- `src/lib/components/chat/Chat.svelte`: shows the AI-output disclaimer under the composer (upstream
  comments it out), with links to the Terms and Privacy Notice.

The legal pages themselves (`/legal/*.html`, `/.well-known/security.txt`) are rendered and mounted by
the deployment (`CorpLynx/aaru`: `legal/`, `infra/scripts/render-legal.sh`), so they can change
without an image rebuild.

### Sign-in page

Design source: `CorpLynx/aaru` → `design/login/index.html` ("Reeds gathering") and
`design/specs/openwebui.md` (01 Login).

New files:

- `src/lib/aaru/reeds.ts`: the scene. One WebGL2 fragment shader draws black night water lit by the
  moon; reed stems surface, topple flat with a ripple and drift together into the word AARU. The
  reeds' positions are updated on the CPU each frame and uploaded as a small float texture. The
  render scale adapts between 0.5 and 1.0 to hold the frame rate, and the loop skips frames while the
  tab is hidden. Beyond the design reference: tapered stems shaded from green base to straw tip with
  contact shadows where they cross, curved approach paths with a settle and a ripple ring on docking,
  stems that ride the visible swell, faint reflected stars, and ripples under the pointer (off with
  `prefers-reduced-motion`).
- `src/lib/aaru/ReedsScene.svelte`: mounts the scene on a full-bleed canvas and releases the GL
  context on destroy. Without WebGL2 the page keeps its flat `#030507` background; with
  `prefers-reduced-motion` the word starts already formed.
- `src/lib/aaru/auth.css`: the card under the word (Ink 900 at 72% with a 12px blur, 16px radius),
  Ink 800 fields, the off-white primary button and secondary SSO buttons. Scoped to the page's
  existing ids, so the stock markup barely changes.

Edited upstream files:

- `src/routes/auth/+page.svelte`: the scene in place of the flat background, the card placed under
  the word, and a "Members only" overline with "Membership is by invitation." on the sign-in form.
  Sign-in, sign-up, LDAP, SSO, MFA and pending-approval flows are unchanged.

The separate encryption passphrase from the login spec is not on the form yet: nothing in the app
derives a key from it, so the field would claim protection that does not exist.

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
