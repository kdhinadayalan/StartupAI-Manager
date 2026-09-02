import React, { createContext, useContext, useEffect, useState } from 'react';
import { Workspace, WorkspaceCreatePayload, WorkspaceMember } from '../types/workspace';
import { Role } from '../types/auth';
import { workspaceApi } from '../api/workspaces';
import { useAuth } from './AuthContext';

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  members: WorkspaceMember[];
  isLoading: boolean;
  currentRole: Role | null;
  selectWorkspace: (workspaceId: string) => void;
  createWorkspace: (payload: WorkspaceCreatePayload) => Promise<Workspace>;
  refreshWorkspaces: () => Promise<void>;
  refreshMembers: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshMembers = async () => {
    if (!currentWorkspace || !user) return;
    try {
      const memberList = await workspaceApi.getMembers(currentWorkspace.id);
      setMembers(memberList);
      const myMembership = memberList.find((m) => m.user_id === user.id);
      if (myMembership) {
        setCurrentRole(myMembership.role);
      }
    } catch (err) {
      console.error('Failed to load workspace members:', err);
    }
  };

  const refreshWorkspaces = async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const list = await workspaceApi.list();
      setWorkspaces(list);

      const savedWorkspaceId = localStorage.getItem('current_workspace_id');
      const matched = list.find((w) => w.id === savedWorkspaceId);

      if (matched) {
        setCurrentWorkspace(matched);
      } else if (list.length > 0) {
        setCurrentWorkspace(list[0]);
        localStorage.setItem('current_workspace_id', list[0].id);
      } else {
        setCurrentWorkspace(null);
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshWorkspaces();
  }, [isAuthenticated]);

  useEffect(() => {
    if (currentWorkspace) {
      refreshMembers();
    } else {
      setMembers([]);
      setCurrentRole(null);
    }
  }, [currentWorkspace?.id]);

  const selectWorkspace = (workspaceId: string) => {
    const selected = workspaces.find((w) => w.id === workspaceId);
    if (selected) {
      setCurrentWorkspace(selected);
      localStorage.setItem('current_workspace_id', selected.id);
    }
  };

  const createWorkspace = async (payload: WorkspaceCreatePayload): Promise<Workspace> => {
    const created = await workspaceApi.create(payload);
    await refreshWorkspaces();
    selectWorkspace(created.id);
    return created;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces,
        members,
        isLoading,
        currentRole,
        selectWorkspace,
        createWorkspace,
        refreshWorkspaces,
        refreshMembers,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
