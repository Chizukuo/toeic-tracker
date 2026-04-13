import { permanentRedirect } from 'next/navigation';

export default function UnfinishedRedirect() {
  permanentRedirect('/insights');
}
