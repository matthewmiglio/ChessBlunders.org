#!/usr/bin/env python3
"""
ChessBlunders Supabase CLI - Read-only access to project data.

IMPORTANT: This is a READ-ONLY tool. No create, update, or delete operations.

CONFIG FILE
===========
Requires config.json in the same directory:
    {
        "supabase_access_token": "sbp_xxx...",
        "project_ref": "your-project-ref",
        "service_role_key": "eyJ...",
        "anon_key": "eyJ..."
    }

GLOBAL OPTIONS (must come BEFORE the command)
=============================================
    --json          Output raw JSON instead of formatted tables
    --limit N       Limit results for logs/auth (default: 25)

QUICK START
===========
    poetry run python supa_cli.py status                   # Project overview
    poetry run python supa_cli.py tables list              # List all tables
    poetry run python supa_cli.py data list profiles       # Query table data
    poetry run python supa_cli.py --json status            # JSON output

PROJECT STATUS
==============
    poetry run python supa_cli.py status
    poetry run python supa_cli.py --json status

LOGS (API request logs)
=======================
    poetry run python supa_cli.py logs list
    poetry run python supa_cli.py --limit 50 logs list
    # Note: --type filter available but API returns all logs

TABLES & SCHEMA
===============
    poetry run python supa_cli.py tables list              # All public tables
    poetry run python supa_cli.py tables get profiles      # Table details + row count
    poetry run python supa_cli.py columns profiles         # Column info for table
    poetry run python supa_cli.py --json tables list       # JSON output

TABLE DATA (PostgREST queries)
==============================
    poetry run python supa_cli.py data list profiles
    poetry run python supa_cli.py data list profiles --limit 5
    poetry run python supa_cli.py data list profiles --select "id,chess_username"
    poetry run python supa_cli.py data list profiles --filter "stripe_subscription_status=eq.active"
    poetry run python supa_cli.py data list games --order "played_at.desc" --limit 10
    poetry run python supa_cli.py data count games
    poetry run python supa_cli.py --json data list profiles --limit 3

    Filter operators (PostgREST syntax):
        eq.value     - equals
        neq.value    - not equals
        gt.value     - greater than
        lt.value     - less than
        gte.value    - greater or equal
        lte.value    - less or equal
        like.*text*  - pattern match
        is.null      - is null
        is.true      - is true

POLICIES (RLS)
==============
    poetry run python supa_cli.py policies list
    poetry run python supa_cli.py policies table profiles
    # Note: Falls back to dashboard link if API unavailable

STORAGE
=======
    poetry run python supa_cli.py storage buckets
    poetry run python supa_cli.py storage list <bucket-name>

EDGE FUNCTIONS
==============
    poetry run python supa_cli.py functions list

AUTH USERS
==========
    poetry run python supa_cli.py auth users
    poetry run python supa_cli.py --limit 10 auth users
    poetry run python supa_cli.py auth user <user-id>
    poetry run python supa_cli.py --json auth user <user-id>

EXAMPLES
========
    # Get active subscribers
    poetry run python supa_cli.py data list profiles --filter "stripe_subscription_status=eq.active"

    # Count games per table
    poetry run python supa_cli.py data count games

    # Get recent games with specific columns
    poetry run python supa_cli.py data list games --select "id,opponent,result" --order "played_at.desc" --limit 5

    # Export users to JSON
    poetry run python supa_cli.py --json auth users > users.json

    # Check project health
    poetry run python supa_cli.py status

TIPS
====
- Use --json for machine-readable output or piping to jq
- Use --select to limit columns and speed up large table queries
- Combine --filter, --order, and --limit for precise queries
- Table names are case-sensitive (use exact names from 'tables list')
"""
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
MANAGEMENT_API = "https://api.supabase.com"


def load_config() -> Dict[str, Any]:
    """Load config from JSON file."""
    config_path = Path(__file__).parent / 'config.json'
    if not config_path.exists():
        raise SystemExit(f"Config file not found: {config_path}\nCreate it with your Supabase credentials.")
    with open(config_path) as f:
        return json.load(f)


