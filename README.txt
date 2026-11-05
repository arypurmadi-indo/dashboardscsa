SCSA MONITORING DASHBOARD - SOFT DELETE UPLOAD

File pengganti:
1. src/worker.mjs
2. public/assets/app.js

Tidak ada migration SQL yang diperlukan. Fitur menggunakan kolom status yang sudah ada pada tabel import_batches.

CARA MEMASANG
1. Buat backup/download file src/worker.mjs dan public/assets/app.js yang sekarang ada di repository.
2. Ganti src/worker.mjs dengan file src/worker.mjs dari paket ini.
3. Ganti public/assets/app.js dengan file public/assets/app.js dari paket ini.
4. Jangan mengubah wrangler.toml, database binding DB, D1 database ID, migration lama, atau file konfigurasi lainnya.
5. Commit dan push ke branch main.
6. Tunggu Cloudflare Pages Production berstatus Success.
7. Login sebagai Manager, buka menu Riwayat upload.

CARA KERJA
- Batalkan: mengubah import_batches.status menjadi 'deleted'. Data peserta dan progress tetap disimpan.
- Pulihkan: mengubah status kembali menjadi 'success'.
- Semua ringkasan Manager dan dashboard publik hanya menghitung batch yang status-nya bukan 'deleted'.
- Jika batch lama dipulihkan sementara ada batch lebih baru yang masih aktif untuk course yang sama, dashboard tetap menggunakan batch aktif terbaru.
- Aksi dicatat di sync_logs dengan source 'csv-import-history'.

PENTING
- Fitur ini adalah soft delete, bukan penghapusan permanen.
- Jangan jalankan query DELETE pada imported_participants, imported_progress, atau import_batches untuk menggunakan fitur ini.
- Endpoint aksi hanya tersedia bagi sesi Manager yang valid.
