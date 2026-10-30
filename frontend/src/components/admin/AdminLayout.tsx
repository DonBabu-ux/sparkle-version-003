import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasAdminSession } from '../../api/api';

/**
 * Gate for the /admin area: the admin elevation session (minted at
 * /admin/login with the second password) must exist, or nothing under /admin
 * renders and the user is redirected back to the gate with the intended
 * destination remembered.
 */
export default function AdminLayout() {
  const location = useLocation();

  if (!hasAdminSession()) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}
