# Print Agent Downloads

This folder contains the Hortitrack Print Agent installers.

## Building the installers

### macOS (from macOS)
```bash
cd print-agent
npm install
npm run build
npm run package:mac
```
Output: `print-agent/release/Hortitrack Print Agent-1.0.0-arm64.dmg`

### Windows (from Windows or using Wine)
```bash
cd print-agent
npm install
npm run build
npm run package:win
```
Output: `print-agent/release/Hortitrack Print Agent Setup 1.0.0.exe`

### Cross-platform builds
For CI/CD, use GitHub Actions with `electron-builder` which can build for all platforms.

## Deploying

Copy the built installers to this folder:
- `Hortitrack-Print-Agent-Setup.exe` - Windows installer
- `Hortitrack-Print-Agent.dmg` - macOS installer
