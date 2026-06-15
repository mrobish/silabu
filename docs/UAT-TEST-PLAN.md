# SILABU DIGI — UAT Test Plan

## Test Tenant
- **Nama:** TEST UAT BUM Desa
- **Email:** uat@silabu.test
- **Password:** testuat123
- **Tenant ID:** e28a0162-0056-464c-a443-11441064f7a7
- **Plan:** yearly (active, trial 365 days)

## Test Accounts (verified active + postable)
| Kode | Nama | Fungsi UAT |
|------|------|------------|
| 1.1.01.01 | Kas Tunai | Saldo awal, kas masuk/keluar |
| 1.1.05.01 | Persediaan Barang Dagangan | Beli/jual persediaan |
| 1.1.03.01 | Piutang Usaha | Jurnal penjualan |
| 2.1.01.01 | Utang Usaha | Beli barang |
| 3.1.01.01 | Penyertaan Modal Desa | Saldo awal, tambahan modal |
| 3.2.01.01 | Bagi Hasil Penyertaan Modal Desa | Prive (closest match) |
| 3.3.01.01 | Saldo Laba Tidak Dicadangkan | Closing → laba |
| 4.1.01.01 | Pendapatan Tiket | Pendapatan operasional |
| 5.1.01.01 | Harga Pokok Penjualan Barang Dagangan | HPP |
| 6.1.04.01 | Beban Listrik | Beban operasional |

---

## Scenario 1: Saldo Awal

### 1.1 Input Saldo Awal
| Akun | Debit | Kredit |
|------|-------|--------|
| 1.1.01.01 Kas Tunai | 100,000 | |
| 1.1.05.01 Persediaan | 50,000 | |
| 2.1.01.01 Utang Usaha | | 30,000 |
| 3.1.01.01 Modal | | 120,000 |
| **TOTAL** | **150,000** | **150,000** |

**Expected:** Balance = 0, tersimpan sebagai draft

### 1.2 Posting Saldo Awal
**Expected:** isposted = true, muncul di Buku Besar dan Neraca

### 1.3 Verifikasi
- [ ] Buku Besar Kas Tunai: saldo awal 100,000
- [ ] Neraca: Aset Lancar = 150,000, Kewajiban = 30,000, Modal = 120,000
- [ ] Neraca Saldo: semua akun sesuai

---

## Scenario 2: Persediaan dan HPP

### 2.1 Beli Barang (Jurnal Umum)
| Akun | Debit | Kredit |
|------|-------|--------|
| 1.1.05.01 Persediaan | 100,000 | |
| 1.1.01.01 Kas Tunai | | 100,000 |
**Keterangan:** Beli 10 unit × Rp10,000

**Expected:** Jurnal balance, persediaan = 150,000 (50,000 + 100,000)

### 2.2 Jual Barang (Transaksi Cepat / POS)
- Qty: 5 unit
- Harga jual: Rp15,000/unit = Rp75,000 total
- HPP: 5 × Rp10,000 = Rp50,000

**Expected auto-journal:**
| Akun | Debit | Kredit |
|------|-------|--------|
| 1.1.01.01 Kas Tunai | 75,000 | |
| 4.1.01.01 Pendapatan | | 75,000 |
| 6.1.01.01 HPP | 50,000 | |
| 1.1.05.01 Persediaan | | 50,000 |

### 2.3 Verifikasi
- [ ] Persediaan akhir: 100,000 (150,000 - 50,000)
- [ ] Stok akhir: 5 unit
- [ ] HPP tercatat: 50,000
- [ ] Pendapatan tercatat: 75,000

---

## Scenario 3: Beban dan Laba Rugi

### 3.1 Input Beban Listrik (Jurnal Umum)
| Akun | Debit | Kredit |
|------|-------|--------|
| 5.1.01.01 Beban Listrik | 20,000 | |
| 1.1.01.01 Kas Tunai | | 20,000 |
**Keterangan:** Bayar listrik bulan ini

### 3.2 Verifikasi Laba Rugi
| Item | Expected |
|------|----------|
| Pendapatan Operasional | 75,000 |
| HPP | 50,000 |
| Laba Kotor | 25,000 |
| Beban Operasional | 20,000 |
| Laba Bersih | 5,000 |

---

## Scenario 4: Modal dan Prive

### 4.1 Tambah Modal (Jurnal Umum)
| Akun | Debit | Kredit |
|------|-------|--------|
| 1.1.01.01 Kas Tunai | 50,000 | |
| 3.1.01.01 Modal | | 50,000 |
**Keterangan:** Tambah modal dari pemilik

