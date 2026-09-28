import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';

// Spec 013 · importar el censo desde CSV. Los animales de prueba empiezan por E2E-IMP.

async function limpiar() {
  const supabase = await clientePrueba();
  await supabase.from('animales').delete().like('numero_interno', 'E2E-IMP%');
}
test.beforeEach(limpiar);
test.afterAll(limpiar);

const CSV = [
  'numero_interno;chapeta_ica;sexo;categoria;lote;fecha_ingreso;peso_ingreso_kg;peso_objetivo_kg;costo_compra_cop',
  'E2E-IMP-1;E2E-IMP-CH-1;Macho;novillo;LOTE-2026-A;15/09/2026;210,5;350;1.250.000',
  'E2E-IMP-2;E2E-IMP-CH-2;Hembra;ternera;LOTE-2026-A;2026-09-16;150;260;',
  'E2E-IMP-3;E2E-IMP-CH-3;Hembra;novillo;NO-EXISTE;31/02/2026;0;100;',
  '0101;E2E-IMP-CH-4;Macho;novillo;LOTE-2026-A;15/09/2026;200;300;',
].join('\n');

test('R1–R4: vista previa con errores por fila e importación de las válidas', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto('/#/animales');
  await page.getByRole('link', { name: 'Importar censo' }).click();
  await expect(page.getByRole('heading', { name: 'Importar censo' })).toBeVisible();

  await page.getByLabel('Archivo CSV del censo').setInputFiles({ name: 'censo.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf-8') });
  await expect(page.getByText('2 filas válidas')).toBeVisible();
  await expect(page.getByText('2 con errores')).toBeVisible();
  await expect(page.getByText('No existe el lote NO-EXISTE.')).toBeVisible();
  await expect(page.getByText(/La fecha "31\/02\/2026" no es válida/)).toBeVisible();
  await expect(page.getByText('El número interno 0101 ya existe en el hato.')).toBeVisible();
  await expect(page.getByText(/Se omitirán las 2 filas con errores/)).toBeVisible();

  await page.getByRole('button', { name: 'Importar 2 animales' }).click();
  await expect(page.getByText('Se importaron 2 animales.')).toBeVisible();

  const supabase = await clientePrueba();
  const { data } = await supabase
    .from('animales')
    .select('numero_interno, chapeta_ica, peso_ingreso_kg, costo_compra_cop, pesajes ( peso_kg, fecha )')
    .like('numero_interno', 'E2E-IMP%')
    .order('numero_interno');
  expect(data).toHaveLength(2);
  expect(data[0]).toMatchObject({ chapeta_ica: 'E2E-IMP-CH-1', peso_ingreso_kg: 210.5, costo_compra_cop: 1_250_000 });
  expect(data[0].pesajes).toEqual([{ peso_kg: 210.5, fecha: '2026-09-15' }]);
  expect(data[1].costo_compra_cop).toBeNull();
});

test('R1: un archivo sin las columnas necesarias explica qué falta', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto('/#/animales/importar');
  await page.getByLabel('Archivo CSV del censo').setInputFiles({ name: 'malo.csv', mimeType: 'text/csv', buffer: Buffer.from('numero;nombre\n1;x', 'utf-8') });
  await expect(page.getByRole('alert')).toHaveText(/Faltan columnas/);
});