def init_config() -> None:
    """Load config."""
    global CONFIG
    CONFIG = load_config()
    required = ['supabase_access_token', 'project_ref', 'service_role_key']
    for key in required:
        if not CONFIG.get(key):
            raise SystemExit(f"Missing '{key}' in config.json")


def get_management_headers() -> Dict[str, str]:
    """Get headers for Management API."""
    return {
        "Authorization": f"Bearer {CONFIG['supabase_access_token']}",
        "Content-Type": "application/json"
    }


def get_postgrest_headers() -> Dict[str, str]:
    """Get headers for PostgREST API."""
    return {
        "apikey": CONFIG['service_role_key'],
        "Authorization": f"Bearer {CONFIG['service_role_key']}",
        "Content-Type": "application/json"
    }


def get_postgrest_url() -> str:
    """Get PostgREST base URL."""
    return f"https://{CONFIG['project_ref']}.supabase.co/rest/v1"


def get_auth_url() -> str:
    """Get Auth API base URL."""
    return f"https://{CONFIG['project_ref']}.supabase.co/auth/v1"


def management_get(endpoint: str, params: Optional[Dict] = None) -> Any:
    """Make GET request to Management API."""
    url = f"{MANAGEMENT_API}{endpoint}"
    r = requests.get(url, headers=get_management_headers(), params=params)
    if r.status_code != 200:
        raise SystemExit(f"Management API Error {r.status_code}: {r.text}")
    return r.json()


def postgrest_get(table: str, params: Optional[Dict] = None, head_only: bool = False) -> Any:
    """Make GET request to PostgREST API."""
    url = f"{get_postgrest_url()}/{table}"
    headers = get_postgrest_headers()
    if head_only:
        headers["Prefer"] = "count=exact"
        r = requests.head(url, headers=headers, params=params)
        if r.status_code != 200:
            raise SystemExit(f"PostgREST Error {r.status_code}: {r.text}")
        # Return count from content-range header
        content_range = r.headers.get("content-range", "")
        if "/" in content_range:
            return int(content_range.split("/")[1])
        return 0
    r = requests.get(url, headers=headers, params=params)
    if r.status_code != 200:
        raise SystemExit(f"PostgREST Error {r.status_code}: {r.text}")
    return r.json()


def auth_get(endpoint: str, params: Optional[Dict] = None) -> Any:
    """Make GET request to Auth Admin API."""
    url = f"{get_auth_url()}/admin{endpoint}"
    r = requests.get(url, headers=get_postgrest_headers(), params=params)
    if r.status_code != 200:
        raise SystemExit(f"Auth API Error {r.status_code}: {r.text}")
    return r.json()


def print_json(obj: Any) -> None:
    """Print object as formatted JSON."""
    print(json.dumps(obj, indent=2, sort_keys=True, default=str))


def format_timestamp(ts) -> str:
    """Format timestamp as readable date."""
    if not ts:
        return "-"
    try:
        # Handle integer timestamps (epoch)
        if isinstance(ts, (int, float)):
            # Convert to seconds: check if microseconds, milliseconds, or seconds
            if ts > 1e15:  # Microseconds
                ts = ts / 1_000_000
            elif ts > 1e12:  # Milliseconds
                ts = ts / 1000
            dt = datetime.fromtimestamp(ts)
            return dt.strftime('%Y-%m-%d %H:%M:%S')
        # Handle ISO string timestamps
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        return dt.strftime('%Y-%m-%d %H:%M')
    except Exception:
        return str(ts)[:16]


def format_age(ts: str) -> str:
    """Format timestamp as relative age."""
    if not ts:
        return "-"
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        now = datetime.now(dt.tzinfo)
        diff = now - dt
        if diff.days > 0:
            return f"{diff.days}d ago"
        hours = diff.seconds // 3600
        if hours > 0:
            return f"{hours}h ago"
        minutes = diff.seconds // 60
        return f"{minutes}m ago"
    except Exception:
        return ts[:16]


