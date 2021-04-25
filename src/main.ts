import * as core from '@actions/core';
import * as github from '@actions/github';

interface Rule {
  type: 'title' | 'body';
  regex: string;
  message: string;
}

const ALLOWED_ACTIONS = ['opened', 'edited', 'reopened'];

async function run() {
  try {
    const rules: string = core.getInput('rules', {required: true});

    // Get client and context
    const client = github.getOctokit(
      core.getInput('repo-token', {required: true})
    );
    const context = github.context;
    const payload = context.payload;

    // Do nothing if it's wasn't a relevant action or it's not an issue
    if (ALLOWED_ACTIONS.indexOf(payload.action) === -1 || !payload.issue) {
      return;
    }

    if (!payload.sender) {
      throw new Error('Internal error, no sender provided by GitHub');
    }

    const issue: {owner: string; repo: string; number: number} = context.issue;

    const parsedRules = JSON.parse(rules) as Rule[];
    const results = parsedRules
      .map(rule => {
        const text = rule.type === 'title' ? payload?.issue?.title : payload?.issue?.body;
        const regexMatches: boolean = check(rule.regex, text);

        if (regexMatches) {
          core.info(`Failed: ${rule.message}`);
          return rule.message;
        } else {
          core.info(`Passed: ${rule.message}`);
        }
      })
      .filter(Boolean);

    if (results.length > 0) {
      // Comment and close if failed any rule
      const infoMessage = payload.action === 'opened'
        ? 'automatically closed'
        : 'not reopened'

      const message = [`@\${issue.user.login} this issue was ${infoMessage} because:\n`, ...results].join('\n- ');

      await client.issues.createComment({
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
        body: evalTemplate(message, payload)
      });

      await client.issues.update({
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
        state: 'closed'
      });
    } else if (payload.action === 'edited') {
      const issueData = await client.issues.get({
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
      });
      const wasClosedByBot = issueData.data.closed_by.login === 'github-actions[bot]';

      // Re-open if edited issue is valid
      if (wasClosedByBot) {
        await client.issues.update({
          owner: issue.owner,
          repo: issue.repo,
          issue_number: issue.number,
          state: 'open'
        });
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

function check(patternString: string, text: string | undefined): boolean {
  const pattern: RegExp = new RegExp(patternString);

  if (text?.match(pattern)) {
    return true;
  } else {
    return false;
  }
}

function evalTemplate(template: string, params: any) {
  return Function(...Object.keys(params), `return \`${template}\``)(...Object.values(params));
}

run();
