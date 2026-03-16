# Panduan Deploy ke Coolify

Panduan ini dibuat khusus untuk struktur project ini:

- `backend/` berisi aplikasi Express
- `frontend/` disajikan langsung oleh Express dari folder statis
- upload file disimpan di `frontend/uploads`
- database menggunakan MySQL

Untuk project ini, metode deploy yang paling aman di Coolify adalah **Dockerfile build pack**.

Alasannya:

- project ini berbentuk monorepo (`backend` + `frontend`)
- server Node di `backend/server.js` membaca asset frontend dari `../frontend`
- upload file perlu storage persisten di dalam container

Referensi Coolify yang dipakai:

- Dockerfile build pack: https://coolify.io/docs/applications/build-packs/dockerfile
- Applications / base directory / deployment model: https://coolify.io/docs/applications/
- Persistent storage: https://coolify.io/docs/knowledge-base/persistent-storage
- Environment variables: https://coolify.io/docs/knowledge-base/environment-variables
- Domains dan HTTPS: https://coolify.io/docs/knowledge-base/domains

## 1. Prasyarat

Sebelum mulai, siapkan:

- server dengan Coolify aktif
- domain/subdomain yang mengarah ke server Coolify
- repository GitHub:
  - `https://github.com/mmusbir/alumni-management-system`
- akun SMTP yang valid jika ingin email pendaftaran aktif

## 2. Struktur deploy yang direkomendasikan

Di Coolify buat 2 resource:

1. **Application** untuk project ini
2. **MySQL Service** untuk database

Tambahkan juga **Persistent Storage** ke application untuk folder upload.

## 3. Buat MySQL Service di Coolify

Di project Coolify Anda:

1. klik **Create New Resource**
2. pilih **Database**
3. pilih **MySQL**
4. gunakan nama database:
   - `ika_smanda`

Simpan credential yang dibuat Coolify:

- host
- port
- username
- password
- database name

Catatan penting:

- file `backend/config/schema.sql` memakai `CREATE DATABASE ika_smanda` dan `USE ika_smanda`
- paling mudah jika nama database service di Coolify juga dibuat `ika_smanda`

## 4. Import schema database

Project ini masih membutuhkan tabel utama dari `schema.sql`, karena bootstrap aplikasi hanya membuat:

- `admin_users`
- `admin_sessions`
- `site_settings`
- `lapak_categories`
- `provinces`
- beberapa kolom tambahan

Bootstrap **tidak** membuat tabel utama berikut dari nol:

- `alumni`
- `usaha`

Jadi Anda harus import:

- `backend/config/schema.sql`

Cara import yang paling aman:

1. buat MySQL service di Coolify
2. konek ke service itu dari local machine atau terminal server
3. jalankan:

```bash
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p ika_smanda < backend/config/schema.sql
```

Jika database service Anda **bukan** bernama `ika_smanda`, edit dulu dua baris awal `schema.sql` sebelum import:

```sql
CREATE DATABASE IF NOT EXISTS nama_database_anda;
USE nama_database_anda;
```

## 5. Tambahkan Application di Coolify

Di Coolify:

1. klik **Create New Resource**
2. pilih **Application**
3. hubungkan repo GitHub Anda
4. pilih repository:
   - `mmusbir/alumni-management-system`
5. branch:
   - `main`
6. **Build Pack**:
   - pilih **Dockerfile**

Karena repo ini sudah memiliki `Dockerfile` di root, Coolify bisa langsung build dari sana.

## 6. Pengaturan dasar Application

Set nilai berikut di Coolify:

- **Port Exposes**: `3000`
- **Dockerfile Location**: `./Dockerfile`
- **Base Directory**: kosongkan / root repository

Alasan:

- container berjalan dari root repo
- `backend/server.js` membutuhkan akses ke `../frontend`

## 7. Environment Variables yang wajib

Tambahkan environment variables berikut di resource application:

