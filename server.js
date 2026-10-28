require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

const client = new MongoClient(MONGODB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let piketCollection = null;

// Fungsi memastikan koneksi database selalu siap sebelum baca/tulis data
async function getCollection() {
    if (piketCollection) return piketCollection;
    if (!MONGODB_URI) {
        throw new Error("MONGODB_URI belum diisi di Environment Variables Render!");
    }
    await client.connect();
    const db = client.db('dinar_boys_db');
    piketCollection = db.collection('data_kamar');
    console.log("✅ Berhasil terhubung ke MongoDB Database: dinar_boys_db");
    return piketCollection;
}

// Jalankan koneksi awal saat server menyala
getCollection().catch(err => console.error("❌ Gagal koneksi awal MongoDB:", err.message));

// Mendapatkan tanggal hari ini zona WIB (GMT+7)
function getTodayWIB() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));
    return `${wib.getFullYear()}-${String(wib.getMonth() + 1).padStart(2, '0')}-${String(wib.getDate()).padStart(2, '0')}`;
}

// Simpan foto di web selama hari yang sama (24 jam) & hapus saat ganti hari (00:00 WIB)
function sanitizeBackendData(data) {
    if (!data) return data;
    const todayYMD = getTodayWIB();

    if (Array.isArray(data.riwayat)) {
        data.riwayat = data.riwayat.map(log => {
            const isToday = log.tanggal && log.tanggal.startsWith(todayYMD);
            return {
                ...log,
                foto: isToday ? (log.foto || '') : ''
            };
        });
    }

    if (Array.isArray(data.tugasTambahan)) {
        data.tugasTambahan = data.tugasTambahan.map(t => {
            const isToday = t.tanggalSelesai === todayYMD;
            return {
                ...t,
                foto: isToday ? (t.foto || '') : ''
            };
        });
    }
    
    return data;
}

// Endpoint GET untuk mengambil data ke Web HTML
app.get(['/api/data', '/data', '/kos_piket_data'], async (req, res) => {
    try {
        const col = await getCollection();
        const doc = await col.findOne({ _id: "master_data" });
        
        if (!doc || !doc.payload) {
            return res.json({ empty: true });
        }
        
        const cleanData = sanitizeBackendData(doc.payload);
        res.json(cleanData);
    } catch (e) {
        console.error("Error GET data:", e.message);
        // PENTING: Kirim status 500 jika DB gagal konek agar frontend TIDAK me-reset data!
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// Endpoint POST untuk menerima dan menyimpan perubahan data dari Web HTML
app.post(['/api/data', '/data', '/kos_piket_data'], async (req, res) => {
    try {
        const col = await getCollection();
        const cleanData = sanitizeBackendData(req.body);
        
        await col.updateOne(
            { _id: "master_data" },
            { $set: { payload: cleanData, updatedAt: new Date() } },
            { upsert: true }
        );
        
        res.json({ status: 'success' });
    } catch (e) {
        console.error("Error POST data:", e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server Dinar Boys berjalan di port ${PORT}`);
});
