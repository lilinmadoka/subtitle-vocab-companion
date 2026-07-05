# Manual Verification

Use this checklist before merging or releasing the `0.2.0` YouTube support work.

## Stable Rollback

- Stable tag: `v0.1.3`
- Stable release: https://github.com/lilinmadoka/subtitle-vocab-companion/releases/tag/v0.1.3
- Stable zip: `subtitle-vocab-companion-v0.1.3.zip`

If the experimental version fails, remove the unpacked experimental extension and install the stable zip from the release above.

## Build The Experimental Zip

From the repository root:

```powershell
$zip = Join-Path $env:TEMP 'subtitle-vocab-companion-v0.2.0-experimental.zip'
if (Test-Path $zip) { Remove-Item -LiteralPath $zip }
$files = @(
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'popup.css',
  'README.md',
  'PRIVACY.md',
  'LICENSE',
  'LICENSE.txt'
)
Compress-Archive -LiteralPath $files -DestinationPath $zip
$zip
```

The zip root must contain `manifest.json` directly.

## Static Gates

Run these before manual browser testing:

```powershell
node scripts\verify-extension.js
node scripts\verify-background-behavior.js
node --check content.js
node --check background.js
node --check popup.js
node --check scripts\verify-extension.js
node --check scripts\verify-background-behavior.js
```

## Chrome Setup

1. Open `chrome://extensions/`.
2. Enable developer mode.
3. Remove or disable any older unpacked copy of Subtitle Vocab Companion.
4. Load the repository folder as an unpacked extension, or unzip the experimental zip and load the unzipped folder.
5. Confirm the extension version is `0.2.0`.

## Netflix + Language Reactor Regression

Pass criteria:

- The content script runs on a Netflix playback page.
- Clicking an English LR subtitle word saves one Vocabulary Card.
- Right-clicking selected subtitle text and choosing "保存到单词本" saves one Vocabulary Card.
- `Alt + Shift + S` saves from the current LR subtitle context.
- The saved card includes the word, English sentence, source URL, and playback time when a video element is available.
- Chinese subtitle context is saved when Language Reactor displays it near the English subtitle.
- LR dictionary explanation is saved when the LR dictionary panel opens in time.
- Popup search, copy, delete, Anki TSV export, word CSV export, and word-count CSV export still work for old and new cards.

## YouTube + Language Reactor Validation

Pass criteria:

- The content script runs on a YouTube playback page.
- With Language Reactor subtitles visible, clicking an English LR subtitle word saves one Vocabulary Card.
- Right-clicking selected LR subtitle text and choosing "保存到单词本" saves one Vocabulary Card.
- `Alt + Shift + S` saves from the current LR subtitle context.
- The saved card includes optional additive metadata: `site`, `siteName`, and `pageTitle`.
- The saved card remains compatible with existing popup display, copy, delete, and export behavior.
- Translation context and LR dictionary explanation are saved when Language Reactor exposes them.

## YouTube Without Language Reactor DOM

Pass criteria:

- Opening a YouTube playback page without Language Reactor subtitle DOM does not save a Vocabulary Card from a normal click.
- Right-click save and `Alt + Shift + S` do not save YouTube native subtitles.
- The extension does not read YouTube timed-text, transcript, caption-track, player response, or native caption DOM data.
- The page does not show noisy or misleading extension errors.

## Do Not Merge Until

- Netflix regression passes.
- YouTube + Language Reactor validation passes.
- YouTube without LR DOM validation passes.
- Any failures are either fixed or explicitly accepted as known limitations in the PR.
