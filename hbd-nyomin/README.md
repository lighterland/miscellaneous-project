# 🌸 Nyomin's Birthday Quest 🎂

An interactive, whimsical retro 2D pixel web quest created as a special birthday gift for **Nyomin**.

Built with **Vite + Vanilla JavaScript + HTML5 Canvas**, optimized mobile-first with touch Virtual D-pad and full desktop keyboard support.

---

## ✨ Features

- 🕰️ **Moscow Time Countdown**: Locked to unlock precisely on **September 26, 00:00 MSK (UTC+3)**.
- 🔑 **Dual Test Bypass**:
  - Add `?dev=true` or `?bypass=true` to the URL.
  - Or tap the title *"Nyomin's Birthday Quest"* 3 times on the countdown screen.
- 🎮 **TibiaME-Style Grid Movement**: Authentic tile-by-tile discrete movement (Up, Down, Left, Right) with smooth walk step interpolation.
- 📱 **Mobile-First & Desktop Friendly**:
  - **Mobile**: On-screen touch Virtual D-Pad, dedicated Action button, and canvas swipe gestures.
  - **Desktop**: Arrow keys / WASD and Space / Enter / E keys.
- 🎨 **Pixel Avatar & Whimsical Nature Aesthetic**:
  - Nyomin's pixel character and portrait designed directly after her photo (dark hair with bangs, charcoal hoodie with white drawstrings, and gentle smiling face).
  - Scenic pastel meadow with lavender patches, wildflowers, winding cobblestone paths, trees, fences, and a sparkling birthday clearing.
- 💬 **Interactive Quest & First-Person Dialogues**:
  - Starts with Nyomin: *"Hello! My name is nyoooooomiiiiiiiiiiin!"*
  - Mini-interactivity: Smell lavender flowers, inspect a wooden signpost, rest by the park bench.
  - Main quest: Discover and open the Birthday Treasure Chest.
- 🎁 **Celebration & Wishes**:
  - Opening the chest triggers a lid-opening animation, celebratory fanfare sound, and multi-colored confetti burst.
  - Unfolds a whimsical birthday card containing wishes in English:
    - Smooth sailing to graduation 🎓
    - Never late on university assignments and study deadlines ⏰
    - High spirits and resilience during the 1-hour campus commute 🚌
    - Endless joy, good health, and bright blessings 🌸
- 🎵 **Web Audio API Sound Engine**:
  - Procedural cozy chiptune birthday BGM and retro SFX (footstep thuds, dialogue chirps, interaction chimes, victory fanfare) with floating Mute/Unmute toggle.

---

## 🚀 Running Locally

1. Clone or navigate to the repository:
   ```bash
   cd hbd-nyomin
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```

---

## 🌐 Deploying to GitHub Pages

This project is pre-configured for GitHub Pages:

1. Create a new repository on GitHub (e.g. `hbd-nyomin`).
2. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Nyomin's Whimsical Birthday Quest"
   git branch -M main
   git remote add origin https://github.com/<your-username>/hbd-nyomin.git
   git push -u origin main
   ```
3. In your GitHub repository:
   - Go to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, select **GitHub Actions**.
   - The included workflow `.github/workflows/deploy.yml` will automatically build and publish your website!
