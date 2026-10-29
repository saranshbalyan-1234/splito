// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Messages/components/MessagesList.tsx
import {memo, useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {logger} from '#/logger'
import {
  appendMessages,
  type AskMessage,
  decodeChat,
  encodeChat,
  needsDivider,
} from '#/lib/ask/history'
import {device} from '#/storage'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {ArrowLeft_Stroke2_Corner0_Rounded as ArrowLeftIcon} from '#/components/icons/Arrow'
import {Sparkles_Stroke2_Corner0_Rounded as SparklesIcon} from '#/components/icons/Sparkles'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Prompt from '#/components/Prompt'
import {AskComposer} from '#/components/SearchAsk/AskComposer'
import {QuestionChip} from '#/components/SearchAsk/AskCards'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useMutationCtx} from '#/data/hooks'
import {AskAnswer} from './AskAnswer'
import {useAskQuestions} from './askQuestions'
import {useAskEngine} from './useAskEngine'

/* The command-palette popup on rail and desktop, as the search view. */
const POPUP_WIDTH = 720
/* Bluesky's bubbles: 20 px corners, the one at the sender's foot squared. */
const BUBBLE_RADIUS = 20
const SQUARED_RADIUS = 4

type Item =
  | {type: 'empty'; key: string}
  | {type: 'divider'; key: string; at: number}
  | {type: 'message'; key: string; message: AskMessage; question?: string}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/**
 * Ask Splito's conversation inside the Search & Ask drawer (ARCHITECTURE
 * 26.19): Bluesky's message list with day dividers and bubbles, a composer
 * bar at the foot, and suggestion chips while it is empty. Questions are
 * answered on this device by `lib/ask`; the chat and the unsent draft stay on
 * this device (never the ledger, the outbox or a backup) and survive closing.
 */
