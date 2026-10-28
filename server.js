require('dotenv').config(); // Untuk membaca .env saat test lokal
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI; // Mengambil URI dari Environment Variable Render

// Mengatur batas ukuran data maksimal 50MB (Untuk mencegah error 413 Payload Too Large)
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Setup koneksi MongoDB
const client = new MongoClient(MONGODB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let piketCollection;

async function connectDB() {
    try {
        await client.connect();
        // Menggunakan database bawaan dari URI atau membuat DB bernama 'dinarboyspiket'
        const db = client.db('dinarboyspiket'); 
        piketCollection = db.collection('data_kamar');
        console.log("✅ Berhasil terhubung ke MongoDB Database!");
    } catch (err) {
        console.error("❌ Gagal terhubung ke MongoDB:", err);
    }
}
connectDB();

// Mendapatkan tanggal hari ini zona WIB (GMT+7)
function getTodayWIB() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));
    return `${wib.getFullYear()}-${String(wib.getMonth() + 1).padStart(2, '0')}-${String(wib.getDate()).padStart(2, '0')}`;
}

// Fungsi membersihkan base64 agar server tidak penuh (Auto Reset Jam 00:00 WIB)
function sanitizeBackendData(data) {
    if (!data) return data;
    const todayYMD = getTodayWIB();

    if (Array.isArray(data.riwayat)) {
        data.riwayat = data.riwayat.map(log => {
            const isToday = log.tanggal && log.tanggal.startsWith(todayYMD);
            const isBase64 = log.foto && log.foto.startsWith('data:image');
            return {
                ...log,
                // Hanya simpan link Drive (bukan base64) jika absen di hari yang sama
                foto: (isToday && !isBase64) ? (log.foto || '') : ''
            };
        });
    }

    if (Array.isArray(data.tugasTambahan)) {
        data.tugasTambahan = data.tugasTambahan.map(t => {
            const isToday = t.tanggalSelesai === todayYMD;
            const isBase64 = t.foto && t.foto.startsWith('data:image');
            return {
                ...t,
                foto: (isToday && !isBase64) ? (t.foto || '') : ''
            };
        });
    }
    
    return data;
}

// Endpoint GET untuk mengambil data ke Web HTML
app.get(['/api/data', '/data', '/kos_piket_data'], async (req, res) => {
    try {
        // Mengambil dokumen tunggal dengan ID "master_data"
        const doc = await piketCollection.findOne({ _id: "master_data" });
        if (!doc || !doc.payload) {
            return res.json({});
        }
        
        const cleanData = sanitizeBackendData(doc.payload);
        res.json(cleanData);
    } catch (e) {
        console.error("Error GET data:", e);
        res.json({});
    }
});

// Endpoint POST untuk menerima dan menyimpan perubahan data dari Web HTML
app.post(['/api/data', '/data', '/kos_piket_data'], async (req, res) => {
    try {
        const cleanData = sanitizeBackendData(req.body);
        
        // Simpan atau update dokumen dengan ID "master_data" di MongoDB (Upsert)
        await piketCollection.updateOne(
            { _id: "master_data" },
            { $set: { payload: cleanData, updatedAt: new Date() } },
            { upsert: true }
        );
        
        res.json({ status: 'success' });
    } catch (e) {
        console.error("Error POST data:", e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`🚀 Server Dinar Boys berjalan di port ${PORT}`);
});
