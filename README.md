# GitHub action to automatically close issues

_This is a modified version of https://github.com/roots/issue-closer-action_

Automatically close issues whose title or body text matches the specified regular expression pattern.

## Installation

To configure the action simply add the following lines to your `.github/main.workflow` workflow file:

```yml
name: Autocloser
on: [issues]
jobs:
  autoclose:
    runs-on: ubuntu-latest
    steps:
    - name: Autoclose issues
      uses: arkon/issue-closer-action@v1.0
      with:
        repo-token: ${{ secrets.GITHUB_TOKEN }}
        issue-close-message: "@${issue.user.login} this issue was automatically closed because it did not follow the issue template"
        issue-title-pattern: ".*Placeholder title.*"
        issue-body-pattern: ".*Remove me.*"
```

## Configuration

`issue-close-message` is an ES6-style template literals which will be evaluated with the issue
webhook payload in context. The example above uses `${issue.user.login}` to get the author of the issue.

* `issue` webhook [payload example](https://developer.github.com/v3/activity/events/types/#webhook-payload-example-15)

`issue-title-pattern` and `issue-body-pattern` are strings which are compiled to JavaScript `Regexp`s.
