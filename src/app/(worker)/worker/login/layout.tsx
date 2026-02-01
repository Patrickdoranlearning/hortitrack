/**
 * Worker Login Layout
 *
 * Simple layout without nav/header for the login page.
 * The main worker layout's auth protection will skip this route.
 */
export default function WorkerLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
