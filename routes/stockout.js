import express from 'express';
const router = express.Router();
import db from '../db.js';

// GET stock out list
// GET stock out list filtered by role
router.get('/', async (req, res) => {
  try {
    const { userId, role } = req.query;
    let query = `
      SELECT s.*, i.item_name, c.client_name
      FROM stock_transactions s
      JOIN inventory i ON s.inventory_id = i.id
      JOIN clients c ON s.client_id = c.id
      WHERE s.type = 'out'
    `;
    const params = [];

    if (role === 'admin') {
      query += ' AND s.created_by_role = "admin"';
    } else if (role === 'engineer') {
      query += ' AND s.created_by_role = "engineer" AND s.user_id = ?';
      params.push(userId);
    } else if (role === 'user') {
      query += ' AND s.created_by_role = "user" AND s.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY s.id DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error fetching stockout:', err);
    res.status(500).json({ error: 'Error fetching stock out data' });
  }
});

// POST stock out (record stock out)
router.post('/', async (req, res) => {
  const { user_id, role, date, inventory_id, client_id, barcode, invoice_no, qty, remark } = req.body;

  console.log('📤 Outward request body:', req.body);

  // ✅ Server-side validation
  if (!user_id || !date || !inventory_id || !client_id || !barcode || !qty) {
    return res.status(400).json({
      error: 'Missing required fields. Ensure user_id, date, inventory_id, client_id, barcode, and qty are provided.'
    });
  }

  // Handle missing role safely (avoid undefined error)
  const safeRole = role || 'unknown';

  try {
    // Insert transaction
    await db.execute(`
      INSERT INTO stock_transactions
      (type, user_id, date, inventory_id, client_id, barcode, invoice_no, qty, remark, created_by_role)
      VALUES ('out', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [user_id, date, inventory_id, client_id, barcode, invoice_no || '', qty, remark || '', safeRole]);

    // Update inventory balance
    await db.execute(`UPDATE inventory SET qty = qty - ? WHERE id = ?`, [qty, inventory_id]);

    // Track user usage
    await db.execute(`
      INSERT INTO user_usage (user_id, client_id, inventory_id, qty)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)
    `, [user_id, client_id, inventory_id, qty]);

    res.json({ message: 'Stock Out recorded and balances updated' });
  } catch (err) {
    console.error('❌ Stock Out Error:', err);
    res.status(500).json({ error: 'Stock Out failed on the server. Check server logs for details.' });
  }
});

// DELETE stock out
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('DELETE FROM stock_transactions WHERE id = ? AND type = "out"', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;
