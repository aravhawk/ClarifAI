import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RELATIONSHIP_OPTIONS } from '@/lib/constants'

interface RelationshipSelectorProps {
  value: string
  otherValue: string
  onChange: (value: string) => void
  onOtherChange: (value: string) => void
}

export function RelationshipSelector({
  value,
  otherValue,
  onChange,
  onOtherChange,
}: RelationshipSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm text-warm-700">Who is this person to you?</Label>
      <div className="space-y-2">
        <div className="grid gap-2">
          {RELATIONSHIP_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-3 rounded-lg border border-warm-200 bg-white/70 px-3 py-2 text-sm text-warm-700"
            >
              <input
                type="radio"
                name="relationship"
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="h-4 w-4 text-sage-600"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {value === 'other' && (
          <Input
            value={otherValue}
            onChange={(event) => onOtherChange(event.target.value)}
            placeholder="Describe your relationship"
          />
        )}
      </div>
    </div>
  )
}
