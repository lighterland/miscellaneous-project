# ✨ Miscellaneous Projects Repository

A collection of random interactive web apps, mini-games, and experiments by [@lighterland](https://github.com/lighterland).

Each project is self-contained in its own folder and automatically built & deployed to **GitHub Pages**.

---

## 📂 Projects Catalog

| Project | Folder | Description | Live Link |
| :--- | :--- | :--- | :--- |
| **🌸 Nyomin's Birthday Quest** | [`/hbd-nyomin`](./hbd-nyomin) | Whimsical retro 2D pixel-art birthday quest with TibiaME-style grid movement, custom avatar, and cozy surprises. | [`/hbd-nyomin/`](https://lighterland.github.io/miscellaneous-project/hbd-nyomin/) |
| **🇲🇳 Операция: Прости, Зуля!** | [`/hbd-zul`](./hbd-zul) | Interactive belated birthday yurt mystery in the Mongolian steppes with intercom interrogations & peace offerings (90+ days late!). | [`/hbd-zul/`](https://lighterland.github.io/miscellaneous-project/hbd-zul/) |

---

## 🛠️ How It Works

This repository functions as a multi-project monorepo:
1. Each project lives in its own directory (e.g. `hbd-nyomin/`).
2. The root `index.html` serves as a portal / directory of all available projects.
3. On every push to `main` (or `master`), the GitHub Actions workflow [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml):
   - Builds each project's static bundle (e.g. `hbd-nyomin/dist`).
   - Copies the root `index.html` and each project's output into `_site/`.
   - Deploys the entire `_site/` directory to GitHub Pages.

---

## 🚀 Adding a New Project in the Future

1. Create a new subfolder in the root of this repo (e.g. `my-new-tool/`).
2. Add your project files inside that subfolder. If using Vite / Webpack / etc., make sure `base: './'` is configured.
3. Add a link or card to your new project in the root `index.html`.
4. Update `.github/workflows/deploy.yml` to build and copy your new project into `_site/<your-folder-name>/`.
5. Commit and push!
