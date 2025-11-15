import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Prueba E2E: Descarga de gráfica en formato Excel
 *
 * Esta prueba verifica el flujo completo de:
 * 1. Login con credenciales válidas
 * 2. Navegación a la página de sensores
 * 3. Selección de estación
 * 4. Selección de rango de fechas
 * 5. Descarga de archivo Excel
 * 6. Validación de contenido del archivo
 */

test.describe('Descarga de gráfica en Excel', () => {
  // URL base de la API
  const API_URL = 'http://localhost:2002/api';

  // Credenciales de prueba
  const credenciales = {
    identifier: 'admin@opws.test',
    password: 'admin123'
  };

  test.beforeEach(async ({ page }) => {
    // Limpiar localStorage antes de cada prueba
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('Debe descargar archivo Excel con datos de sensores válidos', async ({ page }) => {
    // ============================================
    // PASO 1: Login con credenciales válidas
    // ============================================
    console.log('📝 Paso 1: Realizando login...');

    await page.goto('/login');

    // Esperar a que el formulario de login esté visible
    await expect(page.locator('#identifier')).toBeVisible();

    // Llenar formulario de login
    await page.fill('#identifier', credenciales.identifier);
    await page.fill('#password', credenciales.password);

    // Click en botón de login
    await page.click('button[type="submit"]');

    // Esperar a que se complete el login y se redirija
    await page.waitForURL(/\/panel|\/sensores/, { timeout: 10000 });

    // Verificar que el token se guardó en localStorage
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();
    console.log('✅ Login exitoso');

    // ============================================
    // PASO 2: Navegar a /sensores
    // ============================================
    console.log('📝 Paso 2: Navegando a /sensores...');

    await page.goto('/sensores');

    // Verificar que estamos en la página correcta
    await expect(page).toHaveURL(/\/sensores/);

    // Esperar a que cargue el contenido de la página
    await page.waitForSelector('select', { timeout: 10000 });
    console.log('✅ Navegación a /sensores exitosa');

    // ============================================
    // PASO 3: Seleccionar una estación
    // ============================================
    console.log('📝 Paso 3: Seleccionando estación...');

    // Esperar a que el select de estaciones esté disponible
    const estacionSelect = page.locator('select').first();
    await estacionSelect.waitFor({ state: 'visible' });

    // Obtener las opciones disponibles
    const opciones = await estacionSelect.locator('option').all();

    if (opciones.length > 1) {
      // Seleccionar la primera estación (índice 1, porque 0 es "Seleccionar estación")
      await estacionSelect.selectOption({ index: 1 });
      console.log('✅ Estación seleccionada');
    } else {
      console.log('⚠️  No hay estaciones disponibles, usando valor por defecto');
    }

    // Esperar un momento para que carguen los datos
    await page.waitForTimeout(1000);

    // ============================================
    // PASO 4: Seleccionar rango de fechas
    // ============================================
    console.log('📝 Paso 4: Seleccionando rango de fechas...');

    // Buscar el botón de "7d" (últimos 7 días) que es un preset común
    const preset7d = page.locator('button:has-text("7d")');

    if (await preset7d.isVisible()) {
      await preset7d.click();
      console.log('✅ Rango de 7 días seleccionado');
    } else {
      // Si no existe el preset, buscar "Personalizado"
      const personalizado = page.locator('button:has-text("Personalizado")');

      if (await personalizado.isVisible()) {
        await personalizado.click();

        // Llenar fechas manualmente
        const fechaHoy = new Date();
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaHoy.getDate() - 7);

        const formatoFecha = (fecha: Date) => {
          return fecha.toISOString().split('T')[0];
        };

        // Buscar inputs de tipo date
        const fechaInputs = page.locator('input[type="date"]');
        const count = await fechaInputs.count();

        if (count >= 2) {
          await fechaInputs.nth(0).fill(formatoFecha(fechaInicio));
          await fechaInputs.nth(1).fill(formatoFecha(fechaHoy));
          console.log('✅ Rango personalizado seleccionado');
        }
      }
    }

    // Esperar a que se carguen los datos con el nuevo rango
    await page.waitForTimeout(2000);

    // ============================================
    // PASO 5: Activar al menos un sensor
    // ============================================
    console.log('📝 Paso 5: Activando sensores...');

    // Buscar los chips de sensores (botones toggle)
    const sensorChips = page.locator('button').filter({
      hasText: /rainfall_mm|air_temp_c|air_humidity_pct|soil_moisture_pct|luminosity_lx/
    });

    const chipsCount = await sensorChips.count();

    if (chipsCount > 0) {
      // Activar el primer sensor disponible
      await sensorChips.first().click();
      await page.waitForTimeout(500);
      console.log('✅ Sensor activado');
    }

    // ============================================
    // PASO 6: Descargar archivo Excel
    // ============================================
    console.log('📝 Paso 6: Descargando archivo Excel...');

    // Buscar el botón de exportar
    // Intentamos primero con "Exportar todos (XLSX)"
    let exportButton = page.locator('button:has-text("Exportar todos (XLSX)")');

    if (!(await exportButton.isVisible())) {
      // Si no existe, buscar botón individual con emoji de Excel
      exportButton = page.locator('button:has-text("📊")').first();
    }

    if (!(await exportButton.isVisible())) {
      // Último intento: buscar por texto parcial "Excel"
      exportButton = page.locator('button:has-text("Excel")').first();
    }

    // Esperar la descarga
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    await exportButton.click();
    console.log('✅ Click en botón de descarga');

    const download = await downloadPromise;

    // Verificar que el archivo se descargó
    expect(download).toBeTruthy();
    console.log('✅ Archivo descargado:', download.suggestedFilename());

    // ============================================
    // PASO 7: Validar contenido del archivo
    // ============================================
    console.log('📝 Paso 7: Validando contenido del archivo Excel...');

    // Guardar el archivo descargado
    const downloadPath = path.join(__dirname, '..', '..', '..', 'downloads');

    // Crear directorio si no existe
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    const filePath = path.join(downloadPath, download.suggestedFilename());
    await download.saveAs(filePath);

    console.log('📁 Archivo guardado en:', filePath);

    // Leer el archivo Excel
    const workbook = XLSX.readFile(filePath);

    // Verificar que tiene al menos una hoja
    expect(workbook.SheetNames.length).toBeGreaterThan(0);
    console.log('📊 Hojas encontradas:', workbook.SheetNames);

    // Obtener la primera hoja
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convertir a JSON para validar datos
    const data = XLSX.utils.sheet_to_json(firstSheet);

    // Verificar que hay datos en el archivo
    expect(data.length).toBeGreaterThan(0);
    console.log('✅ Archivo contiene', data.length, 'filas de datos');

    // Verificar que las columnas esperadas existen
    if (data.length > 0) {
      const primeraFila = data[0] as Record<string, unknown>;
      const columnas = Object.keys(primeraFila);

      console.log('📋 Columnas encontradas:', columnas);

      // Verificar que al menos tiene una columna de tiempo/fecha
      const tieneColumnaFecha = columnas.some(col =>
        col.toLowerCase().includes('fecha') ||
        col.toLowerCase().includes('time') ||
        col.toLowerCase().includes('timestamp') ||
        col === 't'
      );

      expect(tieneColumnaFecha).toBeTruthy();
      console.log('✅ Archivo contiene columna de tiempo/fecha');

      // Verificar que hay al menos una columna de valores
      expect(columnas.length).toBeGreaterThan(1);
      console.log('✅ Archivo contiene columnas de datos');
    }

    console.log('✅ ¡Prueba completada exitosamente!');

    // Limpieza: eliminar archivo descargado (opcional)
    // fs.unlinkSync(filePath);
  });

  test('Debe manejar error de login con credenciales inválidas', async ({ page }) => {
    console.log('📝 Prueba: Login con credenciales inválidas');

    await page.goto('/login');

    // Llenar formulario con credenciales incorrectas
    await page.fill('#identifier', 'usuario_inexistente@test.com');
    await page.fill('#password', 'contraseña_incorrecta');

    // Click en botón de login
    await page.click('button[type="submit"]');

    // Esperar a que aparezca un mensaje de error
    // Puede ser un toast, un mensaje, o permanecer en /login
    await page.waitForTimeout(2000);

    // Verificar que NO se guardó token
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeFalsy();

    // Verificar que sigue en la página de login
    await expect(page).toHaveURL(/\/login/);

    console.log('✅ Error de login manejado correctamente');
  });

  test('Debe verificar que la página de sensores requiere autenticación', async ({ page }) => {
    console.log('📝 Prueba: Acceso a /sensores sin autenticación');

    // Intentar acceder directamente sin login
    await page.goto('/sensores');

    // Debe redirigir a login
    await page.waitForURL(/\/login/, { timeout: 5000 });

    await expect(page).toHaveURL(/\/login/);

    console.log('✅ Redirección a login funcionando correctamente');
  });
});
