import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const NONE = "__none__"

interface Props {
  options: readonly string[]
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  otherPlaceholder?: string
}

/**
 * A Select that, when "Other" is chosen, reveals a text input for free-form detail.
 *
 * Value contract:
 *  - NONE sentinel ("__none__") → nothing selected
 *  - Any predefined option string → shown as-is in the dropdown
 *  - "Other" (literal) → "Other" shown in dropdown, text input is empty
 *  - Any string not in options → "Other" shown in dropdown, text input populated with that string
 *
 * On save the field stores the custom text (not "Other"), so existing data loads correctly.
 */
export function SelectWithOther({
  options,
  value,
  onChange,
  onBlur,
  otherPlaceholder = "Please specify…",
}: Props) {
  const isCustomValue =
    value !== NONE && value !== "" && !options.includes(value)

  const selectDisplayValue = isCustomValue ? "Other" : (value ?? NONE)
  const otherText = isCustomValue ? value : ""
  const showOtherInput = selectDisplayValue === "Other"

  function handleSelectChange(v: string) {
    onChange(v)
  }

  function handleOtherChange(text: string) {
    onChange(text || "Other")
  }

  return (
    <div className="space-y-2">
      <Select value={selectDisplayValue} onValueChange={handleSelectChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="-None-" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>-None-</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showOtherInput && (
        <Input
          placeholder={otherPlaceholder}
          value={otherText}
          onChange={(e) => handleOtherChange(e.target.value)}
          onBlur={onBlur}
          autoFocus
        />
      )}
    </div>
  )
}
