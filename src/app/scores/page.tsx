import { permanentRedirect } from 'next/navigation';

export default function ScoresRedirect() {
  permanentRedirect('/insights');
}
