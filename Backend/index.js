const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const filename = Date.now() + ext;
      cb(null, filename);
    },
  }),
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Ubah upload.single menjadi upload.array untuk mendukung multiple file
app.post("/measure", upload.array("images"), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Tidak ada gambar yang diunggah" });
  }

  const results = [];
  const processFile = (file, callback) => {
    const ext = path.extname(file.originalname);
    const imagePath = path.join(__dirname, file.path);
    const outputImageFilename = file.filename.replace(ext, "_output" + ext);
    const outputImagePath = path.join(
      __dirname,
      "uploads",
      outputImageFilename
    );

    const pythonProcess = spawn("python", ["../modeling/main.py", imagePath]);

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error("Script Python keluar dengan kode", code);
        callback({ error: "Gagal memproses gambar" });
        return;
      }

      if (stderr) {
        console.error("Script Python stderr:", stderr);
      }

      console.log("Script Python stdout:", stdout);

      if (fs.existsSync(outputImagePath)) {
        const [boundingBoxAreaCm2, widthCm, heightCm] = stdout
          .split(",")
          .map(Number);

        if (isNaN(boundingBoxAreaCm2) || isNaN(widthCm) || isNaN(heightCm)) {
          console.error("Hasil tidak valid dari script Python:", stdout);
          callback({ error: "Hasil tidak valid dari script Python" });
          return;
        }

        const outputImageUrl = `https://api2.hkks.shop/uploads/${outputImageFilename}`;
        // const outputImageUrl = `http://localhost:5000/uploads/${outputImageFilename}`;
        results.push({
          luas: boundingBoxAreaCm2,
          lebar: widthCm,
          tinggi: heightCm,
          url: outputImageUrl,
        });
        callback();
      } else {
        console.error("Gambar output tidak ditemukan:", outputImagePath);
        callback({ error: "Gambar output tidak ditemukan" });
      }

    
    });
  };

  let remainingFiles = req.files.length;

  req.files.forEach((file) => {
    processFile(file, (error) => {
      if (error) {
        return res.status(500).json({ error: error.error });
      }

      remainingFiles--;
      if (remainingFiles === 0) {
        res.json({ data: results });
      }
    });
  });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));
