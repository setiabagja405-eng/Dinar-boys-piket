const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Izinkan ukuran payload hingga 50MB agar foto 24 jam bisa tampil langsung di web semua akun
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

// --- KONEKSI MONGODB ATLAS (SESUAI ENVIRONMENT VARIABLE RENDER) ---
let isMongoConnected = false;
const KosDataSchema = new mongoose.Schema({
    key: { type: String, default: 'main_data', unique: true },
    payload: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

const KosDataModel = mongoose.models.KosData || mongoose.model('KosData', KosDataSchema);

if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            isMongoConnected = true;
            console.log('✅ Terhubung ke MongoDB Atlas');
        })
        .catch(err => {
            console.warn('⚠️ Gagal konek MongoDB, menggunakan penyimpanan file lokal:', err.message);
        });
}

// Fungsi mendapatkan Tanggal Hari Ini dalam Zona Waktu WIB (GMT+7)
function getTodayWIB() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));
    return `${wib.getFullYear()}-${String(wib.getMonth() + 1).padStart(2, '0')}-${String(wib.getDate()).padStart(2, '0')}`;
}

// Fungsi Otomatis Hapus Foto di Backend jika sudah lewat pukul 00:00 WIB / 24 Jam
function cleanExpiredPhotosFromBackend(data) {
    if (!data || typeof data !== 'object') return data;
    const todayYMD = getTodayWIB();
    const nowMs = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    // 1. Bersihkan foto di riwayat absen yang sudah lewat hari (00:00 WIB) atau lewat 24 jam
    if (Array.isArray(data.riwayat)) {
        data.riwayat = data.riwayat.map(log => {
            const isToday = log.tanggal && log.tanggal.startsWith(todayYMD);
            const isWithin24Hours = log.timestamp ? ((nowMs - Number(log.timestamp)) < TWENTY_FOUR_HOURS) : isToday;
            return {
                ...log,
                // Pertahankan foto di web selama hari ini / < 24 jam, hapus otomatis setelahnya
                foto: (isToday && isWithin24Hours) ? (log.foto || '') : ''
            };
        });
    }

    // 2. Bersihkan foto di tugas tambahan yang sudah lewat hari (00:00 WIB) atau lewat 24 jam
    if (Array.isArray(data.tugasTambahan)) {
        data.tugasTambahan = data.tugasTambahan.map(tugas => {
            const isToday = tugas.tanggalSelesai === todayYMD;
            const isWithin24Hours = tugas.timestamp ? ((nowMs - Number(tugas.timestamp)) < TWENTY_FOUR_HOURS) : isToday;
            return {
                ...tugas,
                foto: (isToday && isWithin24Hours) ? (tugas.foto || '') : ''
            };
        });
    }

    // 3. Pastikan di dalam arsip mingguan tidak menyimpan file foto berat
    if (Array.isArray(data.arsipRiwayat)) {
        data.arsipRiwayat = data.arsipRiwayat.map(arsip => ({
            ...arsip,
            logs: Array.isArray(arsip.logs) ? arsip.logs.map(l => ({ ...l, foto: '' })) : []
        }));
    }

    return data;
}

// Fungsi Baca Data dari Database / File
async function readBackendData() {
    if (isMongoConnected) {
        const doc = await KosDataModel.findOne({ key: 'main_data' }).lean();
        if (doc && doc.payload) {
            return cleanExpiredPhotosFromBackend(doc.payload);
        }
    }
    if (fs.existsSync(DATA_FILE)) {
        try {
            const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            return cleanExpiredPhotosFromBackend(raw);
        } catch (e) {
            return {};
        }
    }
    return {};
}

// Fungsi Simpan Data ke Database / File
async function writeBackendData(newData) {
    const cleanedData = cleanExpiredPhotosFromBackend(newData);
    if (isMongoConnected) {
        await KosDataModel.findOneAndUpdate(
            { key: 'main_data' },
            { key: 'main_data', payload: cleanedData },
            { upsert: true, new: true }
        );
    }
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(cleanedData, null, 2), 'utf8');
    } catch (e) {}
    return cleanedData;
}

// Endpoint GET Data
app.get(['/api/data', '/data', '/kos_piket_data'], async (req, res) => {
    try {
        const data = await readBackendData();
        res.json(data);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Endpoint POST Simpan Data
app.post(['/api/data', '/data', '/kos_piket_data'], async (req, res) => {
    try {
        const saved = await writeBackendData(req.body);
        res.json({ status: 'success', data: saved });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Pengecekan berkala setiap 5 menit di server untuk menghapus foto yang sudah lewat jam 00:00 WIB / 24 jam
setInterval(async () => {
    try {
        const currentData = await readBackendData();
        if (currentData && Object.keys(currentData).length > 0) {
            await writeBackendData(currentData);
        }
    } catch (e) {}
}, 5 * 60 * 1000);

// Route utama menampilkan index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server Piket Kos Dinar Boys berjalan di port ${PORT}`);
});
