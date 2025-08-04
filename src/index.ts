import * as core from '@actions/core'
import {
  CloudFormationClient,
  Parameter,
  Capability,
  waitUntilChangeSetCreateComplete,
  waitUntilStackUpdateComplete,
  CreateChangeSetCommand,
  ExecuteChangeSetCommand,
  DeleteChangeSetCommand,
  CreateChangeSetCommandInput,
  GetTemplateSummaryCommand,
  GetTemplateSummaryCommandInput,
} from '@aws-sdk/client-cloudformation'

export function validateArn(arn: any) {
  if (typeof arn === "string" && arn.indexOf("arn:aws:iam:") === 0 && arn.split(":").length >= 6) {
    return arn
  }

  throw new Error("Input role-arn is an invalid arn format")
}

export async function getTemplateParameters(cfnClient: CloudFormationClient, stackName: string): Promise<Parameter[]> {
  const input: GetTemplateSummaryCommandInput = {
    StackName: stackName
  }

  const response = await cfnClient.send(new GetTemplateSummaryCommand(input))

  return response.Parameters!
}

export function parseParameters(templateParameters: Parameter[], parameterOverrides: string[]): Parameter[] {
  let paramMap = new Map<string, string>()

  parameterOverrides.map(parameter => {
    const values = parameter.trim().split('=')

    paramMap.set(values[0], values[1])
  })

  return templateParameters.map(param => {

    if (paramMap.has(param.ParameterKey!)) {
      core.info(`[Parameter] ${param.ParameterKey} => UpdateToValue: ${paramMap.get(param.ParameterKey!)}`)
      return {
        ParameterKey: param.ParameterKey,
        ParameterValue: paramMap.get(param.ParameterKey!)
      }
    } else {
      core.info(`[Parameter] ${param.ParameterKey} => UsePreviousValue: true`)
      return {
        ParameterKey: param.ParameterKey,
        UsePreviousValue: true
      }
    }
    
  })
}

export async function cleanupChangeset(cfnClient: CloudFormationClient, changeSetName: string, stackName: string) {
  try {
    core.info(`Cleaning up failed changeset ${changeSetName}`)
    await cfnClient.send(
      new DeleteChangeSetCommand({
        ChangeSetName: changeSetName,
        StackName: stackName
      })
    )
    core.info(`Successfully deleted changeset ${changeSetName}`)
  } catch (cleanupError) {
    // @ts-expect-error: Object is of type 'unknown'
    core.warning(`Failed to cleanup changeset ${changeSetName}: ${cleanupError.message}`)
  }
}

export async function updateStack(cfnClient: CloudFormationClient, changesetInput: CreateChangeSetCommandInput) {
  let changesetCreated = false
  
  try {
    core.info(`Creating CloudFormation Change Set ${changesetInput.ChangeSetName} for stack ${changesetInput.StackName}`)
    await cfnClient.send(new CreateChangeSetCommand(changesetInput))
    changesetCreated = true

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
  } catch (error) {
    // If changeset was created but failed later, clean it up
    if (changesetCreated && changesetInput.ChangeSetName && changesetInput.StackName) {
      await cleanupChangeset(cfnClient, changesetInput.ChangeSetName, changesetInput.StackName)
    }
    // Re-throw the original error
    throw error
  }
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

        const cfnClient = new CloudFormationClient()

        if (parameterOverrides) {
          const templateParameters = await getTemplateParameters(cfnClient, stackName)

          changesetInput.Parameters = parseParameters(templateParameters, parameterOverrides)
        }

        if (roleArn) {
          changesetInput.RoleARN = validateArn(roleArn)
        }

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