# ============================================================================
# Commands
# ============================================================================

def cmd_status(args: argparse.Namespace) -> None:
    """Show project status overview."""
    ref = CONFIG['project_ref']

    status_data = {"project_ref": ref}

    # Get project info
    try:
        project = management_get(f"/v1/projects/{ref}")
        status_data["name"] = project.get("name", ref)
        status_data["region"] = project.get("region", "-")
        status_data["status"] = project.get("status", "-")
        status_data["created_at"] = project.get("created_at", "")
    except Exception as e:
        status_data["error"] = str(e)

    # Get table count via OpenAPI
    try:
        url = f"https://{ref}.supabase.co/rest/v1/"
        r = requests.get(url, headers=get_postgrest_headers())
        if r.status_code == 200:
            spec = r.json()
            definitions = spec.get("definitions", {})
            public_tables = [k for k in definitions.keys() if not k.startswith("_")]
            status_data["public_tables"] = public_tables
            status_data["table_count"] = len(public_tables)
    except Exception:
        pass

    # Get edge functions
    try:
        functions = management_get(f"/v1/projects/{ref}/functions")
        status_data["edge_functions"] = len(functions)
    except Exception:
        pass

    if args.json:
        print_json(status_data)
        return

    print("\n[bold]ChessBlunders Supabase Status[/bold]\n" if HAS_RICH else "\nChessBlunders Supabase Status\n")
    print(f"Project: {status_data.get('name', ref)}")
    print(f"  Ref: {ref}")
    print(f"  Region: {status_data.get('region', '-')}")
    print(f"  Status: {status_data.get('status', '-')}")
    print(f"  Created: {format_timestamp(status_data.get('created_at', ''))}")
    if status_data.get("table_count"):
        print(f"\n  Public Tables: {status_data['table_count']}")
    if status_data.get("edge_functions") is not None:
        print(f"  Edge Functions: {status_data['edge_functions']}")
    print()


def cmd_logs_list(args: argparse.Namespace) -> None:
    """List project logs."""
    ref = CONFIG['project_ref']

    # Build query for logs
    log_type = args.type or "postgres"

    # Supabase log types: postgres, postgrest, auth, storage, realtime, edge_functions
    endpoint = f"/v1/projects/{ref}/analytics/endpoints/logs.all"

    # Note: The exact logs API may vary. This is a common pattern.
    params = {
        "iso_timestamp_start": args.since if hasattr(args, 'since') and args.since else None,
    }
    params = {k: v for k, v in params.items() if v}

    try:
        data = management_get(endpoint, params)
    except SystemExit as e:
        # Try alternative endpoint
        print(f"Note: Logs endpoint returned error. Trying alternative...")
        try:
            endpoint = f"/v1/projects/{ref}/database/query"
            # This would require POST, so skip for read-only
            print("Logs require the Supabase dashboard or direct database queries.")
            print(f"Visit: https://supabase.com/dashboard/project/{ref}/logs/explorer")
            return
        except Exception:
            raise e

    if args.json:
        print_json(data)
        return

    logs = data if isinstance(data, list) else data.get("result", data.get("data", []))

    if not logs:
        print("No logs found.")
        return

    for log in logs[:args.limit]:
        ts = log.get("timestamp", log.get("created_at", log.get("id", "")))
        msg = log.get("event_message", log.get("message", str(log)))
        # Format timestamp properly
        ts_str = format_timestamp(ts) if ts else "-"
        print(f"[{ts_str}] {msg[:120]}")


