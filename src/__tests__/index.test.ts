import { run, parseParameters, validateArn } from "../index"
import * as core from '@actions/core'
import { mockClient } from 'aws-sdk-client-mock'
import {
  StackStatus,
  ChangeSetStatus,
  CloudFormationClient,
  ExecuteChangeSetCommand,
  DescribeChangeSetCommand,
  CreateChangeSetCommand,
  DescribeStacksCommand,
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

  it("should update the stack with parameters", async () => {
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
      2,
      DescribeChangeSetCommand,
      {
        ChangeSetName: 'my-stack-changeset',
        StackName: 'my-stack'
      }
    )

    expect(mockCfnClient).toHaveReceivedNthCommandWith(
      3,
      ExecuteChangeSetCommand,
      {
        ChangeSetName: 'my-stack-changeset',
        StackName: 'my-stack'
      }
    )

    expect(mockCfnClient).toHaveReceivedNthCommandWith(
      4,
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

  test('returns parameters list from string', async () => {
    let input: string[] = ['UUID=0F54400F-937E-46B9-8C4C-5D94833C9FB8','Name=test']
    const parameters = parseParameters(input)
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