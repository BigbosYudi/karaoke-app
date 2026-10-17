# Karaoke TV

Aplikasi karaoke untuk **TV Android** (juga jalan di HP/laptop): cari lagu dari YouTube, susun antrean, lalu putar dengan pemutar resmi YouTube. Lirik sudah menyatu di dalam video karaoke, jadi aplikasi fokus pada pemutaran dan pengelolaan antrean.

Gratis, tanpa server, tanpa iklan milik aplikasi.

**Alamat online:** <https://bigbosyudi.github.io/karaoke-app/>
**Kode sumber:** <https://github.com/BigbosYudi/karaoke-app>

---

## 1. Cara pakai cepat (tanpa deploy)

1. Buka terminal di folder ini.
2. Jalankan server lokal:
   ```powershell
   node scripts/serve.js 8080
   ```
   Gunakan server bawaan ini: akses `.env`, `.git`, skrip internal, dan jalur keluar folder diblokir. Jangan gunakan server generik dari akar projek yang berisi kredensial.
3. Buka `http://localhost:8080` di komputer untuk mencoba.
4. Untuk TV: buka `http://IP-KOMPUTER:8080` dari browser TV (keduanya harus di Wi-Fi yang sama).

> Pemutar YouTube mewajibkan alamat `http://` atau `https://`. Membuka `index.html` langsung (`file://`) tidak selalu bekerja.

## 2. Pasang API key YouTube (disarankan)

Tanpa key, pencarian memakai server publik Invidious yang bisa berubah-ubah. Dengan key gratis, pencarian stabil (kuota 100 pencarian/hari).

1. Buka <https://console.cloud.google.com> dengan akun Google.
2. Buat project baru.
3. **APIs & Services → Library** → cari **YouTube Data API v3** → **Enable**.
4. **APIs & Services → Credentials → Create credentials → API key**.
5. Batasi key:
   - **API restrictions** → YouTube Data API v3
   - **Application restrictions** → Websites → tambah `http://localhost:8080/*` dan `https://bigbosyudi.github.io/karaoke-app/*`
6. Ada dua cara memakai key:
   - **Cara A (di TV):** tombol **Setelan** di aplikasi → tempel key → Simpan. Key tersimpan di browser TV.
   - **Cara B (file .env):**
     ```powershell
     Copy-Item .env.example .env
     # buka .env, isi YOUTUBE_API_KEY=AIza...
     powershell -ExecutionPolicy Bypass -File scripts\apply-env.ps1
     ```
     Perintah terakhir menghasilkan `js/config.local.js` yang dipakai saat aplikasi diload. File ini **tidak** ikut ter-commit.

## 3. Deploy ke GitHub Pages

Isi `.env` dulu (bagian 2, Cara B), lalu cara tercepat:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
```

Skrip itu membaca `GITHUB_USER`, `GITHUB_REPO`, dan `GIT_TOKEN` dari `.env`, menyetel remote, push branch `main`, lalu mencoba mengaktifkan Pages.

Bila melakukannya manual:

```powershell
git add .
git commit -m "Aplikasi karaoke TV"
git branch -M main
git remote add origin https://github.com/BigbosYudi/karaoke-app.git
git push -u origin main
```

Lalu di GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save**.
Alamat aplikasi: `https://bigbosyudi.github.io/karaoke-app/`.

Catatan untuk repo: Pages gratis hanya untuk repo **publik**. `js/config.local.js` (berisi API key untuk pemakaian lokal) sengaja diabaikan git agar key tidak pernah publik; di versi online key dimasukkan sekali lewat tombol **Setelan** di browser TV.

> Saat `git push`, gunakan Personal Access Token (izin **Contents: Read and write**) yang disimpan di `.env`, bukan login CLI global.

## 4. Pemasangan di TV Android

1. Pasang browser **TV Bro** (gratis, dioptimalkan untuk remote) dari Google Play di TV.
2. Buka alamat aplikasi.
3. Simpan sebagai bookmark/shortcut di TV Bro.
4. Pindah tab cepat: tombol angka **1–4** pada remote.

## 5. Blokir iklan (2 lapis)

**Lapis 1 — AdGuard DNS (seluruh TV):**
- **Setelan → Network & Internet → Private DNS → Nama host penyedia DNS pribadi** → isi `dns.adguard-dns.com`
- Bila TV tidak punya menu Private DNS, set DNS router ke `94.140.14.14` dan `94.140.15.15`.

**Lapis 2 — aplikasi bersih:** aplikasi memakai `youtube-nocookie.com`, tanpa tracker/analytics/iklan sendiri.

