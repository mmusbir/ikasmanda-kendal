# Checklist Deploy Coolify

Gunakan checklist ini saat deploy production.

## Sebelum Deploy

- repo terbaru sudah di-push ke GitHub
- domain sudah mengarah ke server Coolify
- MySQL service sudah dibuat
- database `ika_smanda` sudah ada
- `backend/config/schema.sql` sudah di-import
- SMTP production sudah siap
- password admin default sudah kuat

## Konfigurasi Application

- build pack: `Dockerfile`
- dockerfile location: `./Dockerfile`
- base directory: root repository
- port expose: `3000`
- domain sudah ditambahkan di Coolify

## Environment Variables

- `NODE_ENV=production`
- `PORT=3000`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME=ika_smanda`
- `CORS_ORIGIN=https://domain-anda.com`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `ADMIN_DEFAULT_NAME`
- `ADMIN_DEFAULT_EMAIL`
- `ADMIN_DEFAULT_PASSWORD`
- `ADMIN_SESSION_TTL_SECONDS`

## Persistent Storage

- storage sudah dipasang ke:
  - `/app/frontend/uploads`

## Setelah Deploy

- homepage terbuka
- `/api/health` sukses
- login admin berhasil
- direktori alumni terbuka
- lapak alumni terbuka
- upload favicon/logo/hero berhasil
- file upload tetap ada setelah redeploy
- pendaftaran alumni berhasil tersimpan ke database
- email konfirmasi terkirim jika SMTP aktif

## Jika Gagal

- cek log build
- cek log runtime
- cek koneksi database
- cek apakah schema sudah di-import
- cek apakah storage persisten sudah dipasang
