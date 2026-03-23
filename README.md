# yt-dlp Discord Bot

> Download videos, audio, livestreams, and playlists right from Discord — powered by yt-dlp.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![yt-dlp](https://img.shields.io/badge/yt--dlp-latest-FF0000?logo=youtube&logoColor=white)](https://github.com/yt-dlp/yt-dlp)
[![License](https://img.shields.io/badge/license-Unlicense-blue)](LICENSE)

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Slash Command: /yt-dlp](#slash-command-yt-dlp)
  - [Message Command: yt-dlp ...](#message-command-yt-dlp-)
  - [/queue and /cancel](#queue-and-cancel)
- [How It Works](#how-it-works)
- [File Size Limits](#file-size-limits)
- [Self-Hosting Tips](#self-hosting-tips)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Contributing](#contributing)

---

## Features

- **`/yt-dlp` slash command** with user-friendly options for the most common settings — no CLI knowledge needed
- **`extra-args` escape hatch** — append any raw yt-dlp flag not covered by the built-in options
- **`yt-dlp ...` message prefix** — type it exactly like the real CLI for full control
- **`/upload` slash command** — upload any file directly to gofile.io without yt-dlp; file is never saved to disk
- **`yt-dlp upload` message command** — same as `/upload` but via message with an attachment
- **Everything in your DMs** — progress, logs, and the download button are sent directly to you, never visible in the server
- **Live progress embeds** — the embed updates every 2.5 seconds with the last 30 lines of yt-dlp output
- **Auto-upload** — finished files are uploaded to [gofile.io](https://gofile.io) (no size limit) with [litterbox.catbox.moe](https://litterbox.catbox.moe) as fallback
- **Clickable download button** — a link button appears in your DMs once the file is ready
- **Privacy-safe output** — usernames, absolute paths, IPs, and credentials are stripped from all displayed yt-dlp output
- **Smart queue** — videos and audio run one at a time per user; livestreams allow up to 5 at once. Queued downloads start automatically.
- **Queue management** — `/queue` lists your active downloads, `/cancel` kills one by task ID
- **Works in servers and DMs** — trigger downloads from any channel; results always go to your DMs
- **Concurrent downloads** — multiple users can download at the same time; each user has their own isolated folder
- **No file size limit** — gofile.io supports files of any size
- **Argument sanitization** — dangerous yt-dlp flags (`--exec`, `--cookies-from-browser`, etc.) are blocked to protect the host system

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org) | 18+ | Required for native `fetch` and `FormData` |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | latest | Must be available in `PATH` |
| [ffmpeg](https://ffmpeg.org/download.html) | any recent | Required for audio extraction and format merging |
| Discord bot token | — | Create one at the [Discord Developer Portal](https://discord.com/developers/applications) |

**Installing yt-dlp:**
```bash
# Windows (winget)
winget install yt-dlp

# Windows / macOS / Linux (pip — requires Python 3.6+)
pip install yt-dlp

# macOS / Linux — download the binary directly (no Python needed):
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

**Installing ffmpeg:**
```bash
# Windows
winget install ffmpeg

# macOS
brew install ffmpeg

# Linux (Debian/Ubuntu)
sudo apt install ffmpeg
```

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/lekrkoekje/yt-dlp-discord.git
cd yt-dlp-discord

# 2. Install dependencies
npm install

# 3. Fill in your credentials
notepad .env   # Windows
nano .env      # Linux / macOS

# 4. Register slash commands with Discord
npm run deploy

# 5. Start the bot
npm start
```

---

## Configuration

Open `.env` and fill in both values:

```dotenv
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
```

| Variable | Where to find it |
|---|---|
| `DISCORD_TOKEN` | [Developer Portal](https://discord.com/developers/applications) → your app → **Bot** → **Token** |
| `CLIENT_ID` | Developer Portal → your app → **General Information** → **Application ID** |

> **Required:** enable the **Message Content Intent** in the Developer Portal under **Bot → Privileged Gateway Intents**. Without it the `yt-dlp ...` message prefix will not work.

---

## Usage

There are two ways to trigger a download: the slash command with dedicated options, or the message prefix that accepts raw yt-dlp arguments.

---

### Slash Command: `/yt-dlp`

Use the Discord slash command interface. Each option is described in plain language — no CLI knowledge needed.

**Example:**
```
/yt-dlp url:https://www.youtube.com/watch?v=dQw4w9WgXcQ audio-only:True audio-format:mp3
```

#### Options reference

| Option | yt-dlp flag | Description | Default |
|---|---|---|---|
| `url` *(required)* | *(positional)* | URL to download (video, audio, livestream, playlist, …) | — |
| `format` | `-f` | Format selection. Examples: `bestaudio`, `bestvideo+bestaudio`, `best`, `worst`, `mp4`, `webm` | `best` |
| `audio-only` | `--extract-audio` | Strip video and keep audio only | `false` |
| `audio-format` | `--audio-format` | Audio codec when `audio-only` is true: `mp3`, `aac`, `flac`, `opus`, `wav`, `m4a` | `mp3` |
| `audio-quality` | `--audio-quality` | Audio quality: Best / High / Medium / Low / Smallest (0–10, 0 = best) | Best |
| `output-name` | `-o` | Custom output filename without extension. Example: `%(title)s` | `%(title)s [%(id)s]` |
| `limit-rate` | `-r` | Cap the download speed. Examples: `5M`, `500K` | unlimited |
| `playlist` | `--yes-playlist` | Download the full playlist instead of a single video | `false` |
| `playlist-items` | `--playlist-items` | Which items to download from a playlist. Examples: `1-5`, `1,3,5` | all |
| `subtitles` | `--embed-subs --write-subs` | Embed subtitles into the file if available | `false` |
| `sub-lang` | `--sub-lang` | Subtitle language(s), comma-separated. Example: `en,nl` | `en` |
| `thumbnail` | `--embed-thumbnail` | Embed the video thumbnail into the file | `false` |
| `sponsorblock` | `--sponsorblock-remove default` | Automatically cut out sponsor segments via SponsorBlock | `false` |
| `keep-going` | `-i` / `--ignore-errors` | Keep going when a download in a playlist fails | `false` |
| `extra-args` | *(raw passthrough)* | Any additional yt-dlp flags typed exactly as on the command line. Note: dangerous flags like `--exec` and `--cookies-from-browser` are blocked. | — |

**`extra-args` combined with built-in options:**
```
/yt-dlp url:https://youtube.com/watch?v=xxx format:bestaudio extra-args:--geo-bypass --sleep-interval 5
```

---

### Message Command: `yt-dlp ...`

Send a message that starts with `yt-dlp ` followed by any arguments, exactly as you would type them in a terminal:

```
yt-dlp https://www.youtube.com/watch?v=dQw4w9WgXcQ
```
```
yt-dlp -f bestaudio --extract-audio --audio-format mp3 https://www.youtube.com/watch?v=xxx
```
```
yt-dlp --yes-playlist -o "%(playlist_index)s - %(title)s" https://www.youtube.com/playlist?list=xxx
```
```
yt-dlp --sponsorblock-remove default -f bestvideo+bestaudio https://www.youtube.com/watch?v=xxx
```

Works in both server channels and DMs. The bot replies with a queued embed and then sends all progress to your DMs.

---

### /upload

Upload any file to gofile.io without yt-dlp. The file is fetched directly from Discord and uploaded — nothing is saved to disk.

```
/upload file:<attachment>
```

Via message (attach the file to the message):
```
yt-dlp upload
```

The bot replies with an ephemeral confirmation in the channel, then sends the gofile.io link as a DM embed with a clickable download button.

---

### /queue and /cancel

**`/queue`** — shows all of your currently active downloads with their task IDs. The response is only visible to you.

**`/cancel task-id:<id>`** — kills the download with the given task ID and cleans up any partial files. The task ID is the short code shown in the embed title between square brackets, for example:

```
⬇️ Downloading... [aB3xYz]
```

```
/cancel task-id:aB3xYz
```

You can also cancel via the message prefix:
```
yt-dlp cancel aB3xYz
```

---

## How It Works

### Download pipeline

1. **Validate** — the bot checks that yt-dlp and ffmpeg are installed at startup. If yt-dlp is missing the bot exits immediately.
2. **Prepare** — a unique 6-character task ID is generated. A folder `./downloads/{userId}/` is created for the requesting user.
3. **Acknowledge** — the bot replies with an embed confirming the download is queued (ephemeral for slash commands; visible in channel for message commands). If all slots are occupied you receive a DM with your queue position and the download starts automatically when it's your turn.
4. **DM progress embed** — the bot sends a progress embed directly to your DMs. It is edited every 2.5 seconds with the last 30 lines of filtered yt-dlp output.
5. **Upload** — once yt-dlp exits successfully, each new file is uploaded to [gofile.io](https://gofile.io) (no size limit). If gofile.io fails, [litterbox.catbox.moe](https://litterbox.catbox.moe) is tried as a fallback (max 1 GB).
6. **Result** — the DM embed is updated to show the file name, size, format, and a clickable download button.
7. **Cleanup** — the local file is deleted immediately after upload. Partial files are deleted on failure.

### Privacy filter

Every line of yt-dlp output is filtered before being shown in an embed:

| What is stripped | Replaced with |
|---|---|
| Windows paths (`C:\Users\Name\...`) | `[path]` |
| Linux/macOS home paths (`/home/name/...`) | `[path]` |
| Other absolute paths | `[path]` |
| IP addresses | `[redacted]` |
| Cookies, tokens, passwords in verbose output | `[credentials redacted]` |

---

## File Size Limits

There is no file size limit. The bot uploads your file to [gofile.io](https://gofile.io), which supports files of any size. Download links expire after 10 days of inactivity. If gofile.io is unavailable, [litterbox.catbox.moe](https://litterbox.catbox.moe) is used instead (max 1 GB, expires after 1 week).

---

## Self-Hosting Tips

**PM2 (recommended for production):**
```bash
npm install -g pm2
pm2 start src/index.js --name yt-dlp-discord
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

**systemd:**
Create `/etc/systemd/system/yt-dlp-discord.service` pointing to `node src/index.js` in the repo directory, then run `systemctl enable --now yt-dlp-discord`.

**Disk space:** the bot stores downloads temporarily in `./downloads/`. Each file is deleted right after upload, but make sure the host has headroom for concurrent downloads.

**Keep yt-dlp updated:** yt-dlp gets frequent updates for site compatibility. Update it regularly:
```bash
yt-dlp -U
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `yt-dlp not found` at startup | Install yt-dlp and make sure it is in `PATH`. Verify with `yt-dlp --version`. |
| `ffmpeg not found` at startup | Install ffmpeg. The bot warns but continues — audio extraction and merging will not work without it. |
| Bot ignores `yt-dlp ...` messages | Enable **Message Content Intent** in the Developer Portal under **Bot → Privileged Gateway Intents**. |
| Slash commands not showing in Discord | Run `npm run deploy`. Global commands can take up to an hour to appear everywhere. |
| Bot does not respond in DMs | Make sure **Partials.Channel** and **Partials.Message** are enabled (they are by default in this bot). |
| No download button after completion | Both gofile.io and litterbox.catbox.moe failed to upload. Check your internet connection and the status of those services. |
| Embed stops updating mid-download | Discord rate-limits message edits. The bot waits 2.5 s between updates; occasional skips are normal. |

---

## License

This project is released into the public domain under the [Unlicense](LICENSE).

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Commit your changes with a clear message.
4. Open a pull request describing what changed and why.

Bug reports and feature requests are welcome via GitHub Issues.
