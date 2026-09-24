// Usuarios de demostración para el MVP (login simple, sin backend).
// En un sistema real esto viviría en un backend con contraseñas cifradas;
// aquí se simula únicamente para diferenciar las dos vistas de rol pedidas
// en el Project Charter (dueño vs. administrador operativo).
export const USERS = [
  {
    id: 'miguel-angel',
    nombre: 'Miguel Ángel Lacouture',
    rol: 'dueno',
    rolLabel: 'Dueño / Decisión de venta',
    usuario: 'miguel',
    password: 'santarita2026',
    descripcion:
      'Propietario encargado de la compra-venta del ganado. Usuario principal del módulo de recomendación de venta.',
  },
  {
    id: 'administrador',
    nombre: 'Administrador de la finca',
    rol: 'administrador',
    rolLabel: 'Administrador operativo',
    usuario: 'admin',
    password: 'finca2026',
    descripcion:
      'Vive en la finca y dirige el día a día del hato. Usuario principal del registro de trazabilidad (peso, sanidad, movimientos).',
  },
];
