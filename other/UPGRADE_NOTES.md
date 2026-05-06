# Upgrade notes

This folder is designed as a direct upgrade for:

https://github.com/kai9987kai/YouTubeSearchChromeExtension/tree/master

## Replace these original files

- `manifest.json`
- `extension.html`
- `style.css`
- `feed.js`
- `README.md`
- `icon.png`
- `icon.jpg`

## Add these new files/folders

- `app.js`
- `background.js`
- `options.html`
- `options.js`
- `icons/`
- `assets/`

## Keep these existing repo files

- `LICENSE`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`

## Important fixes

The original repo used Manifest V2 and `browser_action`. This upgrade uses Manifest V3 and `action`.

The original `feed.js` used the old Google Feed API and old YouTube GData feed endpoint. This upgrade uses YouTube's public RSS uploads feed instead.

Inline JavaScript was removed so the extension is easier to maintain and safer for Manifest V3.
