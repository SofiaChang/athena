import fs from "node:fs/promises";
import path from "node:path";

const LINEAR_API_URL = "https://api.linear.app/graphql";
const DEFAULT_PROJECT_NAME = "Personal AI Agent Infrastructure";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optionalEnv(name) {
  const value = process.env[name]?.trim();
  return value || "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function linearRequest(apiKey, query, variables = {}, options = {}) {
  const retries = options.retries ?? 2;
  const authCandidates = apiKey.startsWith("Bearer ")
    ? [apiKey]
    : [`Bearer ${apiKey}`, apiKey];

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const authHeader = authCandidates[Math.min(attempt, authCandidates.length - 1)];
    const response = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (
        attempt < authCandidates.length - 1 &&
        (
          response.status === 401 ||
          response.status === 403 ||
          /api key as a Bearer token/i.test(body)
        )
      ) {
        continue;
      }
      if (attempt < retries && (response.status === 429 || response.status >= 500)) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
      throw new Error(`Linear request failed (${response.status}): ${body.slice(0, 280)}`);
    }

    const payload = await response.json();
    if (payload.errors && payload.errors.length > 0) {
      const message = payload.errors.map((e) => e.message).join("; ");
      if (attempt < retries && /rate limit|temporar|timeout|unavailable/i.test(message)) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
      throw new Error(message);
    }

    return payload.data;
  }

  throw new Error("Linear request failed after retries.");
}

