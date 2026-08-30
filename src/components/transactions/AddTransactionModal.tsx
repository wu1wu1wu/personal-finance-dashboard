// ============================================================
// AddTransactionModal - 手动添加交易记录弹窗
// ============================================================

import { useState } from 'react';
import { useTransactionStore } from '@/stores/transaction-store';
import { CATEGORIES, type Transaction } from '@/types';
import { generateTransactionId } from '@/utils/id';

interface AddTransactionModalProps {
  onClose: () => void;
}

export default function AddTransactionModal({ onClose }: AddTransactionModalProps) {
  const addTransaction = useTransactionStore((s) => s.addTransaction);

  const [transactionType, setTransactionType] = useState<'支出' | '收入'>('支出');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!counterparty.trim() || isNaN(numAmount) || numAmount <= 0) return;

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
      isPeriodic: false,
      tags: [],
      createdAt: new Date().toISOString(),
      coverImage: '',
    };

    addTransaction(txn);
    onClose();
  };

  const isValid = counterparty.trim() && amount && parseFloat(amount) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">新增交易</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* 类型切换 */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setTransactionType('支出')}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${transactionType === '支出' ? 'bg-red-500 text-white' : 'text-gray-500'}`}
          >
            支出
          </button>
          <button
            onClick={() => setTransactionType('收入')}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${transactionType === '收入' ? 'bg-green-500 text-white' : 'text-gray-500'}`}
          >
            收入
          </button>
        </div>

        {/* 金额 */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">金额（元）</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-lg font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            min="0"
            step="0.01"
            autoFocus
          />
        </div>

        {/* 分类 */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">分类</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.filter((c) => c.name !== '待确认').map((cat) => (
              <button
                key={cat.name}
                onClick={() => setCategory(cat.name === category ? '' : cat.name)}
                className={`px-3 py-1.5 text-xs rounded-full transition-colors ${cat.name === category ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                style={cat.name === category ? { backgroundColor: cat.color } : {}}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* 交易对方 */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">交易对方</label>
          <input
            type="text"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="如：美团外卖"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* 备注 */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">备注</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="选填"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* 日期 */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">时间</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* 确认按钮 */}
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full py-2.5 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          添加记账
        </button>
      </div>
    </div>
  );
}