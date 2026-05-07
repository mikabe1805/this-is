import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, BookmarkIcon, RectangleStackIcon, PlusIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useModalDismiss } from '../hooks/useModalDismiss'
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss'
import type { List } from '../types'

interface SaveListToFolderModalProps {
  isOpen: boolean
  onClose: () => void
  /** The list being saved into another list. */
  list: List | null
  /** The current user's lists, used as candidate parent folders. */
  userLists: List[]
  /** parentListIds the picker should pre-select if any. */
  alreadyIn?: string[]
  /** Confirms with the chosen parent list ids. */
  onConfirm: (parentListIds: string[]) => void
  /** Called when the user wants to create a brand-new folder list. */
  onCreateNewFolder?: () => void
}

export default function SaveListToFolderModal({
  isOpen,
  onClose,
  list,
  userLists,
  alreadyIn = [],
  onConfirm,
  onCreateNewFolder,
}: SaveListToFolderModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(alreadyIn))
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set(alreadyIn))
      setSearch('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, list?.id])

  useModalDismiss(isOpen, onClose)
  useSwipeToDismiss({ ref: sheetRef, onDismiss: onClose, enabled: isOpen })

  // Transitive descendant set of `list` within userLists. We can't allow the
  // user to nest list A into any folder X where X is already (directly or
  // indirectly) a descendant of A — that would create a cycle and break
  // recursive folder traversal. Computed via BFS bounded by userLists size,
  // so worst case is O(n) per render.
  const descendantIds = useMemo(() => {
    if (!list) return new Set<string>()
    const byId = new Map(userLists.map(l => [l.id, l]))
    const out = new Set<string>()
    const queue: string[] = [list.id]
    while (queue.length) {
      const id = queue.shift()!
      const node = byId.get(id)
      const subs = (node as { subLists?: string[] } | undefined)?.subLists || []
      for (const child of subs) {
        if (!out.has(child) && child !== list.id) {
          out.add(child)
          queue.push(child)
        }
      }
    }
    return out
  }, [userLists, list])

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return userLists.filter(l => {
      // Don't allow nesting a list into itself.
      if (list && l.id === list.id) return false
      // Don't allow nesting into a list that's already (transitively) inside
      // this one — that would close the loop and break folder traversal.
      if (descendantIds.has(l.id)) return false
      // Hide auto-generated lists (loved/tried/want) — those are place buckets.
      const tags = Array.isArray((l as { tags?: string[] }).tags) ? (l as { tags?: string[] }).tags! : []
      const isAuto = tags.includes('#auto-generated') || tags.includes('auto-generated')
      const nameLower = (l.name || '').toLowerCase()
      const isAutoByName = nameLower === 'all loved' || nameLower === 'all tried' || nameLower === 'all want'
      if (isAuto || isAutoByName) return false
      if (q && !nameLower.includes(q) && !((l.description || '').toLowerCase().includes(q))) return false
      return true
    })
  }, [userLists, list, search, descendantIds])

  if (!isOpen || !list) return null

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    try { onConfirm(Array.from(selected)) } finally { setSubmitting(false) }
  }

  const content = (
    <div
      className="fixed inset-0 z-[10004] flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal={true}
        className="modal-paper relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-edge max-h-[92vh] flex flex-col overflow-hidden"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-edge relative z-10">
          <p className="label-eyebrow text-ink-mute">Save list</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* List preview */}
        <div className="flex items-start gap-3 px-5 sm:px-6 py-4 border-b border-edge relative z-10">
          <div className="w-12 h-12 rounded-xl bg-paper-deep ring-1 ring-edge flex items-center justify-center shrink-0 overflow-hidden">
            {list.coverImage ? (
              <img src={list.coverImage} alt={list.name} className="w-full h-full object-cover" />
            ) : (
              <RectangleStackIcon className="w-6 h-6 text-ink-mute" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-[18px] leading-tight text-ink truncate">{list.name}</h3>
            <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-0.5">
              Save into a folder
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 sm:px-6 py-3 relative z-10">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your folders…"
            className="w-full h-10 px-4 rounded-full border border-edge bg-card text-[13px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
          />
        </div>

        {/* Folder list */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 pb-4 relative z-10">
          {onCreateNewFolder && (
            <button
              type="button"
              onClick={onCreateNewFolder}
              className="w-full mb-2 flex items-center gap-3 p-3 rounded-xl border border-dashed border-edge bg-card text-ink-soft hover:border-ink/40 hover:text-ink transition-colors"
            >
              <span className="w-8 h-8 rounded-full glass-honey flex items-center justify-center">
                <PlusIcon className="w-4 h-4 text-ink" />
              </span>
              <span className="text-[14px] font-medium">New folder</span>
            </button>
          )}

          {candidates.length === 0 ? (
            <div className="text-center py-8">
              <BookmarkIcon className="w-7 h-7 text-ink-faint mx-auto" />
              <p className="font-display text-[16px] text-ink mt-3">No folders yet.</p>
              <p className="text-[12px] text-ink-soft mt-1">Create one above to nest this list inside.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {candidates.map(folder => {
                const checked = selected.has(folder.id)
                return (
                  <label
                    key={folder.id}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${checked ? 'bg-paper-deep' : 'hover:bg-paper-deep'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(folder.id)}
                      className="w-4 h-4 accent-ink rounded"
                    />
                    <div className="w-9 h-9 rounded-lg bg-paper-deep ring-1 ring-edge flex items-center justify-center overflow-hidden shrink-0">
                      {folder.coverImage ? (
                        <img src={folder.coverImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <RectangleStackIcon className="w-4 h-4 text-ink-mute" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-ink truncate">{folder.name}</div>
                      {folder.description && (
                        <div className="text-[12px] text-ink-soft truncate">{folder.description}</div>
                      )}
                    </div>
                    {checked && <CheckIcon className="w-4 h-4 text-accent-deep" />}
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-edge flex gap-2 relative z-10">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1 h-12 font-semibold text-[14px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selected.size === 0 || submitting}
            className="btn-cta flex-1 h-12 font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving…' : selected.size > 1 ? `Save to ${selected.size} folders` : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
