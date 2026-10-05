import { useEffect, useRef, useState } from 'react';
import { entradaPesosInvalida, numeroAPesos, pegadoPesosValido } from '../../utils/validar';

const AVISO = 'Solo pesos enteros: escribe solo números (los puntos de miles se ponen solos) y sin centavos.';

// Spec 018 · R1: campo de dinero con puntos de miles en vivo ("1000000" → "1.000.000").
// `value` es el texto con puntos; quien lo usa lo convierte con pesosANumero al guardar.
// El cursor se mantiene después del mismo dígito aunque se agreguen o quiten puntos.
//
// Verificación Sprint 05 (M1, M1-r2): nunca se convierte un monto en otro número en silencio.
// - Lo que entra de una vez (pegar, autocompletar) solo vale si es un entero bien formado.
// - Un punto o una coma escritos a mano se rechazan, y los dígitos que vengan después también,
//   hasta que se borre algo: así "1.000,50" queda en "1.000" con el aviso, no en "100.050".
export default function CampoPesos({ value, onChange, className = '', ...props }) {
  const ref = useRef(null);
  const [aviso, setAviso] = useState('');
  const bloqueado = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // Evento nativo: el `onBeforeInput` de React no siempre deja cancelar la entrada.
    function antes(e) {
      if (e.inputType?.startsWith('delete')) {
        bloqueado.current = false;
        return;
      }
      const texto = e.data ?? e.dataTransfer?.getData('text') ?? '';
      if (!texto) return;
      const unSoloCaracter = texto.length === 1;
      const valido = unSoloCaracter ? /\d/.test(texto) && !bloqueado.current : pegadoPesosValido(texto);
      if (!valido) {
        e.preventDefault();
        if (unSoloCaracter && /[.,]/.test(texto)) bloqueado.current = true;
        setAviso(AVISO);
      }
    }
    el.addEventListener('beforeinput', antes);
    return () => el.removeEventListener('beforeinput', antes);
  }, []);

  function manejar(e) {
    const el = e.target;
    // Respaldo para cambios que no pasan por `beforeinput`.
    if (entradaPesosInvalida(el.value, value)) {
      setAviso(AVISO);
      return; // React vuelve a mostrar el valor anterior
    }
    if (!bloqueado.current) setAviso('');
    const cursor = el.selectionStart ?? el.value.length;
    const digitosAntes = el.value.slice(0, cursor).replace(/\D/g, '').length;
    const nuevo = numeroAPesos(el.value);
    if (!nuevo) bloqueado.current = false;
    onChange(nuevo);
    requestAnimationFrame(() => {
      if (!ref.current) return;
      let pos = 0;
      let vistos = 0;
      while (pos < nuevo.length && vistos < digitosAntes) {
        if (/\d/.test(nuevo[pos])) vistos += 1;
        pos += 1;
      }
      ref.current.setSelectionRange(pos, pos);
    });
  }

  return (
    <>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-600" aria-hidden="true">
          $
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={manejar}
          aria-invalid={aviso ? true : undefined}
          className={`input pl-7 ${className}`}
          {...props}
        />
      </div>
      {aviso && (
        <span role="status" className="mt-1 block text-sm font-medium text-peligro">
          {aviso}
        </span>
      )}
    </>
  );
}
