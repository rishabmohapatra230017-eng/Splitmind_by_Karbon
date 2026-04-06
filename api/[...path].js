export default async function handler(req, res) {
  const { default: app } = await import('../backend/dist/index.js');
  return app(req, res);
}
