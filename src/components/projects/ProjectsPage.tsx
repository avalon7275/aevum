import { useEffect } from "react";
import { Search, Music } from "lucide-react";
import { useProjectsStore } from "../../stores/projectsStore";
import { useProjectDetailStore } from "../../stores/projectDetailStore";
import { formatDuration, formatDate } from "../../lib/formatters";

export function ProjectsPage() {
  const { projects, loading, searchQuery, fetchProjects, setSearchQuery } =
    useProjectsStore();
  const openProject = useProjectDetailStore((s) => s.openProject);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filtered = searchQuery
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projects;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#111111]">
        <h1 className="text-sm font-semibold text-white/90">Projects</h1>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25"
          />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-52 pl-8 pr-3 py-1.5 text-xs bg-white/5 border border-white/5 rounded-md text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/15"
          />
        </div>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && projects.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/20">
            <Music size={32} className="mb-3 opacity-50" />
            <span className="text-sm">
              {searchQuery ? "No projects match your search" : "No projects yet"}
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((project) => (
              <button
                key={project.id}
                onClick={() => openProject(project.id)}
                className="w-full flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors group text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/80 group-hover:text-indigo-400 transition-colors truncate">
                      {project.name}
                    </span>
                    <span className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded shrink-0">
                      {project.daw}
                    </span>
                  </div>
                  <span className="text-xs text-white/25">
                    Last opened {formatDate(project.last_seen)}
                  </span>
                </div>
                <span className="text-sm text-white/50 font-mono shrink-0">
                  {formatDuration(project.total_seconds)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
