import {useState} from 'react'
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {DomainError} from '@splito/domain'
import {
  applyBackup,
  type BackupFile,
  type BackupPreview,
  createBackup,
  type EntityType,
  parseBackup,
  previewBackup,
  type RestoreMode,
  serializeBackup,
} from '@splito/sync'

import {pickTextFile} from '#/lib/export/pickFile'
import {saveFile} from '#/lib/export/saveFile'
import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useMutationCtx, useStore} from '#/data/hooks'
import {useToday} from '#/locale/useDates'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import {Restore_Stroke2_Corner0_Rounded as RestoreIcon, Upload_Stroke2_Corner0_Rounded as UploadIcon} from '#/components/icons/Export'
import {Warning_Stroke2_Corner0_Rounded as WarningIcon} from '#/components/icons/Warning'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/** The sheet for Settings > Import: `open()` and the element to render once. */
export function useImportSheet() {
  const control = Dialog.useDialogControl({url: 'import'})
  return {open: control.open, element: <ImportSheet control={control} />}
}

export function ImportSheet({control}: {control: Dialog.DialogControlProps}) {
  return (
    <FormSheet.Outer control={control} testID="import-sheet">
      <Body />
    </FormSheet.Outer>
  )
}

type Loaded = {name: string; file: BackupFile}

