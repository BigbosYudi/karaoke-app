# Instruksi projek Karaoke TV

- Selalu berkomunikasi dalam Bahasa Indonesia.
- Projek harus terisolasi: gunakan `.env` dan identitas Git lokal projek. Jangan gunakan login CLI atau konfigurasi Git global.
- Atas permintaan pengguna, setiap pembaruan projek ini harus langsung di-deploy setelah pengujian lulus, kecuali pengguna secara eksplisit meminta tidak deploy.
- Sebelum deploy, jalankan `node scripts/test.js`, pemeriksaan sintaks file JavaScript yang diubah, dan `git diff --check`. Jangan deploy jika pemeriksaan gagal.
- Deploy melalui commit dan push ke `origin/main` untuk GitHub Pages; gunakan token `.env` lokal melalui `scripts/deploy.ps1`. Jangan tampilkan atau commit kredensial.
- Verifikasi status build GitHub Pages untuk commit yang dikirim dan pastikan perubahan tersedia di situs. Laporkan kegagalan atau jika publikasi belum selesai; jangan menyatakan berhasil tanpa bukti.
- Situs projek: https://bigbosyudi.github.io/karaoke-app/
