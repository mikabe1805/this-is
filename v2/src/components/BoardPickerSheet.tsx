/**
 * The board picker — one of exactly two sheets in the app. Opened by the
 * `?pick={pinId}` search param so hardware back always closes it. Picking a
 * board re-files the pin; "Start a new wall" creates inline. No confirm
 * dialogs. The most-recent board arrives pre-lit (DESIGN.md graft).
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useBoards, usePin, useSaveFlow } from '../data/queries'
import { createBoard } from '../data/boards'
import { armToast } from '../state/toast'
import { haptics } from '../lib/haptics'

export default function BoardPickerSheet() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const pinId = params.get('pick')
  const pin = usePin(pinId ?? undefined)
  const { data: boards } = useBoards()
  const { refile, invalidate } = useSaveFlow()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  const open = Boolean(pinId)

  useEffect(() => {
    if (!open) return
    sheetRef.current?.focus()
    // A held save-toast resumes its countdown once the picker goes away
    // (whether by picking, backdrop, or hardware back).
    return () => armToast(3500)
  }, [open])

  if (!pinId) return null

  const close = () => {
    // Hardware/UI back closes the sheet — but on a deep link (?pick= is the
    // first history entry) going back would leave the app; strip the param
    // in place instead.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) {
      navigate(-1)
    } else {
      const next = new URLSearchParams(params)
      next.delete('pick')
      setParams(next, { replace: true })
    }
  }

  const pick = (boardId: string, boardName: string) => {
    haptics.select()
    refile.mutate({ pinId, boardId, boardName })
    close()
  }

  const createAndPick = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const board = await createBoard(name, pin?.snapshot.hex)
      invalidate()
      pick(board.id, board.name)
    } finally {
      setCreating(false)
    }
  }

  const likelyId = (boards ?? []).find(b => !pin?.boardIds.includes(b.id))?.id

  return (
    <div className="sheet-layer">
      <button className="sheet-backdrop" aria-label="Close" onClick={close} />
      <div
        ref={sheetRef}
        className="sheet glass-chrome"
        role="dialog"
        aria-modal="true"
        aria-label="Choose a board"
        tabIndex={-1}
        onKeyDown={e => { if (e.key === 'Escape') close() }}
      >
        <div className="sheet-handle" aria-hidden />
        <p className="eyebrow sheet-eyebrow">
          {pin ? `WHERE DOES “${pin.snapshot.name.toUpperCase()}” HANG?` : 'WHERE DOES IT HANG?'}
        </p>
        <ul className="sheet-list">
          {(boards ?? []).map(b => {
            const isHome = pin?.boardIds.includes(b.id)
            return (
              <li key={b.id}>
                <button
                  className={`sheet-item press${isHome ? ' is-current' : ''}${b.id === likelyId ? ' is-likely' : ''}`}
                  onClick={() => pick(b.id, b.name)}
                >
                  <span className="sheet-swatch" style={{ backgroundColor: b.coverHex }} aria-hidden />
                  <span className="sheet-item-name">{b.name}</span>
                  <span className="eyebrow sheet-item-count">
                    {isHome ? 'HERE' : `Nº ${b.pinCount}`}
                  </span>
                </button>
              </li>
            )
          })}
          <li className="sheet-new">
            <input
              className="sheet-input"
              placeholder="Start a new wall"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void createAndPick() }}
            />
            {newName.trim() && (
              <button className="pill pill-primary press" disabled={creating} onClick={() => void createAndPick()}>
                Create
              </button>
            )}
          </li>
        </ul>
      </div>
    </div>
  )
}
