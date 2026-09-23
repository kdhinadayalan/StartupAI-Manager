import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAIConversation } from '../../context/AIConversationContext';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  Bot,
  Sparkles,
  X,
  Send,
  Maximize2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

const QUICK_PROMPTS = [
  'Audit our runway',
  'Scan sprint risks',
  'Break down task',
  'Explain health score',
];

export const FloatingAIAssistant: React.FC = () => {
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();
  const {
    messages,
    isLoading,
    sendMessage,
    approveAction,
    rejectAction,
    clearConversation,
  } = useAIConversation();

  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suppress the floating assistant widget entirely on dedicated AI pages
  // to avoid redundant duplicate interfaces in the same window.
  const isDedicatedAIPage =
    location.pathname.startsWith('/ai-manager') ||
    location.pathname.startsWith('/ai-monitoring');

  // Close the popup panel whenever the route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = textToSend || inputMessage;
    if (!messageContent.trim() || isLoading || !currentWorkspace) return;
    if (!textToSend) setInputMessage('');
    await sendMessage(messageContent.trim());
  };

  if (isDedicatedAIPage) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      {/* 1. Trigger Floating Action Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 text-white shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20 focus:outline-none"
          title="Open AI Manager Agent Assistant"
          aria-label="Open AI Assistant"
        >
          {/* Subtle breathing outer glow ring */}
          <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 opacity-40 blur-sm group-hover:opacity-75 transition-opacity" />

          <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-white/20">
            <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
          </div>

          <span className="relative font-bold text-xs tracking-wide">
            Manager AI
          </span>

          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
        </button>
      )}

      {/* 2. Expanded Interactive Slide-Over Panel */}
      {isOpen && (
        <div className="flex flex-col w-[360px] sm:w-[420px] h-[580px] max-h-[85vh] bg-white dark:bg-[#252526] border border-slate-200 dark:border-[#2d2d2d] rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shadow-inner">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold tracking-wide">StartupAI Manager</h3>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                    Active
                  </span>
                </div>
                <p className="text-[10px] text-white/80 truncate max-w-[190px]">
                  {currentWorkspace?.name || 'Autonomous Assistant'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearConversation}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="New Chat / Reset Conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <Link
                to="/ai-manager"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="Expand to Full AI Manager Workspace"
              >
                <Maximize2 className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="Minimize Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-[#1e1e1e] border-b border-slate-100 dark:border-[#2d2d2d] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <Sparkles className="w-3 h-3 text-blue-500 shrink-0" />
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading || !currentWorkspace}
                className="shrink-0 px-2.5 py-1 text-[10px] font-medium rounded-full bg-white dark:bg-[#252526] border border-slate-200 dark:border-[#3c3c3c] hover:border-blue-400 dark:hover:border-blue-400 text-slate-700 dark:text-[#e6edf3] transition-all hover:bg-blue-50 dark:hover:bg-[#2a2d2e]"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 bg-slate-50/50 dark:bg-[#1e1e1e] text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'agent' && (
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-[#388bfd] shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className={`max-w-[85%] space-y-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Message Bubble */}
                  <div
                    className={`p-3 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none shadow-sm'
                        : 'bg-white dark:bg-[#252526] text-slate-800 dark:text-[#e6edf3] border border-slate-200/80 dark:border-[#2d2d2d] rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.content || (msg as any).text}
                  </div>

                  {/* Plan Badge if available */}
                  {msg.plan && (
                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 text-[11px] text-indigo-900 dark:text-indigo-300">
                      <span className="font-semibold block mb-0.5">Execution Plan:</span>
                      {msg.plan}
                    </div>
                  )}

                  {/* Staged Approvals */}
                  {msg.pending_approvals && msg.pending_approvals.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {msg.pending_approvals.map((approval) => (
                        <div
                          key={approval.approval_id}
                          className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/50 rounded-xl space-y-2"
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold text-amber-800 dark:text-amber-300">
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              Action Required: {approval.action}
                            </span>
                            <Badge variant={approval.risk_level === 'HIGH' ? 'danger' : 'warning'}>
                              {approval.risk_level}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300">
                            {approval.message}
                          </p>
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => approveAction(approval.approval_id)}
                              className="text-[10px] py-1 px-2.5 h-auto"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rejectAction(approval.approval_id)}
                              className="text-[10px] py-1 px-2.5 h-auto text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                              <XCircle className="w-3 h-3 mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 items-center">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-[#388bfd] shrink-0">
                  <Bot className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="p-3 bg-white dark:bg-[#252526] rounded-2xl rounded-bl-none border border-slate-200 dark:border-[#2d2d2d] text-[11px] text-slate-500 dark:text-[#9da7b3] flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]" />
                  <span className="ml-1">Synthesizing telemetry...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-3 bg-white dark:bg-[#1e1e1e] border-t border-slate-200 dark:border-[#2d2d2d]">
            {!currentWorkspace ? (
              <div className="text-[11px] text-center text-slate-400 dark:text-[#9da7b3] py-1">
                Please select an active workspace to chat with AI Manager.
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Ask Manager AI anything..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-[#252526] border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-[#1e1e1e] text-slate-900 dark:text-[#e6edf3] placeholder-slate-400 dark:placeholder-[#6e7681] focus:outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputMessage.trim()}
                  className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white shadow-md shadow-blue-500/20 transition-all flex items-center justify-center"
                  title="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
