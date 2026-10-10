import { useState } from 'react'
import { Calendar, Scissors, CheckCircle, LogOut } from 'lucide-react'
import { Feedback, FieldError } from './ui/Feedback'

export default function CustomerPortal({ onLogout }) {
  const [step, setStep] = useState(1)
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [dateError, setDateError] = useState('')

  const services = [
    { id: 1, name: 'Haircut & Blowdry', price: '₱350', duration: '45 mins' },
    { id: 2, name: 'Hair Coloring', price: '₱1,500', duration: '2 hours' },
    { id: 3, name: 'Rebond & Treatment', price: '₱3,500', duration: '4 hours' },
    { id: 4, name: 'Manicure & Pedicure', price: '₱500', duration: '1 hour' },
  ]

  const timeSlots = [
    '09:00 AM',
    '10:00 AM',
    '11:00 AM',
    '01:00 PM',
    '02:00 PM',
    '03:00 PM',
    '04:00 PM',
  ]

  const handleBook = () => {
    if (!selectedDate || !selectedTime) {
      setDateError('Choose a date and time to preview your booking.')
      return
    }
    setDateError('')
    setStep(3)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
      {/* Header */}
      <header
        className="glass"
        style={{
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              color: 'white',
            }}
          >
            R
          </div>
          <h2
            className="font-bold m-0"
            style={{ margin: 0, color: 'var(--primary)' }}
          >
            Romel Salon
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="font-bold text-sm">Hello, Guest</span>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem' }}
            onClick={onLogout}
          >
            <LogOut size={16} style={{ marginRight: '0.5rem' }} /> Exit preview
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main
        style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 className="text-2xl font-bold">Book an Appointment</h1>
          <p className="text-muted">
            Choose a service and schedule your visit easily.
          </p>
          <div className="mt-4">
            <Feedback>
              Sample booking preview. No appointment is saved or reserved yet.
            </Feedback>
          </div>
        </div>

        <div className="card glass">
          {step === 1 && (
            <div>
              <h3
                className="font-bold mb-4"
                style={{
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Scissors size={20} color="var(--primary)" /> Step 1: Select
                Service
              </h3>

              <div className="grid-cols-2">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="card"
                    style={{
                      cursor: 'pointer',
                      border:
                        selectedService?.id === service.id
                          ? '2px solid var(--primary)'
                          : '1px solid var(--border)',
                      backgroundColor:
                        selectedService?.id === service.id
                          ? '#FFF1F6'
                          : 'white',
                      boxShadow: 'none',
                    }}
                    onClick={() => setSelectedService(service)}
                  >
                    <h4 className="font-bold m-0">{service.name}</h4>
                    <p className="text-muted text-sm mt-2">
                      {service.duration}
                    </p>
                    <p className="text-primary font-bold mt-2 text-lg">
                      {service.price}
                    </p>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: '2rem',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  className="btn btn-primary"
                  disabled={!selectedService}
                  onClick={() => setStep(2)}
                >
                  Next Step
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3
                className="font-bold mb-4"
                style={{
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Calendar size={20} color="var(--primary)" /> Step 2: Choose
                Date & Time
              </h3>

              <div style={{ display: 'flex', gap: '2rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="input-label" htmlFor="booking-date">
                    Select Date
                  </label>
                  <input
                    id="booking-date"
                    type="date"
                    className="input-field"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value)
                      setDateError('')
                    }}
                    aria-invalid={Boolean(dateError)}
                    aria-describedby={
                      dateError ? 'booking-date-error' : undefined
                    }
                  />
                  <FieldError id="booking-date-error">{dateError}</FieldError>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Select Time</label>
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}
                  >
                    {timeSlots.map((time) => (
                      <button
                        key={time}
                        className={`btn ${selectedTime === time ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                        onClick={() => setSelectedTime(time)}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: '3rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!selectedDate || !selectedTime}
                  onClick={handleBook}
                >
                  Preview Booking
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: '1.5rem',
                }}
              >
                <CheckCircle size={64} color="var(--success)" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Booking Preview</h2>
              <Feedback tone="success">
                Your sample selection is ready to review.
              </Feedback>
              <p className="text-muted mb-4">
                This is a preview; your appointment has not been saved or
                reserved.
              </p>

              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  maxWidth: '400px',
                  margin: '0 auto',
                  textAlign: 'left',
                }}
              >
                <p>
                  <strong>Service:</strong> {selectedService?.name}
                </p>
                <p style={{ marginTop: '0.5rem' }}>
                  <strong>Date:</strong> {selectedDate}
                </p>
                <p style={{ marginTop: '0.5rem' }}>
                  <strong>Time:</strong> {selectedTime}
                </p>
                <p style={{ marginTop: '0.5rem' }}>
                  <strong>Estimated Cost:</strong> {selectedService?.price}
                </p>
              </div>

              <button
                className="btn btn-primary mt-8"
                onClick={() => {
                  setStep(1)
                  setSelectedService(null)
                  setSelectedDate('')
                  setSelectedTime('')
                }}
              >
                Preview Another Appointment
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
