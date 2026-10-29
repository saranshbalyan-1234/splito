// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/AppLanguageDropdown.tsx
import {useLingui} from '@lingui/react/macro'

import {APP_LANGUAGES, appLanguageName} from '#/locale/languages'
import {useAppLanguage} from '#/state/preferences/language'
import {atoms as a, platform, useTheme, web} from '#/alf'
import * as Select from '#/components/Select'
import {Button, ButtonIcon} from './Button'
import {Earth_Stroke2_Corner2_Rounded as EarthIcon} from './icons/Globe'

/**
 * Bluesky's app language dropdown: a ghost button with a globe, the current
 * language and a chevron, opening a dropdown on web and a sheet on phones.
 * It writes the `language` preference (what Settings > Language edits), which
 * `LocaleFromPrefs` activates without a reload. It is always shown where
 * Bluesky shows it: the web splash, sign-up and the desktop right column
 * (owner 128).
 */
export function AppLanguageDropdown() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {language, setLanguage} = useAppLanguage()

  return (
    <Select.Root
      value={language}
      onValueChange={value => {
        if (value !== language && APP_LANGUAGES.some(x => x.code2 === value))
          void setLanguage(value as typeof language)
      }}>
      <Select.Trigger
        label={l`App language, current: ${appLanguageName(language)}`}>
        {({props}) => (
          <Button
            {...props}
            testID="app-language"
            label={props.accessibilityLabel}
            size={platform({
              web: 'tiny',
              native: 'small',
            })}
            variant="ghost"
            color="secondary"
            shape="rectangular"
            style={[
              a.pr_xs,
              a.pl_sm,
              platform({
                web: [{alignSelf: 'flex-start'}, a.gap_sm],
                native: [a.gap_xs],
              }),
            ]}>
            <ButtonIcon icon={EarthIcon} size="md" />
            <Select.ValueText
              placeholder={l`Select an app language`}
              style={[t.atoms.text_contrast_medium]}
            />
            <Select.Icon style={[t.atoms.text_contrast_medium]} />
          </Button>
        )}
      </Select.Trigger>
      <Select.Content
        label={l`Select language`}
        renderItem={({label, value}) => (
          <Select.Item
            value={value}
            label={label}
            testID={`app-language-${value}`}
            style={web([a.pointer])}>
            <Select.ItemIndicator />
            <Select.ItemText>{label}</Select.ItemText>
          </Select.Item>
        )}
        items={APP_LANGUAGES.map(x => ({label: x.name, value: x.code2}))}
      />
    </Select.Root>
  )
}