```env
NODE_ENV=production
PORT=3000

DB_HOST=<host mysql dari coolify>
DB_PORT=<port mysql dari coolify>
DB_USER=<username mysql dari coolify>
DB_PASSWORD=<password mysql dari coolify>
DB_NAME=ika_smanda

CORS_ORIGIN=https://domain-anda.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=IKA SMANDA Kendal <noreply@domain-anda.com>

ADMIN_DEFAULT_NAME=Admin IKA SMANDA
ADMIN_DEFAULT_EMAIL=admin@domain-anda.com
ADMIN_DEFAULT_PASSWORD=ganti-dengan-password-kuat
ADMIN_SESSION_TTL_SECONDS=43200
```

Catatan:

- menurut dokumentasi Coolify, jika `PORT` tidak di-set maka Coolify akan mengisi dari `Port Exposes`, tapi untuk project ini lebih baik di-set eksplisit
- Coolify juga menyediakan variable bawaan seperti `PORT`, `HOST`, `COOLIFY_FQDN`, dan lainnya jika dibutuhkan

## 8. Tambahkan Persistent Storage

Karena upload asset disimpan ke:

- `frontend/uploads/site-settings`
- `frontend/uploads/imports`

Tambahkan persistent storage ke application:

- **Destination Path**:
  - `/app/frontend/uploads`

Ini mengikuti dokumentasi Coolify bahwa base path di dalam container adalah `/app`.

Tanpa storage persisten:

- favicon/logo/hero upload akan hilang saat redeploy
- file CSV import yang tersimpan di folder upload juga tidak persisten

## 9. Tambahkan domain

Di resource application:

1. buka bagian **Domains**
2. isi domain penuh, misalnya:
   - `https://alumni.domainanda.com`

Coolify akan mengatur reverse proxy dan SSL otomatis jika domain sudah mengarah ke server.

Pastikan DNS domain sudah mengarah ke IP server Coolify.

## 10. Deploy pertama

Setelah semua siap:

1. klik **Deploy**
2. tunggu build image selesai
3. cek log deploy

Jika sukses, buka:

- `https://domain-anda.com/`
- `https://domain-anda.com/admin`

## 11. Checklist verifikasi setelah deploy

Cek hal berikut:

1. halaman publik terbuka
2. `/api/health` mengembalikan sukses
3. login admin berhasil
4. upload logo/favicon/hero berhasil
5. setelah upload, file tetap ada setelah redeploy
6. pendaftaran alumni berhasil menyimpan ke database
7. email konfirmasi berjalan jika SMTP valid

## 12. Masalah yang paling mungkin muncul

### A. Aplikasi hidup tapi database error

Penyebab paling umum:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` salah
- schema belum di-import

### B. Halaman jalan, tapi upload hilang setelah deploy ulang

Penyebab:

- belum menambahkan persistent storage `/app/frontend/uploads`

### C. Login admin gagal setelah deploy

Cek:

- `ADMIN_DEFAULT_EMAIL`
- `ADMIN_DEFAULT_PASSWORD`
- tabel `admin_users` sudah ada

Catatan:

- admin default hanya dibuat jika email tersebut belum ada di database
- jika Anda ganti env setelah admin pertama dibuat, akun lama tidak otomatis diubah

### D. Pendaftaran berhasil tapi email tidak terkirim

Penyebab:

- SMTP belum valid
- akun Gmail belum memakai app password

Penting:

- kegagalan email tidak selalu menggagalkan pendaftaran, karena pengiriman email dibuat non-blocking

## 13. Rekomendasi production

Sebelum live penuh:

1. ganti password admin default ke password kuat
2. gunakan database password kuat
3. set `CORS_ORIGIN` hanya ke domain production
4. aktifkan SMTP yang benar
5. backup database MySQL lewat fitur backup Coolify jika tersedia di instance Anda

## 14. Nilai yang saya rekomendasikan untuk project ini

Jika domain production Anda misalnya `https://alumni.example.com`, maka:

```env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://alumni.example.com
DB_NAME=ika_smanda
ADMIN_SESSION_TTL_SECONDS=43200
```

Storage:

```text
/app/frontend/uploads
```

Build:

```text
Dockerfile
```

Port:

```text
3000
```

## 15. Setelah panduan ini

Jika Anda ingin proses deploy lebih mulus lagi, langkah berikut yang paling berguna adalah:

1. menambahkan healthcheck container
2. menambahkan `.env.production.example`
3. menambahkan script migrasi database terpisah supaya tidak perlu import manual
