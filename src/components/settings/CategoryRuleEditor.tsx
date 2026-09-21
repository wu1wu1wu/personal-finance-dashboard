// ============================================================
// CategoryRuleEditor - 自定义分类规则编辑器
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Pencil, Plus, Trash } from 'lucide-react';
import { useClassificationStore } from '@/stores/classification-store';
import { CATEGORIES } from '@/types';
import type { ClassificationRule } from '@/types';
import { BUILTIN_RULES } from '@/constants/rules';
import CategoryIcon from '@/components/ui/CategoryIcon';

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

/** 分类关键词的分隔符：中英文逗号、顿号、分号、空格 */
const KEYWORD_SEPARATOR = /[,，、;；\s]+/;

export default function CategoryRuleEditor() {
  const { customRules, addCustomRule, updateCustomRule, deleteCustomRule, loadFromStorage } =
    useClassificationStore();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [keywords, setKeywords] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0].name);

  // 原来在 render 里直接调用 loadFromStorage()，改成 effect 避免渲染期副作用
  useEffect(() => {
    if (!useClassificationStore.getState().loaded) {
      void loadFromStorage();
    }
  }, [loadFromStorage]);

  /** 内置规则按分类汇总关键词，直接读规则表，避免维护两份说明 */
  const builtinByCategory = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const rule of BUILTIN_RULES) {
      const list = map.get(rule.category) ?? [];
      list.push(...rule.keywords);
      map.set(rule.category, list);
    }
    return map;
  }, []);

  const handleSubmit = () => {
    const kwList = keywords.split(KEYWORD_SEPARATOR).map((k) => k.trim()).filter(Boolean);
    if (kwList.length === 0) return;

    if (editId) {
      updateCustomRule(editId, { keywords: kwList, category });
    } else {
      addCustomRule({ keywords: kwList, category });
    }

    resetForm();
  };

  const handleEdit = (rule: ClassificationRule) => {
    setEditId(rule.id);
    setKeywords(rule.keywords.join('、'));
    setCategory(rule.category);
    setShowForm(true);
  };

  const resetForm = () => {
    setEditId(null);
    setKeywords('');
    setCategory(CATEGORIES[0].name);
    setShowForm(false);
  };

  const getCategoryInfo = (name: string) =>
    CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[CATEGORIES.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-ink-muted">
          命中自定义规则的关键词优先按你的设定分类
        </h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand/90"
          >
            <Plus size={13} aria-hidden="true" />
            添加规则
          </button>
        )}
      </div>

      {showForm && (
        <div className="space-y-3 rounded-xl bg-canvas p-3">
          <div>
            <label htmlFor="rule-keywords" className="mb-1 block text-xs font-medium text-ink">
              关键词（用逗号或空格分隔）
            </label>
            <input
              id="rule-keywords"
              name="keywords"
              type="text"
              autoComplete="off"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="如：星巴克，瑞幸，Manner"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="rule-category" className="mb-1 block text-xs font-medium text-ink">
              目标分类
            </label>
            <select
              id="rule-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={INPUT_CLASS}
            >
              {CATEGORIES.filter((c) => c.name !== '待确认').map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!keywords.trim()}
              className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {editId ? '保存修改' : '添加规则'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg bg-surface px-4 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {customRules.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface py-8 text-center">
          <p className="text-sm text-ink-muted">暂无自定义规则</p>
          <p className="mt-1 text-xs text-ink-subtle">添加关键词后，含该词的交易会自动归到你指定的分类</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {customRules.map((rule) => {
            const cat = getCategoryInfo(rule.category);
            return (
              <li
                key={rule.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-shadow hover:shadow-sm"
              >
                <span
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                >
                  <CategoryIcon category={cat.name} size={12} />
                  {cat.name}
                </span>

                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {rule.keywords.map((kw) => (
                    <span key={kw} className="rounded bg-canvas px-1.5 py-0.5 text-xs text-ink-muted">
                      {kw}
                    </span>
                  ))}
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => handleEdit(rule)}
                    aria-label={`修改规则 ${rule.keywords.join('、')}`}
                    className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-canvas hover:text-brand"
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCustomRule(rule.id)}
                    aria-label={`删除规则 ${rule.keywords.join('、')}`}
                    className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-expense-soft hover:text-expense"
                  >
                    <Trash size={14} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 内置规则说明 */}
      <details className="group rounded-xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-ink-muted [&::-webkit-details-marker]:hidden">
          查看内置分类规则（{builtinByCategory.size} 个分类）
          <ChevronDown
            size={15}
            className="text-ink-subtle transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <ul className="space-y-2 border-t border-line p-4">
          {CATEGORIES.filter((c) => c.name !== '待确认').map((cat) => {
            const keywords = builtinByCategory.get(cat.name) ?? [];
            return (
              <li key={cat.name} className="flex gap-2 text-xs">
                <span className="flex w-24 shrink-0 items-center gap-1 text-ink">
                  <CategoryIcon category={cat.name} size={13} />
                  {cat.name}
                </span>
                <span className="min-w-0 flex-1 text-ink-subtle">
                  {keywords.slice(0, 12).join('、')}
                  {keywords.length > 12 && ' …'}
                </span>
              </li>
            );
          })}
        </ul>
      </details>

    </div>
  );
}
