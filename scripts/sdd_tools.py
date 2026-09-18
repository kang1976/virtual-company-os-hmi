import sys
import os
import re
import subprocess
from pathlib import Path

def get_root():
    res = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True)
    return Path(res.stdout.strip())

def workspace(plan_file):
    root = get_root()
    slug = Path(plan_file).stem
    base = root / ".superpowers" / "sdd"
    dir_path = base / slug
    dir_path.mkdir(parents=True, exist_ok=True)
    (base / ".gitignore").write_text("*\n", encoding="utf-8")
    return dir_path

def task_brief(plan_file, task_num, out_file=None):
    plan_path = Path(plan_file)
    content = plan_path.read_text(encoding="utf-8")
    lines = content.splitlines()

    task_lines = []
    in_task = False
    in_fence = False

    pattern = re.compile(rf"^#+\s+(?:Task|태스크)\s+{task_num}(?:\D|$)")
    other_task_pattern = re.compile(r"^#+\s+(?:Task|태스크)\s+\d+")

    for line in lines:
        if line.startswith("```"):
            in_fence = not in_fence
        if not in_fence and other_task_pattern.match(line):
            if pattern.match(line):
                in_task = True
            else:
                in_task = False
        if in_task:
            task_lines.append(line)

    if not task_lines:
        print(f"Error: Task {task_num} not found in {plan_file}", file=sys.stderr)
        sys.exit(3)

    if not out_file:
        dir_path = workspace(plan_file)
        out_path = dir_path / f"task-{task_num}-brief.md"
    else:
        out_path = Path(out_file)

    out_path.write_text("\n".join(task_lines) + "\n", encoding="utf-8")
    print(str(out_path.resolve()))
    return out_path

def review_package(plan_file, base, head, out_file=None):
    root = get_root()
    dir_path = workspace(plan_file)

    res_base = subprocess.run(["git", "rev-parse", "--short", base], capture_output=True, text=True, check=True)
    res_head = subprocess.run(["git", "rev-parse", "--short", head], capture_output=True, text=True, check=True)
    base_short = res_base.stdout.strip()
    head_short = res_head.stdout.strip()

    if not out_file:
        out_path = dir_path / f"review-{base_short}..{head_short}.diff"
    else:
        out_path = Path(out_file)

    log_res = subprocess.run(["git", "log", "--oneline", f"{base}..{head}"], capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
    stat_res = subprocess.run(["git", "diff", "--stat", f"{base}..{head}"], capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
    diff_res = subprocess.run(["git", "diff", "-U10", f"{base}..{head}"], capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)

    package = f"""# Review package: {base}..{head}

## Commits
{log_res.stdout}

## Files changed
{stat_res.stdout}

## Diff
{diff_res.stdout}
"""
    out_path.write_text(package, encoding="utf-8")
    print(str(out_path.resolve()))
    return out_path

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python sdd_tools.py [workspace|task-brief|review-package] args...")
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "workspace":
        print(str(workspace(sys.argv[2]).resolve()))
    elif cmd == "task-brief":
        task_brief(sys.argv[2], sys.argv[3])
    elif cmd == "review-package":
        review_package(sys.argv[2], sys.argv[3], sys.argv[4])
