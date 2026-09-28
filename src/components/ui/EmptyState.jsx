// Estado vacío: dice qué pasa y qué hacer, con una acción opcional.
export default function EmptyState({ titulo, children, accion }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
      <p className="font-semibold text-gray-800">{titulo}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">{children}</p>}
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  );
}