function parseBrief(markdown) {
  const lines = markdown.split(/\r?\n/);
  const epics = [];

  let inEpicsSection = false;
  let currentEpic = null;
  let currentStory = null;

  const pushStory = () => {
    if (currentEpic && currentStory) {
      currentEpic.stories.push(currentStory);
      currentStory = null;
    }
  };

  const pushEpic = () => {
    pushStory();
    if (currentEpic) {
      epics.push(currentEpic);
      currentEpic = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === "## Epics & Stories") {
      inEpicsSection = true;
      continue;
    }
    if (!inEpicsSection) continue;

    if (line.startsWith("## ") && line !== "## Epics & Stories") {
      break;
    }

    const epicMatch = line.match(/^###\s+Epic\s+(\d+)\s*:\s*(.+)$/);
    if (epicMatch) {
      pushEpic();
      currentEpic = {
        id: `E${epicMatch[1]}`,
        title: epicMatch[2].trim(),
        description: "",
        stories: [],
      };
      continue;
    }

    const storyMatch = line.match(/^####\s+Story\s+(\d+\.\d+)\s*:\s*(.+)$/);
    if (storyMatch) {
      pushStory();
      currentStory = {
        id: `S${storyMatch[1]}`,
        title: storyMatch[2].trim(),
        description: "",
        tasks: [],
      };
      continue;
    }

    if (currentEpic && !currentStory && line.startsWith("**Goal:**")) {
      currentEpic.description = line.replace("**Goal:**", "").trim();
      continue;
    }

    if (currentStory && line.startsWith("Route:")) {
      const routeLine = line.replace(/^Route:\s*/, "").trim();
      currentStory.description = currentStory.description
        ? `${currentStory.description} ${routeLine}`
        : routeLine;
      continue;
    }

    if (currentStory && line.startsWith("- ")) {
      const title = line.slice(2).trim();
      if (!title) continue;
      currentStory.tasks.push({
        id: `T${currentStory.id.slice(1)}.${currentStory.tasks.length + 1}`,
        title,
      });
    }
  }

  pushEpic();

  return { epics };
}

async function readJson(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const apiKey = requiredEnv("LINEAR_API_KEY");
  const teamKey = requiredEnv("LINEAR_TEAM_KEY");
  const projectIdOverride = optionalEnv("LINEAR_PROJECT_ID");
  const projectName = optionalEnv("LINEAR_PROJECT_NAME") || DEFAULT_PROJECT_NAME;
  const dryRun = optionalEnv("LINEAR_DRY_RUN").toLowerCase() === "true";

  const repoRoot = process.cwd();
  const briefPath = optionalEnv("ATHENA_BRIEF_PATH") || path.join(repoRoot, "personal-ai-agent-project-brief.md");
  const mapPath = optionalEnv("LINEAR_SYNC_MAP_PATH") || path.join(repoRoot, ".linear-sync-map.json");

  const brief = await fs.readFile(briefPath, "utf8");
  const data = parseBrief(brief);

  if (!data.epics.length) {
    throw new Error(`No epics parsed from ${briefPath}`);
  }

  const teamsData = await linearRequest(
    apiKey,
    `
      query Teams {
        teams {
          nodes {
            id
            key
            name
          }
        }
      }
    `
  );

  const team = teamsData.teams.nodes.find((t) => t.key.toLowerCase() === teamKey.toLowerCase());
  if (!team) {
    throw new Error(`Team key '${teamKey}' not found in workspace.`);
  }

  const syncMap = await readJson(mapPath, {
    projectsByTeam: {},
    workspaces: {},
  });

  let project = null;
  if (projectIdOverride) {
    project = { id: projectIdOverride, name: "Existing project", url: "" };
  } else if (syncMap.projectsByTeam[team.id]) {
    project = { id: syncMap.projectsByTeam[team.id], name: "Mapped project", url: "" };
  }

  if (!project) {
    const projectDescription = [
      "Imported from personal-ai-agent-project-brief.md.",
      `Epics: ${data.epics.length}`,
      `Stories: ${data.epics.reduce((n, epic) => n + epic.stories.length, 0)}`,
      `Tasks: ${data.epics.reduce((n, epic) => n + epic.stories.reduce((s, story) => s + story.tasks.length, 0), 0)}`,
    ].join("\n");

    if (dryRun) {
      project = { id: "dry-run-project", name: projectName, url: "" };
    } else {
      const projectCreateMutation = `
        mutation ProjectCreate($input: ProjectCreateInput!) {
          projectCreate(input: $input) {
            success
            project {
              id
              name
              url
            }
          }
        }
      `;

      let projectData;
      try {
        projectData = await linearRequest(apiKey, projectCreateMutation, {
          input: {
            name: projectName,
            description: projectDescription,
            teamIds: [team.id],
          },
        });
      } catch {
        projectData = await linearRequest(apiKey, projectCreateMutation, {
          input: {
            name: projectName,
            description: projectDescription,
            teamId: team.id,
          },
        });
      }

      project = projectData.projectCreate.project;
    }
  }

  syncMap.projectsByTeam[team.id] = project.id;

  const workspaceKey = `${team.id}:${project.id}`;
  const workspaceMap = syncMap.workspaces[workspaceKey] || {
    epics: {},
    stories: {},
    tasks: {},
  };

  const issueCreateMutation = `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
          title
        }
      }
    }
  `;

  const summary = {
    projectId: project.id,
    projectName: project.name,
    createdEpics: 0,
    createdFeatures: 0,
    createdTasks: 0,
    reused: 0,
    failed: 0,
    dryRun,
  };

  const persistSyncMap = async () => {
    syncMap.workspaces[workspaceKey] = workspaceMap;
    await writeJson(mapPath, syncMap);
  };

  for (const epic of data.epics) {
    let epicIssue = workspaceMap.epics[epic.id] || null;

    if (!epicIssue) {
      if (dryRun) {
        epicIssue = { id: `dry-${epic.id}`, identifier: epic.id };
      } else {
        try {
          const result = await linearRequest(apiKey, issueCreateMutation, {
            input: {
              teamId: team.id,
              projectId: project.id,
              title: `${epic.id} ${epic.title}`,
              description: epic.description || `Epic ${epic.id}`,
            },
          });
          epicIssue = result.issueCreate.issue;
          summary.createdEpics += 1;
        } catch {
          summary.failed += 1;
          continue;
        }
      }
      workspaceMap.epics[epic.id] = epicIssue;
      if (!dryRun) {
        await persistSyncMap();
      }
      if (dryRun) summary.createdEpics += 1;
    } else {
      summary.reused += 1;
    }

    for (const story of epic.stories) {
      const storyKey = `${epic.id}:${story.id}`;
      let storyIssue = workspaceMap.stories[storyKey] || null;

      if (!storyIssue) {
        if (dryRun) {
          storyIssue = { id: `dry-${story.id}`, identifier: story.id };
        } else {
          try {
            const result = await linearRequest(apiKey, issueCreateMutation, {
              input: {
                teamId: team.id,
                projectId: project.id,
                parentId: epicIssue.id,
                title: `${story.id} ${story.title}`,
                description: story.description || `Feature ${story.id}`,
              },
            });
            storyIssue = result.issueCreate.issue;
            summary.createdFeatures += 1;
          } catch {
            summary.failed += 1;
            continue;
          }
        }
        workspaceMap.stories[storyKey] = storyIssue;
        if (!dryRun) {
          await persistSyncMap();
        }
        if (dryRun) summary.createdFeatures += 1;
      } else {
        summary.reused += 1;
      }

      for (const task of story.tasks) {
        const taskKey = `${storyKey}:${task.id}`;
        if (workspaceMap.tasks[taskKey]) {
          summary.reused += 1;
          continue;
        }

        if (dryRun) {
          workspaceMap.tasks[taskKey] = { id: `dry-${task.id}`, identifier: task.id };
          summary.createdTasks += 1;
          continue;
        }

        try {
          const result = await linearRequest(apiKey, issueCreateMutation, {
            input: {
              teamId: team.id,
              projectId: project.id,
              parentId: storyIssue.id,
              title: `${task.id} ${task.title}`,
              description: `Task ${task.id}`,
            },
          });
          workspaceMap.tasks[taskKey] = result.issueCreate.issue;
          summary.createdTasks += 1;
          await persistSyncMap();
        } catch {
          summary.failed += 1;
        }
      }
    }
  }

  await persistSyncMap();

  const projectUrl = project.url || "";
  console.log(JSON.stringify({ ...summary, projectUrl }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
