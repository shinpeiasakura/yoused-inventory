import { useState } from 'react'

function genId() {
  return crypto.randomUUID()
}

const INPUT_CLS =
  'w-full px-4 py-3 border border-[#DDD5C5] text-sm bg-[#FDFAF5] text-[#2C1A0E] focus:outline-none focus:border-[#8B5E3C] focus:ring-1 focus:ring-[#8B5E3C]/20 placeholder:text-[#C4B8A8] transition-colors'

function EquipmentRow({ item, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: item.name, quantity: item.quantity, notes: item.notes })

  const save = () => {
    onUpdate({ ...item, ...form, quantity: Number(form.quantity) || 0 })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-[#FDFAF5] p-4 space-y-3 border border-[#EDE7DA]" style={{ borderRadius: '3px' }}>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="備品名"
          className={INPUT_CLS}
          style={{ borderRadius: '2px' }}
          autoFocus
        />
        <div className="flex items-center gap-3">
          <label className="text-[10px] text-[#A8998A] flex-shrink-0 tracking-widest uppercase">数量</label>
          <input
            type="number"
            min="0"
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            className={INPUT_CLS}
            style={{ borderRadius: '2px' }}
          />
        </div>
        <input
          type="text"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="メモ"
          className={INPUT_CLS}
          style={{ borderRadius: '2px' }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(false)}
            className="flex-1 py-2.5 border border-[#DDD5C5] text-sm text-[#7A6858] tracking-wide"
            style={{ borderRadius: '2px' }}
          >
            キャンセル
          </button>
          <button
            onClick={save}
            className="flex-1 py-2.5 bg-[#2C1A0E] text-[#F4EFE6] text-sm font-medium tracking-wide"
            style={{ borderRadius: '2px' }}
          >
            保存
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#FDFAF5] px-4 py-3 flex items-center gap-3 border border-[#EDE7DA]" style={{ borderRadius: '3px' }}>
      <div className="flex-1 min-w-0">
        <p className="font-serif font-medium text-sm text-[#2C1A0E] truncate">{item.name}</p>
        {item.notes ? <p className="text-[11px] text-[#A8998A] truncate mt-0.5">{item.notes}</p> : null}
      </div>
      {/* Quantity controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onUpdate({ ...item, quantity: Math.max(0, item.quantity - 1) })}
          className="w-7 h-7 flex items-center justify-center text-[#7A6858] text-lg bg-[#EDE7DA] active:bg-[#DDD5C5]"
          style={{ borderRadius: '2px' }}
        >
          −
        </button>
        <span className="w-6 text-center font-bold text-sm tabular-nums text-[#2C1A0E]">{item.quantity}</span>
        <button
          onClick={() => onUpdate({ ...item, quantity: item.quantity + 1 })}
          className="w-7 h-7 flex items-center justify-center text-[#F4EFE6] text-lg bg-[#2C1A0E] active:bg-[#4a2e1a]"
          style={{ borderRadius: '2px' }}
        >
          +
        </button>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="w-7 h-7 flex items-center justify-center text-[#C4B8A8] hover:text-[#8B5E3C] transition-colors flex-shrink-0"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button
        onClick={() => { if (window.confirm('削除しますか？')) onDelete(item.id) }}
        className="w-7 h-7 flex items-center justify-center text-[#C4B8A8] hover:text-red-400 flex-shrink-0 text-lg transition-colors"
      >
        ×
      </button>
    </div>
  )
}

export default function CashOtherView({
  cash,
  equipment,
  onUpdateCash,
  onAddEquipment,
  onUpdateEquipment,
  onDeleteEquipment,
}) {
  const [editingCash, setEditingCash] = useState(false)
  const [newAmount, setNewAmount] = useState(cash.registerAmount ?? 0)
  const [cashNote, setCashNote] = useState('')

  const [showAddEquip, setShowAddEquip] = useState(false)
  const [newEquip, setNewEquip] = useState({ name: '', quantity: 1, notes: '' })

  const saveCash = () => {
    const amount = Number(newAmount) || 0
    const entry = {
      id: genId(),
      date: new Date().toISOString(),
      amount,
      notes: cashNote.trim(),
    }
    onUpdateCash({
      registerAmount: amount,
      history: [entry, ...(cash.history || [])].slice(0, 50),
    })
    setEditingCash(false)
    setCashNote('')
  }

  const saveEquip = () => {
    if (!newEquip.name.trim()) return
    onAddEquipment({ ...newEquip, quantity: Number(newEquip.quantity) || 0 })
    setNewEquip({ name: '', quantity: 1, notes: '' })
    setShowAddEquip(false)
  }

  const formatDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-4 space-y-8">
      {/* ========== レジ金額 ========== */}
      <section>
        <h2 className="font-serif text-base font-medium text-[#2C1A0E] mb-4 tracking-wide">レジ金額</h2>
        <div className="bg-[#FDFAF5] p-5 border border-[#EDE7DA]" style={{ borderRadius: '3px' }}>
          {/* Amount display */}
          <div className="text-center mb-5 py-3 border-b border-[#EDE7DA]">
            <p className="text-[9px] text-[#A8998A] mb-2 tracking-widest uppercase">現在のレジ</p>
            <p className="font-serif text-5xl font-light text-[#2C1A0E] tabular-nums">
              ¥{(cash.registerAmount ?? 0).toLocaleString()}
            </p>
          </div>

          {editingCash ? (
            <div className="space-y-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A8998A] text-lg">¥</span>
                <input
                  type="number"
                  min="0"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  className={INPUT_CLS + ' pl-8 text-xl font-bold text-center tabular-nums'}
                  style={{ borderRadius: '2px' }}
                  autoFocus
                />
              </div>
              <input
                type="text"
                value={cashNote}
                onChange={e => setCashNote(e.target.value)}
                placeholder="メモ（任意）例: 朝の残高"
                className={INPUT_CLS}
                style={{ borderRadius: '2px' }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingCash(false)}
                  className="flex-1 py-3 border border-[#DDD5C5] text-sm text-[#7A6858] tracking-wide"
                  style={{ borderRadius: '2px' }}
                >
                  キャンセル
                </button>
                <button
                  onClick={saveCash}
                  className="flex-1 py-3 bg-[#2C1A0E] text-[#F4EFE6] text-sm font-medium tracking-widest"
                  style={{ borderRadius: '2px' }}
                >
                  保存する
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setNewAmount(cash.registerAmount ?? 0); setEditingCash(true) }}
              className="w-full py-3 border border-[#DDD5C5] text-sm font-medium text-[#7A6858] tracking-widest uppercase active:bg-[#EDE7DA] transition-colors"
              style={{ borderRadius: '2px' }}
            >
              金額を更新する
            </button>
          )}
        </div>

        {/* History */}
        {(cash.history || []).length > 0 && (
          <div className="mt-4">
            <h3 className="text-[9px] font-semibold text-[#A8998A] uppercase tracking-widest mb-3 px-1">更新履歴</h3>
            <div className="space-y-1.5">
              {(cash.history || []).slice(0, 5).map((h, i) => (
                <div
                  key={h.id}
                  className={`flex items-center justify-between px-4 py-3 border border-[#EDE7DA] ${
                    i === 0 ? 'bg-[#FDFAF5]' : 'bg-[#FDFAF5]/60'
                  }`}
                  style={{ borderRadius: '2px' }}
                >
                  <div>
                    <p className="font-serif text-sm font-medium text-[#2C1A0E] tabular-nums">¥{h.amount.toLocaleString()}</p>
                    {h.notes ? <p className="text-[11px] text-[#A8998A] mt-0.5">{h.notes}</p> : null}
                  </div>
                  <p className="text-[10px] text-[#A8998A]">{formatDate(h.date)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ========== 備品管理 ========== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-base font-medium text-[#2C1A0E] tracking-wide">備品管理</h2>
          <button
            onClick={() => { setNewEquip({ name: '', quantity: 1, notes: '' }); setShowAddEquip(true) }}
            className="px-4 py-2 bg-[#2C1A0E] text-[#F4EFE6] text-[11px] font-medium tracking-widest uppercase active:bg-[#4a2e1a] transition-colors"
            style={{ borderRadius: '2px' }}
          >
            + 追加
          </button>
        </div>

        {/* Add equipment form */}
        {showAddEquip && (
          <div className="bg-[#FDFAF5] p-4 border border-[#DDD5C5] mb-3 space-y-3" style={{ borderRadius: '3px' }}>
            <input
              type="text"
              value={newEquip.name}
              onChange={e => setNewEquip(f => ({ ...f, name: e.target.value }))}
              placeholder="備品名 例: ハンガー、テープ"
              className={INPUT_CLS}
              style={{ borderRadius: '2px' }}
              autoFocus
            />
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-[#A8998A] flex-shrink-0 tracking-widest uppercase w-8">数量</label>
              <input
                type="number"
                min="0"
                value={newEquip.quantity}
                onChange={e => setNewEquip(f => ({ ...f, quantity: e.target.value }))}
                className={INPUT_CLS}
                style={{ borderRadius: '2px' }}
              />
            </div>
            <input
              type="text"
              value={newEquip.notes}
              onChange={e => setNewEquip(f => ({ ...f, notes: e.target.value }))}
              placeholder="メモ（任意）"
              className={INPUT_CLS}
              style={{ borderRadius: '2px' }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddEquip(false)}
                className="flex-1 py-2.5 border border-[#DDD5C5] text-sm text-[#7A6858] tracking-wide"
                style={{ borderRadius: '2px' }}
              >
                キャンセル
              </button>
              <button
                onClick={saveEquip}
                className="flex-1 py-2.5 bg-[#2C1A0E] text-[#F4EFE6] text-sm font-medium tracking-widest"
                style={{ borderRadius: '2px' }}
              >
                追加する
              </button>
            </div>
          </div>
        )}

        {/* Equipment list */}
        {equipment.length === 0 && !showAddEquip ? (
          <div className="text-center py-12 text-[#C4B8A8]">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="mx-auto mb-3">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            <p className="font-serif text-sm text-[#A8998A]">備品が登録されていません</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {equipment.map(item => (
              <EquipmentRow
                key={item.id}
                item={item}
                onUpdate={(updated) => onUpdateEquipment(item.id, updated)}
                onDelete={onDeleteEquipment}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
