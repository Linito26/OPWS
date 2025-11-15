import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para pruebas E2E
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './src/tests/e2e',

  /* Directorio para artefactos de pruebas */
  outputDir: './test-results',

  /* Tiempo máximo de espera por prueba */
  timeout: 60 * 1000,

  /* Configuración de expects */
  expect: {
    timeout: 10000
  },

  /* Fallar si una prueba no tiene expects */
  fullyParallel: true,

  /* No permitir pruebas paralelas */
  workers: 1,

  /* Reporter: usa 'html' para un reporte visual */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  /* Configuración compartida para todos los proyectos */
  use: {
    /* URL base de la aplicación */
    baseURL: 'http://localhost:5173',

    /* Recolectar traces en caso de fallo */
    trace: 'on-first-retry',

    /* Screenshots solo en fallos */
    screenshot: 'only-on-failure',

    /* Video solo en fallos */
    video: 'retain-on-failure',

    /* Configuración de descargas */
    acceptDownloads: true,
  },

  /* Configuración de proyectos para diferentes navegadores */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /* Directorio donde se guardarán las descargas */
        downloadPath: './downloads',
      },
    },
  ],

  /* Configurar servidor web local (opcional - si quieres que Playwright levante el servidor) */
  /*
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  */
});
