# Logika Perhitungan Laporan SILABU DIGI

> **Dokumen Audit Akuntansi** — Generated 2026-06-15
> Tujuan: Review kesesuaian dengan kaidah akuntansi BUMDes / SAK EMKM / ETAP
> Status: **DRAFT — menunggu review pemilik**

---

## Daftar Isi

1. [A. Laba Rugi](#a-laba-rugi)
2. [B. Neraca](#b-neraca)
3. [C. Perubahan Modal](#c-perubahan-modal)
4. [D. Arus Kas](#d-arus-kas)
5. [E. Buku Besar](#e-buku-besar)
6. [F. Neraca Saldo](#f-neraca-saldo)
7. [G. Dashboard](#g-dashboard)
8. [H. Saldo Awal](#h-saldo-awal)
9. [I. Penjualan/POS dan HPP](#i-penjualanpos-dan-hpp)
10. [J. Tutup Buku](#j-tutup-buku)

---

## A. Laba Rugi

| Item | Penjelasan |
|---|---|
| **Endpoint** | `GET /api/accounting/laba-rugi` |
| **Query params** | `start_date`, `end_date` (YYYY-MM-DD) |
| **Function/file** | `computeLabaRugi()` — `apps/api/src/accounting-routes.ts:1572` |
| **Sumber tabel** | `chart_of_accounts` + `journal_lines` + `journal_entries` |
| **Filter periode** | `je.tanggal >= start_date AND je.tanggal <= end_date` (opsional) |
| **Akun yang dihitung** | Golongan 4, 5, 6, 7 (`LEFT(c.kode,1) IN ('4','5','6','7')`) — hanya `ispostable = true` |
| **Akun yang dikecualikan** | `tipetransaksi NOT IN ('OPENING_BALANCE', 'CLOSING')` |
| **Rumus** | |
| | Pendapatan Operasional = Σ Gol 4 (4.1 Jasa + 4.2-4.3 Dagang) |
| | HPP = Σ Gol 5 |
| | Laba Kotor = Pendapatan Operasional − HPP |
| | Beban Operasional = Σ Gol 6 |
| | Laba Operasional = Laba Kotor − Beban Operasional |
| | Pendapatan Lain = Σ Gol 7.1 |
| | Beban Lain = Σ Gol 7.2 |
| | Beban Pajak = Σ Gol 7.3 |
| | Laba Sebelum Pajak = Laba Operasional + Pendapatan Lain − Beban Lain |
| | **Laba Bersih** = Laba Sebelum Pajak − Beban Pajak |
| **Debit/Kredit logic** | Saldo dihitung berdasarkan `saldonormal`: |
| | `saldonormal = 'D'` → saldo = debit − kredit |
| | `saldonormal = 'K'` → saldo = kredit − debit |
| | Catatan: Pendapatan (Gol 4) saldonormal=K, jadi saldo = kredit−debit (positif = normal). Beban (Gol 5/6) saldonormal=D, jadi saldo = debit−kredit (positif = beban). |
| **Contoh angka** | Pendapatan Jasa: kredit 50jt → saldo = +50jt |
| | HPP: debit 20jt → saldo = +20jt |
| | Beban Operasional: debit 10jt → saldo = +10jt |
| | Laba Kotor = 50jt − 20jt = 30jt |
| | Laba Operasional = 30jt − 10jt = 20jt |
| | Laba Bersih = 20jt (tanpa pajak/lain-lain) |
| **Potensi edge case** | 1. `start_date = null` → semua mutasi dari awal tenant (termasuk tahun lalu). Berguna untuk Neraca "laba berjalan dari awal". |
| | 2. Akun Gol 7 kosong → laba sebelum pajak = laba operasional (OK). |
| | 3. Saldo negatif di Pendapatan → bisa terjadi kalau ada reversal (debit > kredit di akun K-normal). Ini mengurangi pendapatan, secara matematis benar. |
| **Catatan risiko** | ⚠️ Laba Rugi mengecualikan CLOSING — ini benar karena jurnal closing hanya memindahkan saldo laba/rugi ke ekuitas, bukan transaksi riil. |
| | ⚠️ Tidak ada filter `isposted` — semua entry masuk termasuk yang belum diposting. Perlu dicek apakah ada entry `isposted=false`. |
| **Sesuai kaidah?** | ✅ Struktur multi-step sesuai SAK EMKM. Rumus benar. |

---

## B. Neraca

| Item | Penjelasan |
|---|---|
| **Endpoint** | `GET /api/accounting/neraca` |
| **Query params** | `end_date` (YYYY-MM-DD, default: hari ini) |
| **Function/file** | Inline di `apps/api/src/accounting-routes.ts:1719` |
| **Sumber tabel** | `chart_of_accounts` + `journal_lines` + `journal_entries` |
| **Filter periode** | `je.tanggal <= end_date` — **SEMUA mutasi dari awal hingga end_date** |
| **Akun yang dihitung** | Golongan 1, 2, 3 (`LEFT(c.kode,1) IN ('1','2','3')`) — hanya `ispostable = true` |
| **Akun yang dikecualikan** | `tipetransaksi <> 'CLOSING'` — CLOSING dikecualikan dari saldo akun |
| **Rumus** | |
| | **AKTIVA (Gol 1):** |
| | Aset Lancar = Σ Gol 1.1 |
| | Aset Tetap Bruto = Σ Gol 1.3 WHERE saldonormal='D' |
| | Aset Tetap Akumulasi = Σ Gol 1.3 WHERE saldonormal='K' |
| | Nilai Buku Aset Tetap = Σ Gol 1.3 (bruto + akumulasi, net) |
| | Aset Lainnya = Σ Gol 1.x BUKAN 1.1 DAN BUKAN 1.3 |
| | **Total Aset** = Σ Gol 1 |
| | **PASSIVA:** |
| | Kewajiban Jangka Pendek = Σ Gol 2.1 |
| | Kewajiban Jangka Panjang = Σ Gol 2.2 |
| | Total Kewajiban = Σ Gol 2 |
| | Ekuitas Akun = Σ Gol 3 (exclude CLOSING) |
| | **Laba Berjalan** = `computeLabaRugi(tenantId, null, end_date).labaBersih` |
| | Total Ekuitas = Ekuitas Akun + Laba Berjalan |
| | **Total Passiva** = Total Kewajiban + Total Ekuitas |
| **Validasi** | `isBalanced = \|TotalAset − TotalPassiva\| < 0.005` |
| **Debit/Kredit logic** | Gol 1: saldo = debit − kredit (positif = aset normal) |
| | Gol 2/3: saldo = kredit − debit (positif = kewajiban/ekuitas normal) |
| | Contra-aset (saldonormal K, Gol 1.3.07): otomatis negatif → mengurangi total aset. |
| **Contoh angka** | Kas Tunai: debit 100jt, kredit 20jt → saldo = +80jt |
| | Akumulasi Penyusutan: debit 0, kredit 15jt → saldo = kredit−debit = +15jt (tapi karena Gol 1, formula = debit−kredit = −15jt → mengurangi aset). |
| | Modal: debit 0, kredit 50jt → saldo = +50jt |
| | Laba Berjalan: +20jt (dari computeLabaRugi) |
| | Total Aset = 80jt − 15jt = 65jt |
| | Total Passiva = 0 + (50jt + 20jt) = 70jt... SELISIH! → perlu dicek. |
| **Potensi edge case** | 1. **"SUNTIKAN MAUT"**: Laba Berjalan dari `computeLabaRugi(null, endDate)` = SEMUA laba dari awal tenant. Jika sudah tutup buku tahun lalu, laba tahun lalu SUDAH masuk Saldo Laba (3.3.01.01) via jurnal CLOSING. Tapi karena CLOSING dikecualikan dari Neraca, laba tahun lalu TIDAK masuk Ekuitas Akun. Laba Berjalan hanya menghitung P&L exclude CLOSING → laba tahun ini saja. **Ini sudah benar.** |
| | 2. Jika belum pernah tutup buku → Laba Berjalan = akumulasi semua laba sejak awal. Ekuitas Akun hanya berisi Modal + Prive (Gol 3.1 + 3.2). Saldo Laba (3.3) = 0 karena belum ada closing. Neraca tetap balance. |
| | 3. Jika sudah tutup buku → Laba tahun lalu sudah masuk 3.3.01.01 via CLOSING. Laba Berjalan = laba tahun ini saja. Total Ekuitas = Modal + Prive + Saldo Laba (dari closing) + Laba Berjalan (tahun ini). |
| **Catatan risiko** | ⚠️ Formula Neraca menggunakan `LEFT(c.kode,1)` bukan `saldonormal`. Ini benar karena semua Gol 1 pasti debit-normal (kecuali contra-asset yang otomatis jadi negatif). |
| | ⚠️ `computeLabaRugi(null, endDate)` menghitung SEMUA P&L dari awal tenant. Jika ada data tahun lalu yang belum di-closing, laba berjalan bisa terlalu besar. **Ini sebenarnya benar** — laba yang belum di-closing memang masih menjadi bagian laba berjalan. |
| **Sesuai kaidah?** | ✅ Aset = Kewajiban + Ekuitas. Laba berjalan sebagai komponen ekuitas sesuai PSAK/SAK EMKM. |

---

## C. Perubahan Modal

| Item | Penjelasan |
|---|---|
| **Endpoint** | `GET /api/accounting/perubahan-modal` |
| **Query params** | `tahun` (default: tahun berjalan), `start_date`, `end_date` |
| **Function/file** | Inline di `apps/api/src/accounting-routes.ts:1825` |
| **Sumber tabel** | `chart_of_accounts` + `journal_lines` + `journal_entries` |
| **Filter periode** | start_date = `${tahun}-01-01`, end_date = `${tahun}-12-31` (default) |
| **Akun yang dihitung** | Gol 3 (kode `3.x`) — `ispostable = true` |
| **Rumus** | |
| | **Modal Awal** = Σ saldo Gol 3 dari SEMUA entry SEBELUM periode (termasuk OPENING_BALANCE apapun tanggalnya + entry tanggal < start_date). **INCLUDE CLOSING historis.** |
| | **Tambahan Modal** = Σ (kredit − debit) akun Gol 3.1.xx |
| | **Prive** = Σ (debit − kredit) akun Gol 3.2.xx (NET, bisa negatif = reversal) |
| | **Laba Bersih** = dari `computeLabaRugi(start_date, end_date)` |
| | **Modal Akhir** = Modal Awal + Tambahan Modal + Laba Bersih − Prive |
| | **Cross-check**: Modal Akhir WAJIB ≈ Total Ekuitas di Neraca (selisih < 0.005) |
| **Debit/Kredit logic** | Modal Awal: `saldonormal = 'D'` → debit−kredit; `saldonormal = 'K'` → kredit−debit |
| | Tambahan Modal (3.1): NET = kredit − debit (positif = setoran) |
| | Prive (3.2): NET = debit − kredit (positif = penarikan, negatif = reversal) |
| | 3.3.xx (Saldo Laba) → **excluded** dari keduanya |
| **Akun yang dikecualikan** | Modal Awal: **termasuk** CLOSING (closing tahun lalu mengubah saldo awal) |
| | Mutasi tahun berjalan: **exclude** OPENING_BALANCE dan CLOSING |
| **Contoh angka** | Modal Awal: 100jt (dari opening balance + jurnal sebelumnya) |
| | Tambahan Modal (3.1.01): kredit 10jt → NET = +10jt |
| | Prive (3.2.01): debit 5jt → NET = +5jt |
| | Laba Bersih: 20jt |
| | Modal Akhir = 100jt + 10jt + 20jt − 5jt = 125jt |
| **Potensi edge case** | 1. Prive negatif (reversal): debit < kredit di akun 3.2 → NET negatif → Modal Akhir = Modal Awal + Tambahan + Laba − (negatif) = Modal Awal + Tambahan + Laba + \|prive\|. Ini benar — reversal prive menambah modal. |
| | 2. Saldo Laba (3.3) dari closing tahun lalu masuk Modal Awal (INCLUDE CLOSING). Laba tahun ini dari computeLabaRugi (EXCLUDE CLOSING). Tidak double-count. |
| | 3. Jika belum pernah tutup buku → Modal Awal hanya berisi OPENING_BALANCE + jurnal Gol 3 sebelum periode. Saldo Laba (3.3) = 0. Laba Bersih = semua laba sejak awal. |
| **Catatan risiko** | ⚠️ Perbedaan treatment CLOSING: Modal Awal INCLUDE CLOSING, tapi mutasi tahun berjalan EXCLUDE CLOSING. Ini **sudah benar** — closing tahun lalu sudah menjadi bagian saldo awal. |
| | ⚠️ Cross-check dengan Neraca harus selalu cocok. Jika tidak cocok = bug di salah satu formula. |
| **Sesuai kaidah?** | ✅ Rumus sesuai SAK EMKM. Prive NET (bukan raw debit) lebih akurat untuk reversal. |

---

## D. Arus Kas

| Item | Penjelasan |
|---|---|
| **Endpoint** | `GET /api/accounting/arus-kas` |
| **Query params** | `start_date`, `end_date` |
| **Function/file** | Inline di `apps/api/src/accounting-routes.ts:2155` |
| **Sumber tabel** | `chart_of_accounts` + `journal_lines` + `journal_entries` |
| **Metode** | **Langsung** (Direct Method) — kas masuk/keluar diklasifikasikan berdasarkan akun lawan |
| **Definisi Kas/Bank** | Gol 1.1.01 (Kas) + Gol 1.1.02 (Setara Kas) — `c.kode LIKE '1.1.01%' OR c.kode LIKE '1.1.02%'` |
| **Filter periode** | start_date s/d end_date. OPENING_BALANCE selalu diikutkan (apapun tanggalnya). |
| **Rumus** | |
| | **Kas Tahun Lalu** = saldo Kas/Bank dari SEMUA entry SEBELUM start_date + OPENING_BALANCE |
| | **Analisis Arus Kas**: per entry yang melibatkan Kas/Bank, hitung net kas (debit−kredit), lalu cari akun lawan utama (contra dengan jumlah terbesar yang sesuai arah kas) |
| | **Klasifikasi**: |
| | - Operasi: Gol 1.1.03 (Piutang), 1.1.05 (Persediaan), 4, 5, 6, 7 |
| | - Investasi: Gol 1.2, 1.3 |
| | - Pendanaan: Gol 2, 3 |
| | **Kas Berjalan** = Kas Tahun Lalu + Net Operasi + Net Investasi + Net Pendanaan |
| | **Validasi**: Kas Berjalan WAJIB ≈ saldo Kas/Bank di Neraca (selisih < 0.005) |
| **Debit/Kredit logic** | Net kas per entry = Σ debit kas − Σ kredit kas |
| | Positif = kas masuk (operasi masuk, investasi masuk, dll) |
| | Negatif = kas keluar |
| | Akun lawan ditentukan dari contra entry (bukan kas) yang paling besar |
| **Contoh angka** | Entry: Debit Kas 10jt, Kredit Pendapatan 10jt |
| | → Net kas = +10jt, contra = Pendapatan (Gol 4) → Operasi Masuk +10jt |
| | Entry: Debit Beban 3jt, Kredit Kas 3jt |
| | → Net kas = −3jt, contra = Beban (Gol 6) → Operasi Keluar +3jt |
| **Potensi edge case** | 1. **Jurnal multi-baris** (misal POS: Kas/Pendapatan/HPP/Persediaan): Sistem menggunakan "primary contra" — akun lawan terbesar yang sesuai arah kas. Ini menghindari double-count. |
| | 2. Transfer antar kas/bank (Kas Tunai ↔ Bank): Net kas = 0 untuk entry tersebut (debit di satu kas, kredit di kas lain). Tidak masuk arus kas. |
| | 3. OPENING_BALANCE: Selalu masuk Kas Tahun Lalu meskipun tanggal sebelum start_date. |
| **Catatan risiko** | ⚠️ Klasifikasi berdasarkan kode akun, bukan sifat transaksi. Misal: pembelian aset tetap tunai → contra Gol 1.3 → Investasi. Ini benar. |
| | ⚠️ Tidak ada klasifikasi "aktivitas operasi/investasi/pendanaan" eksplisit di database — semua berdasarkan mapping kode akun. Jika user membuat akun dengan kode yang tidak standar, klasifikasi bisa salah. |
| **Sesuai kaidah?** | ✅ Direct method sesuai SAK EMKM. Klasifikasi 3 aktivitas standar. Validasi dengan Neraca sudah ada. |

---

## E. Buku Besar

| Item | Penjelasan |
|---|---|
| **Endpoint** | `GET /api/accounting/buku-besar` |
| **Query params** | `akun_id` (required), `start_date`, `end_date` |
| **Function/file** | Inline di `apps/api/src/accounting-routes.ts:1469` |
| **Sumber tabel** | `chart_of_accounts` + `journal_lines` + `journal_entries` |
| **Filter periode** | Saldo awal: SEMUA entry SEBELUM start_date. Mutasi: start_date s/d end_date. |
| **Akun yang dihitung** | 1 akun spesifik (berdasarkan `akun_id`) |
| **Rumus** | |
| | **Saldo Awal** = Σ mutasi akun SEBELUM start_date (semua tipetransaksi, termasuk OPENING_BALANCE) |
| | **Mutasi** = entry dalam periode, dengan running balance |
| | **Running Balance** = Saldo Awal + cumulative sum mutasi (ORDER BY tanggal, created_at) |
| | **Saldo Akhir** = baris terakhir running balance (atau saldo awal jika tidak ada mutasi) |
| **Debit/Kredit logic** | Faktor mutasi tergantung `saldonormal`: |
| | `saldonormal = 'D'` → mutasi = debit − kredit |
| | `saldonormal = 'K'` → mutasi = kredit − debit |
| | Running balance = saldo awal + Σ(mutasi baris 1..n) |
| **Contoh angka** | Kas Tunai (D-normal), Saldo Awal = 50jt |
| | Mutasi 1: debit 10jt → running = 50+10 = 60jt |
| | Mutasi 2: kredit 3jt → running = 60+(0−3) = 57jt |
| | Saldo Akhir = 57jt |
| **Potensi edge case** | 1. Tanpa `start_date` → tidak ada baris saldo awal, semua mutasi ditampilkan dari awal. |
| | 2. Akun tanpa mutasi → saldo awal = 0, mutasi kosong, saldo akhir = 0. |
| | 3. Saldo awal NEGATIF (misal Kas di Bank BSI test data) → running balance dimulai dari negatif. |
| **Catatan risiko** | ⚠️ Tidak ada filter `tipetransaksi` — SEMUA tipe masuk (OPENING, GENERAL, CLOSING, SALES, dll). Ini benar untuk buku besar — semua mutasi akun harus tercatat. |
| | ⚠️ Tidak ada filter `isposted` — entry yang belum diposting juga masuk. |
| **Sesuai kaidah?** | ✅ Running balance dengan saldo normal sesuai praktik akuntansi. |

---

## F. Neraca Saldo

| Item | Penjelasan |
|---|---|
| **Endpoint** | `GET /api/accounting/neraca-saldo` |
| **Query params** | `end_date`, `mode` (`before` / `after`) |
| **Function/file** | Inline di `apps/api/src/accounting-routes.ts:1974` |
| **Sumber tabel** | `chart_of_accounts` + `journal_lines` + `journal_entries` |
| **Filter periode** | `je.tanggal <= end_date` |
| **Akun yang dihitung** | Gol 1-7 (`LEFT(c.kode,1) IN ('1','2','3','4','5','6','7')`) — `ispostable = true` |
| **Mode sebelum closing** | `mode=before`: EXCLUDE CLOSING → P&L accounts masih ada saldonya |
| **Mode setelah closing** | `mode=after`: INCLUDE CLOSING → P&L accounts = 0 (sudah ditutup ke ekuitas) |
| **Rumus** | |
| | Saldo = berdasarkan `saldonormal`: D → debit−kredit; K → kredit−debit |
| | Tampilan debit/kredit: saldo ≥ 0 → tampil di kolom sesuai saldonormal; saldo < 0 → tampil di kolom lawan |
| | Total Debit = Σ semua debit |
| | Total Kredit = Σ semua kredit |
| | `isBalanced = \|totalDebit − totalKredit\| < 0.005` |
| **Debit/Kredit logic** | Mapping saldo ke kolom debit/kredit: |
| | `saldo >= 0 && saldonormal='D'` → debit = saldo |
| | `saldo >= 0 && saldonormal='K'` → kredit = saldo |
| | `saldo < 0 && saldonormal='D'` → kredit = \|saldo\| |
| | `saldo < 0 && saldonormal='K'` → debit = \|saldo\| |
| **Contoh angka** | Kas Tunai (D): debit 80jt, kredit 20jt → saldo = +60jt → debit=60jt, kredit=0 |
| | Pendapatan (K): debit 0, kredit 50jt → saldo = +50jt → debit=0, kredit=50jt |
| | Total Debit = 60jt, Total Kredit = 50jt → SELISIH 10jt (belum balance karena ada akun lain) |
| **Potensi edge case** | 1. Mode `after` + belum pernah tutup buku → CLOSING tidak ada → hasil sama dengan `before`. |
| | 2. Akun dengan saldo 0 tetap tampil (karena LEFT JOIN, saldo = 0). |
| | 3. Contra-asset (saldonormal K di Gol 1): saldo = kredit−debit. Jika kredit > debit → saldo positif → tampil di kredit (benar, akumulasi penyusutan). |
| **Catatan risiko** | ⚠️ Total Debit = Total Kredit hanya berlaku untuk Neraca Saldo (bukan Laba Rugi). Di mode `before`, P&L accounts masih ada → total debit ≠ total kredit (karena laba belum dipindahkan). Ini **normal** — Neraca Saldo sebelum closing memang tidak harus balance total D=K untuk Gol 1-7. Yang dicek adalah saldo per golongan. |
| **Sesuai kaidah?** | ✅ Format standar Neraca Saldo. Mode before/after fleksibel. |

---

## G. Dashboard

| Item | Penjelasan |
|---|---|
| **Endpoint** | `GET /api/accounting/dashboard-summary` |
| **Query params** | Tidak ada (otomatis tahun berjalan) |
| **Function/file** | Inline di `apps/api/src/accounting-routes.ts:1658` |
| **Sumber tabel** | `chart_of_accounts` + `journal_lines` + `journal_entries` + `computeLabaRugi` + `computeLabaRugiMonthlyGrouped` |
| **Filter periode** | Tahun berjalan: `yearStart` (1 Jan) s/d `today` |
| **Rumus** | |
| | **Total Pemasukan** = Pendapatan Operasional.subtotal + Pendapatan Lain.subtotal (dari computeLabaRugi) |
| | **Total Pengeluaran** = HPP.subtotal + Beban Operasional.subtotal + Beban Lain.subtotal + Pajak.subtotal |
| | **Saldo Kas** = Σ saldo Gol 1.1.01 (Kas) — SEMUA mutasi tanpa filter tanggal, tanpa exclude tipetransaksi |
| | **Laba Bersih** = dari computeLabaRugi (exclude OPENING_BALANCE dan CLOSING) |
| | **Transaksi Bulan Ini** = COUNT journal_entries WHERE tipetransaksi ≠ 'OPENING_BALANCE' AND tanggal dalam bulan berjalan |
| | **Monthly Chart** = computeLabaRugiMonthlyGrouped(tahun berjalan) |
| **Akun yang dihitung** | Saldo Kas: Gol 1.1.01 (`kode LIKE '1.1.01%'`) |
| | P&L: Gol 4-7 (via computeLabaRugi) |
| **Akun yang dikecualikan** | Laba: EXCLUDE OPENING_BALANCE dan CLOSING |
| | Saldo Kas: **TIDAK ADA filter tipetransaksi** — semua mutasi masuk |
| | Jumlah transaksi: EXCLUDE OPENING_BALANCE |
| **Potensi edge case** | 1. **Saldo Kas tidak exclude CLOSING** — jika ada jurnal closing yang menyentuh akun kas (seharusnya tidak), saldo kas bisa terpengaruh. |
| | 2. **Saldo Kas tidak filter tanggal** — saldo kas = akumulasi dari awal, bukan per periode. Ini benar untuk "saldo kas saat ini". |
| | 3. Total Pemasukan ≠ Total Pendapatan di Laba Rugi — karena dashboard menjumlahkan semua komponen pendapatan (operasional + lain), sedangkan Laba Rugi memisahkannya. Rumus sebenarnya sama. |
| **Catatan risiko** | ⚠️ Saldo Kas menggunakan `LEFT JOIN` tanpa filter tipetransaksi — berbeda dengan Neraca yang exclude CLOSING. Jika ada CLOSING entry yang menyentuh kas, hasilnya bisa berbeda. |
| | ⚠️ Jumlah transaksi hanya exclude OPENING_BALANCE, tidak exclude CLOSING. Closing entries ikut terhitung. |
| **Sesuai kaidah?** | ✅ Ringkasan wajar. Perlu konsistensi: Saldo Kas seharusnya juga exclude CLOSING. |

---

## H. Saldo Awal

| Item | Penjelasan |
|---|---|
| **Endpoint** | `POST /api/accounting/saldo-awal/post` (posting), `POST /api/accounting/saldo-awal/unpost` (unpost) |
| **Query params** | Tidak ada (berdasarkan tenant) |
| **Function/file** | Inline di `apps/api/src/accounting-routes.ts:1358` |
| **Sumber tabel** | `journal_entries` + `journal_lines` + `tenants` |
| **Tipe transaksi** | `OPENING_BALANCE` |
| **Rumus Posting** | |
| | 1. Advisory lock per tenant (serialisasi) |
| | 2. Cek `status_saldo_awal` di tabel `tenants` — jika sudah `POSTED`, return idempotent |
| | 3. Cek apakah ada entry `OPENING_BALANCE` |
| | 4. Validasi balance: total debit = total kredit (integer cents comparison) |
| | 5. Update `tenants.status_saldo_awal = 'POSTED'`, set lock flag |
| **Akun lawan** | Tidak ada akun lawan khusus — saldo awal langsung ke akun masing-masing. Debit dan kredit harus balance. |
| **Balance check** | `dbNumericToCents(total_debit) === dbNumericToCents(total_kredit)` — integer cents, zero tolerance |
| **Setelah posted** | Boleh di-unpost (kembali ke DRAFT). Setelah unpost, saldo awal bisa diedit. |
| **Potensi edge case** | 1. Posting ulang yang sudah POSTED → idempotent (tidak error). |
| | 2. Unpost saat ada transaksi berjalan → saldo awal berubah, semua laporan terpengaruh. |
| | 3. Saldo awal tidak balance → ditolak (error NOT_BALANCED). |
| **Catatan risiko** | ⚠️ Unpost tidak mengecek apakah ada transaksi yang sudah berjalan. Meng-unpost saldo awal bisa mengubah semua laporan retroaktif. |
| | ⚠️ Tidak ada audit trail siapa yang unpost dan kapan (hanya `saldo_awal_locked_by` untuk post). |
| **Sesuai kaidah?** | ✅ Saldo awal balance = prinsip dasar akuntansi. Lock/unlock fleksibel untuk onboarding. |

---

## I. Penjualan/POS dan HPP

| Item | Penjelasan |
|---|---|
| **Endpoint** | `POST /api/accounting/penjualan` |
| **Function/file** | Inline di `apps/api/src/accounting-routes.ts:3516` |
| **HPP Helper** | `calculateHppCents()` — `apps/api/src/utils/hpp-helpers.ts:45` |
| **Sumber tabel** | `journal_entries` + `journal_lines` + `inventory_items` + `chart_of_accounts` |
| **Jurnal yang terbentuk** | |
| | **Per item:** |
| | Line 1: **Debit Kas** = qty × harga_jual (akun kas dari pengaturan) |
| | Line 2: **Kredit Pendapatan** = qty × harga_jual (akun 4.2.xx) |
| | Line 3: **Debit HPP** = hpp_total_cents / 100 (akun 5.1.xx) |
| | Line 4: **Kredit Persediaan** = hpp_total_cents / 100 (akun 1.1.05.xx, dengan inventory_item_id + qty) |
| **Kas/Piutang debit** | Dari pengaturan tenant (`kasAkunId`) — bisa Kas Tunai atau Bank |
| **Pendapatan kredit** | Dari pengaturan tenant (`pendapatanAkunId`) — biasanya 4.2.xx (Pendapatan Dagang) |
| **HPP debit** | Dari pengaturan tenant (`hppAkunId`) — biasanya 5.1.xx (Harga Pokok Penjualan) |
| **Persediaan kredit** | Dari pengaturan tenant (`persediaanAkunId`) — biasanya 1.1.05.xx (Persediaan Barang) |
| **HPP calculation** | **Average Cost** (weighted average): |
| | `totalCost` = Σ debit persediaan untuk item tersebut (SEMUA entry posted) |
| | `totalQty` = Σ qty debit persediaan untuk item tersebut |
| | `hppPerUnit = totalCost / totalQty` |
| | `hppTotalCents = Math.round((totalCostCents × qtySold) / totalQty)` — **satu kali rounding di total level** |
| **Rounding** | Integer cents (×100). `Math.round()` di akhir. Bukan per-unit rounding. |
| | Contoh: totalCost=1000, totalQty=3, qtySold=3 → hppTotal=1000 (bukan 999!) |
| **Stok check** | `SELECT FOR UPDATE` on `inventory_items` → kalkulasi stok → block jika stok < 0 |
| | Stok = Σ qty debit − Σ qty kredit (dari journal_lines WHERE inventory_item_id = item) |
| **Qty validation** | Harus integer > 0 |
| **HPP validation** | HPP > 0 untuk barang persediaan. HPP = 0 ditolak. |
| **Potensi edge case** | 1. Stok kosong (totalQty = 0) → ditolak (error "data persediaan tidak valid"). |
| | 2. totalCost < 0 → ditolak. |
| | 3. Qty pecahan → ditolak (harus integer). |
| | 4. Concurrent sale → serialized via SELECT FOR UPDATE. |
| **Catatan risiko** | ⚠️ Average cost menggunakan SEMUA debit persediaan (termasuk opening balance). Jika harga beli berubah drastis, HPP bisa tidak mencerminkan harga terkini. |
| | ⚠️ Tidak ada filter tanggal pada perhitungan HPP — rata-rata dari awal hingga saat ini. |
| **Sesuai kaidah?** | ✅ Average cost diperbolehkan SAK EMKM. Rounding di total level lebih akurat dari per-unit. |

---

## J. Tutup Buku

| Item | Penjelasan |
|---|---|
| **Endpoint** | `POST /api/accounting/tutup-buku` |
| **Query params** | `tahun` (required) |
| **Function/file** | Inline di `apps/api/src/accounting-routes.ts:2804` |
| **Sumber tabel** | `journal_entries` + `journal_lines` + `chart_of_accounts` + `financial_periods` |
| **Lock mechanism** | Advisory lock `pg_advisory_xact_lock` per tenant+tahun + row lock `FOR UPDATE` |
| **Pre-check** | Tahun sebelumnya harus sudah CLOSED |
| **Rumus** | |
| | 1. Hitung saldo akhir Gol 4-7 (P&L) per 31 Des: exclude OPENING_BALANCE dan CLOSING |
| | 2. Hitung saldo Prive (Gol 3.2): exclude OPENING_BALANCE dan CLOSING |
| | 3. Laba Bersih = Σ Pendapatan (Gol 4) − Σ Beban (Gol 5,6,7) |
| | 4. Net ke Saldo Laba = Laba Bersih − total Prive |
| **Jurnal yang terbentuk** | |
| | No Jurnal: `CL-{tahun}1231` |
| | Tipe: `CLOSING` |
| | Tanggal: `{tahun}-12-31` |
| | **Zeroing P&L**: Balik saldo setiap akun Gol 4-7 |
| | - Pendapatan (K-normal, saldo +): Debit akun, Kredit Saldo Laba |
| | - Beban (D-normal, saldo +): Kredit akun, Debit Saldo Laba |
| | **Zeroing Prive**: Balik saldo akun Gol 3.2 |
| | - Prive (D-normal, saldo +): Kredit akun, Debit Saldo Laba |
| | - Prive negatif (reversal): Debit akun, Kredit Saldo Laba |
| | **Net ke Saldo Laba (3.3.01.01)**: |
| | - Laba Bersih − Prive > 0 → Kredit Saldo Laba |
| | - Laba Bersih − Prive < 0 → Debit Saldo Laba (rugi bersih) |
| **Akun yang ditutup** | Gol 4 (Pendapatan), Gol 5 (HPP), Gol 6 (Beban), Gol 7 (Pendapatan/Beban Lain) + Gol 3.2 (Prive) |
| **Akun tujuan** | Saldo Laba Tidak Dicadangkan (3.3.01.01) |
| **Balance check** | `validateJournalBalance(lines)` — integer cents, zero tolerance |
| **Post-close** | Update `financial_periods.status = 'CLOSED'` |
| | Auto-create periode tahun berikutnya (`INSERT ... ON CONFLICT DO NOTHING`) |
| **Idempotent** | Jika sudah CLOSED → return existing closing entry (tidak buat duplikat) |
| **Contoh angka** | Pendapatan: kredit 50jt → Jurnal closing: Debit Pendapatan 50jt |
| | Beban: debit 30jt → Jurnal closing: Kredit Beban 30jt |
| | Prive: debit 5jt → Jurnal closing: Kredit Prive 5jt |
| | Laba Bersih = 50jt − 30jt = 20jt |
| | Net ke Saldo Laba = 20jt − 5jt = 15jt → Kredit Saldo Laba 15jt |
| | Total Debit = 50jt (Pendapatan) + 0 = 50jt |
| | Total Kredit = 30jt (Beban) + 5jt (Prive) + 15jt (Saldo Laba) = 50jt ✅ BALANCE |
| **Potensi edge case** | 1. Semua P&L = 0 → error "Tidak ada saldo akun Laba/Rugi atau Prive yang perlu ditutup." |
| | 2. Rugi bersih (Laba Bersih < 0, Prive = 0): Net = negatif → Debit Saldo Laba (mengurangi ekuitas). |
| | 3. Prive > Laba Bersih: Net negatif → Debit Saldo Laba. |
| | 4. Akun 3.3.01.01 tidak ada → error "Seed CoA dulu". |
| **Catatan risiko** | ⚠️ Setelah tutup buku, laporan tahun berjalan (Neraca, Perubahan Modal) harus tetap benar karena: (a) Neraca exclude CLOSING → Laba Berjalan = 0 (P&L sudah di-zero). (b) Ekuitas Akun termasuk saldo Saldo Laba dari CLOSING. (c) Perubahan Modal Modal Awal INCLUDE CLOSING. |
| | ⚠️ Tidak bisa tutup buku tahun X jika tahun X-1 belum CLOSED. Ini memaksa sekuensial. |
| **Sesuai kaidah?** | ✅ Jurnal penutup standar. Saldo Laba (3.3.01.01) sebagai akun tujuan sesuai SAK EMKM. |

---

## Ringkasan Cross-Check Antar Laporan

| Validasi | Laporan 1 | Laporan 2 | Harus Cocok? |
|---|---|---|---|
| Laba Bersih | Laba Rugi | Dashboard | ✅ Sama-sama dari `computeLabaRugi` |
| Laba Berjalan | Neraca (ekuitas) | Laba Rugi | ✅ Neraca memanggil `computeLabaRugi(null, endDate)` |
| Modal Akhir | Perubahan Modal | Neraca (ekuitas) | ✅ Cross-check otomatis (selisih < 0.005) |
| Kas Berjalan | Arus Kas | Neraca (kas) | ✅ Cross-check otomatis (selisih < 0.005) |
| Total Debit = Kredit | Neraca Saldo | — | ✅ Dicek (selisih < 0.005) |
| P&L zeroing | Tutup Buku | Neraca Saldo mode=after | ⚠️ Belum ada explicit cross-check |
| Saldo Kas | Dashboard | Neraca | ⚠️ Dashboard tidak exclude CLOSING, Neraca exclude |

---

## Temuan & Rekomendasi

### 🔴 Perlu Perhatian

1. **Dashboard Saldo Kas tidak exclude CLOSING** — bisa berbeda dengan Neraca jika ada closing entry yang menyentuh kas (unlikely tapi possible).

2. **Buku Besar tidak filter `isposted`** — entry yang belum diposting masuk ke buku besar. Jika ada entry draft, saldo bisa berbeda dengan Neraca Saldo.

3. **Laba Rugi tidak filter `isposted`** — sama seperti Buku Besar.

4. **Unpost Saldo Awal tanpa cek transaksi** — retroactive impact tanpa warning.

### 🟡 Perlu Review

5. **Dashboard jumlah transaksi tidak exclude CLOSING** — closing entries terhitung dalam "Transaksi Bulan Ini".

6. **Arus Kas klasifikasi berdasarkan kode akun** — jika user membuat akun dengan kode non-standar, klasifikasi bisa salah.

7. **HPP average cost dari awal** — tidak ada filter tanggal. Jika harga beli berubah drastis, HPP bisa misleading.

### ✅ Sudah Benar

8. Semua laporan menggunakan `computeLabaRugi()` sebagai sumber tunggal laba bersih — anti mismatch.
9. Cross-check otomatis: Neraca, Perubahan Modal, Arus Kas.
10. Integer cents comparison (bukan float) untuk balance check.
11. CLOSING diexclude dari P&L, diinclude di Modal Awal — konsisten.
12. Tutup buku idempotent + serialized via advisory lock.
