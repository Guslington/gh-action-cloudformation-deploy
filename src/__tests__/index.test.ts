import { run, parseParameters, validateArn, cleanupChangeset } from "../index"
import * as core from '@actions/core'
import { mockClient } from 'aws-sdk-client-mock'
import {
  Parameter,
  StackStatus,
  ChangeSetStatus,
  CloudFormationClient,
  ExecuteChangeSetCommand,
  DescribeChangeSetCommand,
  CreateChangeSetCommand,
  DeleteChangeSetCommand,
  DescribeStacksCommand,
  GetTemplateSummaryCommand,
} from '@aws-sdk/client-cloudformation'
import 'aws-sdk-client-mock-jest'

jest.mock("@actions/core")

const mockCfnClient = mockClient(CloudFormationClient)

const getInputSpy = jest.spyOn(core, 'getInput')
const getMultilineInputSpy = jest.spyOn(core, 'getMultilineInput')

describe("run", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockCfnClient
    .reset()
    .on(GetTemplateSummaryCommand)
    .resolves({
      Parameters: [
        {
          ParameterKey: "UUID",
          ParameterType: "String",
          NoEcho: false,
          Description: "",
        },
        {
          ParameterKey: "Name",
          ParameterType: "String",
          NoEcho: false,
          Description: "",
        },
      ],
      Capabilities: [ 
        "CAPABILITY_IAM",
      ],
    })
    .on(DescribeStacksCommand)
    .resolvesOnce({
      Stacks: [
        {
          StackId:
            'arn:aws:cloudformation:us-east-1:111111111111:stack/my-stack/3839ca53-a950-4e95-a220-28d85c7e5c4d',
          Tags: [],
          Outputs: [],
          StackStatusReason: '',
          CreationTime: new Date('2024-08-16T05:01:55.222Z'),
          Capabilities: [],
          StackName: 'my-stack',
          StackStatus: 'UPDATE_COMPLETE'
        }
      ]
    })
    .resolves({
      Stacks: [
        {
          StackId:
            'arn:aws:cloudformation:us-east-1:111111111111:stack/my-stack/3839ca53-a950-4e95-a220-28d85c7e5c4d',
          Tags: [],
          Outputs: [],
          StackStatusReason: '',
          CreationTime: new Date('2024-08-16T05:01:55.222Z'),
          Capabilities: [],
          StackName: 'my-stack',
          StackStatus: StackStatus.UPDATE_COMPLETE
        }
      ]
    })
    .on(CreateChangeSetCommand)
    .resolves({})
    .on(ExecuteChangeSetCommand)
    .resolves({})
    .on(DescribeChangeSetCommand)
    .resolves({ Status: ChangeSetStatus.CREATE_COMPLETE })
  })

  it("should update the stack with all parameters", async () => {
    var inputs = {} as any
    inputs['stack-name'] = 'my-stack'
    inputs['parameter-overrides'] = ['UUID=0F54400F-937E-46B9-8C4C-5D94833C9FB8','Name=test']
    inputs['role-arn'] = 'arn:aws:iam::111111111111:role/role-name'
    inputs['capabilities'] = ['CAPABILITY_IAM']

    getInputSpy.mockImplementation(input => inputs[input as string])
    getMultilineInputSpy.mockImplementation(input => inputs[input as string])

    await run()

    expect(core.setFailed).not.toHaveBeenCalled()

    expect(mockCfnClient).toHaveReceivedNthCommandWith(
      1,
      GetTemplateSummaryCommand,
      {
        StackName: 'my-stack',
      }
    )

    expect(mockCfnClient).toHaveReceivedNthCommandWith(
      2,
      CreateChangeSetCommand,
      {
        ChangeSetName: 'my-stack-changeset',
        StackName: 'my-stack',
        UsePreviousTemplate: true,
        RoleARN: 'arn:aws:iam::111111111111:role/role-name',
        Capabilities: ['CAPABILITY_IAM'],
        Parameters: [
          {
            ParameterKey: 'UUID',
            ParameterValue: '0F54400F-937E-46B9-8C4C-5D94833C9FB8'
          },
          {
            ParameterKey: 'Name',
            ParameterValue: 'test'
          }
        ]
      }
    )

    expect(mockCfnClient).toHaveReceivedNthCommandWith(
      3,
      DescribeChangeSetCommand,
      {
        ChangeSetName: 'my-stack-changeset',
        StackName: 'my-stack'
      }
    )

    expect(mockCfnClient).toHaveReceivedNthCommandWith(
      4,
      ExecuteChangeSetCommand,
      {
        ChangeSetName: 'my-stack-changeset',
        StackName: 'my-stack'
      }
    )

    expect(mockCfnClient).toHaveReceivedNthCommandWith(
      5,
      DescribeStacksCommand,
      {
        StackName: 'my-stack'
      }
    )
  })

  it("should update the stack with only the parameters that are supplied", async () => {
    var inputs = {} as any
    inputs['stack-name'] = 'my-stack'
    inputs['parameter-overrides'] = ['Name=test']
    inputs['role-arn'] = 'arn:aws:iam::111111111111:role/role-name'
    inputs['capabilities'] = ['CAPABILITY_IAM']

    getInputSpy.mockImplementation(input => inputs[input as string])
    getMultilineInputSpy.mockImplementation(input => inputs[input as string])
    
    await run()

    expect(core.setFailed).not.toHaveBeenCalled()

    expect(mockCfnClient).toHaveReceivedNthCommandWith(
      1,
      GetTemplateSummaryCommand,
      {
        StackName: 'my-stack',
      }
    )

    expect(mockCfnClient).toHaveReceivedNthCommandWith(
      2,
      CreateChangeSetCommand,
      {
        ChangeSetName: 'my-stack-changeset',
        StackName: 'my-stack',
        UsePreviousTemplate: true,
        RoleARN: 'arn:aws:iam::111111111111:role/role-name',
        Capabilities: ['CAPABILITY_IAM'],
        Parameters: [
          {
            ParameterKey: 'UUID',
            UsePreviousValue: true
          },
          {
            ParameterKey: 'Name',
            ParameterValue: 'test'
          }
        ]
      }
    )

    expect(mockCfnClient).toHaveReceivedNthCommandWith(
      3,
      DescribeChangeSetCommand,
      {
        ChangeSetName: 'my-stack-changeset',
        StackName: 'my-stack'
      }
    )

    expect(mockCfnClient).toHaveReceivedNthCommandWith(
      4,
      ExecuteChangeSetCommand,
      {
        ChangeSetName: 'my-stack-changeset',
        StackName: 'my-stack'
      }
    )

    expect(mockCfnClient).toHaveReceivedNthCommandWith(
      5,
      DescribeStacksCommand,
      {
        StackName: 'my-stack'
      }
    )

  })

  it("should update the stack with no parameters", async () => {
    var inputs = {} as any
    inputs['stack-name'] = 'my-stack'

    getInputSpy.mockImplementation(input => inputs[input as string])
    getMultilineInputSpy.mockImplementation(input => inputs[input as string])
    
    await run()

    expect(core.setFailed).not.toHaveBeenCalled()

    expect(mockCfnClient).toHaveReceivedNthCommandWith(
      1,
      CreateChangeSetCommand,
      {
        ChangeSetName: 'my-stack-changeset',
        StackName: 'my-stack',
        UsePreviousTemplate: true,
      }
    )

  })

})

