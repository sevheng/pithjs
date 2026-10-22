import { Link } from 'react-router';

export function Component() {
  return (
    <section className="section narrow">
      <h1>Page not found</h1>
      <Link className="btn primary" to="/">Go to dashboard</Link>
    </section>
  );
}
