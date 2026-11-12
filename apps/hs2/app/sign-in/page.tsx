'use client';

import { useState, useTransition } from 'react';
import { Button, Card, Container, Field, Heading, Input, Stack, Text } from '@chakra-ui/react';

import { signInWithOtp } from './actions';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await signInWithOtp(email);
        setSent(true);
      } catch {
        setError('Could not send the sign-in link. Check the address and try again.');
      }
    });
  };

  return (
    <Container maxW='md' py={16}>
      <Card.Root variant='elevated'>
        <Card.Body>
          <Stack gap={6}>
            <Stack gap={1}>
              <Heading size='lg'>Admin sign-in</Heading>
              <Text color='fg.muted' fontSize='sm'>
                Enter your email and we will send you a one-time sign-in link.
              </Text>
            </Stack>

            {sent ? (
              <Text>
                Check your email. We sent a sign-in link to <b>{email}</b>.
              </Text>
            ) : (
              <form onSubmit={onSubmit}>
                <Stack gap={4}>
                  <Field.Root invalid={error !== null} required>
                    <Field.Label>Email address</Field.Label>
                    <Input
                      type='email'
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder='you@example.com'
                      autoComplete='email'
                    />
                    {error && <Field.ErrorText>{error}</Field.ErrorText>}
                  </Field.Root>
                  <Button type='submit' loading={pending} disabled={email.trim() === ''}>
                    Send sign-in link
                  </Button>
                </Stack>
              </form>
            )}
          </Stack>
        </Card.Body>
      </Card.Root>
    </Container>
  );
}
