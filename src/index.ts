import * as core from '@actions/core'
import {
  CloudFormationClient,
  Parameter,
  Capability,
  waitUntilChangeSetCreateComplete,
  waitUntilStackUpdateComplete,
  CreateChangeSetCommand,
  ExecuteChangeSetCommand,
  CreateChangeSetCommandInput,
} from '@aws-sdk/client-cloudformation'

export function validateArn(arn: any) {
  if (typeof arn === "string" && arn.indexOf("arn:aws:iam:") === 0 && arn.split(":").length >= 6) {
    return arn
  }

  throw new Error("Input role-arn is an invalid arn format")
}

export function parseParameters(parameterOverrides: string[]): Parameter[] {
  return parameterOverrides.map(parameter => {
    const values = parameter.trim().split('=')

    return {
      ParameterKey: values[0],
      ParameterValue: values[1]
    }
  })
}

export async function updateStack(cfnClient: CloudFormationClient, changesetInput: CreateChangeSetCommandInput) {
  core.info(`Creating CloudFormation Change Set ${changesetInput.ChangeSetName} for stack ${changesetInput.StackName}`)
  await cfnClient.send(new CreateChangeSetCommand(changesetInput))

  core.info('Waiting for CloudFormation changeset to create ...')
  await waitUntilChangeSetCreateComplete(
    { 
      client: cfnClient, 
      maxWaitTime: 1800, 
      minDelay: 10
    },
    {
      ChangeSetName: changesetInput.ChangeSetName,
      StackName: changesetInput.StackName
    }
  )

  core.info(`Executing CloudFormation changeset ${changesetInput.ChangeSetName}`)
  await cfnClient.send(
    new ExecuteChangeSetCommand({
      ChangeSetName: changesetInput.ChangeSetName,
      StackName: changesetInput.StackName
    })
  )

  core.info(`Waiting for CloudFormation stack ${changesetInput.StackName} to reach update complete ...`)
  await waitUntilStackUpdateComplete(
    {
      client: cfnClient,
      maxWaitTime: 43200,
      minDelay: 10
    },
    {
      StackName: changesetInput.StackName
    }
  )
}


export async function run() {
    try {
        const stackName = core.getInput("stack-name")
        
        const parameterOverrides = core.getMultilineInput('parameter-overrides', {
          required: false
        })

        const capabilities = core.getMultilineInput('capabilities', {
          required: false
        }) as Capability[]

        const roleArn = core.getInput("role-arn", {
          required: false
        })

        const changesetInput: CreateChangeSetCommandInput = {
          ChangeSetName: `${stackName}-changeset`,
          StackName: stackName,
          UsePreviousTemplate: true,
          Capabilities: capabilities,
        }

        if (parameterOverrides) {
          changesetInput.Parameters = parseParameters(parameterOverrides)
        }

        if (roleArn) {
          changesetInput.RoleARN = validateArn(roleArn)
        }

        const cfnClient = new CloudFormationClient()
        await updateStack(cfnClient, changesetInput)

        core.info('Cloudformation stack update is complete')
    } catch (err) {
        // @ts-expect-error: Object is of type 'unknown'
        core.setFailed(err.message)
        // @ts-expect-error: Object is of type 'unknown'
        core.debug(err.stack)
    }
}

if (require.main === module) {
    run()
}