#!/usr/bin/env python3
"""
ChessBlunders Vercel CLI - Read-only access to deployment data.

Requires a config.json file in the same directory with your Vercel token.

IMPORTANT: Global flags (--json, --limit) must come BEFORE the subcommand!
    CORRECT:   poetry run python vercel_cli.py --json deployments list
    WRONG:     poetry run python vercel_cli.py deployments list --json

PROJECT SHORTCUTS
=================
Use "web" or "dashboard" as shortcuts:
    --project web        = chess-blunders-org (chessblunders.org) -> web_app/
    --project dashboard  = chess-blunders-dashboard -> chessblunders-dashboard/

QUICK START
===========
    poetry run python vercel_cli.py status              # Quick overview of both projects
    poetry run python vercel_cli.py deployments list    # Recent deployments
    poetry run python vercel_cli.py projects list       # List tracked projects

DEPLOYMENTS
===========
    poetry run python vercel_cli.py deployments list
    poetry run python vercel_cli.py deployments list --project web
    poetry run python vercel_cli.py deployments list --project dashboard
    poetry run python vercel_cli.py deployments list --state ERROR
    poetry run python vercel_cli.py deployments list --state BUILDING
    poetry run python vercel_cli.py --limit 20 deployments list

    # Get full deployment ID with --json, then use for get/logs:
    poetry run python vercel_cli.py --json deployments list --project web
    poetry run python vercel_cli.py deployments get dpl_FULL_ID_HERE
    poetry run python vercel_cli.py deployments logs dpl_FULL_ID_HERE   # BUILD logs only

PROJECTS
========
    poetry run python vercel_cli.py projects list
    poetry run python vercel_cli.py projects get web
    poetry run python vercel_cli.py projects get dashboard
    poetry run python vercel_cli.py projects env web       # List env var names (values hidden)
    poetry run python vercel_cli.py projects env dashboard

DOMAINS
=======
    poetry run python vercel_cli.py domains list
    poetry run python vercel_cli.py domains list --project web

TIPS
====
- Deployment IDs are truncated in tables. Use --json to get full IDs for get/logs commands.
- States: READY, ERROR, BUILDING, QUEUED, CANCELED
- Only shows chess-blunders-org and chess-blunders-dashboard (ignores other Vercel projects)
- Build logs show full Next.js build output including route generation

GLOBAL OPTIONS (must come BEFORE subcommand)
============================================
    --json          Output raw JSON instead of formatted tables
    --limit N       Limit results (default: 10)
"""
import os
import sys
import json
import argparse
from pathlib import Path
from typing import Any, Dict, Optional, List
from datetime import datetime

import requests

try:
    from rich import print
    from rich.table import Table
    from rich.console import Console
    from rich.panel import Panel
    console = Console()
    HAS_RICH = True
except ImportError:
    HAS_RICH = False
    console = None

# Global config
CONFIG: Dict[str, Any] = {}
BASE_URL = "https://api.vercel.com"


def load_config() -> Dict[str, Any]:
    """Load config from JSON file."""
    config_path = Path(__file__).parent / 'config.json'
    if not config_path.exists():
        raise SystemExit(f"Config file not found: {config_path}\nCreate it with your Vercel token.")
    with open(config_path) as f:
        return json.load(f)


def init_config() -> None:
    """Load config."""
    global CONFIG
    CONFIG = load_config()
    if not CONFIG.get('vercel_token'):
        raise SystemExit("No vercel_token found in config.json")


def get_headers() -> Dict[str, str]:
    """Get auth headers."""
    return {"Authorization": f"Bearer {CONFIG['vercel_token']}"}


def get_team_param() -> Dict[str, str]:
    """Get team ID query param if set."""
    if CONFIG.get('team_id'):
        return {"teamId": CONFIG['team_id']}
    return {}


def resolve_project(name: str) -> str:
    """Resolve project shortcut (web/dashboard) to actual name."""
    if name in CONFIG.get('projects', {}):
        return CONFIG['projects'][name]['name']
    return name


def get_project_info(shortcut: str) -> Optional[Dict]:
    """Get project info from config."""
    return CONFIG.get('projects', {}).get(shortcut)


