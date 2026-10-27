import LegalPage from '@/components/legal/LegalPage';
import { legal } from '@/lib/legal';

export const metadata = { title: 'Privacidad | TravelPal' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacidad">
      <section>
        <h2>Responsable y contacto</h2>
        <p>El responsable del tratamiento es {legal.TITULAR}, persona física. Identificación y domicilio: {legal.IDENTIFICACION}. Contacto para protección de datos: {legal.CONTACTO}.</p>
        <p>Esta información se refiere al Reglamento General de Protección de Datos (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD).</p>
      </section>
      <section>
        <h2>Qué datos tratamos y para qué</h2>
        <ul>
          <li>Cuenta y acceso: email, nombre, identificador de usuario y avatar, y los datos de perfil que decidas completar (biografía, teléfono, ubicación o web). Se usan para identificarte, gestionar el acceso y mostrar tu perfil. Base jurídica: ejecución del servicio que solicitas (art. 6.1.b RGPD).</li>
          <li>Organización de viajes: viajes, actividades, reservas, tareas, gastos, presupuestos, notas y alertas. Diario: entradas, valoraciones y fotos. Se guardan para ofrecerte las funciones de planificación y memoria del viaje. Base jurídica: ejecución del servicio (art. 6.1.b RGPD). No incluyas información sensible que no sea necesaria.</li>
          <li>Acceso con Google, solo si lo eliges: InsForge recibe del proveedor los datos de identidad necesarios para iniciar sesión, como email, nombre y avatar. Base jurídica del acceso en TravelPal: ejecución del servicio solicitado (art. 6.1.b RGPD). La autorización al proveedor se gestiona en su pantalla de OAuth; puedes usar el acceso por email.</li>
          <li>Solicitudes de derechos: identidad, contacto y contenido de la solicitud, para atenderla y comprobar tu identidad de forma proporcionada. Base jurídica: cumplimiento de las obligaciones del RGPD (art. 6.1.c).</li>
        </ul>
        <p>No utilizamos tus datos para publicidad ni analítica de seguimiento, ni para decisiones automatizadas con efectos jurídicos.</p>
      </section>
      <section>
        <h2>Proveedores y destinatarios</h2>
        <p>InsForge presta el backend de base de datos, autenticación y almacenamiento. Cloudflare sirve la web estática como hosting y CDN. Estos servicios pueden tratar los datos necesarios para prestar sus funciones; las peticiones web incluyen datos técnicos como la dirección IP. Google interviene como proveedor de identidad si eliges su OAuth y aplica también su propia política.</p>
        <p>El backend está configurado en la región eu-central de InsForge. Cloudflare sirve la web como red de distribución global, por lo que una petición puede enrutarse a través de centros suyos situados fuera de la Unión Europea; ambas empresas tratan los datos por cuenta del responsable y conforme a sus condiciones publicadas. Si necesitas detalle concreto sobre este tratamiento o sobre transferencias internacionales antes de usar la aplicación, escríbelo al contacto indicado arriba y se te facilita.</p>
        <p>No se prevé comunicar el contenido de tus viajes a otros usuarios. Podrán atenderse requerimientos de autoridades cuando exista una obligación legal.</p>
      </section>
      <section>
        <h2 id="conservacion">Conservación y borrado</h2>
        <p>El contenido permanece asociado a tu cuenta mientras utilices el servicio y hasta que lo borres o solicites su supresión. Desde Ajustes puedes descargarlo y borrar los archivos y filas propios. La eliminación es irreversible y puede ser parcial si falla una operación; en ese caso se informa para reintentar.</p>
        <p>El borrado disponible actualmente cierra sesión pero no elimina la identidad de autenticación: email, identificador y datos del perfil de acceso pueden permanecer en InsForge. Solicita al responsable la supresión completa; no se presenta esta función como una baja definitiva de cuenta.</p>
        <p>La identidad de acceso (email, identificador y perfil de autenticación) se elimina a petición, previa verificación de la solicitud, en el plazo indicado en el apartado anterior. Los registros técnicos y las copias de seguridad de los proveedores (InsForge y Cloudflare) siguen sus propios ciclos de retención, que no se modifican desde la aplicación; no se anuncia aquí un plazo distinto sin haberlo verificado con ellos.</p>
      </section>
      <section>
        <h2>Tus derechos</h2>
        <p>Puedes solicitar acceso, rectificación, supresión, portabilidad, oposición y limitación del tratamiento cuando correspondan. Envía tu solicitud a <a href={`mailto:${legal.CONTACTO}`}>{legal.CONTACTO}</a>, indicando el derecho y el email de tu cuenta. Solo se pedirá información adicional de identidad si resulta necesaria. Las solicitudes se atienden en el plazo máximo de un mes desde su recepción, ampliable otros dos meses si la petición es compleja, en los términos del artículo 12 del RGPD.</p>
        <p>En Perfil puedes corregir datos y en Ajustes exportar un JSON con identidad, perfil, contenido y archivos propios almacenados en TravelPal. Las imágenes guardadas solo como enlaces externos se incluyen como URL. El archivo se descarga en tu dispositivo: guárdalo de forma segura. La descarga no borra los datos del servicio.</p>
        <p>Si consideras que el tratamiento o la atención a tus derechos no es adecuado, puedes reclamar ante la <a href="https://www.aepd.es/">Agencia Española de Protección de Datos (AEPD)</a>. Consulta también su <a href="https://www.aepd.es/derechos-y-deberes/ejerce-tus-derechos">información sobre el ejercicio de derechos</a>.</p>
      </section>
      <section>
        <h2>Cookies y almacenamiento local</h2>
        <p>No utilizamos cookies de seguimiento, publicidad ni analítica. Guardamos el tema elegido en localStorage bajo la clave theme. Puedes restablecerlo desde Ajustes o borrando los datos del sitio en tu navegador. El SDK de autenticación utiliza cookies técnicas de sesión para mantener el acceso; Google puede usar sus propios mecanismos cuando eliges OAuth.</p>
        <p>No se incorpora un banner de consentimiento porque el almacenamiento descrito sirve al acceso solicitado y a la preferencia de apariencia elegida, sin seguimiento. Esta valoración se basa en la <a href="https://www.aepd.es/guias/guia-cookies.pdf">guía de cookies de la AEPD</a>; deberá revisarse antes de añadir usos o terceros que requieran consentimiento.</p>
      </section>
    </LegalPage>
  );
}