### 4.2 Prive (Jurnal Umum)
| Akun | Debit | Kredit |
|------|-------|--------|
| 3.2.01.01 Prive | 10,000 | |
| 1.1.01.01 Kas Tunai | | 10,000 |
**Keterangan:** Prive pemilik

### 4.3 Verifikasi Perubahan Modal
| Item | Expected |
|------|----------|
| Modal Awal | 120,000 |
| Tambah Modal | 50,000 |
| Prive | -10,000 |
| Laba Bersih | 5,000 |
| Modal Akhir | 165,000 |

### 4.4 Verifikasi Neraca
| Item | Expected |
|------|----------|
| Kas Tunai | 195,000 (100k-100k+75k-20k+50k-10k) |
| Persediaan | 100,000 |
| Total Aset | 295,000 |
| Utang Usaha | 30,000 |
| Modal | 165,000 |
| Laba Ditahan | 5,000 |
| Total Kewajiban+Modal | 295,000 ← harus balance! |

---

## Scenario 5: Semua Laporan

Test akses semua laporan via UI:
- [ ] Dashboard — summary cards
- [ ] Buku Besar — per akun
- [ ] Neraca Saldo — sebelum/sesudah transaksi
- [ ] Laba Rugi — P&L lengkap
- [ ] Neraca — balance sheet
- [ ] Perubahan Modal — modal changes
- [ ] Arus Kas — cash flow classification

---

## Scenario 6: Proteksi Data

### 6.1 Jurnal Tidak Balance
**Action:** Kirim jurnal debit ≠ kredit
**Expected:** Error 400, jurnal ditolak

### 6.2 Penjualan Melebihi Stok
**Action:** Jual 100 unit (stok hanya 5)
**Expected:** Error 400, transaksi ditolak

### 6.3 Saldo Awal Unpost Protection
**Action:** Unpost saldo awal setelah ada transaksi posted
**Expected:** Error 409, unpost ditolak

### 6.4 Draft Tidak Masuk Laporan
**Action:** Buat jurnal draft (unposted), cek Neraca Saldo
**Expected:** Draft tidak muncul di laporan

### 6.5 Double Submit
**Action:** Klik submit 2× cepat
**Expected:** Hanya 1 jurnal yang dibuat (idempotency)

### 6.6 Tenant Isolation
**Action:** Login sebagai uat@silabu.test, cek data
**Expected:** Hanya bisa lihat data TEST UAT, bukan tenant lain

---

## Scenario 7: Tutup Buku

### 7.1 Eksekusi Tutup Buku
**Expected:**
- Jurnal closing dibuat (CL-20261231)
- Pendapatan/HPP/Beban di-nol-kan
- Laba bersih dipindah ke Saldo Laba (3.3.01.01)

### 7.2 Verifikasi Setelah Closing
- [ ] Laba Rugi = 0 (semua di-nol-kan)
- [ ] Neraca: Saldo Laba bertambah sesuai laba bersih
- [ ] Perubahan Modal: laba masuk ke Saldo Laba
- [ ] Jurnal closing terlihat di Buku Besar

---

## Scenario 8: UI Check

### 8.1 Laptop/Desktop
- [ ] Login → Dashboard → semua menu
- [ ] Browser console: no red errors

### 8.2 Mobile/HP
- [ ] Sidebar overlay works
- [ ] Login form responsive
- [ ] Transaction forms usable

---

## Checklist Final

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1.1 | Input saldo awal | ⬜ | |
| 1.2 | Posting saldo awal | ⬜ | |
| 1.3 | Buku Besar/Neraca | ⬜ | |
| 2.1 | Beli barang | ⬜ | |
| 2.2 | Jual barang | ⬜ | |
| 2.3 | HPP verification | ⬜ | |
| 3.1 | Input beban | ⬜ | |
| 3.2 | Laba Rugi check | ⬜ | |
| 4.1 | Tambah modal | ⬜ | |
| 4.2 | Prive | ⬜ | |
| 4.3 | Perubahan Modal | ⬜ | |
| 5.x | Semua laporan | ⬜ | |
| 6.1 | Jurnal tidak balance | ⬜ | |
| 6.2 | Stok exceeded | ⬜ | |
| 6.3 | OB unpost protection | ⬜ | |
| 6.4 | Draft excluded | ⬜ | |
| 6.5 | Double submit | ⬜ | |
| 6.6 | Tenant isolation | ⬜ | |
| 7.x | Tutup buku | ⬜ | |
| 8.x | UI check | ⬜ | |
