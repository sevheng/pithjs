import { html, resource, fetchJSON } from 'mini';

/** @param {{ id: string }} params */
export default function MemberPage({ id }) {
  // null when there's no one with this id (the API answers 404). Other errors show the usual retry view.
  const person = resource(({ signal }) =>
    fetchJSON(`/api/team?id=${encodeURIComponent(id)}`, { signal }).catch((err) => {
      if (err.status === 404) return null;
      throw err;
    })
  );

  return html`
    <section class="section narrow">
      <p><a href="/team">← Team</a></p>
      ${person.render((p) => p
        ? html`
          <h1>${p.name}</h1>
          <p class="lead">${p.role}</p>`
        : html`
          <h1>No such person</h1>
          <p class="lead">No one on the team has the id <code>${id}</code>.</p>`)}
    </section>
  `;
}
