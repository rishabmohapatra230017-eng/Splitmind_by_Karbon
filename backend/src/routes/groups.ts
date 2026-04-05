import { Router } from 'express';

import { createGroup, deleteGroup, listGroups } from '../services/groups-service.js';
import {
  addParticipant,
  createExpense,
  deleteExpense,
  getGroupDetail,
  removeParticipant
  ,
  updateExpense
} from '../services/group-detail-service.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    const groups = listGroups();
    res.json({ groups });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch groups' });
  }
});

router.post('/', (req, res) => {
  try {
    const group = createGroup(req.body);
    res.status(201).json({ group });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create group' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    deleteGroup(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : 'Failed to delete group' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const detail = getGroupDetail(req.params.id);
    res.json(detail);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : 'Failed to fetch group detail' });
  }
});

router.post('/:id/participants', (req, res) => {
  try {
    const detail = addParticipant(req.params.id, req.body);
    res.status(201).json(detail);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to add participant' });
  }
});

router.delete('/:id/participants/:participantId', (req, res) => {
  try {
    const detail = removeParticipant(req.params.id, req.params.participantId);
    res.json(detail);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to remove participant' });
  }
});

router.post('/:id/expenses', (req, res) => {
  try {
    const detail = createExpense(req.params.id, req.body);
    res.status(201).json(detail);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create expense' });
  }
});

router.put('/:id/expenses/:expenseId', (req, res) => {
  try {
    const detail = updateExpense(req.params.id, req.params.expenseId, req.body);
    res.json(detail);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update expense' });
  }
});

router.delete('/:id/expenses/:expenseId', (req, res) => {
  try {
    const detail = deleteExpense(req.params.id, req.params.expenseId);
    res.json(detail);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : 'Failed to delete expense' });
  }
});

export default router;
