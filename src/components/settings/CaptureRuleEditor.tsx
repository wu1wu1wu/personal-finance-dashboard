// ============================================================
// CaptureRuleEditor - 自定义消息读取规则
//
// 内置解析规则是固定的，遇到新的银行/App 格式就只能等更新。
// 这里让用户自己补规则，并提供一个「粘贴消息试一下」的测试框，
// 写完规则立刻能看到会不会被正确识别。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Pencil, Plus, Trash } from 'lucide-react';
import { CATEGORIES, type CaptureRule } from '@/types';
import { useCaptureRuleStore } from '@/stores/capture-rule-store';
import { parseCapturedTransaction } from '@/core/transaction-capture';
import { categoryLabel, transactionTypeLabel, useLocale, useT } from '@/i18n';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import CategoryIcon from '@/components/ui/CategoryIcon';

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

interface RuleDraft {
  name: string;
  packageMatch: string;
  contains: string;
  excludes: string;
  amountRegex: string;
  direction: 'expense' | 'income';
  category: string;
}

const EMPTY_DRAFT: RuleDraft = {
  name: '',
  packageMatch: '',
  contains: '',
  excludes: '',
  amountRegex: '',
  direction: 'expense',
  category: '',
};

/** 关键词输入框用逗号/空格分隔 */
function splitKeywords(value: string): string[] {
  return value
    .split(/[,，、;；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function draftFromRule(rule: CaptureRule): RuleDraft {
  return {
    name: rule.name,
    packageMatch: rule.packageMatch,
    contains: rule.contains.join('、'),
    excludes: rule.excludes.join('、'),
    amountRegex: rule.amountRegex,
    direction: rule.direction,
    category: rule.category,
  };
}

export default function CaptureRuleEditor() {
  const { t } = useT();
  const locale = useLocale();
  const { rules, settings, loadFromStorage, addRule, updateRule, removeRule, setSettings } =
    useCaptureRuleStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RuleDraft>(EMPTY_DRAFT);

  // 全局忽略项用文本框编辑，失焦时保存
  const [ignorePackagesText, setIgnorePackagesText] = useState('');
  const [ignoreKeywordsText, setIgnoreKeywordsText] = useState('');

  const [testText, setTestText] = useState('');
  const [testPackage, setTestPackage] = useState('');

  useEffect(() => {
    if (!useCaptureRuleStore.getState().loaded) void loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    setIgnorePackagesText(settings.ignorePackages.join('、'));
    setIgnoreKeywordsText(settings.ignoreKeywords.join('、'));
  }, [settings.ignorePackages, settings.ignoreKeywords]);

  // 测试框：用当前规则实时解析用户粘贴的消息
  const testResult = useMemo(() => {
    if (!testText.trim()) return null;
    return parseCapturedTransaction(testText, {
      packageName: testPackage,
      rules,
      settings,
    });
  }, [testText, testPackage, rules, settings]);

  const openNew = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setShowForm(true);
  };

  const openEdit = (rule: CaptureRule) => {
    setEditingId(rule.id);
    setDraft(draftFromRule(rule));
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const canSave =
    draft.name.trim().length > 0 &&
    (draft.contains.trim().length > 0 || draft.amountRegex.trim().length > 0);

  const handleSave = () => {
    if (!canSave) return;
    const payload = {
      name: draft.name.trim(),
      enabled: true,
      packageMatch: draft.packageMatch.trim(),
      contains: splitKeywords(draft.contains),
      excludes: splitKeywords(draft.excludes),
      amountRegex: draft.amountRegex.trim(),
      direction: draft.direction,
      category: draft.category,
    };

    if (editingId) {
      updateRule(editingId, payload);
    } else {
      addRule(payload);
    }
    closeForm();
  };

  const saveIgnoreSettings = () => {
    setSettings({
      ignorePackages: splitKeywords(ignorePackagesText),
      ignoreKeywords: splitKeywords(ignoreKeywordsText),
    });
  };

  const separator = t('settingsRules.separator');

  return (
    <div className="space-y-4">
      {/* 规则列表 */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{t('settingsRules.captureRule.hint')}</p>
        {!showForm && (
          <button
            type="button"
            onClick={openNew}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand/90"
          >
            <Plus size={13} aria-hidden="true" />
            {t('settingsRules.addRule')}
          </button>
        )}
      </div>

      {rules.length === 0 && !showForm && (
        <div className="rounded-xl border border-line bg-surface py-8 text-center">
          <p className="text-sm text-ink-muted">{t('settingsRules.rulesEmpty')}</p>
          <p className="mt-1 text-xs text-ink-subtle">
            {t('settingsRules.captureRule.emptyHint')}
          </p>
        </div>
      )}

      {rules.length > 0 && (
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className={cn(
                'flex items-start gap-3 rounded-xl border border-line bg-surface p-3',
                !rule.enabled && 'opacity-55',
              )}
            >
              <button
                type="button"
                onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
                aria-label={t(
                  rule.enabled
                    ? 'settingsRules.captureRule.disableAria'
                    : 'settingsRules.captureRule.enableAria',
                  { name: rule.name },
                )}
                aria-pressed={rule.enabled}
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                  rule.enabled ? 'border-brand bg-brand text-white' : 'border-line',
                )}
              >
                {rule.enabled && <Check size={12} aria-hidden="true" />}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{rule.name}</p>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  {[
                    t(
                      rule.direction === 'income'
                        ? 'settingsRules.captureRule.asIncome'
                        : 'settingsRules.captureRule.asExpense',
                    ),
                    rule.category &&
                      t('settingsRules.captureRule.withCategory', {
                        category: categoryLabel(locale, rule.category),
                      }),
                    rule.contains.length > 0 &&
                      t('settingsRules.captureRule.withContains', {
                        keywords: rule.contains.join('、'),
                      }),
                    rule.packageMatch &&
                      t('settingsRules.captureRule.withPackage', {
                        packageMatch: rule.packageMatch,
                      }),
                  ]
                    .filter(Boolean)
                    .join(separator)}
                </p>
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(rule)}
                  aria-label={t('settingsRules.captureRule.editAria', { name: rule.name })}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-canvas hover:text-brand"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  aria-label={t('settingsRules.captureRule.deleteAria', { name: rule.name })}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-expense-soft hover:text-expense"
                >
                  <Trash size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 新建 / 编辑表单 */}
      {showForm && (
        <div className="space-y-3 rounded-xl bg-canvas p-3">
          <div>
            <label htmlFor="cr-name" className="mb-1 block text-xs font-medium text-ink">
              {t('settingsRules.captureRule.name')}
            </label>
            <input
              id="cr-name"
              name="name"
              type="text"
              autoComplete="off"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t('settingsRules.captureRule.namePlaceholder')}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="cr-contains" className="mb-1 block text-xs font-medium text-ink">
              {t('settingsRules.captureRule.contains')}
            </label>
            <input
              id="cr-contains"
              name="contains"
              type="text"
              autoComplete="off"
              value={draft.contains}
              onChange={(e) => setDraft({ ...draft, contains: e.target.value })}
              placeholder={t('settingsRules.captureRule.containsPlaceholder')}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="cr-excludes" className="mb-1 block text-xs font-medium text-ink">
              {t('settingsRules.captureRule.excludes')}
            </label>
            <input
              id="cr-excludes"
              name="excludes"
              type="text"
              autoComplete="off"
              value={draft.excludes}
              onChange={(e) => setDraft({ ...draft, excludes: e.target.value })}
              placeholder={t('settingsRules.captureRule.excludesPlaceholder')}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="cr-regex" className="mb-1 block text-xs font-medium text-ink">
              {t('settingsRules.captureRule.amountRegex')}
            </label>
            <input
              id="cr-regex"
              name="amountRegex"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={draft.amountRegex}
              onChange={(e) => setDraft({ ...draft, amountRegex: e.target.value })}
              placeholder={t('settingsRules.captureRule.amountRegexPlaceholder')}
              className={cn(INPUT_CLASS, 'font-mono text-xs')}
            />
            <p className="mt-1 text-[11px] text-ink-subtle">
              {t('settingsRules.captureRule.amountRegexHint')}
            </p>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <span className="mb-1 block text-xs font-medium text-ink">
                {t('settingsRules.captureRule.direction')}
              </span>
              <div
                role="group"
                aria-label={t('settingsRules.captureRule.direction')}
                className="flex rounded-lg bg-surface p-0.5"
              >
                {(
                  [
                    { value: 'expense', labelKey: 'common.expense' },
                    { value: 'income', labelKey: 'common.income' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDraft({ ...draft, direction: opt.value })}
                    aria-pressed={draft.direction === opt.value}
                    className={cn(
                      'flex-1 rounded-md py-1.5 text-xs transition-colors',
                      draft.direction === opt.value
                        ? 'bg-surface font-medium text-ink shadow-sm'
                        : 'text-ink-muted',
                    )}
                  >
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1">
              <label htmlFor="cr-category" className="mb-1 block text-xs font-medium text-ink">
                {t('settingsRules.captureRule.category')}
              </label>
              <select
                id="cr-category"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className={INPUT_CLASS}
              >
                <option value="">{t('settingsRules.captureRule.autoCategory')}</option>
                {CATEGORIES.filter((c) => c.name !== '待确认').map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {categoryLabel(locale, cat.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <details className="rounded-lg bg-surface px-3 py-2">
            <summary className="cursor-pointer list-none text-xs font-medium text-ink [&::-webkit-details-marker]:hidden">
              {t('settingsRules.captureRule.packageMatch')}
            </summary>
            <div className="pt-2">
              <label htmlFor="cr-package" className="sr-only">
                {t('settingsRules.captureRule.packageName')}
              </label>
              <input
                id="cr-package"
                name="packageMatch"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={draft.packageMatch}
                onChange={(e) => setDraft({ ...draft, packageMatch: e.target.value })}
                placeholder={t('settingsRules.captureRule.packagePlaceholder')}
                className={cn(INPUT_CLASS, 'font-mono text-xs')}
              />
              <p className="mt-1 text-[11px] text-ink-subtle">
                {t('settingsRules.captureRule.packageHint')}
              </p>
            </div>
          </details>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {editingId ? t('settingsRules.saveChanges') : t('settingsRules.addRule')}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg bg-surface px-4 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* 测试框 */}
      <details className="group rounded-xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
          {t('settingsRules.captureRule.testTitle')}
          <ChevronDown
            size={15}
            className="text-ink-subtle transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="space-y-2 border-t border-line p-3">
          <label htmlFor="cr-test" className="sr-only">
            {t('settingsRules.captureRule.testTextLabel')}
          </label>
          <textarea
            id="cr-test"
            name="testText"
            rows={3}
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder={t('settingsRules.captureRule.testPlaceholder')}
            className={cn(INPUT_CLASS, 'resize-y')}
          />
          <label htmlFor="cr-test-pkg" className="sr-only">
            {t('settingsRules.captureRule.packageName')}
          </label>
          <input
            id="cr-test-pkg"
            name="testPackage"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={testPackage}
            onChange={(e) => setTestPackage(e.target.value)}
            placeholder={t('settingsRules.captureRule.testPackagePlaceholder')}
            className={cn(INPUT_CLASS, 'font-mono text-xs')}
          />

          {testText.trim().length > 0 && (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                'rounded-lg px-3 py-2.5 text-sm',
                testResult ? 'bg-income-soft text-income' : 'bg-canvas text-ink-muted',
              )}
            >
              {testResult ? (
                <>
                  <p className="font-medium">
                    {t('settingsRules.captureRule.testMatch', {
                      type: transactionTypeLabel(locale, testResult.transactionType),
                      amount: formatCurrency(Math.abs(testResult.amount)),
                    })}
                  </p>
                  <p className="mt-1 text-xs opacity-90">
                    {[
                      testResult.matchedRuleId
                        ? t('settingsRules.captureRule.testRuleHit', {
                            name: rules.find((r) => r.id === testResult.matchedRuleId)?.name ?? '',
                          })
                        : t('settingsRules.captureRule.testBuiltin'),
                      testResult.category &&
                        t('settingsRules.captureRule.testCategory', {
                          category: categoryLabel(locale, testResult.category),
                        }),
                      testResult.counterparty &&
                        t('settingsRules.captureRule.testCounterparty', {
                          counterparty: testResult.counterparty,
                        }),
                    ]
                      .filter(Boolean)
                      .join(separator)}
                  </p>
                </>
              ) : (
                <p>{t('settingsRules.captureRule.testNoMatch')}</p>
              )}
            </div>
          )}
        </div>
      </details>

      {/* 全局忽略 */}
      <details className="group rounded-xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
          {t('settingsRules.captureRule.globalIgnore')}
          <ChevronDown
            size={15}
            className="text-ink-subtle transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="space-y-3 border-t border-line p-3">
          <div>
            <label htmlFor="cr-ignore-pkg" className="mb-1 block text-xs font-medium text-ink">
              {t('settingsRules.captureRule.ignorePackages')}
            </label>
            <input
              id="cr-ignore-pkg"
              name="ignorePackages"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={ignorePackagesText}
              onChange={(e) => setIgnorePackagesText(e.target.value)}
              onBlur={saveIgnoreSettings}
              placeholder={t('settingsRules.captureRule.ignorePackagesPlaceholder')}
              className={cn(INPUT_CLASS, 'font-mono text-xs')}
            />
          </div>
          <div>
            <label htmlFor="cr-ignore-kw" className="mb-1 block text-xs font-medium text-ink">
              {t('settingsRules.captureRule.ignoreKeywords')}
            </label>
            <input
              id="cr-ignore-kw"
              name="ignoreKeywords"
              type="text"
              autoComplete="off"
              value={ignoreKeywordsText}
              onChange={(e) => setIgnoreKeywordsText(e.target.value)}
              onBlur={saveIgnoreSettings}
              placeholder={t('settingsRules.captureRule.ignoreKeywordsPlaceholder')}
              className={INPUT_CLASS}
            />
          </div>
          <p className="text-[11px] text-ink-subtle">
            {t('settingsRules.captureRule.ignoreNote')}
          </p>
        </div>
      </details>

      {/* 规则命中提示 */}
      {testResult?.category && (
        <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
          <CategoryIcon category={testResult.category} size={12} />
          {t('settingsRules.captureRule.testCategoryResult', {
            category: categoryLabel(locale, testResult.category),
          })}
        </p>
      )}
    </div>
  );
}
