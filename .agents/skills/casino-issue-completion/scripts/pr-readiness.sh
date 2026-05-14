#!/usr/bin/env bash
set -euo pipefail

INPUT="${1:-origin/main}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

CURRENT_BRANCH="$(git branch --show-current)"
TARGET="$INPUT"
PR_JSON=""
PR_SELECTOR=""
PR_LOOKUP_ERROR=""
TARGET_INPUT_NOTE=""
TARGET_FETCH_STATUS="not attempted"
PR_FIELDS="number,url,title,state,isDraft,baseRefName,baseRefOid,headRefName,headRefOid,mergeable,mergeStateStatus,labels,milestone,closingIssuesReferences,body"

json_value() {
  local path="$1"

  PR_JSON="$PR_JSON" node -e '
const data = JSON.parse(process.env.PR_JSON || "{}");
let value = data;
for (const part of process.argv[1].split(".")) {
  value = value?.[part];
}
if (value === undefined || value === null) {
  process.exit(0);
}
if (typeof value === "object") {
  console.log(JSON.stringify(value));
} else {
  console.log(String(value));
}
' "$path"
}

try_pr_view() {
  local selector="$1"
  local output=""
  local error_output=""

  if output="$(gh pr view "$selector" --json "$PR_FIELDS" 2>&1)"; then
    printf '%s' "$output"
    return 0
  fi

  error_output="$output"
  PR_LOOKUP_ERROR="$error_output"
  return 1
}

input_is_git_ref() {
  git rev-parse --verify --quiet "$INPUT^{commit}" >/dev/null 2>&1
}

input_is_remote_target_ref() {
  case "$INPUT" in
    refs/remotes/*)
      return 0
      ;;
    */*)
      local remote="${INPUT%%/*}"
      git remote get-url "$remote" >/dev/null 2>&1
      return
      ;;
  esac

  return 1
}

should_try_current_branch_pr() {
  [ "$#" -eq 0 ] || { input_is_git_ref && input_is_remote_target_ref; }
}

resolve_pr_context() {
  if ! command -v gh >/dev/null 2>&1; then
    PR_LOOKUP_ERROR="gh CLI is not installed or is not on PATH. Install gh and run gh auth login to gather live PR evidence."
    return
  fi

  if [ "$#" -gt 0 ] && PR_JSON="$(try_pr_view "$INPUT")"; then
    PR_SELECTOR="$INPUT"
    return
  fi

  if [ -n "$CURRENT_BRANCH" ] && should_try_current_branch_pr "$@" && PR_JSON="$(try_pr_view "$CURRENT_BRANCH")"; then
    PR_SELECTOR="$CURRENT_BRANCH"
    return
  fi

  if [ -z "$PR_LOOKUP_ERROR" ]; then
    PR_LOOKUP_ERROR="No pull request was found for input '$INPUT' or current branch '$CURRENT_BRANCH'."
  fi
}

target_remote() {
  case "$TARGET" in
    */*)
      local remote="${TARGET%%/*}"
      if git remote get-url "$remote" >/dev/null 2>&1; then
        printf '%s' "$remote"
        return
      fi
      ;;
  esac

  printf 'origin'
}

fetch_target() {
  local remote
  remote="$(target_remote)"

  if git remote get-url "$remote" >/dev/null 2>&1; then
    if git fetch --prune "$remote" >/dev/null 2>&1; then
      TARGET_FETCH_STATUS="fetched latest refs from $remote before evaluating target freshness"
    else
      TARGET_FETCH_STATUS="warning: git fetch --prune $remote failed; target freshness is based on local refs only"
    fi
  else
    TARGET_FETCH_STATUS="warning: remote '$remote' was not found; target freshness is based on local refs only"
  fi
}

repo_slug() {
  local origin_url

  if [ -n "${GITHUB_REPOSITORY:-}" ]; then
    printf '%s' "$GITHUB_REPOSITORY"
    return
  fi

  origin_url="$(git config --get remote.origin.url || true)"
  case "$origin_url" in
    git@github.com:*|https://github.com/*|ssh://git@github.com/*)
      ;;
    *)
      return
      ;;
  esac

  origin_url="${origin_url%.git}"
  origin_url="${origin_url#git@github.com:}"
  origin_url="${origin_url#https://github.com/}"
  origin_url="${origin_url#ssh://git@github.com/}"

  if [[ "$origin_url" == */* ]]; then
    printf '%s' "$origin_url"
  fi
}

