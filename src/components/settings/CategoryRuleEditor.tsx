// ============================================================
// CategoryRuleEditor 组件 - 分类规则编辑器
// ============================================================

import { useState } from 'react';
import { useClassificationStore } from '@/stores/classification-store';
import { CATEGORIES } from '@/types';
import type { ClassificationRule } from '@/types';

export default function CategoryRuleEditor() {
  const { customRules, addCustomRule, updateCustomRule, deleteCustomRule, loadFromStorage } =
    useClassificationStore();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [keywords, setKeywords] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0].name);

  // 确保已加载
  if (!useClassificationStore.getState().loaded) {
    loadFromStorage();
  }

  const handleSubmit = () => {
    const kwList = keywords
      .split(/[,，、\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);

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
    setKeywords(rule.keywords.join('，'));
    setCategory(rule.category);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    deleteCustomRule(id);
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
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">自定义分类规则</h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            + 添加规则
          </button>
        )}
      </div>

      {/* 添加/编辑表单 */}
      {showForm && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              关键词（用逗号或空格分隔）
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="例如：星巴克，瑞幸，Manner"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              目标分类
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {CATEGORIES.filter((c) => c.name !== '待确认').map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!keywords.trim()}
              className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {editId ? '保存修改' : '添加规则'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 自定义规则列表 */}
      {customRules.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <p className="text-sm">暂无自定义规则</p>
          <p className="text-xs mt-1">添加关键词规则可自动分类交易记录</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customRules.map((rule) => {
            const cat = getCategoryInfo(rule.category);
            return (
              <div
                key={rule.id}
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-shadow"
              >
                {/* 分类标签 */}
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                  style={{ backgroundColor: cat.color + '18', color: cat.color }}
                >
                  {cat.icon} {cat.name}
                </span>

                {/* 关键词列表 */}
                <div className="flex-1 flex flex-wrap gap-1">
                  {rule.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                    >
                      {kw}
                    </span>
                  ))}
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(rule)}
                    className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                    title="编辑"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 内置规则提示 */}
      <details className="text-sm text-gray-500">
        <summary className="cursor-pointer hover:text-gray-700">
          查看内置分类规则（{CATEGORIES.filter((c) => c.name !== '待确认').length}个分类）
        </summary>
        <div className="mt-2 space-y-1 pl-4">
          {CATEGORIES.filter((c) => c.name !== '待确认').map((cat) => (
            <div key={cat.name} className="flex items-start gap-2">
              <span>
                {cat.icon} {cat.name}:
              </span>
              <span className="text-gray-400 text-xs">
                {cat.name === '餐饮美食' && '美团、饿了么、星巴克、外卖...'}
                {cat.name === '交通出行' && '滴滴、高德、地铁、公交...'}
                {cat.name === '购物消费' && '淘宝、京东、拼多多、超市...'}
                {cat.name === '休闲娱乐' && '电影、游戏、KTV、旅游...'}
                {cat.name === '居住生活' && '房租、物业、水电、宽带...'}
                {cat.name === '医疗健康' && '医院、药房、体检、保险...'}
                {cat.name === '教育学习' && '培训、课程、书籍、考试...'}
                {cat.name === '其他' && '转账、红包、提现、退款...'}
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}