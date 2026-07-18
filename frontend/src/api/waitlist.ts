import client from './client';

/** Join the pre-launch waitlist. The backend answers the same way whether or
 *  not the address was already on the list, so there's nothing to branch on. */
export const joinWaitlist = async (email: string, source: string): Promise<void> => {
  await client.post('/waitlist', { email, source });
};
