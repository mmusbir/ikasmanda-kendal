# Alumni Management System

Sistem manajemen alumni untuk Ikatan Keluarga Alumni SMAN 2 Kendal.

Project ini mencakup:
- website publik untuk beranda, direktori alumni, lapak usaha, dan pendaftaran mandiri
- panel admin untuk verifikasi, CRUD data, import CSV, pengaturan halaman depan, kategori lapak, provinsi, dan user admin
- backend API berbasis Express + MySQL

## Fitur Utama

- autentikasi admin berbasis session
- dashboard admin dengan sidebar dan submenu pengaturan
- manajemen data alumni:
  - tambah
  - edit
  - hapus
  - verifikasi
  - import CSV
- manajemen data usaha alumni:
  - tambah
  - edit
  - hapus
  - verifikasi
- pengaturan halaman depan:
  - favicon
  - logo
  - hero section
  - hide/show teks logo
- manajemen kategori lapak
- manajemen provinsi
- manajemen user admin
- direktori alumni publik dengan filter
- lapak alumni publik dengan filter
- pendaftaran alumni mandiri dengan alur verifikasi admin

## Stack

- Frontend: HTML, Tailwind via CDN, vanilla JavaScript
- Backend: Node.js, Express
- Database: MySQL
- Upload: Multer
- Mailer: Nodemailer

## Struktur Folder

- `frontend/`
  - halaman publik
  - halaman login admin
  - panel admin
  - folder upload publik
- `backend/`
  - API
  - model
  - controller
  - route
  - middleware
  - bootstrap database

## Menjalankan Secara Lokal

### 1. Clone repository

```powershell
git clone https://github.com/mmusbir/alumni-management-system.git
cd alumni-management-system
```

### 2. Siapkan file environment

Salin file contoh:

```powershell
Copy-Item backend/.env.example backend/.env
```

Lalu sesuaikan nilai di `backend/.env`.

### 3. Buat database MySQL

Buat database bernama:

```sql
ika_smanda
```

Lalu import schema:

```powershell
mysql -u root -p ika_smanda < backend/config/schema.sql
```

Jika menggunakan Laragon, Anda juga bisa import file [schema.sql](d:/Laragon/www/ikasmanda/backend/config/schema.sql) lewat HeidiSQL atau phpMyAdmin.

### 4. Install dependency backend

```powershell
cd backend
npm install
```

### 5. Jalankan server

```powershell
npm run dev
```

Server default berjalan di:

- `http://localhost:3000`

### 6. Akses aplikasi

- Website publik: `http://localhost:3000/`
- Direktori: `http://localhost:3000/direktori`
- Lapak: `http://localhost:3000/lapak`
- Pendaftaran: `http://localhost:3000/pendaftaran`
- Login admin: `http://localhost:3000/admin`

## Konfigurasi Environment

Contoh konfigurasi tersedia di [backend/.env.example](d:/Laragon/www/ikasmanda/backend/.env.example).

Variabel utama:

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `CORS_ORIGIN`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `ADMIN_DEFAULT_NAME`
- `ADMIN_DEFAULT_EMAIL`
- `ADMIN_DEFAULT_PASSWORD`
- `ADMIN_SESSION_TTL_SECONDS`

## Catatan Database

Schema awal akan membuat tabel:

- `alumni`
- `usaha`
- `lapak_categories`
- `provinces`
- `admin_users`
- `admin_sessions`
- `site_settings`

Seed awal juga mencakup:

- kategori lapak default
- seluruh provinsi Indonesia
- site settings default

## Catatan Admin Bootstrap

Akun admin awal dibaca dari file `.env`.

Gunakan nilai aman sebelum deployment production, terutama:

- `ADMIN_DEFAULT_EMAIL`
- `ADMIN_DEFAULT_PASSWORD`

## Catatan Upload dan GitHub

- file sensitif seperti `backend/.env` tidak ikut di-push
- `backend/node_modules` tidak ikut repo
- folder `frontend/uploads` diabaikan, hanya struktur folder yang disimpan
- `backend/package-lock.json` tetap disimpan agar instalasi konsisten

## Catatan Production

Sebelum deploy ke server production:

- ganti kredensial admin default
- gunakan password database yang kuat
- isi konfigurasi SMTP yang valid
- set `CORS_ORIGIN` ke domain aplikasi
- aktifkan reverse proxy jika tidak ingin memakai `:3000`

## Lisensi

Belum ditentukan.
