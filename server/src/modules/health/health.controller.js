export function createHealthController(service) {
  return {
    async readiness(req, res) {
      const health = await service.getReadiness()
      res.setHeader('Cache-Control', 'no-store')
      res.status(health.status === 'ready' ? 200 : 503).json(health)
    },
    liveness(req, res) {
      res.setHeader('Cache-Control', 'no-store')
      res.json({ status: 'running' })
    },
  }
}
