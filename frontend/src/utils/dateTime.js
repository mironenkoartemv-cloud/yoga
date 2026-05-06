export function toDateTimeLocalValue(value) {
  const date = value instanceof Date ? value : new Date(value)
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function dateTimeLocalToIso(value) {
  return value ? new Date(value).toISOString() : value
}
