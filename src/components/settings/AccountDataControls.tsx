'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { createInsforgeClient } from '@/lib/insforge';
import { deleteAccountData, downloadAccountExport, exportAccountData } from '@/lib/account-data';
import { legal } from '@/lib/legal';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import { localePath } from '@/lib/i18n';

export default function AccountDataControls() {
  const { t, locale } = useI18n();
  const confirmationWord = locale === 'en' ? 'DELETE' : 'ELIMINAR';
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const locked = useRef(false);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const handleExport = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy('export'); setError(''); setStatus('');
    try {
      downloadAccountExport(await exportAccountData());
      setStatus(t('accountDataExportReady'));
    } catch {
      setError(t('accountDataExportError'));
    } finally { locked.current = false; setBusy(null); }
  };

  const handleDelete = async () => {
    if (locked.current || confirmation !== confirmationWord) return;
    locked.current = true;
    setBusy('delete'); setError(''); setStatus('');
    try {
      await deleteAccountData(createInsforgeClient(), 'ELIMINAR');
      // Salir a una página pública conserva un aviso visible tras cerrar sesión.
      // Navegación completa tras invalidar sesión: evita competir con el guard
      // privado y descarta cualquier contenido personal retenido en memoria.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`${localePath(locale, '/privacidad')}#conservacion`);
    } catch {
      setError(t('accountDataDeletePartial'));
    } finally { locked.current = false; setBusy(null); }
  };

  const close = () => {
    if (busy) return;
    setOpen(false); setConfirmation(''); setError('');
  };

  return (
    <section className="space-y-5 border-b border-line pb-8" aria-labelledby="account-data-title">
      <h2 id="account-data-title" className="text-2xl font-bold tracking-tight text-ink">{t('accountDataTitle')}</h2>
      <p className="max-w-2xl text-muted">{t('accountDataDescription')}</p>
      <Button className="min-h-11" variant="outline" disabled={busy !== null} loading={busy === 'export'} onClick={handleExport}>{t('accountDataExport')}</Button>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-ink">{t('accountDataDeletePending')}</h3>
        <p className="max-w-2xl text-muted">{t('accountDataPendingDetail').replace('{contact}', legal.CONTACTO)}</p>
        <Button className="min-h-11" variant="danger" disabled={busy !== null} onClick={() => { setOpen(true); setStatus(''); setError(''); }}>{t('accountDataDelete')}</Button>
      </div>
      {!open && error && <p role="alert" className="text-danger">{error}</p>}
      {status && <p role="status" className="text-muted">{status}</p>}
      <nav aria-label={t('legalInformation')} className="flex flex-wrap gap-6">
        <Link href={localePath(locale, '/aviso-legal')} className="inline-flex min-h-11 items-center text-accent underline">{t('legalNotice')}</Link>
        <Link href={localePath(locale, '/privacidad')} className="inline-flex min-h-11 items-center text-accent underline">{t('privacy')}</Link>
      </nav>
      <Modal isOpen={open} onClose={close} title={t('accountDataConfirm')} showCloseButton={!busy}>
        <div className="space-y-5">
          <p id="delete-data-description" className="text-muted">{t('accountDataIrreversible')}</p>
          <Input id="delete-account-confirmation" label={t('accountDataTypeToConfirm').replace('ELIMINAR', confirmationWord)} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy !== null} autoComplete="off" aria-describedby="delete-data-description" />
          {error && <p role="alert" className="text-danger">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="min-h-11" onClick={close} disabled={busy !== null}>{t('cancel')}</Button>
            <Button variant="danger" className="min-h-11" disabled={confirmation !== confirmationWord || busy !== null} loading={busy === 'delete'} onClick={handleDelete}>{t('accountDataDeleteAndSignOut')}</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
