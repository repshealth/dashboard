'use client';

import { useCallback, useEffect, useState } from 'react';
import { backend } from '@/lib/backend';
import type { EmailCampaign } from '@/lib/emails/types';

/** One client's launch emails, with a reload. undefined while loading, null if there are none. */
export function useCampaign(clientId: string | null | undefined) {
  const [campaign, setCampaign] = useState<EmailCampaign | null | undefined>(undefined);
  const reload = useCallback(async () => {
    if (!clientId) { setCampaign(null); return; }
    setCampaign(await backend.getEmails(clientId));
  }, [clientId]);
  useEffect(() => {
    setCampaign(undefined);
    reload().catch(() => setCampaign(null));
  }, [reload]);
  return { campaign, setCampaign, reload };
}
