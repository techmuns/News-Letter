import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { type SourceKind } from '../data/sources'
import { previewPath } from '../lib/routes'
import { cn } from '../lib/cn'
import {
  defaultSelectionWithCustom,
  sourceLabels,
  mixById,
} from '../data/sources'
import { MicroLabel } from '../components/MicroLabel'
import { Segmented } from '../components/Segmented'
import { MaterialPanel } from '../components/workspace/MaterialPanel'
import { MaterialGroupCard } from '../components/workspace/MaterialGroupCard'
import { OutlineCard } from '../components/workspace/OutlineCard'
import { SourcePicker } from '../components/workspace/SourcePicker'
import { DraftEditor } from '../components/workspace/DraftEditor'
import { ContentSettingsPanel } from '../components/workspace/ContentSettingsPanel'
import { ModelStatus } from '../components/workspace/ModelStatus'
import { WorkspaceIllustration } from '../components/workspace/WorkspaceIllustration'
import {
  IconChevronDown,
  IconUpload,
  IconSparkle,
  IconPlus,
} from '../components/icons'

type Mode = 'manual' | 'auto'

export function Workspace() {
  const groups = useStore((s) => s.groups)
  const openGroupId = useStore((s) => s.openGroupId)
  const finishGroup = useStore((s) => s.finishGroup)
  const reopenGroup = useStore((s) => s.reopenGroup)
  const discardGroup = useStore((s) => s.discardGroup)
  const generateDraft = useStore((s) => s.generateDraft)
  const regenerateDraft = useStore((s) => s.regenerateDraft)
  const commitDraft = useStore((s) => s.commitDraft)
  const discardDraft = useStore((s) => s.discardDraft)
  const draftId = useStore((s) => s.draftId)
  const draft = useStore((s) => s.campaigns.find((c) => c.id === s.draftId) ?? null)
  const generating = useStore((s) => s.generating)
  const customSources = useStore((s) => s.customSources)
  const hiddenSourceIds = useStore((s) => s.hiddenSourceIds)
  const addSource = useStore((s) => s.addSource)
  const removeSource = useStore((s) => s.removeSource)
  const restoreSources = useStore((s) => s.restoreSources)
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('manual')
  /** the material group Generate will run on — one group makes one post */
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  // automatic generator selection
  const [mix, setMix] = useState('linkedin')
  // seeded from the persisted catalog so removed sources don't come back selected
  const [autoSelected, setAutoSelected] = useState<Set<string>>(
    () => new Set(defaultSelectionWithCustom('linkedin', customSources, hiddenSourceIds)),
  )
  /** true while deliberately collecting a fresh post, so the newest finished
      group doesn't pull its write-up back onto the screen */
  const [startingNew, setStartingNew] = useState(false)
  // when a draft exists, inputs collapse — this reopens them to change sources
  const [inputsOpen, setInputsOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)

  // The group Generate acts on: the explicit pick, else the newest closed one.
  const closedGroups = groups.filter((g) => g.id !== openGroupId)
  const activeGroup =
    closedGroups.find((g) => g.id === activeGroupId) ?? closedGroups[0] ?? null
  const openGroup = groups.find((g) => g.id === openGroupId) ?? null
  // Step one is done once the active group has a write-up and nothing is being
  // collected — that write-up then replaces the collector as the next step.
  const collecting = !!openGroup || startingNew
  const outlineGroup = !collecting && activeGroup?.outline ? activeGroup : null
  const otherGroups = closedGroups.filter((g) => g.id !== outlineGroup?.id)

  // A failure explains what the model saw and what to do about it, so it stays
  // up long enough to read; a confirmation doesn't need the same room.
  function flash(text: string, ok: boolean) {
    setFeedback({ text, ok })
    window.setTimeout(() => setFeedback(null), ok ? 5000 : 14000)
  }

  /** Done — closes the group, which composes its write-up (step one). */
  function handleDone() {
    if (openGroup) setActiveGroupId(openGroup.id)
    setStartingNew(false)
    finishGroup()
  }

  /** Puts the empty collector back so a second post can be started. */
  function startNewGroup() {
    setActiveGroupId(null)
    setStartingNew(true)
  }

  /** Edit reopens the group, so the panel above fills with its materials again. */
  function handleEditGroup(id: string) {
    setStartingNew(false)
    reopenGroup(id)
  }

  /** Picking another post brings its write-up up, so it can't stay "starting new". */
  function handleSelectGroup(id: string) {
    setStartingNew(false)
    setActiveGroupId(id)
  }

  function handleDiscardGroup(id: string) {
    discardGroup(id)
    if (activeGroupId === id) setActiveGroupId(null)
  }

  function toggleSource(id: string) {
    setAutoSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function setGroup(ids: string[], select: boolean) {
    setAutoSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)))
      return next
    })
  }

  function changeMix(id: string) {
    setMix(id)
    setAutoSelected(new Set(defaultSelectionWithCustom(id, customSources, hiddenSourceIds)))
  }

  /** Adding a source selects it immediately — that's why you added it. */
  function handleAddSource(input: { name: string; handle: string; kind: SourceKind }) {
    const id = addSource(input)
    if (id) setAutoSelected((prev) => new Set(prev).add(id))
    return id
  }

  function handleRemoveSource(id: string) {
    removeSource(id)
    setAutoSelected((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  /** Restoring re-selects the defaults so the returned sources are actually used. */
  function handleRestoreSources() {
    restoreSources()
    setAutoSelected(new Set(defaultSelectionWithCustom(mix, customSources)))
  }

  // The generation input for the current mode. In manual mode every material
  // in the active group goes in together — one group is one post.
  function currentInput() {
    if (mode === 'manual') {
      const group = outlineGroup ?? activeGroup
      const items = group?.items ?? []
      return {
        sourceMode: 'manual' as const,
        // The group id is what lets the generator reach the actual files — the
        // uploaded images travel to the model from here.
        groupId: group?.id,
        sourceItemIds: items.map((it) => it.id),
        sourceLabels: items.map((it) => it.title),
        // the approved write-up is the text the post is built from — its
        // playbook pattern rides along so each channel keeps the same shape
        outline: group?.outline
          ? {
              headline: group.outline.headline,
              body: group.outline.body,
              pattern: group.outline.pattern,
              dashboard: group.outline.dashboard,
            }
          : undefined,
      }
    }
    return {
      sourceMode: 'auto' as const,
      sourceLabels: sourceLabels(autoSelected, customSources),
    }
  }

  const groupCount = (outlineGroup ?? activeGroup)?.items.length ?? 0
  // In manual mode the write-up is the gate: no step one, nothing to generate.
  const canGenerate = mode === 'manual' ? !!outlineGroup : autoSelected.size > 0

  async function handleGenerate() {
    if (!canGenerate) {
      flash(
        mode === 'manual'
          ? 'Add your material and click Done — you write up the post first.'
          : 'Select at least one source to generate from.',
        false,
      )
      return
    }
    setFeedback(null)
    const result = await generateDraft(currentInput())
    if (!result.ok) {
      // Nothing readable in the upload, or the model call failed. Either way
      // there is no draft — saying so beats showing a post about nothing.
      flash(result.reason, false)
      return
    }
    setStartingNew(false)
    setInputsOpen(false)
    if (result.notice) flash(result.notice, false)
  }

  async function handleRegenerate() {
    setFeedback(null)
    const result = await regenerateDraft(currentInput())
    if (!result.ok) flash(result.reason, false)
    else if (result.notice) flash(result.notice, false)
  }

  function handleContinue() {
    const id = commitDraft()
    if (id) navigate(previewPath(id))
  }

  function handleDiscard() {
    discardDraft()
    setInputsOpen(false)
  }

  const showInputs = !draftId || inputsOpen
  const autoCount = autoSelected.size
  const selCount = mode === 'manual' ? groupCount : autoCount

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
      {/* central workspace column */}
      <div className="min-w-0">
        <MicroLabel tone="violet" className="text-[11px]">
          01
        </MicroLabel>
        <h1 className="mt-2.5 font-display text-[34px] font-bold leading-[1.05] tracking-tight text-heading md:text-[37px]">
          Workspace
        </h1>
        <p className="mt-3 max-w-[33rem] text-[15px] leading-relaxed text-text-2">
          Start from your own materials or from continuously monitored sources — then generate,
          refine and preview content without leaving this page.
        </p>

        {/* the one thing that decides whether uploads mean anything */}
        <ModelStatus />

        {/* two input modes */}
        <div className="mt-6">
          <Segmented
            value={mode}
            onChange={(m) => setMode(m)}
            options={[
              { value: 'manual', label: 'My materials' },
              { value: 'auto', label: 'Automatic Generator' },
            ]}
          />
        </div>

        {/* when a draft exists, inputs collapse into a summary bar */}
        {draftId && (
          <button
            type="button"
            onClick={() => setInputsOpen((o) => !o)}
            className="glass mt-4 flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:border-border-strong"
          >
            <span className="flex items-center gap-2.5">
              {mode === 'auto' ? (
                <IconSparkle size={14} className="text-violet" />
              ) : (
                <IconUpload size={14} className="text-violet" />
              )}
              <span className="text-[13px] text-text-2">
                {mode === 'auto'
                  ? `${autoCount} source${autoCount === 1 ? '' : 's'} · ${mixById(mix).label}`
                  : `${groupCount} material${groupCount === 1 ? '' : 's'} in this post`}
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-violet">
              {inputsOpen ? 'Hide' : 'Change sources'}
              <IconChevronDown
                size={14}
                className={cn('transition-transform', inputsOpen && 'rotate-180')}
              />
            </span>
          </button>
        )}

        {/* input UI */}
        {showInputs && (
          <div className={cn(draftId && 'mt-4')}>
            {mode === 'manual' ? (
              <>
                {/* Collecting, or reviewing the write-up the materials produced.
                    One or the other — never both, so there's a single next step. */}
                {outlineGroup ? (
                  <div className="mt-6">
                    <OutlineCard
                      group={outlineGroup}
                      busy={generating}
                      onGenerate={handleGenerate}
                      onEditMaterials={() => handleEditGroup(outlineGroup.id)}
                      onDiscard={() => handleDiscardGroup(outlineGroup.id)}
                    />
                    <button
                      type="button"
                      onClick={startNewGroup}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong py-2.5 text-[12.5px] font-medium text-text-muted transition-colors hover:border-[color:var(--violet-dim)] hover:text-violet focus-violet"
                    >
                      <IconPlus size={14} /> Start another post
                    </button>
                  </div>
                ) : (
                  <div className="mt-6">
                    <MaterialPanel
                      group={openGroup ?? (startingNew ? null : activeGroup)}
                      onDone={handleDone}
                    />
                  </div>
                )}

                {/* other finished groups — one group per post, kept compact */}
                {otherGroups.length > 0 && (
                  <section className="mt-6 flex flex-col gap-2.5">
                    <MicroLabel className="text-text-dim">
                      {otherGroups.length === 1
                        ? 'Another post in progress'
                        : `${otherGroups.length} other posts · pick one to work on`}
                    </MicroLabel>
                    {otherGroups.map((g) => (
                      <MaterialGroupCard
                        key={g.id}
                        group={g}
                        selected={false}
                        onSelect={() => handleSelectGroup(g.id)}
                        onEdit={() => handleEditGroup(g.id)}
                        onDiscard={() => handleDiscardGroup(g.id)}
                      />
                    ))}
                  </section>
                )}
              </>
            ) : (
              <div className="mt-6">
                <SourcePicker
                  mix={mix}
                  onMix={changeMix}
                  selected={autoSelected}
                  onToggle={toggleSource}
                  onGroupSet={setGroup}
                  custom={customSources}
                  hidden={hiddenSourceIds}
                  onAdd={handleAddSource}
                  onRemove={handleRemoveSource}
                  onRestore={handleRestoreSources}
                />
              </div>
            )}
          </div>
        )}

        {/* the generated draft — created, edited and refined right here */}
        {draft && (
          <div className="mt-8">
            <DraftEditor
              campaign={draft}
              busy={generating}
              onRegenerate={handleRegenerate}
              onContinue={handleContinue}
              onDiscard={handleDiscard}
            />
          </div>
        )}
      </div>

      {/* right column — illustration + content settings */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:max-h-[calc(100vh-5.5rem)] lg:self-start lg:overflow-y-auto lg:pt-1 lg:pb-4">
        {!draftId && <WorkspaceIllustration />}
        <ContentSettingsPanel
          canGenerate={(draftId ? true : canGenerate) && !generating}
          busy={generating}
          ctaLabel={
            generating
              ? 'Reading your material…'
              : draftId
                ? 'Regenerate'
                : 'Generate content'
          }
          onGenerate={draftId ? handleRegenerate : handleGenerate}
          feedback={feedback}
          hint={
            generating
              ? 'Your document and instructions are with the model — this takes a few seconds.'
              : draftId
                ? 'Regenerate applies your latest settings & sources to this draft.'
                : canGenerate
                  ? mode === 'manual'
                    ? `Builds the post from your write-up + ${selCount} material${selCount === 1 ? '' : 's'}.`
                    : `${selCount} selected — these settings apply to every generation.`
                  : mode === 'manual'
                    ? 'Add your material and click Done — a write-up comes first.'
                    : 'Select sources, then generate.'
          }
        />
      </aside>
    </div>
  )
}
