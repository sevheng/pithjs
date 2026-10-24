import { define, html, provide } from 'pith';

// Makes its `value` available to inject('account') in every component inside it: the Shop's account layout
// (app/layouts/shop-account.js) puts { displayName } here, and the pages read it without it being passed down.
define(
  'account-context',
  (props, ctx) => {
    provide('account', props.value.value);
    return html`${ctx.children}`;
  },
  { props: ['value'] }
);
