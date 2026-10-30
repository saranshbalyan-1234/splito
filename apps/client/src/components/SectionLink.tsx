import {Link} from '#/view/com/util/Link'
import {atoms as a, useTheme} from '#/alf'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronIcon} from '#/components/icons/Chevron'
import {Text} from '#/components/Typography'

/** "See all ›" / "Analytics ›" on a section heading's right, as Bluesky's section headers link out. */
export function SectionLink({
  testID,
  href,
  label,
  children,
}: {
  testID: string
  href: string
  /** What a screen reader says ("Open Analytics"). */
  label: string
  children: React.ReactNode
}) {
  const t = useTheme()
  return (
    <Link
      testID={testID}
      href={href}
      title={label}
      accessibilityLabel={label}
      asAnchor
      anchorNoUnderline
      accessibilityHint=""
      hoverStyle={t.atoms.bg_contrast_25}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_2xs,
        a.rounded_full,
        a.pl_sm,
        a.pr_xs,
        a.py_xs,
        a.transition_color,
      ]}>
      <Text style={[a.text_sm, a.font_semi_bold, {color: t.palette.primary_500}]}>{children}</Text>
      <ChevronIcon size="sm" fill={t.palette.primary_500} />
    </Link>
  )
}
