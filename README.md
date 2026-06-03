# BIWASA — Production-Level Manga Creator

BIWASA is an advanced, high-contrast, premium manga storyboard designer and offline image generation pipeline. It elaborates story concepts into comprehensive page-by-page drafts and leverages a headless ChatGPT Free scraper to generate stunning manga panels automatically.

Designed with a stark, zero-gradient **Inked Editorial & Bone-White** visual aesthetic, BIWASA features high-contrast custom drawing canvas grids, clean card lifts, manual prompt overrides, and fluid offline PDF compilation.

---

## Key Features

- 🖋️ **Stark Inked Blueprint Grid**: Zero-gradient, tactile designer theme with dual-scale sketching grids and Vermillion Red stamp accents.
- 🧠 **Dynamic Groq Outline Drafting**: Takes a simple story concept and elaborates it page-by-page (story events, dialogues, and comprehensive panel art prompts).
- 🤖 **ChatGPT Free Headless Pipeline**: Automatically scrapes ChatGPT Free in the background via the custom Python Scrapling fetcher (no OpenAI API key required!).
- 💾 **Local Volume Persistence**: Generated panel PNGs are saved directly inside `public/generated/`.
- 📄 **Cinematic Reader & A4 PDF Exporter**: Re-order, manually override panel URLs, read in a full-screen theater mode, and download your finished manga as a perfectly formatted A4 print-ready PDF.

---

## 📥 Clone the Repository

First, clone the project repository and create your local environment file:

```bash
git clone https://github.com/Lokkuchakreshkumar/Biwasa.git
cd mangaMaker

# Create your local environment configuration file
cp .env.example .env
```

## 💻 Setup & Local Installation

If you prefer to run the application directly on your local system, follow these precise step-by-step instructions.

### 1. Prerequisites
- **Node.js** (version 20 or newer)
- **Python** (version 3.10 or newer)

### 2. Install Node.js Dependencies
Install the Next.js and frontend workspace libraries:
```bash
npm install
```

### 3. Setup Python Virtual Environment (`venv`)
We run python scraper tasks in a local isolated virtual environment (`venv`). Next.js will automatically detect and execute scripts through this virtual environment.

```bash
# Create the virtual environment in the project root
python3 -m venv venv

# Upgrade pip inside the venv
./venv/bin/pip install --upgrade pip

# Install Scrapling and its browser components
./venv/bin/pip install "scrapling[fetchers]"

# Install the browser binary and system dependencies
./venv/bin/scrapling install
```

### 4. Run the Development Server
```bash
npm run dev
```

### 5. Open in Browser
Navigate your browser to:
```text
http://localhost:5173
```

---

## ⚙️ Environment Configuration

Configure the application by creating a file named `.env` in the root folder (or setting these directly as environmental variables on your host laptop/Docker compose):

```env
# Required for Storyboard Outline drafting
GROQ_API_KEY=gsk_your_groq_api_key_here

# Optional: Path to custom Google Chrome profile directory to inherit an active ChatGPT login session.
# If left empty, the Scrapling headless Chromium profile is used automatically.
CHROME_PROFILE=
```

### 🔑 Initial ChatGPT Login

Because BIWASA uses a headless browser to generate manga panels via ChatGPT Free, **you must have an active ChatGPT session**. You have two options for this initial login:

**Option A: Inherit Your Host Browser Session (Recommended)**
Log into [chatgpt.com](https://chatgpt.com) on your regular Google Chrome browser. Then, find your Chrome Profile Path (e.g., `~/.config/google-chrome/Default` on Linux, `%LOCALAPPDATA%\Google\Chrome\User Data\Default` on Windows, or `~/Library/Application Support/Google/Chrome/Default` on Mac) and set the `CHROME_PROFILE` variable in your `.env` file to that path. BIWASA will automatically inherit your existing session!

**Option B: Manual Login to Isolated Profile**
If you leave `CHROME_PROFILE` empty, BIWASA will create a local isolated profile folder (`scrapling_profile`). Since the scraper runs in the background (headless), you must perform a one-time manual login:
1. Open `scrapling_chatgpt.py` and temporarily change `headless=True` to `headless=False` (around line 121).
2. Run a test generation via the BIWASA Web UI. A browser window will pop up.
3. Manually log into your ChatGPT account in that popup window.
4. Once logged in, revert the code back to `headless=True`. Your session is now saved locally and will persist forever!

---

## 🎨 Creative Contribution Style Guidelines

BIWASA is an open-source project designed for an ultra-premium visual presence. When contributing:
- **Strictly No Gradients**: Do not use CSS linear, radial, or repeating gradients. Do not use Tailwind CSS gradient utility classes (like `bg-gradient-to-r`, `from-`, `to-`, etc.).
- **Printed Contrast Grid**: Maintain the stark obsidian charcoal, warm bone-white, and Vermillion Red stamp theme.
- **Backend Integrity**: Keep the API layers focused and high-fidelity. Ensure all changes to generation prompts support high-contrast, black-and-white manga page screen tones.

---

## 👨‍💻 Creator & Credits

- Created by **Chakresh** — [https://chakresh.vercel.app](https://chakresh.vercel.app)
- Special thanks and credit to **biwasa** for the vision and core branding.

---

## 📜 License

This project is released under a **Strict Non-Commercial License**. 
You are free to use and modify it for personal and educational purposes, but you may **NOT** use it for strict business, commercial gain, or resale. 

See the [LICENSE](LICENSE) file for complete details.
