# SILABU DIGI Migration Map

Source lama: `/root/bumdes-saas`
Project baru: `/root/silabu-digi`
Domain: `silabu.ondesa.id`
Webroot aaPanel: `/www/wwwroot/silabudigi`

## Prinsip

- Ambil fitur satu per satu dari lababumdes.
- Jangan copy semua folder lama.
- Domain logic yang stabil dipindah, struktur baru ditulis bersih.
- Setiap modul wajib punya smoke test minimal sebelum status selesai.

## Status Fitur

### 1. Auth Baru
Status: pondasi mulai

Target pola Hexclave yang diambil:
- email/password
- Google OAuth
- OTP + magic link email verification
- reset password
- refresh token rotation
- account linking Google + email
- signup throttle / rate limit
- audit log auth events

### 2. Tenant / Profil BUM Desa
Status: belum dicek

Target:
- data BUM Desa
- alamat/legalitas
- struktur pelaksana
- logo upload file
- kop surat

### 3. CoA / Akun
Status: belum dicek

Target:
- Kepmendesa 136
- custom CoA aman
- opening balance mapping

### 4. Opening Balance
Status: belum dicek

### 5. Transaksi
Status: belum dicek

### 6. Buku Kas
Status: belum dicek

### 7. Buku Besar
Status: belum dicek

### 8. Laporan
Status: belum dicek

Target:
- Neraca
- Laba Rugi
- Perubahan Modal
- Arus Kas
- PDF format BUM Desa

### 9. Aset Tetap
Status: belum dicek

### 10. Anggaran
Status: belum dicek

### 11. Tutup Buku
Status: belum dicek

## Urutan Migrasi

1. Auth Baru
2. Tenant / Profil BUM Desa
3. CoA + Opening Balance
4. Transaksi
5. Buku Kas / Buku Besar
6. Laporan
7. Aset Tetap
8. Anggaran
9. Tutup Buku
