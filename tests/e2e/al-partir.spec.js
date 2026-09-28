import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';

// Spec 007 · "Al partir". El contrato de prueba se reconoce por su precio del animal.

const PRECIO_MARCA = 1234567;
const MOTIVO = 'E2E asignación Al partir';

async function limpiar() {
  const supabase = await clientePrueba();
  const { data: contratos } = await supabase.from('contratos_al_partir').select('id').eq('precio_animal_cop', PRECIO_MARCA);
  for (const c of contratos ?? []) {
    const { data: visitas } = await supabase.from('visitas_verificacion').select('id, revisiones:visita_animales ( pesaje_id )').eq('contrato_id', c.id);
    for (const v of visitas ?? []) {
      const pesajes = v.revisiones.map((r) => r.pesaje_id).filter(Boolean);
      await supabase.from('visitas_verificacion').delete().eq('id', v.id);
      if (pesajes.length) await supabase.from('pesajes').delete().in('id', pesajes);
    }
    const { data: movs } = await supabase.from('movimientos').select('id, animal_id, desde_finca_id, desde_potrero_id').eq('motivo', MOTIVO);
    for (const m of movs ?? []) {
      await supabase.from('animales').update({ contrato_id: null, finca_id: m.desde_finca_id, potrero_id: m.desde_potrero_id }).eq('id', m.animal_id);
      await supabase.from('movimientos').delete().eq('id', m.id);
    }
    await supabase.from('contratos_al_partir').delete().eq('id', c.id);
  }
}
test.beforeAll(limpiar);
test.afterAll(limpiar);

test('R2–R6: contrato nuevo, asignar 2 animales, visita con un peso y un no encontrado', async ({ page }) => {
  const supabase = await clientePrueba();
  await iniciarSesion(page);
  await page.goto('/#/al-partir');
  await expect(page.getByRole('heading', { name: 'Al partir' })).toBeVisible();

  await page.getByRole('button', { name: 'Nuevo contrato' }).click();
  const hoja = page.getByRole('dialog', { name: 'Nuevo contrato' });
  await hoja.getByLabel('Tenedor').selectOption({ label: 'Wilson Brito' });
  await hoja.getByLabel('Porcentaje de la ganancia neta (%)').fill('45');
  await hoja.getByLabel('Precio del animal (COP)').fill(String(PRECIO_MARCA));
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Wilson Brito' })).toBeVisible();
  await expect(page.getByText('Este contrato no tiene animales')).toBeVisible();

  // Dos animales propios de Santa Rita
  const { data: propios } = await supabase.from('animales').select('id, numero_interno').is('contrato_id', null).eq('estado', 'activo').order('numero_interno').limit(2);
  await page.getByRole('button', { name: 'Asignar animales' }).click();
  const asignar = page.getByRole('dialog', { name: /Asignar animales/ });
  for (const a of propios) await asignar.getByRole('checkbox', { name: `Asignar ${a.numero_interno}` }).check();
  await asignar.getByLabel('Motivo').fill(MOTIVO);
  await asignar.getByRole('button', { name: 'Asignar (2)' }).click();
  await expect(asignar).toHaveCount(0);
  await expect(page.getByText('Animales (2)')).toBeVisible();

  const { data: movidos } = await supabase.from('animales').select('finca:fincas ( nombre )').in('id', propios.map((a) => a.id));
  expect(movidos.map((m) => m.finca.nombre)).toEqual(['Finca Buenavista', 'Finca Buenavista']);
  const { count } = await supabase.from('movimientos').select('id', { count: 'exact', head: true }).eq('motivo', MOTIVO);
  expect(count).toBe(2);

  // Visita: el primero pesado, el segundo no encontrado
  await page.getByRole('button', { name: 'Registrar visita' }).click();
  const visita = page.getByRole('dialog', { name: 'Registrar visita de verificación' });
  await visita.getByLabel(`Peso de ${propios[0].numero_interno} (kg)`).fill('333,3');
  await visita.getByRole('listitem').filter({ hasText: propios[1].numero_interno }).getByLabel('No encontrado').check();
  await visita.getByRole('button', { name: 'Guardar visita' }).click();
  await expect(visita).toHaveCount(0);
  await expect(page.getByText(/1 pesados, 1 no encontrados/)).toBeVisible();
  await expect(page.getByText(`${propios[0].numero_interno}: 333.3 kg`)).toBeVisible();

  // En la ficha: el peso de la visita y el movimiento a la finca del tenedor
  await page.goto(`/#/animales/${propios[0].id}`);
  await expect(page.getByText('333.3 kg', { exact: true }).first()).toBeVisible();
  await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ubicación' }) })).toContainText(MOTIVO);
});

test('R7: un contrato terminado no acepta animales (interfaz y base de datos)', async ({ page }) => {
  const supabase = await clientePrueba();
  const { data: tenedor } = await supabase.from('tenedores').select('id').eq('nombre', 'Wilson Brito').single();
  const { data: c } = await supabase
    .from('contratos_al_partir')
    .insert({ tenedor_id: tenedor.id, porcentaje_ganancia: 50, precio_animal_cop: PRECIO_MARCA, estado: 'terminado' })
    .select('id')
    .single();
  await iniciarSesion(page);
  await page.goto(`/#/al-partir/${c.id}`);
  await expect(page.getByText(/Contrato terminado/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Asignar animales' })).toHaveCount(0);

  const { data: a } = await supabase.from('animales').select('id').is('contrato_id', null).eq('estado', 'activo').limit(1).single();
  const rpc = await supabase.rpc('asignar_a_contrato', { ids: [a.id], contrato: c.id, fecha: '2026-09-01', motivo: MOTIVO });
  expect(rpc.error?.message).toMatch(/^contrato_terminado/);
  const directo = await supabase.from('animales').update({ contrato_id: c.id }).eq('id', a.id);
  expect(directo.error?.message).toMatch(/^contrato_terminado/);
});

test('la visita rechaza animales que no son del contrato', async () => {
  const supabase = await clientePrueba();
  const { data: contratos } = await supabase.from('contratos_al_partir').select('id').eq('estado', 'vigente').limit(1);
  const { data: a } = await supabase.from('animales').select('id').is('contrato_id', null).limit(1).single();
  const r = await supabase.rpc('registrar_visita', { contrato: contratos[0].id, fecha: '2026-09-01', notas: null, revisiones: [{ animal_id: a.id, peso_kg: 300 }] });
  expect(r.error?.message).toMatch(/^animal_fuera_del_contrato/);
  const { count } = await supabase.from('visitas_verificacion').select('id', { count: 'exact', head: true }).eq('contrato_id', contratos[0].id);
  expect(count).toBe(0);
});
