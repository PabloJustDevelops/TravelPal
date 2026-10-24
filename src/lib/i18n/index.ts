export const locales = ['es', 'en'] as const
export type Locale = (typeof locales)[number]

export function localePath(locale: Locale, path: string) {
  const cleanPath = path.replace(/^\/(es|en)(?=\/|$)/, '')
  const target = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`
  return target === '/' ? `/${locale}` : `/${locale}${target.replace(/\/$/, '')}`
}

export function resolveLocale(value?: string | null): Locale {
  const normalized = value?.toLowerCase().split(/[-_]/)[0]
  return normalized === 'en' ? 'en' : 'es'
}

export function resolvePreferredLocale(saved?: string | null, browser?: string | null): Locale {
  if (saved && ['es', 'en'].includes(saved.toLowerCase())) return resolveLocale(saved)
  return resolveLocale(browser)
}

export const formatDate = (date: Date, locale: Locale, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-ES', options).format(date)

export const formatNumber = (value: number, locale: Locale, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-ES', options).format(value)

const es = {
  language: 'Idioma', selectLanguage: 'Seleccionar idioma', spanish: 'Español', english: 'English',
  home: 'Inicio', signIn: 'Iniciar sesión', signUp: 'Crear cuenta', legalNotice: 'Aviso legal', privacy: 'Privacidad',
  navFeatures: 'Qué puedes organizar', navHow: 'Cómo funciona', enter: 'Entrar', closeMenu: 'Cerrar menú', openMenu: 'Abrir menú', mobileMenu: 'Menú móvil',
  heroOne: 'Tu viaje,', heroTwo: 'de principio a fin.', heroSubtitle: 'Itinerario, reservas y gastos. En un mismo lugar.', createTrip: 'Crear mi viaje', seeExample: 'Ver un ejemplo', coast: 'Costa mediterránea', coastCaption: 'Un plan, muchos momentos por descubrir.',
  heroIllustrationAlt: 'Ilustración de un viajero siguiendo un camino junto al mar', exampleJourney: 'Viaje de ejemplo', exampleStops: 'Paradas del viaje de ejemplo', arrival: 'Llegada', arrivalSummary: 'Traslado al alojamiento y primer paseo.', arrivalTitle: 'El comienzo, organizado', arrivalDetail: 'Reúne los detalles de transporte y las notas de llegada junto al itinerario.', townWalk: 'Paseo por el pueblo', townSummary: 'Calles con encanto, vistas al mar.', townTitle: 'Cada día, con su recorrido', townDetail: 'Añade actividades al itinerario y consulta qué tienes previsto para cada día.', lodging: 'Alojamiento', lodgingSummary: 'Noche en el centro histórico.', lodgingTitle: 'La reserva, localizada', lodgingDetail: 'Guarda el alojamiento y sus detalles dentro del viaje para encontrarlos cuando los necesites.',
  organize: 'Organiza cada detalle.', featuresIntro: 'Itinerarios, reservas, gastos, tareas, notas y diario de viaje.', plansTitle: 'Un lugar para tus planes', plansBody: 'Consulta las actividades y reservas de cada viaje sin buscar entre notas sueltas.', expensesTitle: 'Los gastos, al día', expensesBody: 'Registra lo que vas gastando y compáralo con el presupuesto del viaje.', memoriesTitle: 'Los recuerdos también cuentan', memoriesBody: 'Escribe en el diario y guarda las fotos que quieras conservar al volver.',
  howTitle: 'Desde la primera idea hasta la vuelta.', step1: 'Crea el viaje', step1Body: 'Elige destino y fechas. Añade las primeras ideas a tus notas.', step2: 'Prepara el recorrido', step2Body: 'Organiza actividades, guarda reservas y apunta lo que falta por hacer.', step3: 'Consulta y recuerda', step3Body: 'Lleva tus planes a mano. Durante el viaje, registra gastos y escribe en el diario.', ctaTitle: 'Empieza por tu próximo destino.', createAccount: 'Crear mi cuenta', footerDescription: 'Un lugar para organizar tus viajes y conservar lo que viviste.', product: 'Producto', project: 'Proyecto', github: 'Repositorio en GitHub', mit: 'Licencia MIT', copyright: 'Código bajo licencia MIT.', aiIllustrations: 'Ilustraciones originales creadas con IA.',
  authStoryLabel: 'Prepara tu próximo viaje', authStoryTitle: 'El viaje empieza mucho antes de salir.', authStoryBody: 'Guarda tus planes. Deja sitio a lo inesperado.', register: 'Registro', signInLabel: 'Inicio de sesión', alreadyAccount: '¿Ya tienes cuenta?', noAccount: '¿Aún no tienes cuenta?', startSession: 'Inicia sesión', createYourAccount: 'Crea tu cuenta', backHome: 'Volver al inicio', travelSpace: 'Tu espacio de viaje', tagline: 'Viajes con todo en su sitio.', fewerTabs: 'Menos pestañas. Más camino.', nextTrip: 'Tu próximo viaje empieza aquí.', tripDescription: 'El itinerario, las reservas y el presupuesto, juntos. Deja espacio para lo que te encuentres por el camino.', authIllustration: 'Ilustración original creada para TravelPal con IA.',
  legalBack: 'Volver al inicio', updated: 'Actualización', legalPendingTitle: 'Información legal pendiente de completar', legalPendingBody: 'Faltan datos de identificación, contacto y revisión. Los marcadores entre corchetes no son un canal válido para ejercer derechos. Este texto aún no es una información legal definitiva.', legalNav: 'Información legal', translationNotice: 'Esta traducción se ofrece únicamente como ayuda. La versión española es la aprobada y prevalece en caso de discrepancia.',
  authPageSignIn: 'Iniciar sesión', authPageSignUp: 'Crear cuenta', forgotTitle: 'Recuperar contraseña', resetTitle: 'Restablecer contraseña', forgotBody: 'Te enviaremos un enlace para que vuelvas a tus planes.', resetBody: 'Elige una nueva contraseña para recuperar el acceso a tus viajes.', loadingForm: 'Cargando formulario...', backSignIn: 'Volver al inicio de sesión',
} as const

const en: Record<keyof typeof es, string> = {
  language: 'Language', selectLanguage: 'Select language', spanish: 'Español', english: 'English',
  home: 'Home', signIn: 'Sign in', signUp: 'Create account', legalNotice: 'Legal notice', privacy: 'Privacy',
  navFeatures: 'What you can organize', navHow: 'How it works', enter: 'Sign in', closeMenu: 'Close menu', openMenu: 'Open menu', mobileMenu: 'Mobile menu',
  heroOne: 'Your trip,', heroTwo: 'from start to finish.', heroSubtitle: 'Itinerary, bookings, and expenses. All in one place.', createTrip: 'Plan my trip', seeExample: 'See an example', coast: 'Mediterranean coast', coastCaption: 'One plan, many moments to discover.',
  heroIllustrationAlt: 'Illustration of a traveler following a path beside the sea', exampleJourney: 'Sample trip', exampleStops: 'Sample trip stops', arrival: 'Arrival', arrivalSummary: 'Transfer to your stay and your first walk.', arrivalTitle: 'A well-planned start', arrivalDetail: 'Keep transport details and arrival notes alongside your itinerary.', townWalk: 'A walk around town', townSummary: 'Charming streets and sea views.', townTitle: 'A plan for every day', townDetail: 'Add activities to your itinerary and see what you have planned each day.', lodging: 'Accommodation', lodgingSummary: 'A night in the historic center.', lodgingTitle: 'Your booking, close at hand', lodgingDetail: 'Save your accommodation and its details in your trip so you can find them when you need them.',
  organize: 'Organize every detail.', featuresIntro: 'Itineraries, bookings, expenses, tasks, notes, and a travel journal.', plansTitle: 'One place for your plans', plansBody: 'See each trip’s activities and bookings without searching through scattered notes.', expensesTitle: 'Stay on top of expenses', expensesBody: 'Track your spending and compare it with your trip budget.', memoriesTitle: 'Make room for memories', memoriesBody: 'Write in your journal and save the photos you want to keep when you get back.',
  howTitle: 'From the first idea to the journey home.', step1: 'Create your trip', step1Body: 'Choose a destination and dates. Add your first ideas to your notes.', step2: 'Plan your itinerary', step2Body: 'Organize activities, save bookings, and note what is left to do.', step3: 'Keep track and remember', step3Body: 'Keep your plans close. Track expenses and write in your journal while you travel.', ctaTitle: 'Start with your next destination.', createAccount: 'Create my account', footerDescription: 'One place to plan your trips and keep the memories.', product: 'Product', project: 'Project', github: 'GitHub repository', mit: 'MIT License', copyright: 'Code released under the MIT License.', aiIllustrations: 'Original AI-generated illustrations.',
  authStoryLabel: 'Get ready for your next trip', authStoryTitle: 'The trip begins long before you leave.', authStoryBody: 'Save your plans. Leave room for the unexpected.', register: 'Sign up', signInLabel: 'Sign in', alreadyAccount: 'Already have an account?', noAccount: 'New to TravelPal?', startSession: 'Sign in', createYourAccount: 'Create an account', backHome: 'Back to home', travelSpace: 'Your travel space', tagline: 'Travel, with everything in its place.', fewerTabs: 'Fewer tabs. More exploring.', nextTrip: 'Your next trip starts here.', tripDescription: 'Your itinerary, bookings, and budget, together. Leave room for whatever you discover along the way.', authIllustration: 'Original illustration created for TravelPal with AI.',
  legalBack: 'Back to home', updated: 'Updated', legalPendingTitle: 'Legal information needs completion', legalPendingBody: 'Identification, contact, and review details are missing. Bracketed placeholders are not a valid way to exercise your rights. This text is not yet final legal information.', legalNav: 'Legal information', translationNotice: 'This translation is provided for convenience only. The approved Spanish version prevails in case of any discrepancy.',
  authPageSignIn: 'Sign in', authPageSignUp: 'Create account', forgotTitle: 'Reset your password', resetTitle: 'Choose a new password', forgotBody: 'We’ll send you a link so you can get back to your plans.', resetBody: 'Choose a new password to regain access to your trips.', loadingForm: 'Loading form...', backSignIn: 'Back to sign in',
}

export const dictionaries = { es, en } as const
export type MessageKey = keyof typeof es
export const translate = (locale: Locale, key: MessageKey) => dictionaries[locale][key]
