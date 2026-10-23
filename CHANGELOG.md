# Changelog

Changes to Aaru's web app. It is based on Open WebUI 0.12.3; Open WebUI's own release history up to
that version is in [`docs/OPEN_WEBUI_CHANGELOG.md`](docs/OPEN_WEBUI_CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The app shows the
newest five versions in its "What's new" dialog.

## [0.12.3] - 2026-10-23

### Added

- **Aaru theme and branding.** A dark-only theme built from the Aaru design tokens, self-hosted Geist and JetBrains Mono, and the Aaru name, logo, splash screen and installable app icons.

### Removed

- **Cloud and frontier model providers.** Azure OpenAI, Anthropic's cloud API, Gemini, ElevenLabs, Deepgram, Mistral, Azure Speech and Document Intelligence are no longer available as connections or engines, and nothing defaults to `api.openai.com`. Models are reached through Aaru's gateway or run locally.
- **OpenAI Realtime voice calls.** Voice calls use the configured speech-to-text and text-to-speech engines.
