import ReactSelect, { type MultiValue } from 'react-select'

export type MultiSelectOption = {
  value: string
  label: string
}

type MultiSelectProps = {
  label?: string
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  error?: string
  hint?: string
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'انتخاب کنید...',
  emptyText = 'موردی برای انتخاب نیست',
  disabled = false,
  error,
  hint,
}: MultiSelectProps) {
  const selected = options.filter((opt) => value.includes(opt.value))

  return (
    <div className="rs-field flex flex-col gap-1.5 text-sm">
      {label ? <span className="font-medium text-heading">{label}</span> : null}
      <ReactSelect
        isMulti
        isRtl
        classNamePrefix="rs"
        className={`rs-root ${error ? 'rs-root--error' : ''}`}
        options={options}
        value={selected}
        isDisabled={disabled}
        placeholder={placeholder}
        closeMenuOnSelect={false}
        hideSelectedOptions
        aria-invalid={error ? true : undefined}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        menuShouldScrollIntoView={false}
        styles={{
          menuPortal: (base) => ({ ...base, zIndex: 80 }),
        }}
        onChange={(opts: MultiValue<MultiSelectOption>) => {
          const next = opts
            .map((o) => o.value)
            .filter((id) => options.some((opt) => opt.value === id))
          onChange(next)
        }}
        noOptionsMessage={() => emptyText}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {!error && hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  )
}
