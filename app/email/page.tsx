import EmailInboxClient from '../components/email/EmailInboxClient';
import RoleGuard from '../components/RoleGuard';

export default function EmailPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN', 'SALES_EXECUTIVE', 'SALES_MANAGER', 'PROCESS_EXECUTIVE', 'PROCESS_MANAGER']}>
      <EmailInboxClient />
    </RoleGuard>
  );
}
