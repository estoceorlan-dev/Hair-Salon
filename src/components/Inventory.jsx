import { PackagePlus, Search } from 'lucide-react'

export default function Inventory() {
  const inventory = [
    { id: 1, item: 'L\'Oreal Hair Color (Black)', category: 'Hair Dye', stock: 2, minStock: 5, status: 'Critical' },
    { id: 2, item: 'L\'Oreal Hair Color (Brown)', category: 'Hair Dye', stock: 8, minStock: 5, status: 'Good' },
    { id: 3, item: 'Keratin Treatment Serum', category: 'Treatment', stock: 5, minStock: 10, status: 'Low' },
    { id: 4, item: 'Premium Shampoo (Gallon)', category: 'Shampoo', stock: 1, minStock: 2, status: 'Critical' },
    { id: 5, item: 'Argan Oil (50ml)', category: 'Treatment', stock: 15, minStock: 5, status: 'Good' },
    { id: 6, item: 'Styling Gel', category: 'Styling', stock: 12, minStock: 5, status: 'Good' },
  ]

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Good': return <span className="badge badge-success">Good</span>
      case 'Low': return <span className="badge badge-warning">Low</span>
      case 'Critical': return <span className="badge badge-danger">Critical</span>
      default: return <span className="badge">Unknown</span>
    }
  }

  return (
    <div className="card glass" style={{ minHeight: '600px' }}>
      <div className="flex justify-between items-center mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <input type="text" className="input-field" placeholder="Search inventory..." style={{ paddingLeft: '2.5rem' }} />
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
        <button className="btn btn-primary">
          <PackagePlus size={18} style={{ marginRight: '8px' }} />
          Add Product
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>Current Stock</th>
              <th>Min Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.id}>
                <td className="font-bold">{item.item}</td>
                <td className="text-muted">{item.category}</td>
                <td className="font-bold">{item.stock}</td>
                <td className="text-muted">{item.minStock}</td>
                <td>{getStatusBadge(item.status)}</td>
                <td>
                  <button className="text-primary font-bold" style={{ background: 'none', border: 'none', marginRight: '1rem' }}>Restock</button>
                  <button className="text-muted font-bold" style={{ background: 'none', border: 'none' }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
