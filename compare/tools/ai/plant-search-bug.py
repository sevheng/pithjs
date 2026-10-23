# Plants the same search bug in one CRM implementation: the query only updates from 2 characters on,
# so clearing the box (or a one-letter search) leaves the old query in the app's state.
import pathlib, sys
compare, impl = pathlib.Path(sys.argv[1]), sys.argv[2]
COMMENT = 'Search from 2 characters on: one letter matches almost everyone and only adds requests.'
def edit(rel, pairs):
    p = compare / rel; s = p.read_text()
    for a, b in pairs:
        assert s.count(a) == 1, (rel, a); s = s.replace(a, b)
    p.write_text(s)
if impl == 'pith':
    edit('crm/pith/app/pages/customers.js', [
        ("  const status = signal('all');\n",
         f"  const status = signal('all');\n  // {COMMENT}\n  const onSearch = (value) => {{\n    if (value.trim().length >= 2) q.value = value;\n  }};\n"),
        ("@input=${(e) => (q.value = e.target.value)}>", "@input=${(e) => onSearch(e.target.value)}>"),
    ])
elif impl == 'react':
    edit('crm/react/src/pages/Customers.jsx', [
        ("  const [status, setStatus] = useState('all');\n",
         f"  const [status, setStatus] = useState('all');\n  // {COMMENT}\n  const onSearch = (value) => {{\n    if (value.trim().length >= 2) setQ(value);\n  }};\n"),
        ("value={q} onChange={(e) => setQ(e.target.value)} />", "defaultValue={q} onChange={(e) => onSearch(e.target.value)} />"),
    ])
elif impl == 'vue':
    edit('crm/vue/src/pages/Customers.vue', [
        ("const status = ref('all');\n",
         f"const status = ref('all');\n// {COMMENT}\nfunction onSearch(value) {{\n  if (value.trim().length >= 2) q.value = value;\n}}\n"),
        ('<input id="search" v-model="q" class="input"', '<input id="search" :value="q" @input="onSearch($event.target.value)" class="input"'),
    ])
