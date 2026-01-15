# Hortitrack Print Agent

Desktop application that enables printing to USB-connected label printers from Hortitrack.

## Features

- Connects to Hortitrack server to receive print jobs
- Discovers USB-connected printers automatically
- Supports Zebra, Toshiba, Dymo, Brother, and other ZPL-compatible printers
- Runs in system tray for minimal intrusion
- Auto-reconnects if connection is lost

## Installation

### From Pre-built Releases

Download the installer for your platform:
- **Windows**: `Hortitrack-Print-Agent-Setup.exe`
- **macOS**: `Hortitrack-Print-Agent.dmg`
- **Linux**: `Hortitrack-Print-Agent.AppImage`

### From Source

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package
```

## Setup

1. In Hortitrack, go to **Settings > Labels > Print Agents**
2. Click **Add Agent** and enter a name (e.g., "Potting Shed PC")
3. Copy the API key that is displayed
4. Open the Print Agent app and enter:
   - **Server URL**: `https://app.hortitrack.com` (or your server URL)
   - **Agent API Key**: Paste the key you copied
5. Click **Save & Connect**

The agent will connect to the server and start listening for print jobs.

## Configuration

Settings are stored locally and persist across restarts:

- **Server URL**: The URL of your Hortitrack server
- **Agent API Key**: The authentication key from Hortitrack
- **Auto Start**: Whether to start the agent automatically on login

## Printer Setup

The agent automatically discovers printers connected to your computer. For best results:

1. Install the printer driver for your label printer
2. Ensure the printer is connected via USB and turned on
3. The printer should appear in the "Discovered Printers" list
4. In Hortitrack Settings, add a printer with:
   - **Connection Type**: USB via Print Agent
   - **Print Agent**: Select your agent
   - **USB Printer Name**: Enter the printer name as shown in the agent

## Troubleshooting

### Agent won't connect

- Verify the server URL is correct and accessible
- Check that the API key is valid (you may need to regenerate it)
- Ensure your firewall allows outbound HTTPS connections

### Printer not found

- Make sure the printer is connected and powered on
- Check that printer drivers are installed
- Try refreshing the printer list

### Print jobs failing

- Verify the printer is not offline or in an error state
- Check that the printer supports ZPL (Zebra Programming Language)
- Look at the printer's ready/error lights for issues

## System Requirements

- **Windows**: Windows 10 or later
- **macOS**: macOS 10.15 (Catalina) or later
- **Linux**: Ubuntu 18.04 or equivalent

## Architecture

The agent uses:
- **Electron** for cross-platform desktop support
- **HTTP Polling** for reliable server communication
- **OS print commands** for sending ZPL to printers

## License

MIT
