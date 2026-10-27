const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi koneksi MongoDB Atlas
const uri = "mongodb+srv://bagjasetia924_db_user:b20g0SCG0QjPGUsh@cluster0.4nhdipk.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

let db, kosCollection;

async function startServer() {
    try {
        await client.connect();
        db = client.db('dinar_boys_db');
        kosCollection = db.collection('piket_data');
        console.log("Berhasil terhubung ke MongoDB Atlas!");

        app.use(cors());
        app.use(express.json({ limit: '50mb' }));
        app.use(express.urlencoded({ limit: '50mb', extended: true }));
        
        // Menyajikan file statis dari folder root atau public
        app.use(express.static(path.join(__dirname)));

        // API Endpoint untuk mengambil seluruh data kosan
        app.get('/api/data', async (req, res) => {
            try {
                let data = await kosCollection.findOne({ _id: "main_config" });
                if (!data) {
                    // Data default jika belum ada di database
                    data = { 
                        _id: "main_config", 
                        penghuni: [], 
                        jadwal: {}, 
                        tugas: [], 
                        tugasTambahan: [], 
                        riwayat: [], 
                        arsipRiwayat: [], 
                        kas: {}, 
                        announcement: {}, 
                        leaderboardTitle: "", 
                        taskCatatan: {} 
                    };
                }
                res.json(data);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // API Endpoint untuk menyimpan / memperbarui data kos
        app.post('/api/data', async (req, res) => {
            try {
                const newData = req.body;
                newData._id = "main_config";
                await kosCollection.updateOne(
                    { _id: "main_config" },
                    { $set: newData },
                    { upsert: true }
                );
                res.json({ success: true, message: "Data berhasil disimpan ke MongoDB!" });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.listen(PORT, () => {
            console.log(`Server berjalan di http://localhost:${PORT}`);
        });

    } catch (e) {
        console.error("Gagal terhubung ke MongoDB Atlas:", e);
    }
}

startServer();
