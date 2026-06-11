import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Submit Feedback | ChessBlunders',
  description: 'Help us improve ChessBlunders by sharing your feedback, bug reports, and feature requests.',
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
