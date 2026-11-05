# SCSA Monitoring Dashboard — CSV Edition

Dashboard mandiri untuk Manager SCSA. Data Moodle dimasukkan melalui dua file CSV per course; aplikasi tidak memerlukan token Moodle, Web Services, maupun hak Superadmin.

## 13 master course
1. Intuisi Bilangan
2. Koneksi
3. Nilai Tempat dan Makna Bilangan
4. Pecahan
5. Pedagogi Pembelajaran Matematika
6. Pembelajaran Matematika Bermakna
7. Pemecahan Masalah
8. Penalaran dan Pembuktian
9. Pengenalan Elemen Proses Matematika
10. Penjumlahan dan Pengurangan
11. Perkalian dan Pembagian
12. Pola sebagai Dasar Penalaran Matematis
13. Representasi Matematis

## Format CSV
- Profil peserta: `First name`, `Last name`, `Email address`, `Groups`.
- Progress: `Email address` serta kolom status aktivitas. Kolom waktu penyelesaian yang berada tepat setelah kolom status akan ikut dibaca.
- Email dipakai untuk mencocokkan peserta pada kedua file.
- Group kosong akan ditampilkan sebagai **Belum Terpetakan**.
- Status yang diawali `Completed` dihitung sebagai aktivitas selesai. Status kelulusan dapat dilihat lebih rinci pada data aktivitas yang disimpan.

## Deployment Cloudflare Pages + D1
1. Unggah isi folder proyek ini ke repository GitHub.
2. Buat D1 database bernama `scsa-monitoring-db`.
3. Masukkan `database_id` yang sebenarnya ke `wrangler.toml`.
4. Terapkan migrasi `0001_init.sql` lalu `0002_csv_import.sql` pada D1.
5. Hubungkan repository ke Cloudflare Pages, Framework preset `None`, build command kosong, output directory `public`.
6. Pada Pages Settings → Bindings, tambahkan D1 binding dengan variable name `DB` dan pilih database `scsa-monitoring-db`.
7. Tambahkan secret `BOOTSTRAP_SECRET` untuk pembuatan akun Manager awal.
8. Deploy ulang.

## Membuat akun Manager Dashboard
POST `/api/manager/bootstrap` dengan header `X-Bootstrap-Secret: <BOOTSTRAP_SECRET>` dan JSON body:
`{"name":"Manager SCSA","email":"manager@example.com","username":"manager-scsa","password":"PASSWORD-KUAT-MINIMAL-12-KARAKTER"}`

Setelah akun berhasil dibuat, hapus atau rotasi `BOOTSTRAP_SECRET`.

## Penggunaan
1. Login ke dashboard.
2. Buka menu Upload CSV.
3. Pilih salah satu dari 13 course.
4. Unggah CSV profil dan CSV progress dari course yang sama.
5. Dashboard memvalidasi kolom, mencocokkan email, dan menyimpan hasil impor.
6. Upload berikutnya untuk course yang sama menjadi data terbaru; batch terdahulu tetap tersimpan sebagai riwayat.

## Catatan data dan privasi
- Maksimum file profil 8 MB dan progress 12 MB.
- Data email/nama peserta merupakan data pribadi. Batasi akses dashboard dan D1 hanya untuk pengelola yang berwenang.
- Saat ini dashboard menyimpan snapshot peserta dan aktivitas per upload. Data lama tidak dihapus otomatis.
- Backup D1 dan kebijakan retensi perlu ditetapkan sebelum penggunaan institusional.
- Lakukan uji upload pada satu course terlebih dahulu sebelum memasukkan 13 course.
