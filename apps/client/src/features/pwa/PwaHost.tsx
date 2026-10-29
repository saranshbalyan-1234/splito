import {useEffect, useRef} from 'react'
import {Trans, useLingui} from '@lingui/react/macro'

import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {applyUpdate, hasWorkAtStake, install, usePwa} from '#/lib/pwa'
import {setPwa} from '#/lib/pwa/state'
import {usePref} from '#/data/hooks'
import * as Dialog from '#/components/Dialog'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as UpdateIcon} from '#/components/icons/ArrowRotate'
import {Download_Stroke2_Corner0_Rounded as DownloadIcon} from '#/components/icons/Download'
import * as Prompt from '#/components/Prompt'
import {InstallHelpDialog} from '#/features/pwa/InstallHelpDialog'
import * as Toast from '#/components/Toast'

/** How long after launch the one-time install hint waits, so it never competes with the first screen. */
const HINT_DELAY_MS = 6000

/**
 * Everything the web app says about itself (ARCHITECTURE 26.21, F-1901): the
 * "New version available" toast, the one-time install hint and the "Add to
 * Home Screen" steps. Idle on native, where `usePwa()` never changes.
 */
export function PwaHost() {
  const {t: l} = useLingui()
  const pwa = usePwa()
  const [isHintShown, setHintShown] = usePref('pwa.installHintDismissed')
  const helpControl = Dialog.useDialogControl({url: 'install'})
  const reloadPrompt = Prompt.usePromptControl()
  const isUpdateToasted = useRef(false)
  const isReloadConfirmed = useRef(false)

  /* Persistent until tapped: it never reloads the app by itself. */
  const showUpdateToast = useNonReactiveCallback(() =>
    Toast.show(
      <Toast.Outer>
        <Toast.Icon icon={UpdateIcon} />
        <Toast.Text>
          <Trans>New version available</Trans>
        </Toast.Text>
        <Toast.Action
          testID="update-reload"
          label={l`Reload`}
          onPress={() => {
            if (hasWorkAtStake()) {
              isReloadConfirmed.current = false
              reloadPrompt.open()
            } else applyUpdate()
          }}>
          <Trans>Reload</Trans>
        </Toast.Action>
      </Toast.Outer>,
      {type: 'info', duration: Infinity},
    ),
  )

  /* One-time: remembered as soon as it is shown, whatever the person does with it. */
  const showInstallHint = useNonReactiveCallback(() => {
    void setHintShown(true)
    const isIos = pwa.installKind === 'ios'
    Toast.show(
      <Toast.Outer>
        <Toast.Icon icon={DownloadIcon} />
        <Toast.Text>
          {isIos ? (
            <Trans>
              Safari can erase Splito’s saved data after 7 days away. Add it to
              your Home Screen to keep it.
            </Trans>
          ) : (
            <Trans>Install Splito for quick access, even offline.</Trans>
          )}
        </Toast.Text>
        <Toast.Action
          testID="install-hint-action"
          label={isIos ? l`Show me how` : l`Install`}
          onPress={() => void install()}>
          {isIos ? <Trans>How</Trans> : <Trans>Install</Trans>}
        </Toast.Action>
      </Toast.Outer>,
      {type: 'info', duration: 12_000},
    )
  })

  useEffect(() => {
    if (!pwa.updateReady || isUpdateToasted.current) return
    isUpdateToasted.current = true
    showUpdateToast()
  }, [pwa.updateReady, showUpdateToast])

  useEffect(() => {
    if (pwa.installKind === null || pwa.isStandalone || isHintShown !== false)
      return
    const timer = setTimeout(showInstallHint, HINT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [pwa.installKind, pwa.isStandalone, isHintShown, showInstallHint])

  useEffect(() => {
    if (pwa.isHelpOpen) helpControl.open()
  }, [pwa.isHelpOpen, helpControl])

  return (
    <>
      <InstallHelpDialog
        control={helpControl}
        onClose={() => setPwa({isHelpOpen: false})}
      />
      <Prompt.Basic
        control={reloadPrompt}
        title={l`Reload and lose your changes?`}
        description={l`You have changes that are not saved yet. Reloading now discards them.`}
        confirmButtonCta={l`Reload`}
        confirmButtonColor="negative"
        onConfirm={() => {
          isReloadConfirmed.current = true
          applyUpdate()
        }}
        onClose={() => {
          /* Cancelled: bring the offer back. */
          if (!isReloadConfirmed.current) showUpdateToast()
        }}
      />
    </>
  )
}
