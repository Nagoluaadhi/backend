import express from 'express';
const router = express.Router();
import db from '../db.js';

router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT st.*, inv.item_name, cl.client_name
      FROM stock_transactions st
      JOIN inventory inv ON st.inventory_id = inv.id
      JOIN clients cl ON st.client_id = cl.id
      WHERE st.type = 'in'
      ORDER BY st.id DESC
    `;
    const [rows] = await db.execute(query);

    console.log('✔ /api/stockin hit');
    console.log('✔ Rows returned:', rows);

    res.json(rows);
  } catch (err) {
    console.error('❌ SQL Error:', err.message);
    console.error('❌ Query Sent:', err.sql);
    res.status(500).json({ error: 'Fetch stock-in failed' });
  }
});
router.get('/:role/:userId', async (req, res) => {
  const { role, userId } = req.params;

  let query = `
    SELECT st.*, inv.item_name, cl.client_name
    FROM stock_transactions st
    JOIN inventory inv ON st.inventory_id = inv.id
    JOIN clients cl ON st.client_id = cl.id
    WHERE st.type = 'in'
  `;

  const params = [];
  if (role === 'user' || role === 'engineer') {
    query += ` AND st.user_id = ?`;
    params.push(userId);
  }

  query += ` ORDER BY st.id DESC`;

  try {
    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error('❌ SQL Error:', err.message);
    console.error('❌ Query Sent:', query);
    res.status(500).json({ error: 'Fetch stock-in failed' });
  }
});


router.post('/', async (req, res) => {
  const { user_id, date, inventory_id, client_id, barcode, invoice_no, qty, remark, role } = req.body;

if (!['admin', 'user', 'engineer'].includes(role)) {
    return res.status(403).json({ error: 'Unauthorized role for Stock In' });
  }
  console.log("📥 Inserting stockin:", {
    user_id, date, inventory_id, client_id, barcode, invoice_no, qty, remark
  });

  try {
  await db.execute(
  `INSERT INTO inventory_system.stock_transactions
  (type, user_id, date, inventory_id, client_id, barcode, invoice_no, qty, remark)
  VALUES ('in', ?, ?, ?, ?, ?, ?, ?, ?)`,
  [user_id, date, inventory_id, client_id, barcode, invoice_no, qty, remark]
).then(() => {
  console.log("✅ Insert success");
}).catch((err) => {
  console.log("❌ Insert failed SQL:", err.sql);
  console.log("❌ Full error object:", err);
});

    await db.execute(`UPDATE inventory SET qty = qty + ? WHERE id = ?`, [qty, inventory_id]);
    await db.execute(`UPDATE clients SET qty = qty + ? WHERE id = ?`, [qty, client_id]);

    res.json({ message: 'Stock In recorded and balances updated' });
  } catch (err) {
    console.error('❌ Stock In Failed:', err.message);
    res.status(500).json({ error: 'Stock In failed' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute(
      'DELETE FROM stock_transactions WHERE id = ? AND type = "in"',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Stock-in entry not found' });
    }
    res.json({ message: 'Stock-in entry deleted' });
  } catch (err) {
    console.error('❌ Delete Stock In Failed:', err.message);
    res.status(500).json({ error: 'Delete stock-in failed' });
  }
});

export default router;