export function AskChat({
  initialQuestion,
  onBack,
  onSearch,
}: {
  initialQuestion?: string
  onBack: () => void
  /** "Show all in Search": back to the results with this query. */
  onSearch: (query: string) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const {close} = Dialog.useDialogContext()
  const {actor: me} = useMutationCtx()
  const {ask, vocab, isReady} = useAskEngine()
  const questions = useAskQuestions()
  const clearPrompt = Prompt.usePromptControl()
  const list = useRef<React.ComponentRef<typeof Dialog.InnerFlatList>>(null)
  const kept = useRef<AskMessage[]>(decodeChat(device.get(['askChat'])))
  const [messages, setMessages] = useState<AskMessage[]>(kept.current)
  const [draft, setDraft] = useState(() => device.get(['askDraft']) ?? '')
  const [footerHeight, setFooterHeight] = useState(72)
  const isBusy = useRef(false)
  const didAskInitial = useRef(false)

  const commit = (next: AskMessage[]) => {
    kept.current = next
    setMessages(next)
    if (next.length === 0) device.remove(['askChat'])
    else device.set(['askChat'], encodeChat(next))
  }

  const changeDraft = (text: string) => {
    setDraft(text)
    if (text) device.set(['askDraft'], text)
    else device.remove(['askDraft'])
  }

  /*
   * Questions wait their turn: one asked before the store has loaded, or while an
   * answer is being worked out, is answered next instead of being dropped.
   */
  const queue = useRef<string[]>([])
  const isReadyNow = useRef(isReady)
  isReadyNow.current = isReady
  const drain = async () => {
    if (isBusy.current || !isReadyNow.current) return
    isBusy.current = true
    try {
      for (let q = queue.current.shift(); q !== undefined; q = queue.current.shift()) {
        commit(appendMessages(kept.current, {id: newId(), at: Date.now(), role: 'user', text: q}))
        try {
          const answer = await ask(q)
          commit(appendMessages(kept.current, {id: newId(), at: Date.now(), role: 'ask', answer}))
        } catch (e) {
          logger.error(e, {where: 'AskChat.send'})
          Toast.show(l`Couldn't read your data just now. Try asking again.`, {type: 'error'})
        }
      }
    } finally {
      isBusy.current = false
    }
  }

  const send = (text: string) => {
    const q = text.trim()
    if (!q) return
    queue.current.push(q)
    void drain()
  }

  // A question from the results row waits like any other until the store has loaded.
  useEffect(() => {
    if (!initialQuestion || didAskInitial.current) return
    didAskInitial.current = true
    send(initialQuestion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion])
  useEffect(() => {
    if (isReady) void drain()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady])

  const items: Item[] = []
  if (messages.length === 0) items.push({type: 'empty', key: 'empty'})
  messages.forEach((m, i) => {
    const prev = messages[i - 1]
    if (needsDivider(prev, m)) items.push({type: 'divider', key: `divider-${m.id}`, at: m.at})
    const lastUser = [...messages.slice(0, i)].reverse().find(x => x.role === 'user')
    items.push({type: 'message', key: m.id, message: m, question: lastUser?.role === 'user' ? lastUser.text : undefined})
  })

  const scrollToEnd = () => list.current?.scrollToEnd({animated: false})
  // The composer's height settles after its first layout: keep the newest message clear of it.
  useEffect(() => {
    scrollToEnd()
    // A card or chart sizes itself a moment after it mounts, so the end moves: follow it.
    const timers = [120, 400, 900].map(ms => setTimeout(scrollToEnd, ms))
    return () => timers.forEach(clearTimeout)
  }, [footerHeight, messages.length])

  const chips = [
    questions.spendFood(),
    questions.owedMost(),
    questions.split(),
    vocab.groups[0] ? questions.groupByDay(vocab.groups[0].name) : questions.spendMonth(),
  ]

  const header = (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.px_md,
        gtMobile ? a.pt_md : a.pt_xl,
        a.pb_md,
        a.border_b,
        t.atoms.bg,
        t.atoms.border_contrast_low,
      ]}>
      <Button testID="ask-back" label={l`Back to search results`} size="small" variant="ghost" color="secondary" shape="round" onPress={onBack}>
        <ButtonIcon icon={ArrowLeftIcon} />
      </Button>
      <View style={[a.flex_1, a.flex_row, a.align_center, a.gap_sm]}>
        <View style={[a.rounded_full, a.align_center, a.justify_center, {width: 32, height: 32, backgroundColor: t.palette.primary_100}]}>
          <SparklesIcon size="sm" fill={t.palette.primary_600} />
        </View>
        <View style={[a.flex_1]}>
          <Text style={[a.text_md, a.font_bold, a.leading_tight]}>
            <Trans>Ask Splito</Trans>
          </Text>
          <Text style={[a.text_xs, a.leading_tight, t.atoms.text_contrast_medium]}>
            <Trans>Answers from this device</Trans>
          </Text>
        </View>
      </View>
      {messages.length > 0 && (
        <Button testID="ask-clear" label={l`Clear chat`} size="small" variant="ghost" color="secondary" shape="round" onPress={() => clearPrompt.open()}>
          <ButtonIcon icon={TrashIcon} />
        </Button>
      )}
      {gtMobile && (
        <Button testID="ask-close" label={l`Close`} size="small" variant="ghost" color="secondary" shape="round" onPress={() => close()}>
          <ButtonIcon icon={XIcon} />
        </Button>
      )}
    </View>
  )

  return (
    <>
      <Dialog.InnerFlatList
        ref={list}
        testID="ask-chat"
        {...({label: l`Ask Splito`} as object)}
        data={items}
        keyExtractor={(item: Item) => item.key}
        renderItem={({item}: {item: Item}) => {
          if (item.type === 'empty') return <EmptyState chips={chips} onAsk={send} />
          if (item.type === 'divider') return <DateDivider at={item.at} />
          return (
            <MessageItem
              message={item.message}
              me={me}
              question={item.question}
              onAsk={send}
              onSearch={onSearch}
            />
          )
        }}
        ListHeaderComponent={header}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onContentSizeChange={scrollToEnd}
        style={[a.px_0]}
        contentContainerStyle={[{paddingBottom: footerHeight + 24}]}
        webInnerStyle={[
          a.p_0,
          gtMobile ? {maxWidth: POPUP_WIDTH, height: 'min(640px, 80vh)'} : web({height: '100dvh', maxHeight: '100dvh'}),
        ]}
        webInnerContentContainerStyle={[a.p_0]}
        footer={
          <Dialog.FlatListFooter border={false} onLayout={e => setFooterHeight(e.nativeEvent.layout.height)}>
            <AskComposer draft={draft} onDraftChange={changeDraft} onSend={send} />
          </Dialog.FlatListFooter>
        }
      />
      <Prompt.Basic
        control={clearPrompt}
        title={l`Clear chat?`}
        description={l`This removes the conversation from this device. Your expenses and balances are not touched.`}
        onConfirm={() => {
          commit([])
          changeDraft('')
        }}
        confirmButtonCta={l({message: 'Clear', context: 'action'})}
        cancelButtonCta={l`Cancel`}
        confirmButtonColor="negative"
      />
    </>
  )
}

