import ReactSelect, { type SingleValue } from 'react-select'
import type { SelectHTMLAttributes } from 'react'

export type SelectOption = { value: string; label: string }

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> & {
  label?: string
  options: SelectOption[]
  value?: string
  onChange?: (event: { target: { value: string; name?: string } }) => void
  error?: string
  hint?: string
  /** When true, enables typing to filter options (react-select combobox). Default false. */
  isSearchable?: boolean
  placeholder?: string
  emptyText?: string
  isClearable?: boolean
}

export function Select({
  label,
  options,
  value,
  onChange,
  className = '',
  name,
  disabled,
  id,
  error,
  hint,
  isSearchable = false,
  placeholder = 'انتخاب کنید...',
  emptyText = 'موردی یافت نشد',
  isClearable = false,
}: SelectProps) {
  const selected = options.find((opt) => opt.value === value) ?? null
  const inputId = id ?? name

  return (
    <div className={`rs-field flex flex-col gap-1.5 text-sm ${className}`}>
      {label ? (
        <label htmlFor={inputId} className="font-medium text-heading">
          {label}
        </label>
      ) : null}
      <ReactSelect
        inputId={inputId}
        classNamePrefix="rs"
        className={`rs-root ${error ? 'rs-root--error' : ''}`}
        options={options}
        value={selected}
        isDisabled={disabled}
        isSearchable={isSearchable}
        isClearable={isClearable}
        isRtl
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        menuShouldScrollIntoView={false}
        styles={{
          menuPortal: (base) => ({ ...base, zIndex: 80 }),
        }}
        onChange={(opt: SingleValue<SelectOption>) => {
          onChange?.({
            target: { value: opt?.value ?? '', name },
          })
        }}
        noOptionsMessage={() => emptyText}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {!error && hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  )
}