def api_get(endpoint: str, params: Optional[Dict] = None) -> Dict:
    """Make GET request to Vercel API."""
    url = f"{BASE_URL}{endpoint}"
    all_params = {**get_team_param(), **(params or {})}
    r = requests.get(url, headers=get_headers(), params=all_params)
    if r.status_code != 200:
        raise SystemExit(f"API Error {r.status_code}: {r.text}")
    return r.json()


def print_json(obj: Any) -> None:
    """Print object as formatted JSON."""
    print(json.dumps(obj, indent=2, sort_keys=True, default=str))


def format_timestamp(ts: int) -> str:
    """Format unix timestamp (ms) as readable date."""
    return datetime.fromtimestamp(ts / 1000).strftime('%Y-%m-%d %H:%M')


def format_age(ts: int) -> str:
    """Format timestamp as relative age."""
    now = datetime.now()
    dt = datetime.fromtimestamp(ts / 1000)
    diff = now - dt

    if diff.days > 0:
        return f"{diff.days}d ago"
    hours = diff.seconds // 3600
    if hours > 0:
        return f"{hours}h ago"
    minutes = diff.seconds // 60
    return f"{minutes}m ago"


def state_color(state: str) -> str:
    """Get color for deployment state."""
    colors = {
        "READY": "green",
        "ERROR": "red",
        "BUILDING": "yellow",
        "QUEUED": "blue",
        "CANCELED": "dim",
    }
    return colors.get(state, "white")


# ============================================================================
# Commands
# ============================================================================

def cmd_status(args: argparse.Namespace) -> None:
    """Show quick status of both projects."""
    print("\n[bold]ChessBlunders Vercel Status[/bold]\n" if HAS_RICH else "\nChessBlunders Vercel Status\n")

    for shortcut, info in CONFIG.get('projects', {}).items():
        project_name = info['name']

        # Get latest deployment
        data = api_get("/v6/deployments", {"projectId": project_name, "limit": 1})
        deployments = data.get("deployments", [])

        if deployments:
            d = deployments[0]
            state = d.get("readyState", d.get("state", "UNKNOWN"))
            age = format_age(d.get("createdAt", 0))
            url = d.get("url", "")

            if HAS_RICH:
                color = state_color(state)
                print(f"[bold]{shortcut}[/bold] ({info['domain']})")
                print(f"  State: [{color}]{state}[/{color}]  |  {age}")
                print(f"  URL: https://{url}")
                print(f"  Local: {info['local_path']}")
                print()
            else:
                print(f"{shortcut} ({info['domain']})")
                print(f"  State: {state}  |  {age}")
                print(f"  URL: https://{url}")
                print(f"  Local: {info['local_path']}")
                print()


def cmd_deployments_list(args: argparse.Namespace) -> None:
    """List deployments."""
    params: Dict[str, Any] = {"limit": args.limit}

    # Filter by project if specified
    if args.project:
        project_name = resolve_project(args.project)
        params["projectId"] = project_name
    else:
        # Default: only show our two projects
        pass  # Will filter after fetching

    if args.state:
        params["state"] = args.state.upper()

    data = api_get("/v6/deployments", params)
    deployments = data.get("deployments", [])

    # Filter to only our projects if no specific project requested
    if not args.project:
        our_projects = [p['name'] for p in CONFIG.get('projects', {}).values()]
        deployments = [d for d in deployments if d.get("name") in our_projects]

    if args.json:
        print_json(deployments)
        return

    if HAS_RICH:
        table = Table(title="Deployments")
        table.add_column("Project", style="cyan")
        table.add_column("State")
        table.add_column("Age")
        table.add_column("Branch")
        table.add_column("Commit")
        table.add_column("ID", style="dim")

        for d in deployments:
            state = d.get("readyState", d.get("state", "?"))
            color = state_color(state)

            # Get project shortcut
            name = d.get("name", "")
            shortcut = name
            for s, info in CONFIG.get('projects', {}).items():
                if info['name'] == name:
                    shortcut = s
                    break

            meta = d.get("meta", {})
            branch = meta.get("githubCommitRef", "-")[:20]
            commit_msg = meta.get("githubCommitMessage", "-")[:30]

            table.add_row(
                shortcut,
                f"[{color}]{state}[/{color}]",
                format_age(d.get("createdAt", 0)),
                branch,
                commit_msg,
                d.get("uid", "")
            )
        console.print(table)
    else:
        for d in deployments:
            state = d.get("readyState", d.get("state", "?"))
            print(f"{d.get('name')}  {state}  {format_age(d.get('createdAt', 0))}  {d.get('uid', '')}")