describe('Parse Parameters', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns all parameters list from string', async () => {
    let parameterOverrides: string[] = ['UUID=0F54400F-937E-46B9-8C4C-5D94833C9FB8','Name=test']
    let templateParameters: Parameter[] =  [
        {
          ParameterKey: "UUID",
        },
        {
          ParameterKey: "Name",
        },
      ]

    const parameters = parseParameters(templateParameters, parameterOverrides)
    expect(parameters).toEqual([
      {
        ParameterKey: 'UUID',
        ParameterValue: '0F54400F-937E-46B9-8C4C-5D94833C9FB8'
      },
      {
        ParameterKey: 'Name',
        ParameterValue: 'test'
      }
    ])
  })

  test('sets use previous value if parameter not supplied', async () => {
    let parameterOverrides: string[] = ['UUID=0F54400F-937E-46B9-8C4C-5D94833C9FB8']
    let templateParameters: Parameter[] =  [
        {
          ParameterKey: "UUID",
        },
        {
          ParameterKey: "Name",
        },
      ]

    const parameters = parseParameters(templateParameters, parameterOverrides)
    expect(parameters).toEqual([
      {
        ParameterKey: 'UUID',
        ParameterValue: '0F54400F-937E-46B9-8C4C-5D94833C9FB8'
      },
      {
        ParameterKey: 'Name',
        UsePreviousValue: true
      }
    ])
  })
})

describe('Validate Role ARN', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns valid arn', async () => {
    const roleArn = 'arn:aws:iam::111111111111:role/test'
    const returnedRoleArn = validateArn(roleArn)
    expect(returnedRoleArn).toEqual(roleArn)
  })

  test('throws invalid arn', async () => {
    const roleArn = 'arn:aws:ec2::111111111111:instance/i-abc123'
    expect(() => {validateArn(roleArn)}).toThrow(Error)
  })
})

describe('Cleanup Changeset', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCfnClient.reset()
  })

  test('successfully deletes changeset', async () => {
    mockCfnClient
      .on(DeleteChangeSetCommand)
      .resolves({})

    const cfnClient = new CloudFormationClient()
    await cleanupChangeset(cfnClient, 'test-changeset', 'test-stack')

    expect(mockCfnClient).toHaveReceivedCommandWith(
      DeleteChangeSetCommand,
      {
        ChangeSetName: 'test-changeset',
        StackName: 'test-stack'
      }
    )
  })

  test('handles deletion failure gracefully', async () => {
    const mockError = new Error('Changeset not found')
    mockCfnClient
      .on(DeleteChangeSetCommand)
      .rejects(mockError)

    const cfnClient = new CloudFormationClient()
    
    // Should not throw an error even if deletion fails
    await expect(cleanupChangeset(cfnClient, 'test-changeset', 'test-stack')).resolves.not.toThrow()

    expect(mockCfnClient).toHaveReceivedCommandWith(
      DeleteChangeSetCommand,
      {
        ChangeSetName: 'test-changeset',
        StackName: 'test-stack'
      }
    )
  })
})