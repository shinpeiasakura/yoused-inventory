import { useState } from 'react'

function genId() {
  return crypto.randomUUID()
}

const INPUT_CLS =
  'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#C4956A] focus:ring-1 focus:ring-[#C4956A]/30'

function EquipmentRow({ item, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: item.name, quantity: item.quantity, notes: item.notes })

  const save = () => {
    onUpdate({ ...item, ...form, quantity: Number(form.quantity) || 0 })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="備品名"
          className={INPUT_CLS}
          autoFocus
        />
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 flex-shrink-0">数量</label>
          <input
            type="number"
            min="0"
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            className={INPUT_CLS}
          />
        </div>
        <input
          type="text"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="メモ"
          className={INPUT_CLS}
        />
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)} className="flex-1 py-2.5 rounded-xl border text-sm text-gray-500">キャンセル</button>
          <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-[#1A1A1A] text-white text-sm font-medium">保存</button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-[#1A1A1A] truncate">{item.name}</p>
        {item.notes ? <p className="text-xs text-gray-400 truncate">{item.notes}</p> : null}
      </div>
      {/* Quantity controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onUpdate({ ...item, quantity: Math.max(0, item.quantity - 1) })}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xl active:bg-gray-200"
        >
          −
        </button>
        <span className="w-7 text-center font-bold text-sm tabular-nums">{item.quantity}</span>
        <button
          onClick={() => onUpdate({ ...item, quantity: item.quantity + 1 })}
          className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white text-xl active:bg-gray-700"
        >
          +
        </button>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 flex-shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button
        onClick={() => { if (window.confirm('削除しますか？')) onDelete(item.id) }}
        className="w-7 h-7 flex items-center justify-center text-gray-200 hover:text-red-400 flex-shrink-0 text-lg"
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
    <div className="p-4 space-y-6">
      {/* ========== レジ金額 ========== */}
      <section>
        <h2 className="text-base font-bold text-[#1A1A1A] mb-3 tracking-wide">レジ金額</h2>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          {/* Amount display */}
          <div className="text-center mb-5">
            <p className="text-xs text-gray-400 mb-1 tracking-wide uppercase">現在のレジ</p>
            <p className="text-5xl font-bold text-[#1A1A1A] tabular-nums">
              ¥{(cash.registerAmount ?? 0).toLocaleString()}
            </p>
          </div>

          {editingCash ? (
            <div className="space-y-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-bold">¥</span>
                <input
                  type="number"
                  min="0"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  className={INPUT_CLS + ' pl-8 text-xl font-bold text-center tabular-nums'}
                  autoFocus
                />
              </div>
              <input
                type="text"
                value={cashNote}
                onChange={e => setCashNote(e.target.value)}
                placeholder="メモ（任意）例: 朝の残高"
                className={INPUT_CLS}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingCash(false)}
                  className="flex-1 py-3 rounded-xl border text-sm text-gray-500"
                >
                  キャンセル
                </button>
                <button
                  onClick={saveCash}
                  className="flex-1 py-3 rounded-xl bg-[#1A1A1A] text-white text-sm font-semibold"
                >
                  保存する
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setNewAmount(cash.registerAmount ?? 0); setEditingCash(true) }}
              className="w-full py-3 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 active:bg-gray-200 transition-colors"
            >
              金額を更新する
            </button>
          )}
        </div>

        {/* History */}
        {(cash.history || []).length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">更新履歴</h3>
            <div className="space-y-2">
              {(cash.history || []).slice(0, 5).map((h, i) => (
                <div key={h.id} className={`flex items-center justify-between px-4 py-3 rounded-xl ${i === 0 ? 'bg-white shadow-sm' : 'bg-white/60'}`}>
                  <div>
                    <p className="text-sm font-bold text-[#1A1A1A] tabular-nums">¥{h.amount.toLocaleString()}</p>
                    {h.notes ? <p className="text-xs text-gray-400">{h.notes}</p> : null}
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(h.date)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ========== 備品管理 ========== */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#1A1A1A] tracking-wide">備品管理</h2>
          <button
            onClick={() => { setNewEquip({ name: '', quantity: 1, notes: '' }); setShowAddEquip(true) }}
            className="px-4 py-2 bg-[#1A1A1A] text-white text-xs font-semibold rounded-full active:bg-gray-700"
          >
            + 追加
          </button>
        </div>

        {/* Add equipment form */}
        {showAddEquip && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-3 space-y-3">
            <input
              type="text"
              value={newEquip.name}
              onChange={e => setNewEquip(f => ({ ...f, name: e.target.value }))}
              placeholder="備品名 例: ハンガー、テープ"
              className={INPUT_CLS}
              autoFocus
            />
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500 flex-shrink-0 w-8">数量</label>
              <input
                type="number"
                min="0"
                value={newEquip.quantity}
                onChange={e => setNewEquip(f => ({ ...f, quantity: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>
            <input
              type="text"
              value={newEquip.notes}
              onChange={e => setNewEquip(f => ({ ...f, notes: e.target.value }))}
              placeholder="メモ（任意）"
              className={INPUT_CLS}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAddEquip(false)} className="flex-1 py-2.5 rounded-xl border text-sm text-gray-500">キャンセル</button>
              <button onClick={saveEquip} className="flex-1 py-2.5 rounded-xl bg-[#1A1A1A] text-white text-sm font-semibold">追加する</button>
            </div>
          </div>
        )}

        {/* Equipment list */}
        {equipment.length === 0 && !showAddEquip ? (
          <div className="text-center py-12 text-gray-300">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            <p className="text-sm">備品が登録されていません</p>
          </div>
        ) : (
          <div className="space-y-2">
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
