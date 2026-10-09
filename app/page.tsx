import { redirect } from 'next/navigation';

/** REPS logins land on the agency overview; client logins are sent on to their Leads page from there. */
export default function Home() {
  redirect('/agency');
}
