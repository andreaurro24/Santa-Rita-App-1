import { useEffect, useLayoutEffect, useRef } from 'react';

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Comportamiento de diálogo modal accesible (verificación 002, hallazgo Medio):
// - al abrir, el foco entra al diálogo (o se respeta un autoFocus de adentro);
// - Tab y Shift+Tab no salen del diálogo;
// - Escape lo cierra;
// - al cerrar, el foco vuelve al control que lo abrió;
// - el fondo no se desplaza mientras está abierto.
// Spec 024: puede haber un diálogo encima de otro (el recortador de fotos sobre el formulario);
// solo el de arriba responde al teclado.
const abiertos = [];

export default function useDialogo(onClose) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialogo = ref.current;
    const anterior = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (dialogo && !dialogo.contains(document.activeElement)) {
      // Primero el contenido (el primer campo), luego el pie (los botones), y si no hay nada, el
      // propio diálogo. Así el botón "Cerrar" de la cabecera no se lleva el foco inicial.
      const primero =
        dialogo.querySelector(`[data-dialogo-cuerpo] :is(${ENFOCABLES})`) ??
        dialogo.querySelector(`[data-dialogo-pie] :is(${ENFOCABLES})`) ??
        dialogo.querySelector(ENFOCABLES) ??
        dialogo;
      primero.focus();
    }

    abiertos.push(dialogo);

    function onKey(e) {
      if (abiertos.at(-1) !== dialogo) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogo) return;
      const enfocables = [...dialogo.querySelectorAll(ENFOCABLES)].filter((el) => el.offsetParent !== null);
      if (!enfocables.length) return;
      const primero = enfocables[0];
      const ultimo = enfocables.at(-1);
      if (e.shiftKey && (document.activeElement === primero || !dialogo.contains(document.activeElement))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (document.activeElement === ultimo || !dialogo.contains(document.activeElement))) {
        e.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      abiertos.splice(abiertos.lastIndexOf(dialogo), 1);
      document.body.style.overflow = overflow;
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, []);

  return ref;
}
