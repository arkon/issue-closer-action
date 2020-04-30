import * as core from '@actions/core';
import * as github from '@actions/github';

async function run() {
  try {
    const issueCloseMessage: string = core.getInput('issue-close-message', {required: true});
    const issueBodyPattern: string = core.getInput('issue-body-pattern');
    const issueTitlePattern: string = core.getInput('issue-title-pattern');

    if (!issueBodyPattern && !issueBodyPattern) {
      throw new Error(
        'Action must have at least one of issue-body-pattern or issue-title-pattern set'
      );
    }

    // Get client and context
    const client: github.GitHub = new github.GitHub(
      core.getInput('repo-token', {required: true})
    );
    const context = github.context;
    const payload = context.payload;

    // Do nothing if it's wasn't being opened or it's not an issue
    if (payload.action !== 'opened' || !payload.issue) {
      return;
    }

    if (!payload.sender) {
      throw new Error('Internal error, no sender provided by GitHub');
    }

    const issue: {owner: string; repo: string; number: number} = context.issue;

    const bodyMatches: boolean = issueBodyPattern && check(issueBodyPattern, payload?.issue?.body);
    const titleMatches: boolean = issueTitlePattern && check(issueTitlePattern, payload?.issue?.title);

    // Do nothing if no match
    if (!bodyMatches && !titleMatches) {
      return;
    }

    // Comment and close
    await client.issues.createComment({
      owner: issue.owner,
      repo: issue.repo,
      issue_number: issue.number,
      body: evalTemplate(issueCloseMessage, payload)
    });
    await client.issues.update({
      owner: issue.owner,
      repo: issue.repo,
      issue_number: issue.number,
      state: 'closed'
    });
  } catch (error) {
    core.setFailed(error.message);
    return;
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
