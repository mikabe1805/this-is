/**
 * Historical `/search` links now enter the one reviewed capture lane.
 * Search is an action inside Add, never a catalog/discovery destination.
 */
import { Navigate, useLocation } from 'react-router-dom'

export default function Search() {
  const location = useLocation()
  return <Navigate to={{ pathname: '/add', search: location.search }} replace />
}
