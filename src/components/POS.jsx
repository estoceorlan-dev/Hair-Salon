import { useState } from 'react'
import { ShoppingBag, Search, CreditCard } from 'lucide-react'
import { EmptyState, Feedback, LoadingState } from './ui/Feedback'
import { useCatalog } from '../hooks/useCatalog'
import { businessRules, formatCurrency } from '../config/business-rules'
import { paymentMethods } from '../config/payment-methods'

export default function POS() {
  const catalog = useCatalog()
  const items = catalog.items.map((s) => ({ ...s, price: s.price_cents === null ? null : Number(s.price_cents) / 100 }))
  const [cartIds, setCart] = useState([])
  const cart = cartIds.flatMap((entry) => { const item = items.find((s) => s.id === entry.id && s.price !== null); return item ? [{ ...item, qty: entry.qty }] : [] })
  const [activeCategory, setActiveCategory] = useState('')
  const [search, setSearch] = useState('')
  const filteredItems = items.filter(
    (item) =>
      (!activeCategory || item.category === activeCategory) &&
      item.name.toLowerCase().includes(search.toLowerCase()),
  )
  const addToCart = (item) =>
    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id)
      return existing
        ? current.map((entry) =>
            entry.id === item.id ? { ...entry, qty: entry.qty + 1 } : entry,
          )
        : [...current, { ...item, qty: 1 }]
    })
  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.qty,
    0,
  )
  const tax =
    businessRules.taxRate === null ? null : subtotal * businessRules.taxRate
  return (
    <div className="pos-layout">
      <section className="pos-catalog">
        <div className="pos-toolbar">
          {['', ...new Set(items.map((s) => s.category))].map((category) => (
            <button
              type="button"
              key={category}
              className={`btn ${activeCategory === category ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveCategory(category)}
            >
              {category || 'All services'}
            </button>
          ))}
          <div className="pos-search">
            <label className="sr-only" htmlFor="pos-search">
              Search items
            </label>
            <input
              id="pos-search"
              type="search"
              className="input-field"
              placeholder="Search..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Search size={18} aria-hidden="true" />
          </div>
        </div>
        <p className="text-muted text-sm">
          Current service catalog. Demo entries are illustrative. Products and checkout will be connected in later phases.
        </p>
        {catalog.loading && <LoadingState />}
        {catalog.error && <Feedback tone="error">{catalog.error}</Feedback>}
        <button className="btn btn-secondary mb-4" disabled={catalog.loading} onClick={catalog.refresh}>Refresh catalog</button>
        <div className="grid-cols-3">
          {filteredItems.map((item) => (
            <button
              type="button"
              key={item.id}
              className="card catalog-item"
              disabled={item.price === null || catalog.loading || !!catalog.error}
              onClick={() => addToCart(item)}
            >
              <span className="font-bold">{item.name}</span>
              <span className="text-primary font-bold">
                {item.price === null ? 'Price undefined' : formatCurrency(item.price)}{item.is_demo ? ' · Demo' : ''}
              </span>
            </button>
          ))}
        </div>
        {filteredItems.length === 0 && (
          <EmptyState
            title="No matching items"
            description="Try a different search or category."
          />
        )}
      </section>
      <section className="card glass pos-cart" aria-label="Current order">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingBag size={20} aria-hidden="true" />
          <h2 className="text-lg">Current Order</h2>
        </div>
        <div className="cart-items">
          {cart.length === 0 ? (
            <EmptyState
              title="Order is empty"
              description="Select an item to preview an order."
            />
          ) : (
            cart.map((item) => (
              <div key={item.id} className="cart-row">
                <div>
                  <p className="font-bold text-sm">{item.name}</p>
                  <p className="text-muted text-sm">
                    {formatCurrency(item.price)} x {item.qty}
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setCart((current) =>
                        current.filter((entry) => entry.id !== item.id),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
                <p className="font-bold">
                  {formatCurrency(item.price * item.qty)}
                </p>
              </div>
            ))
          )}
        </div>
        <dl className="order-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCurrency(subtotal)}</dd>
          </div>
          <div>
            <dt>Tax</dt>
            <dd>{tax === null ? 'To be defined' : formatCurrency(tax)}</dd>
          </div>
          <div className="order-total">
            <dt>Estimated total</dt>
            <dd>{formatCurrency(subtotal + (tax ?? 0))}</dd>
          </div>
        </dl>
        <fieldset className="payment-options">
          <legend>Payment methods</legend>
          <div className="payment-grid">
            {paymentMethods.map((method) => (
              <button
                type="button"
                key={method.id}
                className="btn btn-secondary"
                disabled={!method.enabled}
              >
                {method.label}
                <span>Coming soon</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Feedback>
          Payment methods are display only. This preview does not collect or
          record payments.
        </Feedback>
        <button type="button" className="btn btn-primary mt-4" disabled>
          <CreditCard size={18} aria-hidden="true" />
          Payment unavailable
        </button>
      </section>
    </div>
  )
}
