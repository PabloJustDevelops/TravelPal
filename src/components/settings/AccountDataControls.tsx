'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { createInsforgeClient } from '@/lib/insforge';
import { deleteAccountData, downloadAccountExport, exportAccountData } from '@/lib/account-data';
import { getErrorMessage } from '@/lib/utils';
import { legal } from '@/lib/legal';

export default function AccountDataControls() {
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
      setStatus('Exportación preparada. Revisa las descargas de tu navegador.');
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo exportar. No se ha descargado un archivo parcial.'));
    } finally { locked.current = false; setBusy(null); }
  };

  const handleDelete = async () => {
    if (locked.current || confirmation !== 'ELIMINAR') return;
    locked.current = true;
    setBusy('delete'); setError(''); setStatus('');
    try {
      await deleteAccountData(createInsforgeClient(), confirmation);
      // Salir a una página pública conserva un aviso visible tras cerrar sesión.
      // Navegación completa tras invalidar sesión: evita competir con el guard
      // privado y descarta cualquier contenido personal retenido en memoria.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/privacidad#conservacion');
    } catch (err) {
      setError(getErrorMessage(err, 'El borrado puede ser parcial. Reintenta o contacta con el responsable.'));
    } finally { locked.current = false; setBusy(null); }
  };

  const close = () => {
    if (busy) return;
    setOpen(false); setConfirmation(''); setError('');
  };

  return (
    <section className="space-y-5 border-b border-line pb-8" aria-labelledby="account-data-title">
      <h2 id="account-data-title" className="text-2xl font-bold tracking-tight text-ink">Tus datos</h2>
      <p className="max-w-2xl text-muted">Descarga tu identidad, perfil, viajes, actividades, reservas, tareas, gastos, presupuestos, notas, alertas y diario. El JSON incluye los archivos propios del diario y avatares en base64; los enlaces externos se conservan como URL. Puede ocupar bastante memoria. Guarda una copia antes de borrar.</p>
      <Button className="min-h-11" variant="outline" disabled={busy !== null} loading={busy === 'export'} onClick={handleExport}>Exportar mis datos</Button>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-ink">Borrado de datos y baja de cuenta pendiente</h3>
        <p className="max-w-2xl text-muted">Se borrarán tus fotos del diario, avatares almacenados y datos de la app, y se cerrará la sesión. No se elimina tu identidad de acceso (email y perfil de autenticación). La baja definitiva requiere que el responsable la complete. Contacto: {legal.CONTACTO}.</p>
        <Button className="min-h-11" variant="danger" disabled={busy !== null} onClick={() => { setOpen(true); setStatus(''); setError(''); }}>Borrar mis datos</Button>
      </div>
      {!open && error && <p role="alert" className="text-danger">{error}</p>}
      {status && <p role="status" className="text-muted">{status}</p>}
      <nav aria-label="Información legal" className="flex flex-wrap gap-6">
        <Link href="/aviso-legal" className="inline-flex min-h-11 items-center text-accent underline">Aviso legal</Link>
        <Link href="/privacidad" className="inline-flex min-h-11 items-center text-accent underline">Privacidad</Link>
      </nav>
      <Modal isOpen={open} onClose={close} title="Confirmar borrado de datos" showCloseButton={!busy}>
        <div className="space-y-5">
          <p id="delete-data-description" className="text-muted">Esta operación es irreversible. Borrará archivos y contenido de TravelPal, pero tu cuenta de autenticación seguirá existiendo. Si falla, puede quedar un borrado parcial: se mostrará el error y podrás reintentarlo. Cierra otras pestañas para evitar escrituras mientras se borran los datos.</p>
          <Input id="delete-account-confirmation" label="Escribe ELIMINAR para confirmar" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy !== null} autoComplete="off" aria-describedby="delete-data-description" />
          {error && <p role="alert" className="text-danger">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="min-h-11" onClick={close} disabled={busy !== null}>Cancelar</Button>
            <Button variant="danger" className="min-h-11" disabled={confirmation !== 'ELIMINAR' || busy !== null} loading={busy === 'delete'} onClick={handleDelete}>Borrar datos y cerrar sesión</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