def cmd_tables_list(args: argparse.Namespace) -> None:
    """List database tables via PostgREST OpenAPI."""
    # Get schema from PostgREST OpenAPI endpoint
    url = f"https://{CONFIG['project_ref']}.supabase.co/rest/v1/"
    r = requests.get(url, headers=get_postgrest_headers())

    if r.status_code != 200:
        raise SystemExit(f"Error fetching schema: {r.status_code}")

    # The OpenAPI spec contains definitions for each table
    spec = r.json()
    definitions = spec.get("definitions", {})

    # Extract table names (excluding internal ones)
    tables = []
    for name, schema in definitions.items():
        if not name.startswith("_"):  # Skip internal tables
            tables.append({
                "name": name,
                "columns": len(schema.get("properties", {})),
                "description": schema.get("description", "")
            })

    if args.json:
        print_json(tables)
        return

    if HAS_RICH:
        table = Table(title="Public Tables")
        table.add_column("Name", style="cyan")
        table.add_column("Columns")

        for t in sorted(tables, key=lambda x: x["name"]):
            table.add_row(t["name"], str(t["columns"]))
        console.print(table)
    else:
        for t in sorted(tables, key=lambda x: x["name"]):
            print(f"{t['name']}  columns={t['columns']}")


def cmd_tables_get(args: argparse.Namespace) -> None:
    """Get table details via PostgREST OpenAPI."""
    url = f"https://{CONFIG['project_ref']}.supabase.co/rest/v1/"
    r = requests.get(url, headers=get_postgrest_headers())

    if r.status_code != 200:
        raise SystemExit(f"Error fetching schema: {r.status_code}")

    spec = r.json()
    definitions = spec.get("definitions", {})

    if args.table_name not in definitions:
        raise SystemExit(f"Table '{args.table_name}' not found")

    table_info = definitions[args.table_name]
    properties = table_info.get("properties", {})
    required = table_info.get("required", [])

    # Get row count
    count = postgrest_get(args.table_name, {"select": "*"}, head_only=True)

    if args.json:
        print_json({"name": args.table_name, "row_count": count, "columns": properties})
        return

    print(f"\nTable: {args.table_name}")
    print(f"  Rows: {count}")
    print(f"\n  Columns ({len(properties)}):")

    for col_name, col_info in properties.items():
        col_type = col_info.get("type", col_info.get("format", "unknown"))
        nullable = "NOT NULL" if col_name in required else "nullable"
        desc = col_info.get("description", "")[:40] if col_info.get("description") else ""
        print(f"    {col_name}: {col_type} ({nullable}) {desc}")


def cmd_columns(args: argparse.Namespace) -> None:
    """Show columns for a table via PostgREST OpenAPI."""
    url = f"https://{CONFIG['project_ref']}.supabase.co/rest/v1/"
    r = requests.get(url, headers=get_postgrest_headers())

    if r.status_code != 200:
        raise SystemExit(f"Error fetching schema: {r.status_code}")

    spec = r.json()
    definitions = spec.get("definitions", {})

    if args.table_name not in definitions:
        raise SystemExit(f"Table '{args.table_name}' not found")

    table_info = definitions[args.table_name]
    properties = table_info.get("properties", {})
    required = table_info.get("required", [])

    columns = []
    for name, info in properties.items():
        columns.append({
            "name": name,
            "type": info.get("type", info.get("format", "unknown")),
            "nullable": name not in required,
            "description": info.get("description", "")
        })

    if args.json:
        print_json(columns)
        return

    if HAS_RICH:
        table = Table(title=f"Columns: {args.table_name}")
        table.add_column("Name", style="cyan")
        table.add_column("Type")
        table.add_column("Nullable")
        table.add_column("Description")

        for col in sorted(columns, key=lambda x: x["name"]):
            table.add_row(
                col["name"],
                col["type"],
                "Yes" if col["nullable"] else "No",
                col["description"][:40] if col["description"] else "-"
            )
        console.print(table)
    else:
        for col in sorted(columns, key=lambda x: x["name"]):
            print(f"{col['name']}: {col['type']}")


