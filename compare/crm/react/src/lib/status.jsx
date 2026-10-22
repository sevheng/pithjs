export function Loading() {
  return <p className="loading" role="status">Loading…</p>;
}

export function LoadError({ error, retry }) {
  return (
    <div className="load-error" role="alert">
      <p>Couldn't load this. {error.message}</p>
      <button className="btn" type="button" onClick={retry}>Try again</button>
    </div>
  );
}
