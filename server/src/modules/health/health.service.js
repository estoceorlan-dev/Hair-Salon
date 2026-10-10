export function createHealthService(database) {
  return {
    async getReadiness() {
      const db = await database.checkReadiness()
      return {
        status: db.status === 'ready' ? 'ready' : 'not_ready',
        api: { status: 'running' },
        database: db,
      }
    },
  }
}
