import React from 'react';
import { Navigate } from 'react-router-dom';
import { useVeetaa } from '../context/VeetaaContext';
import AdminLiveMap from './AdminLiveMap';

/**
 * Accès à la carte admin : session valide + `profiles.is_admin = true` (voir RLS Supabase).
 * La garde UI ne remplace pas les politiques côté base pour les données sensibles.
 */
const AdminLiveMapRoute: React.FC = () => {
  const { user, isBlocked } = useVeetaa();

  if (!user) {
    return <Navigate to="/login" replace state={{ returnTo: '/admin/carte-live' }} />;
  }
  if (isBlocked) {
    return <Navigate to="/blocked" replace />;
  }
  if (!user.isAdmin) {
    return <Navigate to="/home" replace />;
  }
  return <AdminLiveMap />;
};

export default AdminLiveMapRoute;