def cmd_policies_list(args: argparse.Namespace) -> None:
    """List RLS policies."""
    ref = CONFIG['project_ref']

    try:
        data = management_get(f"/v1/projects/{ref}/database/policies")
    except SystemExit:
        # Fallback: query via PostgREST using pg_policies view
        print("Note: Policies endpoint not available. Try direct database query.")
        print(f"Visit: https://supabase.com/dashboard/project/{ref}/auth/policies")
        return

    if args.json:
        print_json(data)
        return

    if HAS_RICH:
        table = Table(title="RLS Policies")
        table.add_column("Table", style="cyan")
        table.add_column("Name")
        table.add_column("Command")
        table.add_column("Roles")

        for p in data:
            table.add_row(
                p.get("table", ""),
                p.get("name", ""),
                p.get("command", ""),
                ", ".join(p.get("roles", []))
            )
        console.print(table)
    else:
        for p in data:
            print(f"{p.get('table')}.{p.get('name')}  cmd={p.get('command')}  roles={p.get('roles')}")


def cmd_policies_table(args: argparse.Namespace) -> None:
    """List policies for a specific table."""
    ref = CONFIG['project_ref']

    try:
        data = management_get(f"/v1/projects/{ref}/database/policies")
        policies = [p for p in data if p.get("table") == args.table_name]
    except SystemExit:
        print(f"Visit: https://supabase.com/dashboard/project/{ref}/auth/policies")
        return

    if args.json:
        print_json(policies)
        return

    if not policies:
        print(f"No policies found for table '{args.table_name}'")
        return

    for p in policies:
        print(f"\nPolicy: {p.get('name')}")
        print(f"  Command: {p.get('command')}")
        print(f"  Roles: {', '.join(p.get('roles', []))}")
        if p.get("definition"):
            print(f"  Definition: {p.get('definition')[:100]}...")


def cmd_data_list(args: argparse.Namespace) -> None:
    """Query table data."""
    params: Dict[str, Any] = {}

    if args.select:
        params["select"] = args.select

    if args.filter:
        # Parse filter like "email=eq.someone@example.com"
        if "=" in args.filter:
            key, value = args.filter.split("=", 1)
            params[key] = value

    if args.limit:
        params["limit"] = args.limit

    if args.order:
        params["order"] = args.order

    data = postgrest_get(args.table_name, params)

    if args.json:
        print_json(data)
        return

    if not data:
        print(f"No data found in '{args.table_name}'")
        return

    if HAS_RICH and len(data) > 0:
        # Auto-detect columns from first row
        columns = list(data[0].keys())[:8]  # Limit to 8 columns for display

        table = Table(title=f"{args.table_name} ({len(data)} rows)")
        for col in columns:
            table.add_column(col, overflow="fold")

        for row in data:
            values = []
            for col in columns:
                val = row.get(col, "")
                if val is None:
                    val = "null"
                elif isinstance(val, (dict, list)):
                    val = json.dumps(val)[:50]
                else:
                    val = str(val)[:50]
                values.append(val)
            table.add_row(*values)

        console.print(table)
    else:
        for row in data:
            print(json.dumps(row, default=str))


def cmd_data_count(args: argparse.Namespace) -> None:
    """Count rows in a table."""
    count = postgrest_get(args.table_name, {"select": "*"}, head_only=True)

    if args.json:
        print_json({"table": args.table_name, "count": count})
        return

    print(f"{args.table_name}: {count} rows")


def cmd_storage_buckets(args: argparse.Namespace) -> None:
    """List storage buckets."""
    ref = CONFIG['project_ref']

    try:
        data = management_get(f"/v1/projects/{ref}/storage/buckets")
    except SystemExit:
        # Try direct storage API
        url = f"https://{ref}.supabase.co/storage/v1/bucket"
        r = requests.get(url, headers=get_postgrest_headers())
        if r.status_code != 200:
            print(f"Visit: https://supabase.com/dashboard/project/{ref}/storage/buckets")
            return
        data = r.json()

    if args.json:
        print_json(data)
        return

    if not data:
        print("No storage buckets found.")
        return

    if HAS_RICH:
        table = Table(title="Storage Buckets")
        table.add_column("Name", style="cyan")
        table.add_column("Public")
        table.add_column("Created")

        for b in data:
            table.add_row(
                b.get("name", b.get("id", "")),
                "Yes" if b.get("public") else "No",
                format_timestamp(b.get("created_at", ""))
            )
        console.print(table)
    else:
        for b in data:
            public = "public" if b.get("public") else "private"
            print(f"{b.get('name', b.get('id'))}  {public}")


