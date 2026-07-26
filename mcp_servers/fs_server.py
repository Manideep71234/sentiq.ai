import os
import sys
import logging
from pathlib import Path
from mcp.server.fastmcp import FastMCP

WORKSPACE_DIR = Path("/app/workspace").resolve()

mcp = FastMCP("workspace-fs")

def is_safe_path(basedir: Path, path: str) -> bool:
    try:
        matchpath = os.path.realpath(basedir.joinpath(path))
    except Exception:
        return False
    return basedir.resolve().as_posix() in Path(matchpath).resolve().as_posix()

@mcp.tool()
def list_workspace_dir(path: str = "") -> str:
    """List contents of a directory in the workspace."""
    target = WORKSPACE_DIR / path
    if not is_safe_path(WORKSPACE_DIR, target.as_posix()):
        return "Error: Path outside workspace"
    try:
        return "\n".join(os.listdir(target))
    except Exception as e:
        return str(e)

@mcp.tool()
def read_workspace_file(path: str) -> str:
    """Read a file in the workspace."""
    target = WORKSPACE_DIR / path
    if not is_safe_path(WORKSPACE_DIR, target.as_posix()):
        return "Error: Path outside workspace"
    try:
        with open(target, "r") as f:
            return f.read()
    except Exception as e:
        return str(e)

if __name__ == "__main__":
    mcp.run(transport='stdio')
