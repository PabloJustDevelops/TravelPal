// El contrato compartido vive dentro de la función Edge para que el CLI de InsForge pueda empaquetarla:
// copia solo la carpeta de la función, así que un import a `src/lib` rompía el despliegue. Cliente y
// pruebas lo consumen desde aquí.
export * from '../../insforge/functions/travel-inspiration/contract'