Catatan: iklan pre-roll/mid-roll YouTube sebagian masih dapat muncul karena berasal dari domain video yang sama. Untuk nol iklan YouTube diperlukan pemblokir dalam-halaman (mis. Firefox sideload + uBlock Origin) — di luar cakupan panduan ini.

## 6. Kontrol remote

| Tombol | Fungsi |
| --- | --- |
| Panah | Pindah fokus antar tombol |
| OK | Pilih |
| 1–4 | Pindah tab: Cari, Antre, Putar, Bantuan |
| Back / Esc | Tutup Setelan / keluar dari layar penuh |

## 7. Struktur berkas

```
index.html                 Halaman utama (4 tab)
manifest.webmanifest       Metadata PWA
sw.js                      Service worker (mode offline shell)
css/style.css              Tampilan 10-foot UI
js/config.js               Konfigurasi + fungsi bantu
js/config.local.js         Hasil scripts/apply-env.ps1 (tidak di-commit)
js/queue.js                Antrean lagu (localStorage)
js/search.js               Pencarian YouTube Data API + fallback Invidious
js/player.js               Pemutar YouTube IFrame + kontrol + layar penuh
js/mic.js                  Mikrofon + echo (Web Audio API)
js/guide.js               Deteksi dukungan, panel diagnostik & tautan ke Setelan
js/app.js                  Pengatur tab, remote, modal, toast
scripts/apply-env.ps1      Ubah .env menjadi js/config.local.js
scripts/make-icons.ps1     Buat ulang ikon PNG
```

## 8. Batasan yang diketahui

- Kuota pencarian gratis 100/hari; fallback Invidious otomatis bila habis atau tanpa key.
- Lirik tidak ditampilkan aplikasi karena sudah ada di dalam video karaoke (untuk video non-karaoke tidak ada lirik).
- Video yang menolak diputar di pemutar tersemat (mis. dibatasi pemiliknya) otomatis dilewati, maksimal 5 lagu beruntun. Tombol **Buka di YouTube** membuka lagu itu lewat aplikasi YouTube di TV.
- Bila browser memblokir autoplay, aplikasi memberi tanda pada tombol **Putar**; tekan sekali untuk mulai.
- Antrean tersimpan per perangkat (localStorage), bukan tersinkron antar perangkat.
- Mikrofon bergantung dukungan browser TV; bila tidak didukung, tombol Mic dinonaktifkan otomatis.

## 9. Pemecahan masalah

| Gejala | Penyebab & solusi |
| --- | --- |
| Pemutar tidak muncul | Dibuka lewat `file://`. Jalankan lewat server http/https atau GitHub Pages |
| "Kuota API harian habis" | Kuota 100 pencarian habis; aplikasi otomatis pindah ke server cadangan |
| Lirik tidak muncul | Memang tidak ada panel lirik: lirik berada di dalam gambar video karaoke |
| Tombol Mic mati | Browser TV tidak mendukung `getUserMedia` atau halaman bukan https/localhost |
| Video diam setelah dipilih | Kebijakan autoplay browser; tombol **Putar** diberi tanda, tekan sekali |
| Video tidak bisa diputar di embed | Dibatasi pemilik video; aplikasi melewatinya otomatis, atau tekan **Buka di YouTube** |
| Aplikasi tidak jalan di STB lama | Browser/WebView terlalu tua (butuh Chromium ± 50+ / Android 7+). Pasang TV Bro versi terbaru; cek tab Bantuan → Diagnostik perangkat |
| Iklan masih muncul | Iklan dalam pemutar YouTube; lihat bagian 5 |


## 10. Pemeriksaan dan keamanan lokal

- Jalankan pengujian tanpa internet: `node scripts/test.js`.
- Server lokal hanya menyajikan aset aplikasi. Server mendengarkan jaringan lokal agar TV dapat mengaksesnya; gunakan jaringan yang dipercaya dan hentikan setelah selesai.
- `js/config.local.js` memang dibaca browser. Isinya bukan rahasia server: jangan masukkan token Git/deployment ke berkas ini. Batasi API key ke YouTube Data API dan alamat situs milik Anda, bukan seluruh `*.github.io`.
- Menekan Hapus Key menonaktifkan key konfigurasi lokal untuk browser ini sampai key baru disimpan.
- Mikrofon dimatikan ketika halaman ditinggalkan. Pemutaran langsung dari pencarian tidak melanjutkan antrean otomatis.
- Pengujian otomatis memakai simulasi browser/YouTube; pemutaran, autoplay, mikrofon, dan remote tetap perlu diuji di TV fisik.
