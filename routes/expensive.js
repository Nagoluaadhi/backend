import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db.js';

const router = express.Router();

// Image storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/expenses';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

/**
 * POST /add
 * Upload image + expense details
 */
router.post('/add', upload.single('image'), async (req, res) => {
  const {
    engineer_id,
    from,
    to,
    transport,
    accommodation,
    food,
    days,
    paid,
    remarks
  } = req.body;

  const image_path = req.file ? `/uploads/expenses/${req.file.filename}` : null;

  // Sanitize values
  const t = parseFloat(transport) || 0;
  const a = parseFloat(accommodation) || 0;
  const f = parseFloat(food) || 0;
  const d = parseInt(days) || 0;
  const total_cost = t + a * d + f * d;

  try {
    const sql = `
      INSERT INTO expenses 
      (engineer_id, \`from\`, \`to\`, transport, accommodation, food, days, total_cost, paid, remarks, image_path, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      engineer_id, from, to, t, a, f, d,
      total_cost, paid, remarks,
      image_path, image_path
    ];
    await db.execute(sql, values);

    res.json({ message: '✅ Expense saved' });
  } catch (err) {
    console.error('❌ DB Insert Error:', err);
    res.status(500).json({ error: 'Insert failed' });
  }
});

/**
 * GET /engineer/:id
 */
router.get('/engineer/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM expenses WHERE engineer_id = ? ORDER BY id DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('❌ Fetch Error:', err);
    res.status(500).json({ error: 'Fetch failed' });
  }
});
router.delete('/delete/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;

    // Get image path first
    const [rows] = await db.execute('SELECT image_path FROM expenses WHERE id = ?', [expenseId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const imagePath = rows[0].image_path;
    if (imagePath) {
      const fullPath = path.join(process.cwd(), imagePath);
      fs.unlink(fullPath, (err) => {
        if (err) console.warn('⚠️ Could not delete image:', err.message);
      });
    }

    await db.execute('DELETE FROM expenses WHERE id = ?', [expenseId]);
    res.json({ message: '✅ Expense deleted' });
  } catch (err) {
    console.error('❌ Delete Error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});
export default router;
