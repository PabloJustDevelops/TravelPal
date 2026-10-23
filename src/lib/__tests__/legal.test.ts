import { legal, legalPending } from '@/lib/legal';

describe('datos del responsable en las páginas legales', () => {
  it('no deja marcadores entre corchetes en los textos publicados', () => {
    expect(legalPending).toBe(false);
    const problemáticos = Object.entries(legal)
      .filter(([, value]) => !value.trim() || /[[\]]/.test(value))
      .map(([key]) => key);
    expect(problemáticos).toEqual([]);
  });

  it('publica un canal de contacto utilizable para ejercer derechos', () => {
    expect(legal.CONTACTO).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(legal.FECHA_ACTUALIZACION).toMatch(/\d{4}/);
    expect(legal.TITULAR.length).toBeGreaterThan(3);
  });
});
