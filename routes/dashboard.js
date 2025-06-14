import express from 'express';
const router = express.Router();
import db from '../db.js';

router.get('/inventory/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT SUM(qty) AS qty 
       FROM stock_transactions 
       WHERE inventory_id = ? AND type = 'in'`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Inventory lookup failed' });
  }
});
// 🟢 Branch Office Dashboard
router.get('/branch-dashboard/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const [rows] = await db.execute(`
      SELECT 
        c.client_name, 
        i.item_name, 
        st.qty, 
        st.date 
      FROM stock_transactions st
      JOIN clients c ON st.client_id = c.id
      JOIN inventory i ON st.inventory_id = i.id
      WHERE st.type = 'out' AND c.branch_user_id = ?
      ORDER BY st.date DESC
    `, [userId]);

    res.json(rows);
  } catch (err) {
    console.error('Branch dashboard error:', err);
    res.status(500).json({ error: 'Error fetching branch dashboard' });
  }
});

router.get('/clients/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT SUM(qty) AS qty 
       FROM stock_transactions 
       WHERE client_id = ? AND type = 'out'`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Client usage lookup failed' });
  }
});

// 🟢 Get user-specific usage for a client and inventory
router.get('/usage', async (req, res) => {
  const { user_id, client_id, inventory_id } = req.query;
  try {
    const [rows] = await db.execute(
      `SELECT SUM(qty) AS qty 
       FROM user_usage 
       WHERE user_id = ? AND client_id = ? AND inventory_id = ?`,
      [user_id, client_id, inventory_id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'User usage lookup failed' });
  }
});
// backend/routes/dashboard.js
router.get('/items-summary', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        i.id,
        i.item_name,
        i.qty AS total_added,
        IFNULL(SUM(s.qty), 0) AS used,
        i.qty - IFNULL(SUM(s.qty), 0) AS balance
      FROM inventory i
      LEFT JOIN stock_transactions s ON s.inventory_id = i.id AND s.type = 'out'
      GROUP BY i.id, i.item_name, i.qty
    `);

    res.json(rows);
  } catch (err) {
    console.error('❌ items-summary error:', err);
    res.status(500).json({ error: 'Failed to fetch item summary' });
  }
});


router.get('/clients-summary', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT c.client_name, COUNT(*) as total
      FROM stock_transactions t
      JOIN clients c ON t.client_id = c.id
      GROUP BY t.client_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching client summary' });
  }
});

router.get('/', async (req, res) => {
  try {
    const [[stockInRow]] = await db.execute(
      `SELECT SUM(qty) AS total FROM stock_transactions WHERE type = 'in'`
    );
    const [[stockOutRow]] = await db.execute(
      `SELECT SUM(qty) AS total FROM stock_transactions WHERE type = 'out'`
    );

    const [perUserOut] = await db.execute(`
      SELECT u.username, SUM(st.qty) AS totalOut
      FROM stock_transactions st
      JOIN users u ON st.user_id = u.id
      WHERE st.type = 'out'
      GROUP BY u.username
    `);

    const [perUserIn] = await db.execute(`
      SELECT u.username, SUM(st.qty) AS totalIn
      FROM stock_transactions st
      JOIN users u ON st.user_id = u.id
      WHERE st.type = 'in'
      GROUP BY u.username
    `);

    const [perClientBalance] = await db.execute(`
      SELECT c.client_name, i.item_name,
        SUM(CASE WHEN st.type = 'in' THEN st.qty ELSE 0 END) -
        SUM(CASE WHEN st.type = 'out' THEN st.qty ELSE 0 END) AS balance
      FROM stock_transactions st
      JOIN clients c ON st.client_id = c.id
      JOIN inventory i ON st.inventory_id = i.id
      GROUP BY c.client_name, i.item_name
    `);
    const [clientTotalBalance] = await db.execute(`
  SELECT c.client_name,
    SUM(CASE WHEN st.type = 'in' THEN st.qty ELSE 0 END) -
    SUM(CASE WHEN st.type = 'out' THEN st.qty ELSE 0 END) AS balance
  FROM stock_transactions st
  JOIN clients c ON st.client_id = c.id
  WHERE c.client_name IS NOT NULL
  GROUP BY c.client_name
`);


    const stockIn = stockInRow?.total || 0;
    const stockOut = stockOutRow?.total || 0;
    const totalBalance = stockIn - stockOut;

    res.json({ stockIn, stockOut, totalBalance, perUserOut, perUserIn, perClientBalance, clientTotalBalance });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
router.get('/branch-dashboard-role/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const [stockinFromAdmin] = await db.execute(`
      SELECT st.date, i.item_name, c.client_name, st.qty
      FROM stock_transactions st
      JOIN clients c ON st.client_id = c.id
      JOIN inventory i ON st.inventory_id = i.id
      WHERE st.type = 'out' AND st.created_by_role = 'admin'
      AND c.branch_user_id = ?
    `, [userId]);

    const [stockoutFromUser] = await db.execute(`
      SELECT st.date, i.item_name, c.client_name, st.qty
      FROM stock_transactions st
      JOIN clients c ON st.client_id = c.id
      JOIN inventory i ON st.inventory_id = i.id
      WHERE st.type = 'out' AND st.created_by_role = 'engineer'
      AND c.branch_user_id = ?
    `, [userId]);

const [itemBalances] = await db.execute(`
  SELECT 
    i.item_name,
    c.client_name,
    SUM(CASE WHEN st.created_by_role = 'admin' AND st.type = 'out' THEN st.qty ELSE 0 END) AS stockin_from_admin,
    SUM(CASE WHEN st.created_by_role = 'engineer' AND st.type = 'out' THEN st.qty ELSE 0 END) AS stockout_by_engineer,
    (
      SUM(CASE WHEN st.created_by_role = 'admin' AND st.type = 'out' THEN st.qty ELSE 0 END) -
      SUM(CASE WHEN st.created_by_role = 'engineer' AND st.type = 'out' THEN st.qty ELSE 0 END)
    ) AS balance
  FROM stock_transactions st
  JOIN clients c ON st.client_id = c.id
  JOIN inventory i ON st.inventory_id = i.id
  WHERE c.branch_user_id = ?
  GROUP BY st.inventory_id, st.client_id
`, [userId]);


    res.json({ stockinFromAdmin, stockoutFromUser, itemBalances });
  } catch (err) {
    console.error('Branch dashboard error:', err);
    res.status(500).json({ error: 'Error fetching branch dashboard' });
  }
});

export default router;