def cmd_storage_list(args: argparse.Namespace) -> None:
    """List files in a storage bucket."""
    ref = CONFIG['project_ref']

    url = f"https://{ref}.supabase.co/storage/v1/object/list/{args.bucket_name}"
    r = requests.post(url, headers=get_postgrest_headers(), json={"prefix": "", "limit": args.limit})

    if r.status_code != 200:
        raise SystemExit(f"Storage API Error {r.status_code}: {r.text}")

    data = r.json()

    if args.json:
        print_json(data)
        return

    if not data:
        print(f"No files in bucket '{args.bucket_name}'")
        return

    for item in data:
        name = item.get("name", "")
        size = item.get("metadata", {}).get("size", "-")
        print(f"  {name}  size={size}")


def cmd_functions_list(args: argparse.Namespace) -> None:
    """List edge functions."""
    ref = CONFIG['project_ref']
    data = management_get(f"/v1/projects/{ref}/functions")

    if args.json:
        print_json(data)
        return

    if not data:
        print("No edge functions found.")
        return

    if HAS_RICH:
        table = Table(title="Edge Functions")
        table.add_column("Name", style="cyan")
        table.add_column("Status")
        table.add_column("Created")

        for f in data:
            table.add_row(
                f.get("name", f.get("slug", "")),
                f.get("status", "-"),
                format_timestamp(f.get("created_at", ""))
            )
        console.print(table)
    else:
        for f in data:
            print(f"{f.get('name', f.get('slug'))}  status={f.get('status', '-')}")


def cmd_auth_users(args: argparse.Namespace) -> None:
    """List auth users."""
    params = {"page": 1, "per_page": args.limit}
    data = auth_get("/users", params)

    users = data.get("users", data) if isinstance(data, dict) else data

    if args.json:
        print_json(users)
        return

    if not users:
        print("No users found.")
        return

    if HAS_RICH:
        table = Table(title="Auth Users")
        table.add_column("ID", style="dim")
        table.add_column("Email")
        table.add_column("Created")
        table.add_column("Last Sign In")

        for u in users:
            table.add_row(
                u.get("id", "")[:12] + "...",
                u.get("email", "-"),
                format_age(u.get("created_at", "")),
                format_age(u.get("last_sign_in_at", ""))
            )
        console.print(table)
    else:
        for u in users:
            print(f"{u.get('id')}  {u.get('email')}  created={format_timestamp(u.get('created_at', ''))}")


def cmd_auth_user(args: argparse.Namespace) -> None:
    """Get auth user details."""
    data = auth_get(f"/users/{args.user_id}")

    if args.json:
        print_json(data)
        return

    print(f"\nUser: {data.get('id')}")
    print(f"  Email: {data.get('email', '-')}")
    print(f"  Phone: {data.get('phone', '-')}")
    print(f"  Created: {format_timestamp(data.get('created_at', ''))}")
    print(f"  Last Sign In: {format_timestamp(data.get('last_sign_in_at', ''))}")
    print(f"  Confirmed: {data.get('email_confirmed_at') is not None}")

    if data.get("user_metadata"):
        print(f"  Metadata: {json.dumps(data['user_metadata'])[:100]}")