function Body() {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const [loaded, setLoaded] = useState<Loaded>()
  const [mode, setMode] = useState<RestoreMode>('merge')
  const [preview, setPreview] = useState<BackupPreview>()
  const [error, setError] = useState<string>()
  const [isBusy, setIsBusy] = useState(false)
  const replaceControl = Prompt.usePromptControl()
  const skipControl = Prompt.usePromptControl()
  const today = useToday()
  /* Replace needs a copy of this device first: saved, or skipped on a second confirm. */
  const [copy, setCopy] = useState<'none' | 'saved' | 'skipped'>('none')

  const explain = (e: unknown) => {
    const code = e instanceof DomainError ? e.code : ''
    if (code === 'BACKUP_TOO_NEW') return l`This backup was made by a newer version of Splito. Update the app, then try again.`
    if (code === 'GROUP_INACTIVE') return l`This backup would add expenses to a group that is no longer active on this device, so it can’t be restored over it. Reactivate the group first.`
    if (code === 'BACKUP_TOO_OLD') return l`This backup was made by an older version of Splito that this version can’t read yet.`
    if (code === 'BACKUP_CORRUPT') return l`This file is damaged or was changed after it was saved, so Splito won’t use it.`
    if (code === 'BACKUP_BROKEN_REFERENCE') return l`This backup mentions people or groups it doesn’t contain, so it can’t be added to what is on this device.`
    if (code.startsWith('BACKUP_')) return l`This isn’t a Splito backup file.`
    logger.error(e, {where: 'ImportSheet'})
    return l`Couldn’t read this file.`
  }

  const refresh = async (file: BackupFile, next: RestoreMode) => {
    try {
      setPreview(await previewBackup(store, ctx, file, next))
      setError(undefined)
    } catch (e) {
      setPreview(undefined)
      setError(explain(e))
    }
  }

  const choose = async () => {
    setIsBusy(true)
    try {
      const picked = await pickTextFile()
      if (!picked) return
      setLoaded(undefined)
      setPreview(undefined)
      setError(undefined)
      let file: BackupFile
      try {
        file = parseBackup(picked.text)
      } catch (e) {
        setError(explain(e))
        return
      }
      setLoaded({name: picked.name, file})
      await refresh(file, mode)
    } finally {
      setIsBusy(false)
    }
  }

  const saveCopy = async () => {
    setIsBusy(true)
    try {
      const file = await createBackup(store, ctx)
      if (await saveFile(`splito-before-restore-${today}.json`, 'application/json', serializeBackup(file))) setCopy('saved')
      else Toast.show(l`Couldn’t save a copy here. Try again, or skip it.`, {type: 'error'})
    } catch (e) {
      logger.error(e, {where: 'ImportSheet.saveCopy'})
      Toast.show(l`Couldn’t save a copy. Nothing was changed.`, {type: 'error'})
    } finally {
      setIsBusy(false)
    }
  }

  const apply = async () => {
    if (!loaded) return
    setIsBusy(true)
    try {
      // Kept in memory for this session so a Replace can be undone from the toast.
      const before = mode === 'replace' ? await createBackup(store, ctx) : null
      const done = await applyBackup(store, ctx, loaded.file, mode)
      haptics.success()
      const touched = done.added + done.overwritten
      control.close(() =>
        Toast.show(
          <Toast.Outer>
            <Toast.Icon />
            <Toast.Text>
              {touched + done.removed === 0 ? <Trans>Everything in the backup was already here</Trans> : <Trans>Restored: {touched} added or updated, {done.removed} removed</Trans>}
            </Toast.Text>
            {before && touched + done.removed > 0 ? (
              <Toast.Action
                label={l`Undo`}
                onPress={() =>
                  void applyBackup(store, ctx, before, 'replace').then(
                    () => Toast.show(l`Restored what was here before`, {type: 'success'}),
                    e => {
                      logger.error(e, {where: 'ImportSheet.undo'})
                      Toast.show(l`Couldn’t undo. The copy you saved can restore it.`, {type: 'error'})
                    },
                  )
                }>
                <Trans>Undo</Trans>
              </Toast.Action>
            ) : null}
          </Toast.Outer>,
        ),
      )
    } catch (e) {
      haptics.error()
      setError(explain(e))
      setIsBusy(false)
    }
  }

  const changes = preview ? preview.add + preview.overwrite + preview.remove : 0
  const label: Record<string, string> = {
    person: l`People`,
    group: l`Groups`,
    expense: l`Expenses`,
    repayment: l`Payments`,
    writeoff: l`Call it even`,
  }
  const main = Object.keys(label) as EntityType[]
  const other = preview
    ? (Object.keys(preview.counts) as EntityType[])
        .filter(k => !main.includes(k))
        .reduce((sum, k) => ({add: sum.add + preview.counts[k].add, overwrite: sum.overwrite + preview.counts[k].overwrite, remove: sum.remove + preview.counts[k].remove}), {add: 0, overwrite: 0, remove: 0})
    : undefined

  return (
    <FormSheet.Inner
      title={l`Import a backup`}
      footer={{
        saveLabel: loaded ? l`Restore` : l`Choose file`,
        canSave: !isBusy && (!loaded || (changes > 0 && (mode !== 'replace' || copy !== 'none'))),
        onSave: () => (loaded ? (mode === 'replace' ? replaceControl.open() : void apply()) : void choose()),
      }}>
      <View style={[a.gap_xl]}>
        {!loaded && (
          <View style={[a.gap_md]}>
            <View style={[a.flex_row, a.gap_md, a.align_start]}>
              <RestoreIcon size="md" fill={t.palette.primary_500} />
              <Text style={[a.flex_1, a.text_md, a.leading_snug]}>
                <Trans>Pick a backup file saved by Splito. You see what it will change before anything is restored.</Trans>
              </Text>
            </View>
            <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>Nothing leaves your device. A file that is damaged or from a newer version is refused and nothing changes.</Trans>
            </Text>
          </View>
        )}

        {error && (
          <View testID="import-error" style={[a.flex_row, a.gap_md, a.align_start, a.p_md, a.rounded_md, {backgroundColor: t.palette.negative_50}]}>
            <WarningIcon size="md" fill={t.palette.negative_500} />
            <View style={[a.flex_1, a.gap_xs]}>
              <Text style={[a.text_md, a.leading_snug, a.font_semi_bold, {color: t.palette.negative_700}]}>{error}</Text>
              <Text style={[a.text_sm, {color: t.palette.negative_700}]}>
                <Trans>Nothing was changed.</Trans>
              </Text>
            </View>
          </View>
        )}
        {error && !loaded && (
          <Button testID="import-choose-again" label={l`Choose another file`} size="small" color="secondary" onPress={() => void choose()}>
            <ButtonIcon icon={UploadIcon} />
            <ButtonText><Trans>Choose another file</Trans></ButtonText>
          </Button>
        )}

        {loaded && (
          <View style={[a.gap_lg]}>
            <View testID="import-summary" style={[a.gap_xs]}>
              <Text numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>{loaded.name}</Text>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Saved {i18n.date(new Date(loaded.file.exportedAt), {dateStyle: 'medium', timeStyle: 'short'})}</Trans>
              </Text>
              {preview?.foreignIdentity && (
                <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
                  <Trans>Made on another device: your side of every expense is matched to you here.</Trans>
                </Text>
              )}
            </View>

            <SegmentedControl.Root type="radio" label={l`How to restore`} value={mode} onChange={v => { setMode(v as RestoreMode); void refresh(loaded.file, v as RestoreMode) }}>
              <SegmentedControl.Item testID="import-mode-merge" label={l`Merge`} value="merge">
                <SegmentedControl.ItemText><Trans>Merge</Trans></SegmentedControl.ItemText>
              </SegmentedControl.Item>
              <SegmentedControl.Item testID="import-mode-replace" label={l`Replace`} value="replace">
                <SegmentedControl.ItemText><Trans>Replace</Trans></SegmentedControl.ItemText>
              </SegmentedControl.Item>
            </SegmentedControl.Root>
            <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {mode === 'merge' ? (
                <Trans>Adds what is missing here and keeps what you have. If both have a record, the one changed last wins.</Trans>
              ) : (
                <Trans>Makes this device match the file. Anything here that the file doesn’t have is removed (its history is kept).</Trans>
              )}
            </Text>

            {mode === 'replace' && (
              <View testID="import-safety" style={[a.gap_sm, a.p_md, a.rounded_md, t.atoms.bg_contrast_25]}>
                <Text style={[a.text_md, a.font_semi_bold]}>
                  <Trans>Save a copy of this device first</Trans>
                </Text>
                <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
                  <Trans>Replace changes what is here. A copy lets you bring it back later.</Trans>
                </Text>
                {copy === 'saved' ? (
                  <Text testID="import-copy-saved" style={[a.text_sm, a.font_semi_bold, {color: t.palette.positive_600}]}>
                    <Trans>Copy saved</Trans>
                  </Text>
                ) : copy === 'skipped' ? (
                  <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                    <Trans>No copy will be saved.</Trans>
                  </Text>
                ) : (
                  <View style={[a.flex_row, a.gap_sm, a.flex_wrap]}>
                    <Button testID="import-save-copy" label={l`Save a copy of this device first`} size="small" color="primary" disabled={isBusy} onPress={() => void saveCopy()}>
                      <ButtonText><Trans>Save a copy</Trans></ButtonText>
                    </Button>
                    <Button testID="import-skip-copy" label={l`Skip the copy`} size="small" color="secondary" variant="ghost" onPress={() => skipControl.open()}>
                      <ButtonText><Trans>Skip</Trans></ButtonText>
                    </Button>
                  </View>
                )}
              </View>
            )}

            {preview && (
              <View testID="import-preview" style={[a.rounded_md, a.border, t.atoms.border_contrast_low, a.overflow_hidden]}>
                {main.map(k => (
                  <Row key={k} name={label[k]!} testID={`import-count-${k}`} c={preview.counts[k]} />
                ))}
                {other && other.add + other.overwrite + other.remove > 0 && (
                  <Row name={l`Settings and other records`} testID="import-count-other" c={other} />
                )}
                {changes === 0 && (
                  <Text testID="import-nothing" style={[a.p_md, a.text_sm, t.atoms.text_contrast_medium]}>
                    <Trans>Nothing to restore: everything in this file is already here.</Trans>
                  </Text>
                )}
                {preview.keep > 0 && (
                  <Text style={[a.p_md, a.text_sm, t.atoms.text_contrast_medium]}>
                    {plural(preview.keep, {one: '# record here is newer than the file, so it stays.', other: '# records here are newer than the file, so they stay.'})}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      </View>
      <Prompt.Basic
        control={skipControl}
        title={l`Replace without a copy?`}
        description={l`If you change your mind later, only the Undo that follows this restore can bring back what is here now, and only until you close Splito.`}
        confirmButtonCta={l`Skip the copy`}
        confirmButtonColor="negative"
        onConfirm={() => setCopy('skipped')}
      />
      <Prompt.Basic
        control={replaceControl}
        title={l`Replace what is on this device?`}
        description={l`Everything here that the backup doesn’t have will be removed from your lists. Their history is kept.`}
        confirmButtonCta={l`Replace`}
        confirmButtonColor="negative"
        onConfirm={() => void apply()}
      />
    </FormSheet.Inner>
  )
}

function Row({name, c, testID}: {name: string; c: {add: number; overwrite: number; remove: number}; testID: string}) {
  const t = useTheme()
  const parts = [
    c.add > 0 ? plural(c.add, {one: '# new', other: '# new'}) : null,
    c.overwrite > 0 ? plural(c.overwrite, {one: '# updated', other: '# updated'}) : null,
    c.remove > 0 ? plural(c.remove, {one: '# removed', other: '# removed'}) : null,
  ].filter(Boolean)
  return (
    <View testID={testID} style={[a.flex_row, a.align_center, a.justify_between, a.gap_md, a.px_md, a.py_sm, a.border_b, t.atoms.border_contrast_low]}>
      <Text style={[a.text_md]}>{name}</Text>
      <Text style={[a.text_sm, parts.length ? a.font_semi_bold : t.atoms.text_contrast_low]}>{parts.length ? parts.join(' · ') : '–'}</Text>
    </View>
  )
}
