import { useRef, useState } from 'react';
import { entradaPesosInvalida, numeroAPesos } from '../../utils/validar';

// Spec 018 · R1: campo de dinero con puntos de miles en vivo ("1000000" → "1.000.000").
// `value` es el texto con puntos; quien lo usa lo convierte con pesosANumero al guardar.
// El cursor se mantiene después del mismo dígito aunque se agreguen o quiten puntos.
export default function CampoPesos({ value, onChange, className = '', ...props }) {
  const ref = useRef(null);
  const [aviso, setAviso] = useState('');

  function manejar(e) {
    const el = e.target;
    if (entradaPesosInvalida(el.value, value)) {
      setAviso('Solo pesos enteros: sin centavos, signos ni letras.');
      return; // React vuelve a mostrar el valor anterior
    }
    setAviso('');
    const cursor = el.selectionStart ?? el.value.length;
    const digitosAntes = el.value.slice(0, cursor).replace(/\D/g, '').length;
    const nuevo = numeroAPesos(el.value);
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
