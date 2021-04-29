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
    const { issue, payload } = github.context;

    // Do nothing if it's wasn't a relevant action or it's not an issue
    if (ALLOWED_ACTIONS.indexOf(payload.action) === -1 || !payload.issue) {
      return;
    }
    if (!payload.sender) {
      throw new Error('Internal error, no sender provided by GitHub');
    }

    const rules: string = core.getInput('rules', {required: true});

    // Get client and context
    const client = github.getOctokit(
      core.getInput('repo-token', {required: true})
    );

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

    const issueMetadata = {
      owner: issue.owner,
      repo: issue.repo,
      issue_number: issue.number,
    };

    const issueData = await client.issues.get(issueMetadata);

    if (results.length > 0) {
      // Comment and close if failed any rule
      const infoMessage = payload.action === 'opened'
        ? 'automatically closed'
        : 'not reopened';

      // Avoid commenting about automatic closure if it was already closed
      const shouldComment = (payload.action === 'opened' && issueData.data.state === 'open')
        || (payload.action === 'edited' && issueData.data.state === 'closed');

      if (shouldComment) {
        const message = [`@\${issue.user.login} this issue was ${infoMessage} because:\n`, ...results].join('\n- ');

        await client.issues.createComment({
          ...issueMetadata,
          body: evalTemplate(message, payload),
        });
      }

      await client.issues.update({
        ...issueMetadata,
        state: 'closed',
      });
    } else if (payload.action === 'edited') {
      // Re-open if edited issue is valid and was previously closed by action
      if (issueData.data.closed_by?.login === 'github-actions[bot]') {
        await client.issues.update({
          ...issueMetadata,
          state: 'open',
        });
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

function check(patternString: string, text: string | undefined): boolean {
  const pattern = new RegExp(patternString);
  return text?.match(pattern) !== null;
}

function evalTemplate(template: string, params: any) {
  return Function(...Object.keys(params), `return \`${template}\``)(...Object.values(params));
}

run();
