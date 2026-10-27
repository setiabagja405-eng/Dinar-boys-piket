const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' })); // Batas limit diperbesar untuk base64 foto bukti piket

// Melayani file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Koneksi ke MongoDB (Mendukung environment variable MONGO_URI dari Render)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/piket_kos_db';

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Berhasil terhubung ke MongoDB!'))
.catch(err => console.error('Koneksi MongoDB gagal:', err));

// Skema Data Utama (Singleton Document untuk seluruh state aplikasi)
const kosSchema = new mongoose.Schema({
    singletonKey: { type: String, unique: true, default: 'main_config' },
    penghuni: Array,
    jadwal: Object,
    tugas: Array,
    tugasTambahan: Array,
    riwayat: Array,
    arsipRiwayat: Array,
    kas: {
        nominal: Number,
        pembayaran: Object,
        pemasukanLogs: Array,
        pengeluaranLogs: Array,
        penyesuaianSaldo: Number,
        pendingApprovals: Array,
        lastAutoResetWeek: String
    },
    announcement: Object,
    leaderboardTitle: String,
    taskCatatan: Object
});

const KosData = mongoose.model('KosData', kosSchema);

// Data Default Inisialisasi
const DEFAULT_PENGHUNI = [
    { id: 'p1', nama: 'Budi Santoso', kamar: 'Kamar 01', pin: '123456', motivasi: 'Selalu jaga kebersihan kosan kita!' },
    { id: 'p2', nama: 'Andi Pratama', kamar: 'Kamar 02', pin: '123456', motivasi: 'Kosan bersih hati pun senang.' },
    { id: 'p3', nama: 'Rizky Febian', kamar: 'Kamar 03', pin: '123456', motivasi: 'Semangat piket hari ini boy!' },
    { id: 'p4', nama: 'Dimas Anggara', kamar: 'Kamar 04', pin: '123456', motivasi: 'Disiplin nomor satu.' },
    { id: 'p5', nama: 'Eko Prasetyo', kamar: 'Kamar 05', pin: '123456', motivasi: 'Bersih itu sebagian dari iman.' },
];

const DEFAULT_JADWAL = {
    'Senin': [{ penghuniId: 'p1', area: 'Area Dapur & Wastafel' }, { penghuniId: 'p2', area: 'Sampah & Koridor Utama' }],
    'Selasa': [{ penghuniId: 'p2', area: 'Area Ruang Tamu & TV' }, { penghuniId: 'p3', area: 'Area Kamar Mandi & Kloset' }],
    'Rabu': [{ penghuniId: 'p3', area: 'Area Halaman & Teras' }, { penghuniId: 'p4', area: 'Area Dapur & Wastafel' }],
    'Kamis': [{ penghuniId: 'p4', area: 'Area Kamar Mandi & Kloset' }, { penghuniId: 'p5', area: 'Sampah & Koridor Utama' }],
    'Jumat': [{ penghuniId: 'p5', area: 'Area Ruang Tamu & TV' }, { penghuniId: 'p1', area: 'Area Halaman & Teras' }],
    'Sabtu': [{ penghuniId: 'p1', area: 'Area Dapur & Wastafel' }, { penghuniId: 'p3', area: 'Area Kamar Mandi & Kloset' }],
    'Minggu': [{ penghuniId: 'p2', area: 'Area Halaman & Teras' }, { penghuniId: 'p4', area: 'Sampah & Koridor Utama' }]
};

const DEFAULT_AREAS = [
    'Area Dapur & Wastafel',
    'Area Ruang Tamu & TV',
    'Area Kamar Mandi & Kloset',
    'Area Halaman & Teras',
    'Sampah & Koridor Utama'
];

// Endpoint API: Ambil Data
app.get('/api/data', async (req, res) => {
    try {
        let data = await KosData.findOne({ singletonKey: 'main_config' });
        if (!data) {
            data = new KosData({
                singletonKey: 'main_config',
                penghuni: DEFAULT_PENGHUNI,
                jadwal: DEFAULT_JADWAL,
                tugas: DEFAULT_AREAS,
                tugasTambahan: [],
                riwayat: [],
                arsipRiwayat: [],
                kas: { nominal: 10000, pembayaran: {}, pemasukanLogs: [], pengeluaranLogs: [], penyesuaianSaldo: 0, pendingApprovals: [], lastAutoResetWeek: '' },
                announcement: { active: true, type: "Peringatan Admin", title: "Siapa Piket Hari Ini?", subtitle: "Tong hilap foto nya!.", text: "Diharapkan bagi yang bertugas piket hari ini untuk selalu menjaga kebersihan area!", image: "", backgroundImage: "" },
                leaderboardTitle: "Leaderboard Paling Rajin",
                taskCatatan: {}
            });
            await data.save();
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint API: Simpan / Update Data
app.post('/api/data', async (req, res) => {
    try {
        const updateData = req.body;
        let data = await KosData.findOneAndUpdate(
            { singletonKey: 'main_config' },
            { $set: updateData },
            { new: true, upsert: true }
        );
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fallback untuk route frontend single-page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));