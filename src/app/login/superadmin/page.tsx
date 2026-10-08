import { redirect } from 'next/navigation';

export default function SuperAdminLoginRedirect() {
  redirect('/login/admin?mode=superadmin');
}
