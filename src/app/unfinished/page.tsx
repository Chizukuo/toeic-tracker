import { redirect } from 'next/navigation';

export default function UnfinishedRedirect() {
  redirect('/insights');
}