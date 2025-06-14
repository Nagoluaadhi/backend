import express from 'express';
const router = express.Router();
import db from '../db.js';

router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT s.*, c.client_name
      FROM services s
      JOIN clients c ON s.client_id = c.id
    `;
    const params = [];

    if (req.query.role === 'branch_office' && req.query.username) {
      query += `
        WHERE s.client_id IN (
          SELECT client_id FROM stock_transactions
          WHERE user_id = (SELECT id FROM users WHERE username = ?)
        )
      `;
      params.push(req.query.username);
    }

    query += ' ORDER BY s.id DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching services' });
  }
});



router.post('/', async (req, res) => {
  const { client_id, vehicle_no, service_remark, charges, status, warranty_status, date_time, barcodes } = req.body;

  if (!Array.isArray(barcodes) || barcodes.length === 0) {
    return res.status(400).json({ error: 'No barcodes provided' });
  }

  try {
    const insertQuery = `
      INSERT INTO services 
      (client_id, vehicle_no, service_remark, charges, status, barcode, warranty_status, date_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const barcode of barcodes) {
      await db.execute(insertQuery, [
        client_id,
        vehicle_no,
        service_remark,
        charges,
        status,
        barcode,
        warranty_status,
        date_time
      ]);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Service insert failed:', err);
    res.status(500).send(err);
  }
});


router.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM services WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err);
  }
});

export default router;
