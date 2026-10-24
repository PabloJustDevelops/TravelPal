import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage from '@/components/legal/LegalPage'
import { legal } from '@/lib/legal'
import type { Locale } from '@/lib/i18n'

const origin = 'https://travelpal.prg-dev.workers.dev'
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const path = `/${locale}/aviso-legal`
  const title = locale === 'en' ? 'Legal notice | TravelPal' : 'Aviso legal | TravelPal'
  const description = locale === 'en' ? 'Legal information about using TravelPal.' : 'Información legal sobre el uso de TravelPal.'
  return { title, description, robots: { index: true, follow: true }, alternates: { canonical: path, languages: { es: `${origin}/es/aviso-legal`, en: `${origin}/en/aviso-legal`, 'x-default': `${origin}/es/aviso-legal` } }, openGraph: { title, description, locale: locale === 'en' ? 'en_US' : 'es_ES', images: [{ url: '/og-image.png', width: 1200, height: 630, alt: locale === 'en' ? 'TravelPal legal notice' : 'Aviso legal de TravelPal' }] } }
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const english = locale === 'en'
  return <LegalPage locale={locale} translated={english} title={english ? 'Legal notice' : 'Aviso legal'}>
    {english ? <>
      <section><h2>Website operator</h2><p>TravelPal is a project managed by {legal.TITULAR}, an individual. It is not presented as a commercial company.</p><p>Identification and address: {legal.IDENTIFICACION}</p><p>Contact: {legal.CONTACTO}</p></section>
      <section><h2>Purpose and use</h2><p>TravelPal lets you organize trips, itineraries, bookings, tasks, expenses, budgets, notes, and journal memories. Only add content you are entitled to use, and avoid including other people’s data without a lawful basis.</p><p>You are responsible for the information you enter. Check dates, bookings, and amounts with their providers before making decisions; TravelPal does not process or confirm bookings.</p></section>
      <section><h2>Intellectual property and links</h2><p>The project code is distributed under the MIT License listed in the repository. Content you contribute remains yours. Links to external services are subject to the terms of their respective owners.</p></section>
      <section><h2>Personal data and browser storage</h2><p>The <Link href={`/${locale}/privacidad`}>privacy policy</Link> explains processing, providers, and how to exercise your rights under the GDPR and Spain’s LOPDGDD. We do not use tracking cookies or analytics. Your theme preference is stored in localStorage under the key theme; account access uses technical authentication mechanisms.</p></section>
    </> : <>
      <section><h2>Responsable del sitio</h2><p>TravelPal es un proyecto gestionado por {legal.TITULAR}, persona física. No se presenta como una sociedad mercantil.</p><p>Identificación y domicilio: {legal.IDENTIFICACION}</p><p>Contacto: {legal.CONTACTO}</p></section>
      <section><h2>Objeto y uso</h2><p>TravelPal permite organizar viajes, itinerarios, reservas, tareas, gastos, presupuestos, notas y recuerdos del diario. Introduce únicamente contenidos que tengas derecho a utilizar y evita incluir datos de otras personas sin una base legítima.</p><p>La información que introduces depende de ti. Comprueba fechas, reservas e importes con sus proveedores antes de tomar decisiones; TravelPal no tramita ni confirma reservas.</p></section>
      <section><h2>Propiedad intelectual y enlaces</h2><p>El código del proyecto se distribuye bajo la licencia MIT indicada en el repositorio. Los contenidos que aportas siguen siendo tuyos. Los enlaces a servicios externos se rigen por las condiciones de sus respectivos titulares.</p></section>
      <section><h2>Datos personales y almacenamiento del navegador</h2><p>La <Link href={`/${locale}/privacidad`}>política de privacidad</Link> explica los tratamientos, los proveedores y cómo ejercer tus derechos conforme al RGPD y la LOPDGDD. No utilizamos cookies de seguimiento ni analítica. La preferencia de tema se guarda en localStorage con la clave theme; el acceso a la cuenta utiliza mecanismos técnicos de autenticación.</p></section>
    </>}
  </LegalPage>
}
