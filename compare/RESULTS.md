# Results

Measured 2026-10-22 with Chrome/155.0.0.0, Node v26.10.0. Medians of 5 runs (load) and 10 runs × 3 pages (runtime).

## Load on a slow phone

Fresh browser profile each run, Slow 4G (150 ms RTT, 1.6 Mbps) and 4× CPU slowdown. "Ready" = the page's real content is on screen (todos, stats, or table rows). "Blocking" = long-task time over 50 ms before ready. Lower is better; best per row in bold.

### Over HTTP/1.1

| `todo` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 26.7 | **6.2** | 67.2 | 26 |
| JS files | 11 | **1** | **1** | **1** |
| First paint (ms) | 692 | **484** | 788 | 588 |
| Ready (ms) | 628.2 | **420.9** | 743 | 530.7 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

| `crm` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 26.7 | **10.4** | 97.9 | 37.1 |
| JS files | 13 | **3** | 4 | 5 |
| First paint (ms) | 660 | **464** | 948 | 644 |
| Ready (ms) | 1140.8 | **794.9** | 1297.6 | 993 |
| Blocking (ms) | **0** | **0** | 2 | 38 |

| `crm/customers` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 27.2 | **10.8** | 98.3 | 37.6 |
| JS files | 13 | **3** | 4 | 5 |
| First paint (ms) | 656 | **468** | 952 | 656 |
| Ready (ms) | 1160.9 | **816.1** | 1343.6 | 1049.7 |
| Blocking (ms) | **0** | **0** | **0** | 42 |

### Over HTTP/2

| `todo` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 26.7 | **6.2** | 67.2 | 26 |
| JS files | 11 | **1** | **1** | **1** |
| First paint (ms) | 628 | **480** | 796 | 592 |
| Ready (ms) | 571.2 | **421.8** | 747.8 | 543.3 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

| `crm` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 26.7 | **10.4** | 97.9 | 37.1 |
| JS files | 13 | **3** | 4 | 5 |
| First paint (ms) | 596 | **468** | 956 | 648 |
| Ready (ms) | 1086.2 | **797.6** | 1307.8 | 1009.2 |
| Blocking (ms) | **0** | **0** | 5 | 39 |

| `crm/customers` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 27.2 | **10.8** | 98.3 | 37.6 |
| JS files | 13 | **3** | 4 | 5 |
| First paint (ms) | 600 | **468** | 964 | 652 |
| Ready (ms) | 1097.2 | **819** | 1359.3 | 1046.9 |
| Blocking (ms) | **0** | **0** | 12 | 36 |

## Runtime (ms, lower is better)

js-framework-benchmark-style operations on the bench app, desktop CPU. Time from click to DOM updated and laid out.

| Operation | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| create 1,000 rows | 56.3 | 51.5 | 55.5 | **49.6** |
| replace 1,000 rows | 59.9 | **54.7** | 56.6 | 57.5 |
| update every 10th row | 18.9 | 18.4 | **14.7** | 16.7 |
| select a row | 2.6 | 2.4 | **1.1** | 2.7 |
| swap two rows | **6.8** | 7.9 | 47.1 | 9.5 |
| remove a row | 11 | 9.7 | **4.7** | 9.3 |
| create 10,000 rows | 588.4 | **581.7** | 746.5 | 649.1 |
| append 1,000 rows | 70 | 60.6 | **58** | 64.8 |
| clear 1,000 rows | **6.3** | 7.3 | 8.8 | 8.1 |

### Mini before and after the optimization pass

Same session, old and new Mini alternated 6 times (medians), so session-to-session noise cancels out.

| Operation | Mini before | Mini after | change |
|---|---:|---:|---:|
| create 1,000 rows | 76.5 | 66.30000000000001 | -13% |
| replace 1,000 rows | 83.9 | 67.65 | -19% |
| update every 10th row | 23.25 | 21.4 | -8% |
| select a row | 1.5 | 2.2 | +47% |
| swap two rows | 59.599999999999994 | 7.75 | -87% |
| remove a row | 6.55 | 10.25 | +56% |
| create 10,000 rows | 799.75 | 681.1500000000001 | -15% |
| append 1,000 rows | 93.1 | 71 | -24% |
| clear 1,000 rows | 9.350000000000001 | 8 | -14% |

## Memory (JS heap, MB, lower is better)

| State | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| ready | 0.58 | **0.56** | 0.97 | 0.75 |
| 1,000 rows | 1.51 | **1.48** | 2.7 | 2.68 |
| 10,000 rows | 8.37 | **8.35** | 15.71 | 18.28 |
| after 5 create/clear | 0.79 | **0.76** | 1.76 | 1.59 |

## Code (lines of app code, without comments and blank lines)

| App | Mini | React | Vue |
|---|---:|---:|---:|
| todo | 108 | 106 | **91** |
| crm | **256** | 406 | 394 |
| bench | 87 | 91 | **82** |

## Developer experience

|  | Mini | React | Vue |
|---|---:|---:|---:|
| npm packages to install | 0 | 22 | 67 |
| node_modules size (MB) | 0 | 44 | 53 |
| Build step | none | Vite | Vite |
| Production build of the CRM (ms) | 0 | 304 | 199 |
| Config files | 0 | 1 (vite.config.js) | 1 (vite.config.js) |

## AI-friendliness

Two feature requests (spec in each task), identical text for every framework. One fresh AI agent per framework and task (same model, no memory of this project), each in its own copy, allowed to edit only that framework's CRM folder, with the same verification tools (build + existing flows). Mini's agents were also pointed to Mini's docs, since no model has Mini in its training data. Graded afterwards with hidden acceptance flows the agents never saw, plus the 11 existing flows for regressions. One run per cell: treat it as a signal, not a statistic.

| Task | Mini | React | Vue |
|---|---:|---:|---:|
| Sortable table: hidden tests passed | **4/4** | **4/4** | **4/4** |
| Sortable table: regressions | none | none | none |
| Sortable table: tokens / tool calls / time | 48.7k / 12 / 94 s | 37.8k / 9 / 75 s | 40.4k / 11 / 75 s |
| Sortable table: lines changed | 26 | 28 | 29 |
| Form rules + counter: hidden tests passed | **6/6** | **6/6** | **6/6** |
| Form rules + counter: regressions | none | none | none |
| Form rules + counter: tokens / tool calls / time | 56.2k / 13 / 105 s | 42.9k / 11 / 82 s | 41.9k / 13 / 116 s |
| Form rules + counter: lines changed | 18 | 10 | 11 |

- Every agent succeeded on its first try, including on Mini, which the model had never seen: its docs and checks were enough.
- Mini cost about 15-30% more tokens, mostly spent reading AGENTS.md and the README first.
- The Mini form agent made the live counter work by passing a function as a field hint, which worked but was undocumented (it needed a type cast). That is now an official, tested feature.
