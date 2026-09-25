import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = "uploads/foods";

    // Kiểm tra route để quyết định thư mục
    if (req.originalUrl.includes("/restaurant")) {
      uploadPath = "uploads/restaurants";
    } else if (req.originalUrl.includes("/food")) {
      uploadPath = "uploads/foods";
    } else if (req.originalUrl.includes("/user")) {
      uploadPath = "uploads/avatars";
    }

    // Tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log("Created upload directory:", uploadPath);
    }

    console.log("Upload destination:", uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Tạo tên file unique: timestamp + extension
    const filename = Date.now() + path.extname(file.originalname);
    console.log("Generated filename:", filename);
    cb(null, filename);
  },
});

// File filter để chỉ chấp nhận ảnh
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export { uploadMiddleware };