print_pr_summary() {
  PR_JSON="$PR_JSON" node --input-type=module - <<'NODE'
import { validatePullRequest } from './scripts/validate-pr-standards.mjs';

const pr = JSON.parse(process.env.PR_JSON || '{}');
const labels = (pr.labels ?? []).map((label) => label.name).filter(Boolean);
const closingIssues = (pr.closingIssuesReferences ?? []).map((issue) => {
  const number = issue.number ? `#${issue.number}` : '(unknown issue)';
  const title = issue.title ? ` ${issue.title}` : '';
  return `${number}${title}`;
});
const failures = validatePullRequest(pr);

console.log(`PR number: ${pr.number ?? '(unknown)'}`);
console.log(`PR URL: ${pr.url ?? '(unknown)'}`);
console.log(`PR title: ${pr.title ?? '(unknown)'}`);
console.log(`PR state: ${pr.state ?? '(unknown)'}`);
console.log(`Draft: ${pr.isDraft === true ? 'yes' : pr.isDraft === false ? 'no' : '(unknown)'}`);
console.log(`Base branch: ${pr.baseRefName ?? '(unknown)'}`);
console.log(`Base SHA: ${pr.baseRefOid ?? '(unknown)'}`);
console.log(`Head branch: ${pr.headRefName ?? '(unknown)'}`);
console.log(`Head SHA: ${pr.headRefOid ?? '(unknown)'}`);
console.log(`Mergeable: ${pr.mergeable ?? '(unknown)'}`);
console.log(`Merge state: ${pr.mergeStateStatus ?? '(unknown)'}`);
console.log(`Labels: ${labels.length > 0 ? labels.join(', ') : '(none)'}`);
console.log(`Milestone: ${pr.milestone?.title ?? '(none)'}`);
console.log(`Linked closing issues: ${closingIssues.length > 0 ? closingIssues.join('; ') : '(none reported by GitHub)'}`);
if (failures.length === 0) {
  console.log('PR template and metadata validator: pass');
} else {
  console.log('PR template and metadata validator: fail');
  for (const failure of failures) {
    console.log(`- ${failure}`);
  }
}
NODE
}

print_required_checks() {
  local pr_number="$1"
  local pr_head_sha="$2"
  local checks_json=""
  local error_output=""

  echo "Required checks for PR head $pr_head_sha:"
  if checks_json="$(gh pr checks "$pr_number" --required --json name,state,bucket,link,workflow 2>&1)"; then
    CHECKS_JSON="$checks_json" node -e '
const checks = JSON.parse(process.env.CHECKS_JSON || "[]");
if (checks.length === 0) {
  console.log("(none reported by gh pr checks --required)");
}
for (const check of checks) {
  const workflow = check.workflow ? ` (${check.workflow})` : "";
  const state = check.state ?? check.bucket ?? "unknown";
  const link = check.link ? ` ${check.link}` : "";
  console.log(`- ${check.name ?? "(unnamed check)"}${workflow}: ${state}${link}`);
}
'
  else
    error_output="$checks_json"
    echo "warning: unable to fetch required checks with 'gh pr checks $pr_number --required': $error_output"
  fi
}

print_review_threads() {
  local pr_number="$1"
  local slug
  local owner
  local name
  local threads_json=""
  local error_output=""
  slug="$(repo_slug)"

  if [ -z "$slug" ]; then
    echo "Review threads: warning: could not infer GitHub owner/repo from remote.origin.url"
    return
  fi

  owner="${slug%%/*}"
  name="${slug#*/}"

  if threads_json="$(gh api graphql -F owner="$owner" -F name="$name" -F number="$pr_number" -f query='
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          path
          line
          comments(first: 1) {
            nodes {
              id
              url
              author {
                login
              }
              body
            }
          }
        }
      }
    }
  }
}
' 2>&1)"; then
    THREADS_JSON="$threads_json" node -e '
