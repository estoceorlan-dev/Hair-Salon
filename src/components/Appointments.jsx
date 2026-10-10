import { Plus } from 'lucide-react'

export default function Appointments() {
  const appointments = [
    { id: 1, time: '09:00 AM', name: 'Anna Lee', service: 'Haircut & Blowdry', stylist: 'Jane', status: 'Completed' },
    { id: 2, time: '10:00 AM', name: 'Maria Santos', service: 'Hair Coloring', stylist: 'Jane', status: 'In Progress' },
    { id: 3, time: '11:30 AM', name: 'Juan Dela Cruz', service: 'Men\'s Haircut', stylist: 'Mark', status: 'Confirmed' },
    { id: 4, time: '01:00 PM', name: 'Elena Reyes', service: 'Rebond & Treatment', stylist: 'Jane', status: 'Confirmed' },
    { id: 5, time: '03:00 PM', name: 'Sarah Gomez', service: 'Manicure & Pedicure', stylist: 'Lisa', status: 'Pending' },
  ]

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed': return <span className="badge badge-success" style={{ background: '#E0E7FF', color: '#4338CA' }}>Completed</span>
      case 'In Progress': return <span className="badge badge-warning">In Progress</span>
      case 'Confirmed': return <span className="badge badge-success">Confirmed</span>
      default: return <span className="badge badge-danger" style={{ background: '#F3F4F6', color: '#4B5563' }}>Pending</span>
    }
  }

  return (
    <div className="card glass" style={{ minHeight: '600px' }}>
      <div className="flex justify-between items-center mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input type="date" className="input-field" defaultValue="2026-09-18" style={{ width: 'auto' }} />
          <select className="input-field" style={{ width: 'auto' }}>
            <option>All Stylists</option>
            <option>Jane</option>
            <option>Mark</option>
            <option>Lisa</option>
          </select>
        </div>
        <button className="btn btn-primary">
          <Plus size={18} style={{ marginRight: '8px' }} />
          New Appointment
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Customer Name</th>
              <th>Service</th>
              <th>Stylist</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((apt) => (
              <tr key={apt.id}>
                <td className="font-bold">{apt.time}</td>
                <td>{apt.name}</td>
                <td className="text-muted">{apt.service}</td>
                <td>{apt.stylist}</td>
                <td>{getStatusBadge(apt.status)}</td>
                <td>
                  <button className="text-primary font-bold" style={{ background: 'none', border: 'none', marginRight: '1rem' }}>Edit</button>
                  {apt.status === 'Confirmed' && <button className="text-success font-bold" style={{ background: 'none', border: 'none' }}>Check-in</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
