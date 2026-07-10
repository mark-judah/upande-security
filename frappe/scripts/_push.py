"""
Helper to push a Server Script to the kaitet.local FAC endpoint.

Usage:
    python3 _push.py <script_name> <api_method> <script_file>

Example:
    python3 _push.py "Get Session Info" get_session_info get_session_info.py
"""
import json
import os
import sys
import urllib.request

FAC_PATH = "/api/method/frappe_assistant_core.api.fac_endpoint.handle_mcp"
DEFAULT_BASE_URL = "https://kaitet-group.upande.com"

def _load_creds():
    here = os.path.dirname(os.path.abspath(__file__))
    creds_path = os.path.join(here, "..", "..", ".kaitet-credentials.json")
    try:
        with open(creds_path) as f:
            c = json.load(f)
            token = c["api_key"] + ":" + c["api_secret"]
            base = c.get("base_url") or DEFAULT_BASE_URL
            return token, base.rstrip("/")
    except Exception:
        pass
    return os.environ.get("FAC_TOKEN", ""), os.environ.get("FAC_BASE_URL", DEFAULT_BASE_URL).rstrip("/")

API_TOKEN, BASE_URL = _load_creds()
FAC_URL = BASE_URL + FAC_PATH
MODULE = "Upande Security"


def call_mcp(method, params):
    body = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    ).encode()
    req = urllib.request.Request(
        FAC_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": "token " + API_TOKEN,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def tool_call(name, arguments):
    out = call_mcp("tools/call", {"name": name, "arguments": arguments})
    if "error" in out:
        raise RuntimeError("MCP error: " + json.dumps(out["error"]))
    content = out.get("result", {}).get("content", [])
    for c in content:
        text = c.get("text", "")
        try:
            return json.loads(text)
        except Exception:
            return {"raw": text}
    return {}


def exists(name):
    result = tool_call(
        "list_documents",
        {
            "doctype": "Server Script",
            "filters": {"name": name},
            "fields": ["name"],
            "limit": 1,
        },
    )
    data = result.get("result", {}).get("data", [])
    return bool(data)


def create_script(name, api_method, script_body):
    return tool_call(
        "create_document",
        {
            "doctype": "Server Script",
            "data": {
                "name": name,
                "script_type": "API",
                "api_method": api_method,
                "module": MODULE,
                "disabled": 0,
                "script": script_body,
                "allow_guest": 0,
            },
        },
    )


def update_script(name, script_body):
    return tool_call(
        "update_document",
        {
            "doctype": "Server Script",
            "name": name,
            "data": {"script": script_body, "disabled": 0},
        },
    )


def main():
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(2)
    display_name, api_method, script_file = sys.argv[1], sys.argv[2], sys.argv[3]
    here = os.path.dirname(os.path.abspath(__file__))
    body = open(os.path.join(here, script_file)).read()
    if exists(display_name):
        print("[update]", display_name)
        result = update_script(display_name, body)
    else:
        print("[create]", display_name, "->", api_method)
        result = create_script(display_name, api_method, body)
    print(json.dumps(result, indent=2)[:800])


if __name__ == "__main__":
    main()
