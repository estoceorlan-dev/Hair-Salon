import { DollarSign, Scissors, AlertCircle, TrendingUp } from 'lucide-react'

export default function Dashboard() {
  const stats = [
    { title: "Today's Sales", value: '₱12,450', icon: <DollarSign size={24} />, color: 'var(--primary)', bg: '#FFE4EF' },
    { title: 'Appointments Today', value: '24', icon: <Scissors size={24} />, color: 'var(--accent)', bg: '#EDE9FE' },
    { title: 'New Customers', value: '5', icon: <TrendingUp size={24} />, color: 'var(--success)', bg: '#D1FAE5' },
    { title: 'Low Stock Alerts', value: '3', icon: <AlertCircle size={24} />, color: 'var(--danger)', bg: '#FEE2E2' },
  ]

  return (
    <div className="flex-col gap-4" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Stats Row */}
      <div className="grid-cols-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="card flex items-center gap-4">
            <div style={{ backgroundColor: stat.bg, color: stat.color, padding: '12px', borderRadius: '12px' }}>
              {stat.icon}
            </div>
            <div>
              <p className="text-muted text-sm">{stat.title}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid-cols-2">

        {/* Upcoming Appointments */}
        <div className="card glass">
          <div className="flex justify-between items-center mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="font-bold">Upcoming Appointments</h3>
            <button className="text-primary text-sm font-bold" style={{ background: 'none', border: 'none' }}>View All</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { time: '10:00 AM', name: 'Maria Santos', service: 'Hair Coloring', stylist: 'Jane' },
              { time: '11:30 AM', name: 'Juan Dela Cruz', service: 'Men\'s Haircut', stylist: 'Mark' },
              { time: '01:00 PM', name: 'Elena Reyes', service: 'Rebond & Treatment', stylist: 'Jane' }
            ].map((apt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: i !== 2 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: 'var(--bg-color)', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.875rem' }}>
                    {apt.time}
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ margin: 0 }}>{apt.name}</p>
                    <p className="text-muted text-sm" style={{ margin: 0 }}>{apt.service} • with {apt.stylist}</p>
                  </div>
                </div>
                <span className="badge badge-success">Confirmed</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="card">
          <h3 className="font-bold mb-4" style={{ marginBottom: '1rem' }}>Low Stock Alerts</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Current Stock</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>L'Oreal Hair Color (Black)</td>
                  <td className="font-bold">2 boxes</td>
                  <td><span className="badge badge-danger">Critical</span></td>
                  <td><button className="text-primary font-bold" style={{ background: 'none', border: 'none' }}>Order</button></td>
                </tr>
                <tr>
                  <td>Keratin Treatment Serum</td>
                  <td className="font-bold">5 bottles</td>
                  <td><span className="badge badge-warning">Low</span></td>
                  <td><button className="text-primary font-bold" style={{ background: 'none', border: 'none' }}>Order</button></td>
                </tr>
                <tr>
                  <td>Premium Shampoo (Gallon)</td>
                  <td className="font-bold">1 unit</td>
                  <td><span className="badge badge-danger">Critical</span></td>
                  <td><button className="text-primary font-bold" style={{ background: 'none', border: 'none' }}>Order</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
