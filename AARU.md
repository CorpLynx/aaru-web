# Aaru patches

Aaru's fork of Open WebUI. Upstream: `open-webui/open-webui` (remote `upstream`).
Design source: `CorpLynx/aaru` → `design/` (handoff) and `design/specs/openwebui.md`.

Every edit to an upstream file carries an `AARU:` comment (`// AARU:`, `# AARU:`, `/* AARU: */`
or `<!-- AARU: -->`). Find them with `git grep -n "AARU:"`.

## Upstream sync log

| Date | Upstream version | Notes |
| --- | --- | --- |
| 2026-10-22 | 0.12.3 (`91ea4e342`) | Fork point for the theme layer |

## License

The full rebrand relies on Open WebUI LICENSE clause 4(i): at most 50 end users in any rolling
30-day period. If Aaru exceeds that, the branding changes below must be reverted or licensed.

## Patches

### Theme layer (workstream 1)

New files:
- `src/lib/aaru/theme.css`: `--aaru-*` tokens, self-hosted Geist and JetBrains Mono, the gray-scale
  remap onto the Ink ramp, Tailwind utilities (`bg-ink-900`, `text-cipher`, `border-line-2`, ...)
  and off-white checkboxes.
- `static/assets/fonts/Geist-*.woff2`, `JetBrainsMono-*.woff2` plus their OFL licenses.
- `static/static/aaru-mark-animated.svg`, `aaru-mark-white.svg`.

New workflow: `.github/workflows/aaru-image.yaml` (see Building).

Replaced assets (same filenames): favicons, apple-touch icon, PWA icons, `logo.png`, `splash*.png`.

Edited upstream files:
- `src/tailwind.css`: imports the theme layer.
- `src/app.html`: title, `theme-color`, dark-only default, animated splash mark, black splash.
- `src/lib/components/chat/Settings/General.svelte`: theme picker limited to Dark and OLED Dark.
- `backend/open_webui/env.py`: `WEBUI_NAME` defaults to `Aaru` with no "(Open WebUI)" suffix.
- `backend/open_webui/main.py`: generated PWA manifest description and colors.
- `static/static/site.webmanifest`: name and colors.

Token names are prefixed `--aaru-*` inside this fork. The handoff's unprefixed names
(`--radius-lg`, `--font-sans`, `--ease-out`, `--text-*`) are Tailwind v4 theme variables and would
restyle stock components.

## Building

### Deployable image

The image is built on GitHub Actions, never locally. From the `CorpLynx/aaru` repo root:

```sh
infra/scripts/build-openwebui-image.sh
```

It pushes tag `aaru-<short sha>` for the checked-out fork commit. `.github/workflows/aaru-image.yaml`
then builds linux/amd64 (non-root, UID 1000), fails on fixable CRITICAL/HIGH Trivy findings
(exceptions go in `.trivyignore` with a reason), and pushes `ghcr.io/corplynx/open-webui:aaru-<short sha>`.
The script writes the digest-pinned reference into `infra/quadlet/openwebui.container`.

### Local development

`package.json` requires Node 18–22. The production build needs a larger heap:

```sh
NODE_OPTIONS=--max-old-space-size=8192 npm run build
```
