import RmdpDatePicker, {
  type DateObject,
  type Value,
} from 'react-multi-date-picker'
import persian from 'react-date-object/calendars/persian'
import persian_fa from 'react-date-object/locales/persian_fa'
import { formatJalaliStorage, toWesternDigits } from '../../lib/jalaliDate'

// CJS package under ESM: default import may be the module namespace, not the component.
const DatePickerLib =
  (RmdpDatePicker as unknown as { default?: typeof RmdpDatePicker }).default ??
  RmdpDatePicker

type DatePickerProps = {
  label?: string
  hint?: string
  error?: string
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  name?: string
  className?: string
}

const STORAGE_FORMAT = 'YYYY/MM/DD'

function parseValue(value: string | undefined): Value {
  const raw = (value ?? '').trim()
  if (!raw) return null
  // Accept fa/en digits; library parses with persian calendar
  return toWesternDigits(raw)
}

function toStorage(date: DateObject | null): string {
  if (!date) return ''
  return formatJalaliStorage(date.year, date.month.number, date.day)
}

export function DatePicker({
  label,
  hint,
  error,
  value = '',
  onChange,
  placeholder = '۱۴۰۳/۰۱/۰۱',
  disabled,
  id,
  name,
  className = '',
}: DatePickerProps) {
  const inputId = id ?? name

  return (
    <label className={`rmdp-field flex flex-col gap-1.5 text-sm ${className}`}>
      {label ? <span className="font-medium text-heading">{label}</span> : null}
      <DatePickerLib
        id={inputId}
        name={name}
        value={parseValue(value)}
        onChange={(date: DateObject | null) => {
          onChange?.(toStorage(date))
        }}
        calendar={persian}
        locale={persian_fa}
        format={STORAGE_FORMAT}
        digits={['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']}
        calendarPosition="bottom-right"
        containerClassName="w-full"
        inputClass={`rmdp-input${error ? ' rmdp-input--error' : ''}`}
        placeholder={placeholder}
        disabled={disabled}
        editable
        portal
        zIndex={80}
        aria-invalid={error ? true : undefined}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {!error && hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  )
}