def cmd_deployments_get(args: argparse.Namespace) -> None:
    """Get deployment details."""
    data = api_get(f"/v13/deployments/{args.deployment_id}")

    if args.json:
        print_json(data)
        return

    state = data.get("readyState", data.get("status", "?"))
    meta = data.get("meta", {})

    print(f"\nDeployment: {data.get('id', args.deployment_id)}")
    print(f"  Project: {data.get('name')}")
    print(f"  State: {state}")
    print(f"  URL: https://{data.get('url', '')}")
    print(f"  Created: {format_timestamp(data.get('createdAt', 0))}")
    print(f"  Branch: {meta.get('githubCommitRef', '-')}")
    print(f"  Commit: {meta.get('githubCommitMessage', '-')}")
    print(f"  Author: {meta.get('githubCommitAuthorName', '-')}")

    # Build times
    if data.get("buildingAt") and data.get("ready"):
        build_time = (data["ready"] - data["buildingAt"]) / 1000
        print(f"  Build Time: {build_time:.1f}s")


def cmd_deployments_logs(args: argparse.Namespace) -> None:
    """Get deployment build logs."""
    import builtins
    import sys
    data = api_get(f"/v2/deployments/{args.deployment_id}/events")

    if args.json:
        print_json(data)
        return

    events = data if isinstance(data, list) else data.get("events", data.get("logs", []))

    for event in events:
        if isinstance(event, dict):
            text = event.get("text", event.get("payload", {}).get("text", ""))
            if text:
                # Handle unicode on Windows
                try:
                    builtins.print(text)
                except UnicodeEncodeError:
                    builtins.print(text.encode('ascii', 'replace').decode('ascii'))


def cmd_projects_list(args: argparse.Namespace) -> None:
    """List projects (only our tracked ones)."""
    data = api_get("/v9/projects", {"limit": 100})
    projects = data.get("projects", [])

    # Filter to only our projects
    our_projects = {p['name']: shortcut for shortcut, p in CONFIG.get('projects', {}).items()}
    projects = [p for p in projects if p.get("name") in our_projects]

    if args.json:
        print_json(projects)
        return

    if HAS_RICH:
        table = Table(title="ChessBlunders Projects")
        table.add_column("Shortcut", style="cyan")
        table.add_column("Name")
        table.add_column("Framework")
        table.add_column("Local Path")

        for p in projects:
            name = p.get("name", "")
            shortcut = our_projects.get(name, name)
            local_path = CONFIG.get('projects', {}).get(shortcut, {}).get('local_path', '-')

            table.add_row(
                shortcut,
                name,
                p.get("framework", "-"),
                local_path
            )
        console.print(table)
    else:
        for p in projects:
            print(f"{p.get('name')}  framework={p.get('framework', '-')}")


def cmd_projects_get(args: argparse.Namespace) -> None:
    """Get project details."""
    project_name = resolve_project(args.project_name)
    data = api_get(f"/v9/projects/{project_name}")

    if args.json:
        print_json(data)
        return

    info = get_project_info(args.project_name)

    print(f"\nProject: {data.get('name')}")
    if info:
        print(f"  Shortcut: {args.project_name}")
        print(f"  Local Path: {info.get('local_path', '-')}")
    print(f"  Framework: {data.get('framework', '-')}")
    print(f"  Node Version: {data.get('nodeVersion', '-')}")
    print(f"  Created: {format_timestamp(data.get('createdAt', 0))}")

    # Domains
    targets = data.get("targets", {})
    prod = targets.get("production", {})
    if prod:
        print(f"  Production URL: https://{prod.get('url', '-')}")

    # Latest deployments info
    latest = data.get("latestDeployments", [])
    if latest:
        print(f"\n  Latest Deployments:")
        for d in latest[:3]:
            state = d.get("readyState", "?")
            print(f"    {d.get('id', '')[:12]}  {state}  {format_age(d.get('createdAt', 0))}")


