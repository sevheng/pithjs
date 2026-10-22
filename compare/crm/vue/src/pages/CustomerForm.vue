<script setup>
import { reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { fetchJSON } from '../lib/api.js';
import Field from '../components/Field.vue';

const props = defineProps({ customer: { type: Object, default: null } });

const EMPTY = { name: '', email: '', company: '', phone: '', status: 'lead', notes: '' };
const FIELDS = Object.keys(EMPTY);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RULES = {
  name: (v) => (!v.trim() ? 'This field is required' : v.trim().length < 2 ? 'Use at least 2 characters' : null),
  email: (v) => (!v.trim() ? 'This field is required' : !EMAIL.test(v.trim()) ? 'Enter a valid email address' : null),
};

const router = useRouter();
const values = reactive(props.customer ? Object.fromEntries(FIELDS.map((f) => [f, props.customer[f] ?? ''])) : { ...EMPTY });
const touched = reactive({});
const attempted = ref(false);
const serverErrors = ref({});
const submitting = ref(false);
const submitError = ref(null);
const els = {};

const errorOf = (name) => serverErrors.value[name] ?? RULES[name]?.(values[name]) ?? null;
const shown = (name) => (touched[name] || attempted.value ? errorOf(name) : null);
const invalid = (name) => (shown(name) ? 'true' : undefined);
const edited = (name) => {
  if (serverErrors.value[name]) serverErrors.value = { ...serverErrors.value, [name]: undefined };
};

async function submit() {
  if (submitting.value) return;
  attempted.value = true;
  submitError.value = null;
  serverErrors.value = {};
  const firstInvalid = FIELDS.find((n) => RULES[n]?.(values[n]));
  if (firstInvalid) {
    els[firstInvalid]?.focus();
    return;
  }
  submitting.value = true;
  try {
    const saved = await fetchJSON(props.customer ? `/api/customers/${props.customer.id}` : '/api/customers', {
      method: props.customer ? 'PUT' : 'POST',
      json: { ...values },
    });
    router.push(`/customers/${saved.id}`);
  } catch (err) {
    const fieldErrors = err?.body?.errors;
    if (fieldErrors) {
      serverErrors.value = fieldErrors;
      els[FIELDS.find((n) => fieldErrors[n])]?.focus();
    } else {
      submitError.value = err;
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form class="card form" novalidate @submit.prevent="submit">
    <Field id="f-name" label="Name" :error="shown('name')">
      <input id="f-name" :ref="(el) => (els.name = el)" v-model="values.name" name="name" class="input" autocomplete="name"
             :aria-invalid="invalid('name')" aria-describedby="f-name-error" @blur="touched.name = true" @input="edited('name')">
    </Field>
    <Field id="f-email" label="Email" :error="shown('email')">
      <input id="f-email" :ref="(el) => (els.email = el)" v-model="values.email" name="email" type="email" class="input" autocomplete="email"
             :aria-invalid="invalid('email')" aria-describedby="f-email-error" @blur="touched.email = true" @input="edited('email')">
    </Field>
    <Field id="f-company" label="Company" :error="shown('company')">
      <input id="f-company" v-model="values.company" name="company" class="input"
             :aria-invalid="invalid('company')" aria-describedby="f-company-error" @blur="touched.company = true" @input="edited('company')">
    </Field>
    <Field id="f-phone" label="Phone" :error="shown('phone')">
      <input id="f-phone" v-model="values.phone" name="phone" type="tel" class="input"
             :aria-invalid="invalid('phone')" aria-describedby="f-phone-error" @blur="touched.phone = true" @input="edited('phone')">
    </Field>
    <Field id="f-status" label="Status" :error="shown('status')">
      <select id="f-status" v-model="values.status" name="status" class="input"
              :aria-invalid="invalid('status')" aria-describedby="f-status-error" @blur="touched.status = true" @change="edited('status')">
        <option value="lead">Lead</option>
        <option value="active">Active</option>
        <option value="churned">Churned</option>
      </select>
    </Field>
    <Field id="f-notes" label="Notes" :error="shown('notes')">
      <textarea id="f-notes" v-model="values.notes" name="notes" class="input" rows="4"
                :aria-invalid="invalid('notes')" aria-describedby="f-notes-error" @blur="touched.notes = true" @input="edited('notes')" />
    </Field>
    <p v-if="submitError" class="form-error" role="alert">Couldn't save. {{ submitError.message }}</p>
    <div class="row">
      <button class="btn primary" type="submit" :disabled="submitting">{{ submitting ? 'Saving…' : 'Save' }}</button>
      <RouterLink class="btn ghost" :to="customer ? `/customers/${customer.id}` : '/customers'">Cancel</RouterLink>
    </div>
  </form>
</template>
