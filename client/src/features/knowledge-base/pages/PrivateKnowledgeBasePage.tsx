import { useState, useEffect } from 'react';

interface KnowledgeCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    required?: boolean;
    options?: string[];
  }>;
}

interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  data: Record<string, unknown>;
  tags: string[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface CategoryStats {
  count: number;
  total_usage: number;
}

export default function PrivateKnowledgeBasePage() {
  const [categories, setCategories] = useState<Record<string, KnowledgeCategory>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [statistics, setStatistics] = useState<Record<string, CategoryStats>>({});
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // 加载分类和统计
  useEffect(() => {
    loadCategories();
    loadStatistics();
  }, []);

  // 加载知识项
  useEffect(() => {
    loadItems();
  }, [selectedCategory, searchKeyword]);

  const loadCategories = async () => {
    try {
      const result = await window.yibiao?.privateKnowledgeBase.getCategories();
      if (result) {
        setCategories(result);
      }
    } catch (err) {
      console.error('加载分类失败:', err);
    }
  };

  const loadStatistics = async () => {
    try {
      const result = await window.yibiao?.privateKnowledgeBase.getStatistics();
      if (result) {
        setStatistics(result);
      }
    } catch (err) {
      console.error('加载统计失败:', err);
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const result = await window.yibiao?.privateKnowledgeBase.listItems({
        category: selectedCategory || undefined,
        keyword: searchKeyword || undefined,
      });
      if (result) {
        setItems(result);
      }
    } catch (err) {
      console.error('加载知识项失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedCategory || !formData.title) return;

    try {
      await window.yibiao?.privateKnowledgeBase.createItem({
        category: selectedCategory,
        title: formData.title as string,
        data: formData,
        tags: [],
      });
      setShowCreateDialog(false);
      setFormData({});
      loadItems();
      loadStatistics();
    } catch (err) {
      console.error('创建失败:', err);
    }
  };

  const handleUpdate = async () => {
    if (!editingItem) return;

    try {
      await window.yibiao?.privateKnowledgeBase.updateItem({
        id: editingItem.id,
        updates: {
          title: formData.title as string,
          data: formData,
        },
      });
      setEditingItem(null);
      setFormData({});
      loadItems();
    } catch (err) {
      console.error('更新失败:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此知识项吗？')) return;

    try {
      await window.yibiao?.privateKnowledgeBase.deleteItem(id);
      loadItems();
      loadStatistics();
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const handleEdit = (item: KnowledgeItem) => {
    setEditingItem(item);
    setFormData({ title: item.title, ...item.data });
  };

  const handleSearch = () => {
    loadItems();
  };

  const getCategoryIcon = (categoryId: string) => {
    return categories[categoryId]?.icon || '📄';
  };

  const getCategoryName = (categoryId: string) => {
    return categories[categoryId]?.name || categoryId;
  };

  const renderFormField = (field: KnowledgeCategory['fields'][0]) => {
    const value = formData[field.id] as string;

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
            placeholder={`请输入${field.name}`}
          />
        );
      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
          >
            <option value="">请选择{field.name}</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
            placeholder={`请输入${field.name}`}
          />
        );
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
            placeholder={`请输入${field.name}`}
          />
        );
    }
  };

  return (
    <div className="private-kb-page">
      <div className="private-kb-header">
        <h2>私有知识库</h2>
        <p className="private-kb-description">
          管理企业专属标书知识，包括企业简介、团队信息、案例库、中标方案等
        </p>
      </div>

      <div className="private-kb-layout">
        {/* 左侧分类导航 */}
        <nav className="private-kb-sidebar">
          <div
            className={`category-item ${selectedCategory === null ? 'selected' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            <span className="category-icon">📁</span>
            <span className="category-name">全部</span>
            <span className="category-count">
              {Object.values(statistics).reduce((sum, s) => sum + s.count, 0)}
            </span>
          </div>
          {Object.entries(categories).map(([id, category]) => (
            <div
              key={id}
              className={`category-item ${selectedCategory === id ? 'selected' : ''}`}
              onClick={() => setSelectedCategory(id)}
            >
              <span className="category-icon">{category.icon}</span>
              <span className="category-name">{category.name}</span>
              <span className="category-count">{statistics[id]?.count || 0}</span>
            </div>
          ))}
        </nav>

        {/* 右侧内容区 */}
        <main className="private-kb-content">
          {/* 搜索和操作栏 */}
          <div className="private-kb-toolbar">
            <div className="search-bar">
              <input
                type="text"
                placeholder="搜索知识项..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button type="button" onClick={handleSearch}>搜索</button>
            </div>
            {selectedCategory && (
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  setFormData({});
                  setShowCreateDialog(true);
                }}
              >
                + 新增{getCategoryName(selectedCategory)}
              </button>
            )}
          </div>

          {/* 知识项列表 */}
          {loading ? (
            <div className="private-kb-loading">加载中...</div>
          ) : items.length === 0 ? (
            <div className="private-kb-empty">
              <p>暂无知识项</p>
              {selectedCategory && (
                <p>点击上方按钮添加{getCategoryName(selectedCategory)}</p>
              )}
            </div>
          ) : (
            <div className="private-kb-items">
              {items.map((item) => (
                <div key={item.id} className="knowledge-item-card">
                  <div className="item-header">
                    <span className="item-category-icon">{getCategoryIcon(item.category)}</span>
                    <span className="item-title">{item.title}</span>
                    <span className="item-usage">使用 {item.usage_count} 次</span>
                  </div>
                  <div className="item-preview">
                    {Object.entries(item.data)
                      .filter(([key]) => key !== 'title')
                      .slice(0, 3)
                      .map(([key, value]) => (
                        <span key={key} className="item-field">
                          <strong>{categories[item.category]?.fields.find((f) => f.id === key)?.name || key}:</strong>
                          {String(value).slice(0, 50)}
                        </span>
                      ))}
                  </div>
                  {item.tags.length > 0 && (
                    <div className="item-tags">
                      {item.tags.map((tag, i) => (
                        <span key={i} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="item-actions">
                    <button type="button" onClick={() => handleEdit(item)}>编辑</button>
                    <button type="button" onClick={() => handleDelete(item.id)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* 创建/编辑对话框 */}
      {(showCreateDialog || editingItem) && selectedCategory && (
        <div className="private-kb-dialog-overlay">
          <div className="private-kb-dialog">
            <div className="dialog-header">
              <h3>{editingItem ? '编辑' : '新增'}{getCategoryName(selectedCategory)}</h3>
              <button
                type="button"
                className="dialog-close"
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingItem(null);
                  setFormData({});
                }}
              >
                ✕
              </button>
            </div>
            <div className="dialog-body">
              {categories[selectedCategory]?.fields.map((field) => (
                <div key={field.id} className="form-field">
                  <label>
                    {field.name}
                    {field.required && <span className="required">*</span>}
                  </label>
                  {renderFormField(field)}
                </div>
              ))}
            </div>
            <div className="dialog-footer">
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingItem(null);
                  setFormData({});
                }}
              >
                取消
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={editingItem ? handleUpdate : handleCreate}
              >
                {editingItem ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