def cmd_projects_env(args: argparse.Namespace) -> None:
    """List environment variables (names only, values hidden)."""
    project_name = resolve_project(args.project_name)
    data = api_get(f"/v9/projects/{project_name}/env")

    envs = data.get("envs", [])

    if args.json:
        # Strip values for safety
        safe_envs = [{"key": e.get("key"), "target": e.get("target")} for e in envs]
        print_json(safe_envs)
        return

    print(f"\nEnvironment Variables for {args.project_name}:")
    print("(Values hidden for security)\n")

    if HAS_RICH:
        table = Table()
        table.add_column("Key")
        table.add_column("Target")
        table.add_column("Type")

        for e in envs:
            targets = ", ".join(e.get("target", []))
            table.add_row(e.get("key", ""), targets, e.get("type", "-"))
        console.print(table)
    else:
        for e in envs:
            targets = ", ".join(e.get("target", []))
            print(f"  {e.get('key')}  [{targets}]")


def cmd_domains_list(args: argparse.Namespace) -> None:
    """List domains."""
    params = {"limit": args.limit}

    if args.project:
        project_name = resolve_project(args.project)
        # Get project domains
        data = api_get(f"/v9/projects/{project_name}/domains")
        domains = data.get("domains", [])
    else:
        data = api_get("/v5/domains", params)
        domains = data.get("domains", [])

    if args.json:
        print_json(domains)
        return

    if HAS_RICH:
        table = Table(title="Domains")
        table.add_column("Domain")
        table.add_column("Verified")

        for d in domains:
            name = d.get("name", d.get("domain", ""))
            verified = "Yes" if d.get("verified", True) else "No"
            table.add_row(name, verified)
        console.print(table)
    else:
        for d in domains:
            name = d.get("name", d.get("domain", ""))
            print(f"  {name}")


# ============================================================================
# CLI Parser
# ============================================================================

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog='vercel-cli',
        description='ChessBlunders Vercel CLI - Read-only access to deployment data.'
    )
    p.add_argument('--json', action='store_true', help='Output raw JSON')
    p.add_argument('--limit', type=int, default=10, help='Limit results (default: 10)')

    sub = p.add_subparsers(dest='cmd', required=True)

    # status - quick overview
    sub.add_parser('status', help='Quick status of both projects')

    # deployments
    pd = sub.add_parser('deployments', help='Deployment commands')
    sd = pd.add_subparsers(dest='deployments_cmd', required=True)

    pd_list = sd.add_parser('list', help='List deployments')
    pd_list.add_argument('--project', '-p', help='Filter by project (web/dashboard)')
    pd_list.add_argument('--state', '-s', help='Filter by state (READY, ERROR, BUILDING)')
    pd_list.set_defaults(func=cmd_deployments_list)

    pd_get = sd.add_parser('get', help='Get deployment details')
    pd_get.add_argument('deployment_id')
    pd_get.set_defaults(func=cmd_deployments_get)

    pd_logs = sd.add_parser('logs', help='Get deployment build logs')
    pd_logs.add_argument('deployment_id')
    pd_logs.set_defaults(func=cmd_deployments_logs)

    # projects
    pp = sub.add_parser('projects', help='Project commands')
    sp = pp.add_subparsers(dest='projects_cmd', required=True)

    pp_list = sp.add_parser('list', help='List projects')
    pp_list.set_defaults(func=cmd_projects_list)

    pp_get = sp.add_parser('get', help='Get project details')
    pp_get.add_argument('project_name', help='Project name or shortcut (web/dashboard)')
    pp_get.set_defaults(func=cmd_projects_get)

    pp_env = sp.add_parser('env', help='List environment variables')
    pp_env.add_argument('project_name', help='Project name or shortcut (web/dashboard)')
    pp_env.set_defaults(func=cmd_projects_env)

    # domains
    pdom = sub.add_parser('domains', help='Domain commands')
    sdom = pdom.add_subparsers(dest='domains_cmd', required=True)

    pdom_list = sdom.add_parser('list', help='List domains')
    pdom_list.add_argument('--project', '-p', help='Filter by project')
    pdom_list.set_defaults(func=cmd_domains_list)

    return p


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    init_config()

    if args.cmd == 'status':
        cmd_status(args)
    else:
        args.func(args)

    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
