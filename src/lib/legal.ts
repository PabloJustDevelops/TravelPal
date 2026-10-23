// Única fuente de datos del responsable. Si vuelves a dejar marcadores, el
// aviso de «información pendiente» reaparece solo en las páginas legales.
export const legal = {
  TITULAR: 'Pablo Rodríguez Garijo',
  CONTACTO: 'pabloroga6@gmail.com',
  FECHA_ACTUALIZACION: '23 de octubre de 2026',
  // Persona física, sin actividad mercantil: sin NIF ni domicilio público. Si el
  // proyecto pasa a facturar, hay que añadirlos aquí (LSSI, art. 10).
  IDENTIFICACION: 'Pablo Rodríguez Garijo, Albacete (España)',
} as const;

export const legalPending = Object.values(legal).some(value =>
  /\[(TITULAR|CONTACTO|FECHA_ACTUALIZACION|IDENTIFICACION):/.test(value),
);
