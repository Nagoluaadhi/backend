import express from 'express';
const router = express.Router();
import db from '../db.js';

// Create user
router.post('/', async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const [existing] = await db.execute('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (existing.length > 0) return res.status(400).json({ error: 'User already exists' });

    await db.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, role]);
    res.json({ message: 'User created' });
  } catch (err) {
    console.error('User creation error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  const force = req.query.force === 'true';

  try {
    const [used] = await db.execute(`
      SELECT user_id FROM stock_transactions WHERE user_id = ? 
UNION 
SELECT user_id FROM user_usage WHERE user_id = ?
      LIMIT 1
    `, [id, id]);

    if (used.length > 0 && !force) {
      return res.status(400).json({ error: 'Cannot delete user. It is in use.' });
    }

    if (force) {
      await db.execute('DELETE FROM stock_transactions WHERE user_id = ?', [id]);
      await db.execute('DELETE FROM user_usage WHERE user_id = ?', [id]);
    }

    await db.execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('❌ Error deleting user:', err);
    res.status(500).json({ error: 'Delete failed', detail: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password, role } = req.body;
  console.log('🔐 Login Attempt:', { username, password, role });

  try {
    const [results] = await db.execute(
      `SELECT id, username, password, role, can_stockin, can_stockout FROM users WHERE LOWER(username) = LOWER(?)`,
      [username]
    );
    console.log('🧪 Matched by username:', results);

    if (results.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = results[0];
    console.log('🔍 Password match:', user.password.trim() === password.trim());
console.log('🔍 Role match:', user.role.trim().toLowerCase() === role.trim().toLowerCase());

// Show character codes to detect hidden characters
console.log('🔢 user.password:', [...user.password].map(c => c.charCodeAt(0)));
console.log('🔢 input.password:', [...password].map(c => c.charCodeAt(0)));

console.log('🔢 user.role:', [...user.role].map(c => c.charCodeAt(0)));
console.log('🔢 input.role:', [...role].map(c => c.charCodeAt(0)));

const normalizedInputRole = role.trim().toLowerCase().replace('-', '_');
const normalizedUserRole = user.role.trim().toLowerCase();
if (
  user.password.trim() !== password.trim() ||
  normalizedUserRole !== normalizedInputRole
) {
  return res.status(401).json({ error: 'Invalid credentials' });
}


    res.json({
  id: user.id,
  username: user.username,
  role: user.role,
  can_stockin: user.can_stockin,
  can_stockout: user.can_stockout
});

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin grants/revokes StockIn/Out permissions
router.post('/update-permissions', async (req, res) => {
  const { userId, field, value } = req.body;

  // Whitelist only allowed fields to avoid SQL injection
  const allowedFields = ['can_stockin', 'can_stockout'];
  if (!allowedFields.includes(field)) {
    return res.status(400).json({ error: 'Invalid permission field' });
  }

  try {
    await db.execute(`UPDATE users SET ${field} = ? WHERE id = ?`, [value, userId]);
    res.json({ message: '✅ Permission updated' });
  } catch (err) {
    console.error('❌ Permission update failed:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});


export default router;
