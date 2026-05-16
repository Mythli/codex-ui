import { FiBox, FiCpu, FiEdit3, FiFolder, FiRefreshCw } from "react-icons/fi";
import type { ChatSummary, ProjectSummary } from "../types";

export function Sidebar({
  status,
  projects,
  selectedProject,
  projectsLoading,
  chats,
  threadId,
  selectedChatLoading,
  isStreaming,
  onRefreshProjects,
  onSelectProject,
  onNewProjectChat,
  onSelectChat
}: {
  status: string;
  projects: ProjectSummary[];
  selectedProject: string;
  projectsLoading: boolean;
  chats: ChatSummary[];
  threadId: string;
  selectedChatLoading: string;
  isStreaming: boolean;
  onRefreshProjects: () => void;
  onSelectProject: (cwd: string) => void;
  onNewProjectChat: (cwd: string) => void;
  onSelectChat: (chat: ChatSummary) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebarBrand">
        <div className="avatarCore">CX</div>
        <div>
          <h1>Codex API</h1>
          <p>{status}</p>
        </div>
      </div>

      <nav className="utilityNav">
        <button type="button"><FiBox /> Plugins</button>
        <button type="button"><FiCpu /> Automations</button>
      </nav>

      <div className="sidebarSection">
        <div className="sectionHeader">
          <span>Projects</span>
          <button className="iconButton" onClick={onRefreshProjects} disabled={projectsLoading || isStreaming} title="Refresh projects">
            <FiRefreshCw />
          </button>
        </div>

        <div className="projectTree">
          {projects.length === 0 ? (
            <div className="miniEmpty">No projects found.</div>
          ) : (
            projects.map((project) => (
              <div className="projectGroup" key={project.cwd}>
                <div className={`projectRow ${project.cwd === selectedProject ? "active" : ""}`}>
                  <button
                    className="projectButton"
                    onClick={() => onSelectProject(project.cwd)}
                    type="button"
                    disabled={isStreaming}
                  >
                    <FiFolder className="folderIcon" />
                    <span>{project.name}</span>
                  </button>
                  <button
                    className="newProjectChat"
                    onClick={() => onNewProjectChat(project.cwd)}
                    type="button"
                    title={`New chat in ${project.name}`}
                    disabled={isStreaming}
                  >
                    <FiEdit3 />
                  </button>
                </div>
                {project.cwd === selectedProject && (
                  <div className="nestedChats">
                    {chats.length === 0 ? (
                      <div className="miniEmpty">No saved chats found.</div>
                    ) : (
                      chats.map((chat) => (
                        <button
                          className={`chatOption ${chat.threadId === threadId ? "selected" : ""}`}
                          key={chat.threadId}
                          onClick={() => onSelectChat(chat)}
                          type="button"
                          disabled={isStreaming || selectedChatLoading === chat.threadId}
                        >
                          <span>{selectedChatLoading === chat.threadId ? "Loading chat..." : chat.title}</span>
                          <small>{relativeTime(chat.updatedAt)}</small>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function relativeTime(value: string | undefined) {
  if (!value) {
    return "";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h`;
  }
  return `${Math.round(hours / 24)}d`;
}
