# Results

Measured 2026-10-23 with Chrome/155.0.0.0, Node v26.10.0. Medians of 9 runs (load) and 10 runs × 3 pages (runtime).

## Load on a slow phone

Fresh browser profile each run, Slow 4G (150 ms RTT, 1.6 Mbps) and 4× CPU slowdown. "Ready" = the page's real content is on screen (todos, stats, or table rows). "Blocking" = long-task time over 50 ms before ready. Lower is better; best per row in bold.

### Over HTTP/1.1

| `todo` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 10.8 | **6.7** | 67.2 | 26 |
| JS files | 3 | **1** | **1** | **1** |
| First paint (ms) | **528** | **528** | 808 | 600 |
| Ready (ms) | 457.9 | **454.9** | 757.1 | 539.9 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

| `crm` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | **10.7** | 11 | 97.9 | 37.1 |
| JS files | 5 | **3** | 4 | 5 |
| First paint (ms) | 488 | **484** | 956 | 644 |
| Ready (ms) | 973.3 | **813.6** | 1307.3 | 1005.6 |
| Blocking (ms) | **0** | **0** | 3 | 38 |

| `crm/customers` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | **11.3** | 11.4 | 98.3 | 37.6 |
| JS files | 5 | **3** | 4 | 5 |
| First paint (ms) | 504 | **484** | 1004 | 648 |
| Ready (ms) | 1009.2 | **836.4** | 1468.1 | 1045.8 |
| Blocking (ms) | **0** | **0** | 35 | 39 |

### Over HTTP/2

| `todo` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 10.8 | **6.7** | 67.2 | 26 |
| JS files | 3 | **1** | **1** | **1** |
| First paint (ms) | 564 | **536** | 812 | 596 |
| Ready (ms) | 486.8 | **458.8** | 760.8 | 538.7 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

| `crm` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | **10.7** | 11 | 97.9 | 37.1 |
| JS files | 5 | **3** | 4 | 5 |
| First paint (ms) | **488** | 492 | 976 | 656 |
| Ready (ms) | 976 | **816.7** | 1324.4 | 1013.7 |
| Blocking (ms) | **0** | **0** | 13 | 38 |

| `crm/customers` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | **11.3** | 11.4 | 98.3 | 37.6 |
| JS files | 5 | **3** | 4 | 5 |
| First paint (ms) | 504 | **496** | 988 | 668 |
| Ready (ms) | 1017.3 | **838** | 1396.8 | 1058.6 |
| Blocking (ms) | **0** | 3 | 12 | 46 |

## Runtime (ms, lower is better)

js-framework-benchmark-style operations on the bench app, desktop CPU. Time from click to DOM updated and laid out.

| Operation | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| create 1,000 rows | 45.2 | 46.2 | 47 | **44.2** |
| replace 1,000 rows | 52.7 | 53.3 | 53.4 | **51.4** |
| update every 10th row | 17.6 | 18.7 | **13** | 14.6 |
| select a row | **0.3** | **0.3** | 1.3 | 2.4 |
| swap two rows | 5 | **4.9** | 42.4 | 7.5 |
| remove a row | **4** | 4.4 | 4.3 | 7.9 |
| create 10,000 rows | 568.4 | 563.3 | 727.9 | **533.8** |
| append 1,000 rows | 57.4 | 56.4 | 53.2 | **53** |
| clear 1,000 rows | 6.3 | **6.2** | 7.7 | 7.2 |

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
| ready | 0.59 | **0.56** | 0.97 | 0.75 |
| 1,000 rows | 1.61 | **1.57** | 2.7 | 2.68 |
| 10,000 rows | 9.24 | **9.22** | 15.71 | 18.28 |
| after 5 create/clear | 0.79 | **0.76** | 1.76 | 1.59 |

## Code (lines of app code, without comments and blank lines)

| App | Mini | React | Vue |
|---|---:|---:|---:|
| todo | 109 | 106 | **91** |
| crm | **257** | 406 | 394 |
| bench | 89 | 91 | **82** |

## Developer experience

|  | Mini | React | Vue |
|---|---:|---:|---:|
| npm packages to install | 0 | 22 | 67 |
| node_modules size (MB) | 0 | 44 | 53 |
| Build step | none | Vite | Vite |
| Production build of the CRM (ms) | 0 | 295 | 189 |
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
| Round 2 · Search bug fix: hidden tests passed | **3/3** | **3/3** | **3/3** |
| Round 2 · Search bug fix: regressions | none | none | none |
| Round 2 · Search bug fix: tokens / tool calls / time | 34.4k / 5 / 28 s | 33.1k / 4 / 25 s | 33.1k / 5 / 26 s |
| Round 2 · Search bug fix: lines changed | 6 | 6 | 4 |
| Round 2 · Sortable table (Mini only): hidden tests / tokens / tool calls / time | **4/4** · 51.5k / 11 / 63 s | – | – |
| Round 2 · Form rules + counter (Mini only): hidden tests / tokens / tool calls / time | **6/6** · 48.2k / 10 / 54 s | – | – |

- Every agent succeeded on its first try, including on Mini, which the model had never seen: its docs and checks were enough.
- Mini cost about 15-30% more tokens, mostly spent reading AGENTS.md and the README first.
- The Mini form agent made the live counter work by passing a function as a field hint, which worked but was undocumented (it needed a type cast). That is now an official, tested feature.
- Round 2 (2026-10-22, after Mini gained --state and the state block in failing flows; AGENTS.md grew from 244 to 316 lines). Same setup, one run per cell. Bug task: the same planted bug in all three CRMs (search only updated from 2 characters, so clearing the box kept the list filtered), a visible reproduction flow, graded with hidden flows (clearing restores all, one-letter search filters, search + status combine). Failing Mini flows showed `q = "ada"` under an empty search box; React and Vue showed only the page outline.
- Bug task result: all three fixed it the same way (removed the 2-character rule, citing the spec) in 4–5 tool calls, at about the same cost (Mini +4%). The bug was found by reading one short file, so the state output had no room to help; a bigger app or a bug spread over several files would be a fairer test of it.
- Mini re-run of the old tasks: sortable table 51.5k tokens (was 48.7k), form 48.2k (was 56.2k): no clear change from the bigger AGENTS.md. Round 1's React and Vue numbers came from an earlier session, possibly another model, so don't compare these Mini numbers with them directly. Times also aren't comparable across sessions.
