// Única fuente de datos del responsable. Sustituir los marcadores antes de
// presentar estos textos como información definitiva.
export const legal = {
  TITULAR: 'Pablo Rodríguez Garijo',
  CONTACTO: '[CONTACTO: pendiente de dirección de contacto para ejercer derechos]',
  FECHA_ACTUALIZACION: '[FECHA_ACTUALIZACION: pendiente de revisión del responsable]',
  IDENTIFICACION: '[TITULAR: pendiente de NIF y domicilio de contacto aplicables al aviso legal]',
} as const;

export const legalPending = Object.values(legal).some(value =>
  /\[(TITULAR|CONTACTO|FECHA_ACTUALIZACION):/.test(value),
);
