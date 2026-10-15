'use client';

import { useCallback, useEffect, useState } from 'react';
import { backend } from '@/lib/backend';
import { campaignKey, type EmailCampaign } from '@/lib/emails/types';

/** One email campaign by key (the client id for launch emails), with a reload. undefined while loading, null if none. */
export function useCampaign(key: string | null | undefined) {
  const [campaign, setCampaign] = useState<EmailCampaign | null | undefined>(undefined);
  const reload = useCallback(async () => {
    if (!key) { setCampaign(null); return; }
    setCampaign(await backend.getEmails(key));
  }, [key]);
  useEffect(() => {
    setCampaign(undefined);
    reload().catch(() => setCampaign(null));
  }, [reload]);
  return { campaign, setCampaign, reload };
}

/** All of a client's email campaigns (launch emails, then follow-up flows), with the one being looked at. */
export function useCampaigns(clientId: string | null | undefined) {
  const [all, setAll] = useState<EmailCampaign[] | undefined>(undefined);
  const [key, setKey] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!clientId) { setAll([]); return; }
    const list = await backend.listEmails(clientId);
    setAll(list);
    setKey((k) => (k && list.some((c) => campaignKey(c) === k) ? k : list[0] ? campaignKey(list[0]) : null));
  }, [clientId]);
  useEffect(() => {
    setAll(undefined);
    setKey(null);
    reload().catch(() => setAll([]));
  }, [reload]);
  const campaign = all === undefined ? undefined : all.find((c) => campaignKey(c) === key) ?? null;
  return { all, campaign, key, setKey, reload };
}
