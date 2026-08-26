import { Icon } from './Icon'

/**
 * The marker for anything a model produced rather than a person.
 *
 * Karma is not a star average copied off another site — it is the output of a
 * sentiment pass over everything publicly said about a business. That
 * distinction is the whole reason the number is worth anything, so it gets a
 * mark of its own and the mark is used everywhere Karma is, at three sizes:
 *
 *   sm   inline beside a number, no words
 *   md   a labelled pill above a panel
 *   lg   a section heading eyebrow
 *
 * It is deliberately never used on the AIVIDI Score. That one is arithmetic
 * over fields we can point at, and dressing it as AI would be a lie about
 * where it comes from.
 */
export function AiTag({
  size = 'md',
  label = 'AI анализа на сентимент',
}: {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}) {
  if (size === 'sm') {
    return (
      <span className="ai-tag ai-sm" title={label} aria-label={label}>
        <Icon name="sparkle" size={13} />
      </span>
    )
  }

  return (
    <span className={`ai-tag ai-${size}`}>
      <Icon name="sparkle" size={size === 'lg' ? 16 : 14} />
      <span>{label}</span>
    </span>
  )
}
