'use client'

import { Button } from '@/components/ui/button'

export default function LoginPage() {
  return (
    <div className='min-h-screen flex items-center justify-center p-6'>
      <div className='max-w-md w-full space-y-6 text-center'>
        <h1 className='text-2xl font-semibold'>Login to Jira Clone</h1>
        <p className='text-muted-foreground'>
          Connect your Atlassian account to continue.
        </p>
        <div>
          <a href='/api/auth/jira/login'>
            <Button size='lg' className='cursor-pointer'>
              Connect to Jira
            </Button>
          </a>
        </div>
        <p className='text-xs text-muted-foreground'>
          You will be redirected to Atlassian to grant access. After login,
          you&apos;ll come back here.
        </p>
      </div>
    </div>
  )
}
