# ADR-005: Persistent Volume Claim (`local-path` RWO) & Storage-Node Pinning

- **Status:** Accepted
- **Tanggal:** 2026-11-10
- **Penanggung Jawab:** Anggota 2 (Platform & Kubernetes)

## Context
Endpoint `POST /api/manuscripts/upload` menyimpan dokumen `.docx` di `/app/uploads`, sementara Deployment menjalankan 2–3 replika pod untuk ketersediaan tinggi dan *rolling update* (`maxUnavailable: 0`). File yang diunggah oleh Pod A harus tetap terbaca oleh Pod B atau pod pengganti jika salah satu pod mati.

## Decision
Menggunakan Kubernetes `PersistentVolumeClaim` (`journalfit-uploads`, `1Gi`, `storageClassName: local-path`, `accessModes: ReadWriteOnce`) dipadukan dengan **`nodeSelector: { journalfit-storage: uploads }`** dan anotasi Argo CD `Prune=false,Delete=false` pada `deployment/pvc.yaml`.

## Alternatives Considered
1. **Object Storage S3-compatible (MinIO / Garage)** sejak v1.
2. **Ephemeral `emptyDir`** di tiap pod (hilang saat pod dihapus).

## Consequences / Trade-Offs
- **Positif:**
  - Terbukti melalui checksum SHA-256 (`pod-replacement-persistence.txt`) bahwa ketika satu pod dihapus (`kubectl delete pod`), pod pengganti membaca file `.docx` yang sama persis tanpa korupsi data.
  - Lebih ringan di laptop dibanding menambah container MinIO/Garage.
- **Negatif / Batasan (Residual Risk):**
  - Karena `ReadWriteOnce` di `local-path` terikat ke satu node (`k3d-capstone-agent-0`), semua replika dipaksa berjalan pada node tersebut (*single-node SPOF*). Pada migrasi cloud produksi (multi-node/multi-AZ), wajib beralih ke S3/MinIO atau CSI `ReadWriteMany` (NFS/CephFS).
