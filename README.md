## Deploy CloudFormation Stack Action for GitHub Actions

![Package](https://github.com/guslington/gh-action-cloudformation-deploy/workflows/Package/badge.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Updates a Cloudformation parameter using the previously deployed template

## Usage

```yaml
- name: update cloudformation parameter
  uses: Guslington/gh-action-cloudformation-deploy
  with:
    stack-name: my-stack
    parameter-overrides: |-
      Name=${{ inputs.name }}
      UUID=${{ inputs.uuid }}
```