// Mengimpor modul yang diperlukan
const express = require("express"); // Framework web untuk Node.js
const multer = require("multer"); // Middleware untuk menangani unggahan file
const { spawn } = require("child_process"); // Modul untuk menjalankan proses anak
const cors = require("cors"); // Middleware untuk mengizinkan permintaan dari domain lain
const path = require("path"); // Modul untuk bekerja dengan jalur file dan direktori
const fs = require("fs"); // Modul untuk operasi file sistem

// Membuat aplikasi Express
const app = express();

// Mengkonfigurasi Multer untuk menangani unggahan file
const upload = multer({
  storage: multer.diskStorage({
    // Menentukan direktori penyimpanan file yang diunggah
    destination: (req, file, cb) => {
      cb(null, "uploads/"); // Menyimpan file yang diunggah di direktori 'uploads'
    },
    // Menentukan nama file yang diunggah
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname); // Mendapatkan ekstensi file
      const filename = Date.now() + ext; // Membuat nama file unik dengan timestamp
      cb(null, filename); // Menetapkan nama file
    },
  }),
});

// Middleware untuk mengizinkan permintaan dari domain lain
app.use(cors());

// Middleware untuk parsing JSON
app.use(express.json());

// Middleware untuk menyajikan file statis dari direktori 'uploads'
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Rute untuk menangani unggahan dan pemrosesan gambar
app.post("/measure", upload.array("images"), (req, res) => {
  // Jika tidak ada file yang diunggah, kirimkan respons kesalahan
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Tidak ada gambar yang diunggah" }); // Respons kesalahan jika tidak ada gambar yang diunggah
  }

  const results = []; // Array untuk menyimpan hasil pemrosesan gambar

  // Fungsi untuk memproses setiap file yang diunggah
  const processFile = (file, callback) => {
    const ext = path.extname(file.originalname); // Mendapatkan ekstensi file
    const imagePath = path.join(__dirname, file.path); // Menyusun path lengkap file yang diunggah
    const outputImageFilename = file.filename.replace(ext, "_output" + ext); // Membuat nama file output dengan "_output" di tengahnya
    const outputImagePath = path.join(__dirname, "uploads", outputImageFilename); // Menyusun path lengkap file output

    // Menjalankan skrip Python untuk memproses gambar
    const pythonProcess = spawn("python", ["../modeling/main.py", imagePath]); // Menjalankan skrip Python dengan path file gambar sebagai argumen

    let stdout = ""; // Variabel untuk menyimpan output stdout dari skrip Python
    let stderr = ""; // Variabel untuk menyimpan output stderr dari skrip Python

    // Mengumpulkan data dari stdout
    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString(); // Menambahkan data stdout ke variabel stdout
    });

    // Mengumpulkan data dari stderr
    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString(); // Menambahkan data stderr ke variabel stderr
    });

    // Menangani akhir proses Python
    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error("Script Python keluar dengan kode", code); // Menampilkan pesan kesalahan jika kode keluar bukan 0
        callback({ error: "Gagal memproses gambar" }); // Memanggil callback dengan kesalahan
        return;
      }

      if (stderr) {
        console.error("Script Python stderr:", stderr); // Menampilkan pesan kesalahan dari stderr
      }

      console.log("Script Python stdout:", stdout); // Menampilkan output dari stdout

      // Memeriksa apakah gambar output ada
      if (fs.existsSync(outputImagePath)) {
        const [boundingBoxAreaCm2, widthCm, heightCm] = stdout.split(",").map(Number); // Memisahkan output stdout dan mengkonversi menjadi angka

        if (isNaN(boundingBoxAreaCm2) || isNaN(widthCm) || isNaN(heightCm)) {
          console.error("Hasil tidak valid dari script Python:", stdout); // Menampilkan pesan kesalahan jika hasil tidak valid
          callback({ error: "Hasil tidak valid dari script Python" }); // Memanggil callback dengan kesalahan
          return;
        }

        const outputImageUrl = `http://localhost:5000/uploads/${outputImageFilename}`; // Menyusun URL untuk file output
        results.push({
          luas: boundingBoxAreaCm2, // Menyimpan luas bounding box dalam cm²
          lebar: widthCm, // Menyimpan lebar dalam cm
          tinggi: heightCm, // Menyimpan tinggi dalam cm
          url: outputImageUrl, // Menyimpan URL gambar output
        });
        callback(); // Memanggil callback tanpa kesalahan
      } else {
        console.error("Gambar output tidak ditemukan:", outputImagePath); // Menampilkan pesan kesalahan jika gambar output tidak ditemukan
        callback({ error: "Gambar output tidak ditemukan" }); // Memanggil callback dengan kesalahan
      }
    });
  };

  let remainingFiles = req.files.length; // Menghitung jumlah file yang tersisa untuk diproses

  // Memproses setiap file yang diunggah
  req.files.forEach((file) => {
    processFile(file, (error) => {
      if (error) {
        return res.status(500).json({ error: error.error }); // Mengirimkan respons kesalahan jika terjadi masalah saat memproses file
      }

      remainingFiles--; // Mengurangi jumlah file yang tersisa
      if (remainingFiles === 0) {
        res.json({ data: results }); // Mengirimkan respons JSON dengan hasil pemrosesan gambar jika semua file telah diproses
      }
    });
  });
});

// Menentukan port untuk server berjalan
const PORT = 5000;

// Menjalankan server
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`)); // Menjalankan server dan menampilkan pesan bahwa server berjalan