const data = JSON.parse(process.env.THREADS_JSON || "{}");
const threads = data.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];
const unresolved = threads.filter((thread) => thread.isResolved !== true);
console.log(`Review threads: ${unresolved.length} unresolved of ${threads.length} fetched`);
for (const thread of unresolved) {
  const comment = thread.comments?.nodes?.[0] ?? {};
  const location = [thread.path, thread.line].filter(Boolean).join(":") || "(unknown location)";
  const author = comment.author?.login ? ` by ${comment.author.login}` : "";
  const url = comment.url ? ` ${comment.url}` : "";
  console.log(`- ${thread.id} ${location}${author}${url}`);
}
'
  else
    error_output="$threads_json"
    echo "Review threads: warning: unable to fetch review thread state with gh api graphql: $error_output"
  fi
}

resolve_pr_context "$@"

if [ -n "$PR_JSON" ]; then
  TARGET="origin/$(json_value baseRefName)"
elif [ "$#" -gt 0 ] && ! input_is_git_ref; then
  TARGET="origin/main"
  TARGET_INPUT_NOTE="input '$INPUT' did not resolve as a PR or local Git ref; using origin/main for local evidence"
fi

fetch_target

echo "== Casino Warehouse PR readiness =="
echo

echo "== Local git evidence =="
echo

echo "Target fetch status:"
echo "$TARGET_FETCH_STATUS"
echo

echo "Current branch:"
echo "$CURRENT_BRANCH"
echo

echo "Current HEAD:"
git rev-parse HEAD
echo

echo "Target branch:"
echo "$TARGET"
echo

if [ -n "$TARGET_INPUT_NOTE" ]; then
  echo "Target input note:"
  echo "$TARGET_INPUT_NOTE"
  echo
fi

echo "Target commit:"
git rev-parse "$TARGET"
echo

echo "Merge base:"
git merge-base HEAD "$TARGET"
echo

echo "Is target an ancestor of HEAD?"
if git merge-base --is-ancestor "$TARGET" HEAD; then
  echo "yes"
else
  echo "no"
fi
echo

echo "Working tree status:"
git status --short
echo

echo "Changed files:"
git diff --name-only "$TARGET"...HEAD
echo

echo "Diff stat:"
git diff --stat "$TARGET"...HEAD
echo

echo "Diff check:"
if git diff --check "$TARGET"...HEAD; then
  echo "pass"
else
  echo "fail"
fi
echo

echo "Generated/build output candidates:"
git diff --name-only "$TARGET"...HEAD \
  | grep -E '(^dist/|^build/|^coverage/|^playwright-report/|^test-results/|\.tsbuildinfo$)' \
  || true
echo

echo "Workflow files changed:"
git diff --name-only "$TARGET"...HEAD \
  | grep -E '^\.github/workflows/' \
  || true
echo

echo "Package or lockfile changes:"
git diff --name-only "$TARGET"...HEAD \
  | grep -E '(^package\.json$|^package-lock\.json$)' \
  || true
echo

echo "== GitHub PR evidence =="
echo

if [ -n "$PR_JSON" ]; then
  PR_NUMBER="$(json_value number)"
  PR_HEAD_SHA="$(json_value headRefOid)"
  LOCAL_HEAD="$(git rev-parse HEAD)"

  echo "PR selector resolved:"
  echo "$PR_SELECTOR"
  echo

  print_pr_summary
  echo

  echo "Local HEAD matches PR head SHA?"
  if [ "$LOCAL_HEAD" = "$PR_HEAD_SHA" ]; then
    echo "yes"
  else
    echo "no - local HEAD is $LOCAL_HEAD and PR head is $PR_HEAD_SHA"
  fi
  echo

  print_required_checks "$PR_NUMBER" "$PR_HEAD_SHA"
  echo

  print_review_threads "$PR_NUMBER"
  echo
else
  echo "No pull request evidence was resolved."
  echo "Lookup detail: $PR_LOOKUP_ERROR"
  echo "Action: pass a PR number or branch name, push the current branch and open a PR, or run 'gh auth login' if authentication failed."
  echo
fi

echo "Review evidence required before ready:"
echo "- changed files inspected with purpose, correctness, security, performance, architecture, maintainability, tests, and docs lenses"
echo "- findings recorded with location, severity, category, description, suggestion, and blocking status"
echo "- review verdict recorded as APPROVE, REQUEST_CHANGES, or NEEDS_DISCUSSION"
echo "- current external claims web-verified, or explicitly marked not needed"
echo "- PR review comments left for every finding when permissions allow, or fallback findings reported with a reason"
