import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");
const THIS_FILE = path.resolve(__filename);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const allFiles = walk(SRC).filter((file) => file !== THIS_FILE);

const sourceFiles = allFiles.filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));

// Ruta relativa con separadores POSIX para que el mismo assert valga en Windows y en la CI.
const relative = (file: string) =>
  path.relative(process.cwd(), file).split(path.sep).join("/");

describe("sistema de diseno: un solo spinner", () => {
  it("existe un unico fichero LoadingSpinner y vive en components/ui", () => {
    const spinners = allFiles
      .filter((file) => path.basename(file) === "LoadingSpinner.tsx")
      .map(relative);

    expect(spinners).toEqual(["src/components/ui/LoadingSpinner.tsx"]);
  });

  it("nadie importa el spinner retirado de components/common", () => {
    const offenders = sourceFiles
      .filter((file) => /common\/LoadingSpinner/.test(readFileSync(file, "utf8")))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it("la animacion de giro solo se declara dentro del componente del spinner", () => {
    const offenders = sourceFiles
      .filter((file) => /animate-spin/.test(readFileSync(file, "utf8")))
      .map(relative);

    expect(offenders).toEqual(["src/components/ui/LoadingSpinner.tsx"]);
  });
});

describe("sistema de diseno: una sola clase de campo", () => {
  it("la clase canonica de los campos solo se declara en fieldStyles", () => {
    const offenders = sourceFiles
      .filter((file) =>
        /focus:ring-accent\/35 focus:border-accent/.test(
          readFileSync(file, "utf8"),
        ),
      )
      .map(relative);

    expect(offenders).toEqual(["src/components/ui/fieldStyles.ts"]);
  });

  it("el componente Input se apoya en la clase compartida", () => {
    const input = readFileSync(
      path.join(SRC, "components", "ui", "Input.tsx"),
      "utf8",
    );

    expect(input).toContain("fieldClassName");
  });
});

describe("sistema de diseno: un solo boton primario", () => {
  it("la combinacion de color del primario solo se declara en la clase compartida", () => {
    const offenders = sourceFiles
      .filter((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .some(
            (line) =>
              line.includes("bg-accent") && line.includes("hover:bg-accent-hover"),
          ),
      )
      .map(relative);

    expect(offenders).toEqual(["src/components/ui/actionStyles.ts"]);
  });

  it("el boton del sistema y los enlaces de accion se apoyan en esa clase", () => {
    const button = readFileSync(
      path.join(SRC, "components", "ui", "Button.tsx"),
      "utf8",
    );
    expect(button).toContain("accentActionClassName");

    // Los enlaces que hacen de boton no reescriben el acento a mano.
    for (const file of [
      "src/components/landing/Hero.tsx",
      "src/components/landing/Navbar.tsx",
    ]) {
      expect(readFileSync(path.join(process.cwd(), file), "utf8")).toContain(
        "accentLinkClassName",
      );
    }
  });

  // Un <button> nativo sigue siendo lo correcto cuando el control no es un boton del sistema:
  // controles de icono con geometria propia, controles segmentados, elementos que una libreria
  // de terceros clona (Menu.Item de headlessui) o disparadores de un input oculto. La lista es
  // explicita para que no pueda crecer sin que alguien lo revise.
  const NATIVE_BUTTON_FILES = [
    "src/app/dashboard/page.tsx",
    "src/app/planning/page.tsx",
    "src/app/settings/page.tsx",
    "src/app/tasks/page.tsx",
    "src/components/auth/ForgotPasswordForm.tsx",
    "src/components/auth/LoginForm.tsx",
    "src/components/auth/RegisterForm.tsx",
    "src/components/auth/ResetPasswordForm.tsx",
    "src/components/budget/BudgetCard.tsx",
    "src/components/calendar/Calendar.tsx",
    "src/components/i18n/LanguageSelect.tsx",
    "src/components/i18n/__tests__/LanguageSelect.test.tsx",
    "src/components/landing/Navbar.tsx",
    "src/components/layout/Navbar.tsx",
    "src/components/layout/TopBar.tsx",
    "src/components/layout/__tests__/Navbar.test.tsx",
    "src/components/notifications/NotificationSystem.tsx",
    "src/components/ui/Button.tsx",
    "src/components/ui/Toast.tsx",
  ];

  it("los botones nativos que quedan estan en una lista explicita y justificada", () => {
    const withNativeButton = sourceFiles
      .filter((file) => /<button/.test(readFileSync(file, "utf8")))
      .map(relative)
      .sort();

    expect(withNativeButton).toEqual([...NATIVE_BUTTON_FILES].sort());
  });
});

describe("sistema de diseno: un solo sistema de iconos", () => {
  it("nadie importa la segunda libreria de iconos", () => {
    const offenders = sourceFiles
      .filter((file) => /from ['"]lucide-react['"]/.test(readFileSync(file, "utf8")))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  // Unico resto permitido: el prefijo de un mensaje de error por consola en la validacion de
  // entorno del servidor. No es un icono de interfaz.
  const EMOJI_ALLOWLIST = ["src/lib/public-env.ts"];

  it("no quedan emoji haciendo de icono", () => {
    const emoji =
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

    const offenders = sourceFiles
      .filter((file) => emoji.test(readFileSync(file, "utf8")))
      .map(relative);

    expect(offenders).toEqual(EMOJI_ALLOWLIST);
  });
});

describe("sistema de diseno: movimiento y tipografia", () => {
  const css = readFileSync(path.join(SRC, "app", "globals.css"), "utf8");
  const layout = readFileSync(path.join(SRC, "app", "layout.tsx"), "utf8");

  it("no queda una transicion global a 300ms", () => {
    expect(css).not.toMatch(/transition-duration:\s*300ms/);
    expect(css).not.toMatch(/transition-property:/);
  });

  it("la preferencia de movimiento reducido del sistema se respeta", () => {
    expect(css).toContain("prefers-reduced-motion");
  });

  it("la tipografia se declara en un unico sitio", () => {
    // globals.css no impone familia: la define next/font en layout.tsx.
    expect(css).not.toContain("font-family");
    expect(layout.match(/next\/font\/google/g) ?? []).toHaveLength(1);
    expect(layout).toContain("inter.className");
  });
});

// El rumbo "cuaderno de viaje" es un contrato, no una preferencia: la paleta vive en tokens y
// los componentes compartidos piden color por nombre, no por escala cruda de tailwind. Asi el
// cambio de acento o de papel se hace en un sitio y no hay que repintar pantalla por pantalla.
describe("sistema de diseno: el rumbo en tokens", () => {
  const css = readFileSync(path.join(SRC, "app", "globals.css"), "utf8");
  const layout = readFileSync(path.join(SRC, "app", "layout.tsx"), "utf8");

  const TOKEN_FILES = [
    "src/components/ui/actionStyles.ts",
    "src/components/ui/Button.tsx",
    "src/components/ui/Card.tsx",
    "src/components/ui/EmptyState.tsx",
    "src/components/ui/ErrorState.tsx",
    "src/components/ui/Input.tsx",
    "src/components/ui/LoadingSpinner.tsx",
    "src/components/ui/Modal.tsx",
    "src/components/ui/PageSkeleton.tsx",
    "src/components/ui/PageTitle.tsx",
    "src/components/ui/Toast.tsx",
    "src/components/ui/fieldStyles.ts",
  ];

  it("el papel, la tinta, la linea y el acento se declaran como tokens en claro y en oscuro", () => {
    for (const token of [
      "--paper",
      "--surface",
      "--ink",
      "--muted",
      "--line",
      "--accent",
    ]) {
      expect(css).toContain(`${token}:`);
    }

    // La paleta oscura existe de verdad: no es un juego de valores a medias.
    expect(css).toMatch(/\.dark\s*\{[\s\S]*?--paper:/);
  });

  it("el modo oscuro se declara tambien a nivel de plataforma", () => {
    // Los controles nativos (selects, scrollbars) tienen que seguir el modo elegido.
    expect(css).toContain("color-scheme: light");
    expect(css).toContain("color-scheme: dark");
  });

  it("el tema se aplica antes del primer pintado, sin parpadeo", () => {
    expect(layout).toContain("themeInitScript");
  });

  it("la serif de titulares se resuelve por variable, sin un segundo import de fuentes", () => {
    expect(css).toContain("--font-serif: var(--font-fraunces)");
    expect(layout).toContain("--font-fraunces");
  });

  it("los componentes compartidos no vuelven a la escala cruda de tailwind", () => {
    const rawPalette =
      /(bg|text|border|ring|divide)-(gray|blue|red|green|yellow|indigo|purple|pink|orange|emerald|sky)-[0-9]{2,3}/;

    const offenders = TOKEN_FILES.filter((file) =>
      readFileSync(path.join(process.cwd(), file), "utf8")
        .split("\n")
        .some((line) => rawPalette.test(line)),
    );

    expect(offenders).toEqual([]);
  });
});
