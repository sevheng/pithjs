import { define, html, provide } from 'pith';

// Makes its `value` available to inject('settings') in every component inside it.
define(
  'settings-context',
  (props, ctx) => {
    provide('settings', props.value.value);
    return html`${ctx.children}`;
  },
  { props: ['value'] }
);
