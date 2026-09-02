import React, { useEffect, useState, useRef } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { aiApi, ChatResponsePayload } from '../../api/ai';
import { ChatMessage } from '../../types/ai';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Sparkles,
  Send,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  Terminal,
  Activity,
} from 'lucide-react';

export const AIChatPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [telemetry, setTelemetry] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadTelemetry = async () => {
    if (!currentWorkspace) return;
    try {
      const data = await aiApi.getMonitoring(currentWorkspace.id);
      setTelemetry(data);
    } catch (err) {
      console.error('Failed to load AI telemetry:', err);
    }
  };

  useEffect(() => {
    loadTelemetry();
  }, [currentWorkspace?.id]);

  const handleSend = async (e?: React.FormEvent, presetMessage?: string) => {
    if (e) e.preventDefault();
    const query = presetMessage || input;
    if (!currentWorkspace || !query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      content: query.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!presetMessage) setInput('');
    setIsLoading(true);

    try {
      const res: ChatResponsePayload = await aiApi.chat(
        currentWorkspace.id,
        userMsg.content,
        conversationId
      );

      setConversationId(res.conversation_id);

      const agentMsg: ChatMessage = {
        id: res.run_id,
        sender: 'agent',
        content: res.response,
        plan: res.plan,
        tokens_used: res.tokens_used,
        execution_time_ms: res.execution_time_ms,
        pending_approvals: res.pending_approvals,
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, agentMsg]);
      loadTelemetry();
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: 'agent',
        content: `⚠️ Error: ${err.message || 'Failed to communicate with Manager Agent.'}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveAction = async (approvalId: string) => {
    if (!currentWorkspace) return;
    try {
      await aiApi.approve(currentWorkspace.id, approvalId);
      alert('Action approved and executed successfully by the backend!');
      loadTelemetry();
      // Remove approval from visible list or update state
      setMessages((prev) =>
        prev.map((m) => {
          if (m.pending_approvals) {
            return {
              ...m,
              pending_approvals: m.pending_approvals.filter((a) => a.approval_id !== approvalId),
            };
          }
          return m;
        })
      );
    } catch (err: any) {
      alert(err.message || 'Failed to approve action. Verification check failed.');
    }
  };

  const handleRejectAction = async (approvalId: string) => {
    if (!currentWorkspace) return;
    const reason = prompt('Please enter a rejection reason:') || undefined;
    try {
      await aiApi.reject(currentWorkspace.id, approvalId, reason);
      alert('Action rejected.');
      loadTelemetry();
      setMessages((prev) =>
        prev.map((m) => {
          if (m.pending_approvals) {
            return {
              ...m,
              pending_approvals: m.pending_approvals.filter((a) => a.approval_id !== approvalId),
            };
          }
          return m;
        })
      );
    } catch (err: any) {
      alert(err.message || 'Failed to reject action.');
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        Please select or create a startup workspace first.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-5xl mx-auto">
      {/* Header & Telemetry Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-400" />
            AI Manager Agent & Multi-Agent Core
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Planning, tool dispatching, risk analysis, and human approval workflow.
          </p>
        </div>

        {telemetry && (
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400" />
              {telemetry.total_runs} runs
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-brand-400" />
              {telemetry.total_tokens.toLocaleString()} tokens
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              {telemetry.avg_execution_time_ms}ms avg
            </span>
          </div>
        )}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
        {messages.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Startup Operating System AI</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Ask the Manager Agent to analyze projects, break down goals, suggest task allocations,
                or generate health reports.
              </p>
            </div>

            {/* Quick Prompts */}
            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto pt-2">
              <button
                onClick={() =>
                  handleSend(undefined, 'What is the status of our projects and tasks? Give me a health report.')
                }
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-colors"
              >
                📊 Generate startup health report
              </button>
              <button
                onClick={() =>
                  handleSend(undefined, 'Please create task Build automated API test suite with high priority.')
                }
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-colors"
              >
                ⚡ Propose task (triggers Approval Gate)
              </button>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[11px] font-semibold text-slate-400">
                  {m.sender === 'user' ? 'You' : 'AI Manager Agent'}
                </span>
                <span className="text-[10px] text-slate-500">{m.timestamp}</span>
              </div>

              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-brand-600 text-white shadow-lg'
                    : 'bg-slate-800/80 border border-slate-700/60 text-slate-200'
                }`}
              >
                {/* Agent Plan Decomposition if present */}
                {m.plan && (
                  <div className="mb-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40 text-[11px] space-y-1">
                    <span className="font-bold text-brand-400 flex items-center gap-1">
                      <Terminal className="w-3 h-3" /> Execution Plan:
                    </span>
                    <p className="text-slate-300 whitespace-pre-wrap font-mono">{m.plan}</p>
                  </div>
                )}

                <div className="whitespace-pre-wrap font-sans">{m.content}</div>

                {/* Inline Human Approval Action Cards */}
                {m.pending_approvals && m.pending_approvals.length > 0 && (
                  <div className="mt-4 space-y-3 pt-3 border-t border-slate-700">
                    {m.pending_approvals.map((appr) => (
                      <div
                        key={appr.approval_id}
                        className="bg-slate-900 border border-amber-500/40 rounded-xl p-3 space-y-2 shadow-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                            <ShieldAlert className="w-4 h-4" />
                            <span>Action Staged for Human Approval</span>
                          </div>
                          <Badge variant={appr.risk_level === 'HIGH' ? 'danger' : 'warning'}>
                            {appr.risk_level} RISK
                          </Badge>
                        </div>

                        <div className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded border border-slate-800 font-mono">
                          <div>
                            <span className="text-slate-500">Tool:</span> {appr.action}
                          </div>
                          <div>
                            <span className="text-slate-500">Parameters:</span>{' '}
                            {JSON.stringify(appr.payload)}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-red-400 hover:text-red-300"
                            onClick={() => handleRejectAction(appr.approval_id)}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            className="text-xs bg-emerald-600 hover:bg-emerald-500"
                            onClick={() => handleApproveAction(appr.approval_id)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve & Execute
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Execution Telemetry Footer */}
                {m.tokens_used !== undefined && (
                  <div className="mt-2 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{m.tokens_used} tokens</span>
                    <span>{m.execution_time_ms}ms latency</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
            <Sparkles className="w-3.5 h-3.5 animate-spin text-brand-400" />
            <span>Manager Agent is planning and executing tools...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={(e) => handleSend(e)} className="pt-3 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          placeholder="Ask the AI Manager (e.g. 'Report project health' or 'Create task...') "
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          disabled={isLoading}
        />
        <Button variant="primary" size="md" type="submit" isLoading={isLoading}>
          <Send className="w-4 h-4 mr-1.5" /> Send
        </Button>
      </form>
    </div>
  );
};
