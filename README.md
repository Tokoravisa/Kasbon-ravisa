# Buku Kasbon - Toko Ravisa

Aplikasi pencatatan kasbon (utang) pelanggan, terhubung ke Google Sheets.

## Menjalankan secara lokal
```
npm install
npm run dev
```

## Deploy
Project ini dibuat untuk deploy otomatis lewat Vercel (root directory: folder ini, framework: Vite).

## Konfigurasi
- Password admin: lihat `ADMIN_PASSWORD` di `src/KasbonApp.jsx`
- URL Google Sheets API: lihat `SHEETS_API_URL` di `src/KasbonApp.jsx`
