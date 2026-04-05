import app from './index.js';

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
  console.log(`EquiShare API running on http://localhost:${PORT}`);
});