# ============================================================================
# CLI Parser
# ============================================================================

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog='supa-cli',
        description='ChessBlunders Supabase CLI - Read-only access to project data.'
    )
    p.add_argument('--json', action='store_true', help='Output raw JSON')
    p.add_argument('--limit', type=int, default=25, help='Limit results (default: 25)')

    sub = p.add_subparsers(dest='cmd', required=True)

    # status
    sub.add_parser('status', help='Project overview')

    # logs
    pl = sub.add_parser('logs', help='Log commands')
    sl = pl.add_subparsers(dest='logs_cmd', required=True)
    pl_list = sl.add_parser('list', help='List logs')
    pl_list.add_argument('--type', choices=['postgres', 'postgrest', 'auth', 'storage', 'realtime', 'edge_functions'],
                         help='Log type')
    pl_list.add_argument('--since', help='ISO timestamp or relative (1h, 1d)')
    pl_list.set_defaults(func=cmd_logs_list)

    # tables
    pt = sub.add_parser('tables', help='Table commands')
    st = pt.add_subparsers(dest='tables_cmd', required=True)
    pt_list = st.add_parser('list', help='List tables')
    pt_list.set_defaults(func=cmd_tables_list)
    pt_get = st.add_parser('get', help='Get table details')
    pt_get.add_argument('table_name')
    pt_get.set_defaults(func=cmd_tables_get)

    # columns
    pc = sub.add_parser('columns', help='Show columns for a table')
    pc.add_argument('table_name')
    pc.set_defaults(func=cmd_columns)

    # policies
    pp = sub.add_parser('policies', help='RLS policy commands')
    sp = pp.add_subparsers(dest='policies_cmd', required=True)
    pp_list = sp.add_parser('list', help='List all policies')
    pp_list.set_defaults(func=cmd_policies_list)
    pp_table = sp.add_parser('table', help='Policies for a table')
    pp_table.add_argument('table_name')
    pp_table.set_defaults(func=cmd_policies_table)

    # data
    pd = sub.add_parser('data', help='Table data commands')
    sd = pd.add_subparsers(dest='data_cmd', required=True)
    pd_list = sd.add_parser('list', help='Query table data')
    pd_list.add_argument('table_name')
    pd_list.add_argument('--select', help='Columns to select (comma-separated)')
    pd_list.add_argument('--filter', help='Filter (e.g., email=eq.test@example.com)')
    pd_list.add_argument('--order', help='Order by (e.g., created_at.desc)')
    pd_list.add_argument('--limit', '-n', type=int, help='Limit rows returned')
    pd_list.set_defaults(func=cmd_data_list)
    pd_count = sd.add_parser('count', help='Count rows in table')
    pd_count.add_argument('table_name')
    pd_count.set_defaults(func=cmd_data_count)

    # storage
    pst = sub.add_parser('storage', help='Storage commands')
    sst = pst.add_subparsers(dest='storage_cmd', required=True)
    pst_buckets = sst.add_parser('buckets', help='List buckets')
    pst_buckets.set_defaults(func=cmd_storage_buckets)
    pst_list = sst.add_parser('list', help='List files in bucket')
    pst_list.add_argument('bucket_name')
    pst_list.set_defaults(func=cmd_storage_list)

    # functions
    pf = sub.add_parser('functions', help='Edge function commands')
    sf = pf.add_subparsers(dest='functions_cmd', required=True)
    pf_list = sf.add_parser('list', help='List functions')
    pf_list.set_defaults(func=cmd_functions_list)

    # auth
    pa = sub.add_parser('auth', help='Auth commands')
    sa = pa.add_subparsers(dest='auth_cmd', required=True)
    pa_users = sa.add_parser('users', help='List auth users')
    pa_users.set_defaults(func=cmd_auth_users)
    pa_user = sa.add_parser('user', help='Get auth user by ID')
    pa_user.add_argument('user_id')
    pa_user.set_defaults(func=cmd_auth_user)

    return p


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    init_config()

    if args.cmd == 'status':
        cmd_status(args)
    elif args.cmd == 'columns':
        cmd_columns(args)
    else:
        args.func(args)

    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
