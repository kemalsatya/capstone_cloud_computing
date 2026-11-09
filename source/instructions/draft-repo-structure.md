```
my-express-modular-monolith/
├── src/
│   ├── app.js                 # Entry point aplikasi Express
│   ├── config/                # Konfigurasi global (env, database connection)
│   ├── common/                # Shared utilities & global middlewares
│   │   ├── middlewares/       # Auth, error handler, logger global
│   │   └── utils/             # Helper universal (formatter, validator)
│   │
│   └── modules/               # 📦 TEMPAT MODUL DOMAIN UTAMA
│       ├── users/             # --- Modul Pengguna ---
│       │   ├── controllers/   # HTTP request handlers
│       │   ├── services/      # Business logic utama untuk domain user
│       │   ├── repositories/  # Query database spesifik user
│       │   ├── models/        # Skema database/entitas user
│       │   ├── index.js       # Public API / Router utama modul user
│       │   └── events.js      # Event handlers (jika ada komunikasi antar-modul)
│       │
│       ├── products/          # --- Modul Produk ---
│       │   ├── controllers/
│       │   ├── services/
│       │   ├── repositories/
│       │   ├── models/
│       │   └── index.js
│       │
│       └── orders/            # --- Modul Pesanan ---
│           ├── controllers/
│           ├── services/
│           └── index.js
│
├── tests/                     # Integration tests global
├── .env.example
├── package.json
└── README.md
```