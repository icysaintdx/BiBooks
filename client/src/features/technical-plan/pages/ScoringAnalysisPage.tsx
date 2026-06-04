import { useState } from 'react';
import { useToast } from '../../../shared/ui';
import type { BackgroundTaskState, ScoringAnalysisResult } from '../types';

interface ScoringAnalysisPageProps {
  hasTechRequirements: boolean;
  analysis?: ScoringAnalysisResult;
  task?: BackgroundTaskState;
  onStartAnalysis: () => void;
}

const priorityLabels: Record<string, { label: string; color: string }> = {
  high: { label: '高优先级', color: '#ff4d4f' },
  medium: { label: '中优先级', color: '#faad14' },
  low: { label: '低优先级', color: '#52c41a' },
};

function ScoringAnalysisPage({ hasTechRequirements, analysis, task, onStartAnalysis }: ScoringAnalysisPageProps) {
  const { showToast } = useToast();
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const isRunning = task?.status === 'running';
  const selectedItem = analysis?.scoringItems.find((item) => item.id === selectedItemId);

  return (
    <div className="scoring-analysis-page">
      <div className="scoring-analysis-header">
        <div>
          <span className="section-kicker">智能分析</span>
          <strong>评分结构分析</strong>
          <p>自动解析技术评分要求，提取评分大类、权重分布和编写建议。</p>
        </div>
        <div className="scoring-analysis-actions">
          <button
            type="button"
            className="primary-action"
            onClick={onStartAnalysis}
            disabled={!hasTechRequirements || isRunning}
            title={!hasTechRequirements ? '请先完成招标文件解析，获取技术评分要求' : ''}
          >
            {isRunning ? '分析中...' : analysis ? '重新分析' : '开始评分分析'}
          </button>
        </div>
      </div>

      {!hasTechRequirements && (
        <div className="scoring-analysis-empty">
          <strong>尚未获取技术评分要求</strong>
          <p>请先在"招标文件解析"步骤中完成解析，获取技术评分要求后再进行评分分析。</p>
        </div>
      )}

      {hasTechRequirements && !analysis && !isRunning && (
        <div className="scoring-analysis-empty">
          <strong>点击"开始评分分析"</strong>
          <p>系统将自动分析技术评分要求，提取评分结构和权重分布。</p>
        </div>
      )}

      {isRunning && (
        <div className="scoring-analysis-running">
          <div className="scoring-analysis-progress-track">
            <span style={{ width: `${task?.progress || 0}%` }} />
          </div>
          <p>{task?.logs?.[task.logs.length - 1] || '正在分析评分结构...'}</p>
        </div>
      )}

      {analysis && (
        <div className="scoring-analysis-results">
          {/* 总览 */}
          <div className="scoring-overview">
            <div className="scoring-overview-card">
              <span>评分大类</span>
              <strong>{analysis.scoringItems.length}</strong>
            </div>
            <div className="scoring-overview-card">
              <span>总分</span>
              <strong>{analysis.totalScore}</strong>
            </div>
            {analysis.analysisSummary && (
              <div className="scoring-overview-summary">
                <p>{analysis.analysisSummary}</p>
              </div>
            )}
          </div>

          {/* 评分大类列表 */}
          <div className="scoring-items-section">
            <h4>评分大类</h4>
            <div className="scoring-items-grid">
              {analysis.scoringItems.map((item) => {
                const priority = priorityLabels[item.priority] || priorityLabels.medium;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`scoring-item-card${selectedItemId === item.id ? ' is-active' : ''}`}
                    onClick={() => setSelectedItemId(item.id === selectedItemId ? '' : item.id)}
                  >
                    <div className="scoring-item-head">
                      <span className="scoring-item-category">{item.category}</span>
                      <span className="scoring-item-score">{item.totalScore} 分</span>
                    </div>
                    <div className="scoring-item-bar">
                      <span style={{ width: `${item.percentage}%` }} />
                    </div>
                    <div className="scoring-item-meta">
                      <span style={{ color: priority.color }}>{priority.label}</span>
                      <span>{item.percentage.toFixed(1)}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 选中大类的子项 */}
          {selectedItem && selectedItem.subItems.length > 0 && (
            <div className="scoring-subitems-section">
              <h4>{selectedItem.category} - 评分子项</h4>
              <table className="scoring-subitems-table">
                <thead>
                  <tr>
                    <th>子项名称</th>
                    <th>分值</th>
                    <th>评分标准</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItem.subItems.map((sub, idx) => (
                    <tr key={idx}>
                      <td>{sub.name}</td>
                      <td>{sub.score}</td>
                      <td>{sub.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 编写建议 */}
          {analysis.recommendations.length > 0 && (
            <div className="scoring-recommendations-section">
              <h4>内容编写建议</h4>
              <ul className="scoring-recommendations-list">
                {analysis.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScoringAnalysisPage;
