import cors from 'cors';
import express from 'express';

import { initializeStore } from './database/store.js';
import { resetSeedData, seedDatabase } from './database/seed.js';
import { equiShareSchemaSql } from './database/schema.js';
import groupsRouter from './routes/groups.js';
import { getCurrentUser } from './services/groups-service.js';
import { getCurrentUserRow, login, logout, register } from './services/session-service.js';

initializeStore();
seedDatabase();

const app = express();

app.use(
  cors({
    origin: '*',
    credentials: true
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    name: 'EquiShare API',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/session/current-user', (_req, res) => {
  const currentUser = getCurrentUserRow();
  res.json({ currentUser: currentUser ? getCurrentUser() : null });
});

app.post('/api/session/login', (req, res) => {
  try {
    const currentUser = login(req.body);
    res.json({ currentUser });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to log in' });
  }
});

app.post('/api/session/register', (req, res) => {
  try {
    const currentUser = register(req.body);
    res.status(201).json({ currentUser });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to register' });
  }
});

app.post('/api/session/logout', (_req, res) => {
  logout();
  res.json({ ok: true });
});

app.get('/api/meta/schema', (_req, res) => {
  res.type('text/plain').send(equiShareSchemaSql);
});

app.post('/api/meta/reset', (_req, res) => {
  resetSeedData();
  res.json({ ok: true });
});

app.use('/api/groups', groupsRouter);

export default app;
