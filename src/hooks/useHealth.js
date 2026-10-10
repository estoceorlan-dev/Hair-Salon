import { useEffect, useState } from 'react'
import { getHealth } from '../api/health'
import { apiErrorMessage } from '../api/client'

export function useHealth() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({
    status: 'loading',
    data: null,
    error: null,
  })
  useEffect(() => {
    const controller = new AbortController()
    getHealth(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ status: 'success', data, error: null })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            status: 'error',
            data: null,
            error: apiErrorMessage(error),
          })
      })
    return () => controller.abort()
  }, [attempt])
  const retry = () => {
    setState({ status: 'loading', data: null, error: null })
    setAttempt((value) => value + 1)
  }
  return { ...state, retry }
}
