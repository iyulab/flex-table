/** `u-date-picker` publishes its calendar state as `:state(open)`. Engines without `:state()` say no. */
export function calendarOpen(picker: Element): boolean {
  try {
    return picker.matches(':state(open)');
  } catch {
    return false;
  }
}
