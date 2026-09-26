# 🇲🇳 Операция: Прости, Зуля! (Operation: Forgive Me, Zulya!)
### Belated Happy Birthday Interactive Yurt Mystery Web App

A hilarious, lightweight, mobile-first interactive website created to celebrate **Zulya's belated birthday** (June 26th — 90+ days late!).

Set outside Zulya's traditional Mongolian Yurt (Ger) in the open steppes under the eternal blue sky, the player must use the makeshift intercom **"ЮРТ-КОМ 3000"** and peace offerings to appease an enraged Zulya and unlock the yurt door before getting smacked by flying slippers.

---

## 🌟 Fitur Utama (Key Features)

1. **Komedi & Percakapan Dramatis**:
   - Bahasa utama: **Rusia** (ekspresif, dramatis, kocak).
   - Teks bantuan: **Inggris** (mudah dipahami siapa saja).
   - Ucapan & sentuhan budaya autentik: **Mongolia** (*Төрсөн өдрийн мэнд!*, *Сүүтэй цай*, *Гэр*, *Бүх цаг үеийн хамгийн шилдэг найз*).
2. **Mekanik Interaktif**:
   - **ЮРТ-КОМ 3000 (Yurt Intercom)**: Ketuk pintu atau tekan tombol interkom untuk memulai interogasi.
   - **Шкала гнева Зули (Rage Meter)**: Meteran emosi dinamis (99% ➔ 0%).
   - **Flying Tapochki Physics (🩴 & 👢)**: Pilihan alibi yang salah akan memicu Zulya melempar sandal/sepatu langsung menghantam layar pengguna dengan efek goyang (*screen shake*) dan suara *THWACK!*
   - **Inventory Sogokan**:
     * 🎂 *Торт 90-дневной выдержки* (Kue 90 hari / artefak fosil berharga).
     * ☕ *Сүүтэй цай* (Teh susu hangat tradisional pereda amarah).
     * 💐 *Степные цветы* (Bunga padang rumput segar).
   - **Gembok Pintu Dinamis (🔒)**: Gembok berkurang jika alibi diterima, atau bertambah jika Zulya makin marah.
3. **Grand Finale Penuh Perayaan**:
   - Pintu Yurt terbuka lebar.
   - Hujan konfeti warna-warni (*canvas particle physics*).
   - Lagu ulang tahun 8-bit chiptune yang riang.
   - Lilin kue interaktif yang bisa ditiup (tap kue untuk tiup lilin & buat permohonan!).
   - Surat ucapan hangat dan hiperbolis dari *"Бүх цаг үеийн хамгийн шилдэг найз"* (Teman terbaik sepanjang masa).
4. **Web Audio API Engine**:
   - Semua efek suara (ketukan pintu, bel interkom, desingan sandal melayang, denting gembok, dan lagu Happy Birthday) disintesis secara murni via kode JavaScript tanpa perlu mendownload file MP3 eksternal. 100% cepat dan bebas gagal load.
5. **Mobile-First & 100% Responsive**:
   - Dirancang khusus agar sangat nyaman dibuka di browser smartphone (iOS Safari, Android Chrome) maupun layar laptop.

---

## 🚀 Cara Menjalankan (How to Run)

### Opsi 1: Buka Langsung (Direct Open)
Cukup klik dua kali file `index.html` di file explorer kamu untuk membukanya langsung di Google Chrome, Edge, Safari, atau Firefox.

### Opsi 2: Menggunakan Local Server (Rekomendasi untuk Uji Coba)
Jika ingin menjalankan server lokal:
```bash
# Menggunakan Python
python -m http.server 8000

# Atau menggunakan Node (npx)
npx serve .
```
Lalu buka browser di `http://localhost:8000`.

### Opsi 3: Deploy ke GitHub Pages (Gratis & Mudah)
Kamu bisa langsung deploy proyek ini ke **GitHub Pages** agar Zulya bisa membukanya dari HP-nya:

1. **Inisialisasi Git & Commit**:
   ```bash
   git init
   git add .
   git commit -m "feat: Zulya belated birthday yurt mystery web app"
   ```
2. **Buat Repository Baru di GitHub** (misal dinamai: `hbd-zulya`).
3. **Hubungkan dan Push ke GitHub**:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<USERNAME-KAMU>/<NAMA-REPO>.git
   git push -u origin main
   ```
4. **Aktifkan GitHub Pages**:
   - Buka repo kamu di GitHub ➔ Klik tab **Settings** ➔ Pilih menu **Pages** di sebelah kiri.
   - Di bagian **Build and deployment > Source**, pilih **Deploy from a branch**.
   - Branch: pilih `main` dan folder `/ (root)`. Klik **Save**.
   - Tunggu sekitar 1-2 menit, GitHub akan memberikan link website kamu (contoh: `https://<username>.github.io/hbd-zulya/`). Link ini siap kamu bagikan ke Zulya!

---

## 📁 Struktur File
```
├── index.html        # Kerangka pemandangan Steppe, Yurt, HUD, modal dialog & kartu perayaan
├── style.css         # Styling responsif mobile-first, animasi lemparan sandal & visual tenda
├── js/
│   ├── audio.js      # Web Audio API Synthesizer (SFX sandal, knock, buzzer, 8-bit BGM)
│   ├── dialogues.js  # Naskah percakapan komedi (Rusia, Inggris, Mongolia)
│   └── game.js       # Game loop, state manager, sistem partikel konfeti
└── README.md         # Dokumentasi & panduan
```
