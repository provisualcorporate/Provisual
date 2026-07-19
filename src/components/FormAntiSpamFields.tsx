/** Campo honeypot oculto — bots preenchem; humanos não veem. */
export default function FormAntiSpamFields({ idPrefix = "pv" }: { idPrefix?: string }) {
  const fieldId = `${idPrefix}-website`;

  return (
    <div className="absolute -left-[9999px] h-px w-px overflow-hidden opacity-0" aria-hidden="true">
      <label htmlFor={fieldId}>Website</label>
      <input
        type="text"
        id={fieldId}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
    </div>
  );
}
