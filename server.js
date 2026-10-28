const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Mengatur batas ukuran data maksimal 50MB (Untuk mencegah error 413 Payload Too Large)
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Mendapatkan tanggal hari ini zona WIB (GMT+7)
function getTodayWIB() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));
    return `${wib.getFullYear()}-${String(wib.getMonth() + 1).padStart(2, '0')}-${String(wib.getDate()).padStart(2, '0')}`;
}

// Fungsi membersihkan base64 dan foto lama agar server tidak penuh (Auto Reset Jam 00:00 WIB)
function sanitizeBackendData(data) {
    if (!data) return data;
    const todayYMD = getTodayWIB();

    if (Array.isArray(data.riwayat)) {
        data.riwayat = data.riwayat.map(log => {
            const isToday = log.tanggal && log.tanggal.startsWith(todayYMD);
            const isBase64 = log.foto && log.foto.startsWith('data:image');
            return {
                ...log,
                // Hanya simpan link Drive jika absen di hari yang sama. Jika base64 atau beda hari, kosongkan.
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
app.get(['/api/data', '/data', '/kos_piket_data'], (req, res) => {
    if (!fs.existsSync(DATA_FILE)) {
        return res.json({});
    }
    try {
        const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const cleanData = sanitizeBackendData(raw);
        res.json(cleanData);
    } catch (e) {
        res.json({});
    }
});

// Endpoint POST untuk menerima dan menyimpan perubahan data dari Web HTML
app.post(['/api/data', '/data', '/kos_piket_data'], (req, res) => {
    try {
        const cleanData = sanitizeBackendData(req.body);
        fs.writeFileSync(DATA_FILE, JSON.stringify(cleanData, null, 2), 'utf8');
        res.json({ status: 'success' });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`Server Dinar Boys berjalan di port ${PORT}`);
});
