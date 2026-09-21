// ============================================================
// AddTransactionModal - 手动记一笔
// ============================================================

import { useState } from 'react';
import { useTransactionStore } from '@/stores/transaction-store';
import { CATEGORIES, type Transaction } from '@/types';
import { generateTransactionId } from '@/utils/id';
import { cn } from '@/utils/cn';
import Modal from '@/components/ui/Modal';
import CategoryIcon from '@/components/ui/CategoryIcon';

interface AddTransactionModalProps {
  onClose: () => void;
}

type Direction = '支出' | '收入';

const FIELD_CLASS =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export default function AddTransactionModal({ onClose }: AddTransactionModalProps) {
  const addTransaction = useTransactionStore((s) => s.addTransaction);

  const [transactionType, setTransactionType] = useState<Direction>('支出');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  const numAmount = Number.parseFloat(amount);
  const isValid = counterparty.trim().length > 0 && !Number.isNaN(numAmount) && numAmount > 0;

  const handleSubmit = () => {
    if (!isValid) return;

    const transactionTime = `${date} ${time}:00`;
    const finalAmount = transactionType === '支出' ? numAmount : -numAmount;

    const txn: Transaction = {
      id: generateTransactionId(transactionTime, finalAmount, `manual-${Date.now()}`),
      transactionTime,
      transactionType,
      counterparty: counterparty.trim(),
      description: description.trim(),
      amount: finalAmount,
      paymentStatus: '',
      transactionNo: `manual-${Date.now()}`,
      paymentMethod: '',
      category: category || '待确认',
      categorySource: category ? 'manual' : 'auto',
      origin: 'manual',
      isPeriodic: false,
      tags: [],
      createdAt: new Date().toISOString(),
      coverImage: '',
    };

    addTransaction(txn);
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title="记一笔"
      description="金额和交易对方是必填项"
      footer={
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          保存
        </button>
      }
    >
      <div className="space-y-4 pb-1">
        {/* 收/支方向 */}
        <div role="group" aria-label="收支方向" className="flex rounded-lg bg-canvas p-0.5">
          {(['支出', '收入'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTransactionType(type)}
              aria-pressed={transactionType === type}
              className={cn(
                'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
                transactionType === type
                  ? type === '支出'
                    ? 'bg-surface text-expense shadow-sm'
                    : 'bg-surface text-income shadow-sm'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {type}
            </button>
          ))}
        </div>

        {/* 金额 */}
        <div>
          <label htmlFor="add-amount" className="mb-1 block text-xs text-ink-muted">
            金额（元）
          </label>
          <input
            id="add-amount"
            name="amount"
            type="number"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="tnum w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-xl font-semibold text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {/* 分类 */}
        <fieldset>
          <legend className="mb-1.5 text-xs text-ink-muted">分类</legend>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.filter((c) => c.name !== '待确认').map((cat) => {
              const active = cat.name === category;
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setCategory(active ? '' : cat.name)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    active ? 'text-white' : 'bg-canvas text-ink-muted hover:text-ink',
                  )}
                  style={active ? { backgroundColor: cat.color } : undefined}
                >
                  <CategoryIcon category={cat.name} size={13} />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 交易对方 */}
        <div>
          <label htmlFor="add-counterparty" className="mb-1 block text-xs text-ink-muted">
            交易对方
          </label>
          <input
            id="add-counterparty"
            name="counterparty"
            type="text"
            autoComplete="off"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="如：美团外卖"
            className={FIELD_CLASS}
          />
        </div>

        {/* 备注 */}
        <div>
          <label htmlFor="add-description" className="mb-1 block text-xs text-ink-muted">
            备注
          </label>
          <input
            id="add-description"
            name="description"
            type="text"
            autoComplete="off"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="选填"
            className={FIELD_CLASS}
          />
        </div>

        {/* 日期 + 时间 */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="add-date" className="mb-1 block text-xs text-ink-muted">
              日期
            </label>
            <input
              id="add-date"
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="add-time" className="mb-1 block text-xs text-ink-muted">
              时间
            </label>
            <input
              id="add-time"
              name="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={FIELD_CLASS}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
