import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// For resolving __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import db from './db.js';
import stockinRoutes from './routes/stockin.js';
import stockoutRoutes from './routes/stockout.js';
import inventoryRoutes from './routes/inventory.js';
import clientRoutes from './routes/clients.js';
import dashboardRoutes from './routes/dashboard.js';
import servicesRoutes from './routes/services.js';
import reportRoutes from './routes/report.js';
import userRoutes from './routes/users.js';
import expenseRoutes from './routes/expensive.js';


const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Route Registrations
app.use('/api/stockin', stockinRoutes);
app.use('/api/stockout', stockoutRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/expensive', expenseRoutes);
app.listen(3001, () => {
  console.log('🚀 Server is running on port 3001');
});