function EmptyState({chips, onAsk}: {chips: string[]; onAsk: (q: string) => void}) {
  const t = useTheme()
  return (
    <View testID="ask-empty" style={[a.align_center, a.gap_lg, a.px_xl, a.pt_4xl, a.pb_lg]}>
      <View style={[a.rounded_full, a.align_center, a.justify_center, {width: 64, height: 64, backgroundColor: t.palette.primary_100}]}>
        <SparklesIcon size="xl" fill={t.palette.primary_600} />
      </View>
      <View style={[a.gap_xs, a.align_center]}>
        <Text style={[a.text_xl, a.font_bold, a.text_center]}>
          <Trans>Ask about your money</Trans>
        </Text>
        <Text style={[a.text_md, a.leading_snug, a.text_center, t.atoms.text_contrast_medium]}>
          <Trans>Balances, who owes whom, and where the money went. Answered on this device, nothing is sent anywhere.</Trans>
        </Text>
      </View>
      <View style={[a.flex_row, a.flex_wrap, a.justify_center, a.gap_sm]}>
        {chips.map(c => (
          <QuestionChip key={c} testID="ask-chip" text={c} onPress={() => onAsk(c)} />
        ))}
      </View>
    </View>
  )
}

/* The day divider and the bubbles are Bluesky's (components/dms/DateDivider.tsx, MessageItem.tsx); see docs/reuse/ask.md. */
const DateDivider = memo(function DateDivider({at}: {at: number}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const when = new Date(at)
  const now = new Date()
  const sameDay = (x: Date, y: Date) => x.toDateString() === y.toDateString()
  const yesterday = new Date(now.getTime() - 86_400_000)
  const day = sameDay(when, now)
    ? l`Today`
    : sameDay(when, yesterday)
      ? l`Yesterday`
      : i18n.date(when, {weekday: 'short', month: 'long', day: 'numeric', ...(when.getFullYear() === now.getFullYear() ? {} : {year: 'numeric'})})
  const time = i18n.date(when, {hour: 'numeric', minute: 'numeric'})
  return (
    <View style={[a.w_full, a.mt_md]}>
      <Text style={[a.text_xs, a.text_center, a.px_md, t.atoms.text_contrast_medium]}>
        <Trans>
          {day} at {time}
        </Trans>
      </Text>
    </View>
  )
})

const MessageItem = memo(function MessageItem({
  message,
  me,
  question,
  onAsk,
  onSearch,
}: {
  message: AskMessage
  me: string
  question?: string
  onAsk: (q: string) => void
  onSearch: (q: string) => void
}) {
  const t = useTheme()
  const {i18n} = useLingui()
  if (message.role === 'user') {
    return (
      <View testID="ask-message-user" style={[a.px_lg, a.mt_md, a.align_end]}>
        <View
          style={[
            a.py_sm,
            a.px_md,
            {maxWidth: '85%', backgroundColor: t.palette.primary_500, borderRadius: BUBBLE_RADIUS, borderBottomRightRadius: SQUARED_RADIUS},
          ]}>
          <Text selectable style={[a.text_md, a.leading_snug, {color: t.palette.white}]}>
            {message.text}
          </Text>
        </View>
      </View>
    )
  }
  const { answer } = message
  /* Only a real answer is "answered on this device"; a question back or an honest "not yet" is not. */
  const isAnswered = !['unsupported', 'clarify', 'help'].includes(answer.kind)
  return (
    <View testID="ask-message-ask" style={[a.px_lg, a.mt_md, a.align_start]}>
      <View style={[a.w_full, a.gap_md, {maxWidth: '100%'}]}>
        <AskAnswer answer={answer} me={me} question={question} onAsk={onAsk} onSearch={onSearch} />
        {isAnswered && (
          <Text testID="ask-on-device" style={[a.text_xs, a.my_2xs, t.atoms.text_contrast_medium]}>
            <Trans>
              Answered on this device · {i18n.date(new Date(message.at), {hour: 'numeric', minute: 'numeric'})}
            </Trans>
          </Text>
        )}
      </View>
    </View>
  )
})
