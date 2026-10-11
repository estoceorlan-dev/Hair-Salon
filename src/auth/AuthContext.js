import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)
export function useAuth() { return useContext(AuthContext) }
export function homeFor(user) {
  if (user.role === 'customer') return '/book'
  return user.permissions.includes('dashboard.view') ? '/app/dashboard' : '/app/appointments'
}
