export const features = [
  { number: '01', name: 'Repository review', copy: 'Read selected setup files for execution signals.', href: '#review' },
  { number: '02', name: 'Execution preview', copy: 'Trace potential commands without running them.', href: '#replay' },
  { number: '03', name: 'Package checks', copy: 'Check npm, PyPI and OSV advisory evidence.', href: '#packages' },
]

export const stages = [
  { name: 'Clone', command: 'git clone', copy: 'Copies the project files.', detail: 'A normal clone does not run the project’s setup scripts. Review the files before trusting the workspace.', checkpoint: 'Inspect first' },
  { name: 'Open', command: 'Open workspace', copy: 'Editor and agent trust begins.', detail: 'Editor tasks, devcontainers or an AI agent can act on repository instructions when enabled or approved. Keep unfamiliar workspaces in restricted mode.', checkpoint: 'Review workspace trust' },
  { name: 'Install', command: 'npm install / pip install', copy: 'Dependencies can execute code.', detail: 'npm lifecycle scripts and Python build hooks can run during installation. A familiar package name or lockfile alone is not a trust guarantee.', checkpoint: 'Inspect scripts and dependencies' },
  { name: 'Run', command: 'npm start / python app.py', copy: 'Code uses the process’s access.', detail: 'Running code can read reachable files, contact the network and use exposed credentials. It does not automatically gain administrator privileges.', checkpoint: 'Isolate and limit permissions' },
]

export const incidents = [
  {
    name: 'Nx Console', date: 'May 2026', dateTime: '2026-05', category: 'Dependency → extension',
    summary: 'A stolen developer credential became a compromised editor extension.',
    entry: 'Nx reports that a contributor installed a malicious TanStack dependency in an external repository. The payload stole a GitHub CLI credential.',
    observed: 'An attacker later published Nx Console 18.95.0. Its payload ran on extension activation, harvested credentials and wrote persistence artifacts.',
    boundary: 'The incident concerned this specific extension version; Nx says the Nx CLI, official plugins and Nx Cloud were not affected.',
    lesson: 'A dependency installed on one laptop can expose publishing access. Separate release credentials from everyday development.',
    source: 'Nx incident postmortem', url: 'https://nx.dev/blog/nx-console-v18-95-0-postmortem',
  },
  {
    name: 'Shai-Hulud', date: 'September 2025', dateTime: '2025-09', category: 'Compromised npm packages',
    summary: 'Stolen tokens let malicious packages spread to more packages.',
    entry: 'The campaign compromised npm packages and scanned affected environments for GitHub tokens and cloud API keys.',
    observed: 'CISA reports credential exfiltration, public exposure of stolen secrets on GitHub and automated publication of further compromised packages.',
    boundary: 'This describes the September 2025 campaign, not every npm package. Exposure depended on affected dependencies and accessible credentials.',
    lesson: 'Review transitive dependencies, isolate installations and restrict publishing tokens. If exposed, revoke and rotate credentials; deleting a package is not enough.',
    source: 'CISA incident alert', url: 'https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem',
  },
  {
    name: 'tj-actions / changed-files', date: 'March 2025', dateTime: '2025-03', category: 'Third-party CI action',
    summary: 'A trusted workflow component exposed build secrets in logs.',
    entry: 'A compromised third-party GitHub Action ran inside CI workflows, crossing the same trust boundary as other build dependencies.',
    observed: 'CISA warned of disclosure of access keys, GitHub personal access tokens, npm tokens and private RSA keys, including through public workflow logs.',
    boundary: 'Using GitHub Actions alone did not imply exposure. Affected workflow runs and the credentials available to them needed investigation.',
    lesson: 'Review third-party actions, pin reviewed full commit SHAs and give workflows minimal permissions. Audit logs and rotate exposed secrets after an incident.',
    source: 'CISA incident alert', url: 'https://www.cisa.gov/news-events/alerts/2025/03/18/supply-chain-compromise-third-party-tj-actionschanged-files-cve-2025-30066-and-reviewdogaction',
  },
]

export const exposures = [
  {
    name: 'Credentials & accounts', icon: 'key', label: 'Access can leave your machine',
    copy: 'Tokens, SSH keys and cloud credentials can be copied or used.',
    pathway: 'An install hook or running process reads accessible environment variables, configuration files or authenticated tools.',
    consequence: 'Stolen credentials may permit account access, unwanted cloud charges or further intrusion—within those credentials’ permissions.',
    action: 'Use a disposable environment without personal secrets. Restrict token scopes and rotate credentials after suspected exposure.',
    incident: 1,
  },
  {
    name: 'Source & software releases', icon: 'file', label: 'One developer can become a distribution point',
    copy: 'Publishing access can turn a local compromise into someone else’s dependency.',
    pathway: 'A stolen repository or package-publishing token is used outside the original laptop.',
    consequence: 'Attackers may change code, expose private repositories or distribute modified releases to colleagues and customers.',
    action: 'Separate publishing identities, review release workflows and require independent approval for production releases.',
    incident: 0,
  },
  {
    name: 'Files & connected systems', icon: 'system', label: 'The impact depends on reachable access',
    copy: 'Accessible files can be copied, altered or deleted; unwanted processes can persist.',
    pathway: 'A process uses filesystem, network or session access already available to the user or CI job.',
    consequence: 'Potential outcomes include lost work, leaked project data, tampered builds and service disruption. Administrator access is not automatic.',
    action: 'Limit mounted files and network access. Avoid running unfamiliar projects in a logged-in personal or production environment.',
    incident: 0,
  },
]
