import Link from 'next/link';
import LegalPage from '@/components/legal/LegalPage';
import { legal } from '@/lib/legal';

export const metadata = { title: 'Aviso legal | TravelPal' };

export default function LegalNoticePage() {
  return (
    <LegalPage title="Aviso legal">
      <section>
        <h2>Responsable del sitio</h2>
        <p>TravelPal es un proyecto gestionado por {legal.TITULAR}, persona física. No se presenta como una sociedad mercantil.</p>
        <p>Identificación y domicilio: {legal.IDENTIFICACION}</p>
        <p>Contacto: {legal.CONTACTO}</p>
      </section>
      <section>
        <h2>Objeto y uso</h2>
        <p>TravelPal permite organizar viajes, itinerarios, reservas, tareas, gastos, presupuestos, notas y recuerdos del diario. Introduce únicamente contenidos que tengas derecho a utilizar y evita incluir datos de otras personas sin una base legítima.</p>
        <p>La información que introduces depende de ti. Comprueba fechas, reservas e importes con sus proveedores antes de tomar decisiones; TravelPal no tramita ni confirma reservas.</p>
      </section>
      <section>
        <h2>Propiedad intelectual y enlaces</h2>
        <p>El código del proyecto se distribuye bajo la licencia MIT indicada en el repositorio. Los contenidos que aportas siguen siendo tuyos. Los enlaces a servicios externos se rigen por las condiciones de sus respectivos titulares.</p>
      </section>
      <section>
        <h2>Datos personales y almacenamiento del navegador</h2>
        <p>La <Link href="/privacidad">política de privacidad</Link> explica los tratamientos, los proveedores y cómo ejercer tus derechos conforme al RGPD y la LOPDGDD. No utilizamos cookies de seguimiento ni analítica. La preferencia de tema se guarda en localStorage con la clave theme; el acceso a la cuenta utiliza mecanismos técnicos de autenticación.</p>
      </section>
    </LegalPage>
  );
}
