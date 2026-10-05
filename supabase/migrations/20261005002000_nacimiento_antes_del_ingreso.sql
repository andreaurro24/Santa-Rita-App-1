-- Sprint 06 · corrección de la verificación r1 (B1, spec 023 · R8): un animal no puede nacer después
-- de llegar a la finca. Con mes desconocido, la fecha es el 1 de enero del año: también cumple si
-- nació ese año y entró después.
alter table public.animales
  add constraint animales_nacimiento_antes_del_ingreso check (fecha_nacimiento is null or fecha_nacimiento <= fecha_ingreso);
